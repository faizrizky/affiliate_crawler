import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../jobs/redis.service";
import { fuzzyMatch, mentionsProduct } from "./fuzzy-match";

export const AUTO_PUBLISH_QUEUE = "auto-publish";

/** "https://www.threads.com/@budi/post/abc" -> "budi". */
export function usernameFromReplyLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const match = /threads\.(?:com|net)\/@([\w.]+)/i.exec(link);
  return match ? match[1].toLowerCase() : null;
}

type OwnPost = { text: string; postUrl: string; createdAt: string | null };

export type AutoPublishResult = {
  checked: number;
  matched: number;
  accounts?: number;
  skipped?: "no-drafts";
  error?: string;
};

@Injectable()
export class AutoPublishService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoPublishService.name);
  private readonly queue: Queue;
  private readonly worker: Worker;
  private readonly crawlerUrl: string;
  private readonly threshold: number;
  private readonly windowHours: number;
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    redis: RedisService,
  ) {
    this.crawlerUrl = config.get("CRAWLER_API_URL") ?? "http://localhost:8001";
    this.threshold = Number(config.get("AUTO_PUBLISH_THRESHOLD") ?? 0.85);
    this.windowHours = Number(config.get("AUTO_PUBLISH_WINDOW_HOURS") ?? 24);
    this.intervalMs = Number(config.get("AUTO_PUBLISH_INTERVAL_MS") ?? 120_000);


    this.queue = new Queue(AUTO_PUBLISH_QUEUE, { connection: redis.client });
    this.worker = new Worker(
      AUTO_PUBLISH_QUEUE,
      async () => this.checkAndPublishDrafts(),
      { connection: redis.client, concurrency: 1 },
    );
    this.worker.on("failed", (job, err) =>
      // Job gagal tidak boleh mematikan siklus; cycle berikutnya mencoba lagi.
      this.logger.warn(`auto-publish cycle failed: ${err?.message ?? job?.id}`),
    );
  }

  async onModuleInit() {
    if (this.config.get("AUTO_PUBLISH_ENABLED") === "false") {
      this.logger.log("auto-publish disabled (AUTO_PUBLISH_ENABLED=false)");
      return;
    }
    // BullMQ 6: repeatable job dipasang lewat job scheduler, bukan opsi `repeat`.
    await this.queue.upsertJobScheduler(
      "auto-publish-cycle",
      { every: this.intervalMs },
      { name: "cycle", opts: { removeOnComplete: 20, removeOnFail: 20 } },
    );
    this.logger.log(`auto-publish scheduled every ${this.intervalMs / 1000}s`);
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.queue.close();
  }

  /** Satu siklus: cocokkan draft yang menunggu dengan post asli di profil. */
  async checkAndPublishDrafts(): Promise<AutoPublishResult> {
    const drafts = await this.getPendingDrafts();
    // Antrean kosong -> tidak membuka Threads sama sekali. Ini yang menjaga
    // jumlah request harian tetap rendah saat tidak ada yang ditunggu.
    if (drafts.length === 0) {
      return { checked: 0, matched: 0, skipped: "no-drafts" };
    }

    // Kelompokkan per akun Threads: satu crawl per username unik per siklus,
    // bukan per draft — semua request lewat SATU sesi login crawler.
    const byUsername = new Map<string, typeof drafts>();
    for (const draft of drafts) {
      const username =
        usernameFromReplyLink(draft.replyLink) ?? draft.user.threadsUsername;
      if (!username) continue; // user belum mengisi akun Threads-nya
      const key = username.replace(/^@/, "").toLowerCase();
      byUsername.set(key, [...(byUsername.get(key) ?? []), draft]);
    }

    let matched = 0;
    const errors: string[] = [];
    for (const [username, group] of byUsername) {
      let posts: OwnPost[];
      try {
        posts = await this.fetchPosts(username);
      } catch (err) {
        // Satu akun gagal tidak boleh menghentikan akun lain di siklus yang sama.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`could not read posts of @${username}: ${message}`);
        errors.push(`@${username}: ${message}`);
        continue;
      }
      for (const draft of group) {
        const post = posts.find(
          (p) =>
            mentionsProduct(draft.product, p.text) &&
            fuzzyMatch(draft.content, p.text, this.threshold),
        );
        if (!post) continue;
        // Draft kembar semuanya ikut terbit saat satu post cocok.
        await this.markPublished(draft.id, post.postUrl, post.createdAt);
        matched += 1;
      }
    }

    if (matched > 0) {
      this.logger.log(`auto-published ${matched} draft (dari ${drafts.length} menunggu)`);
    }
    return {
      checked: drafts.length,
      matched,
      accounts: byUsername.size,
      ...(errors.length ? { error: errors.join("; ") } : {}),
    };
  }

  private getPendingDrafts() {
    const since = new Date(Date.now() - this.windowHours * 3600_000);
    return this.prisma.affiliateContent.findMany({
      where: { status: "DRAFT", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        product: true,
        replyLink: true,
        user: { select: { threadsUsername: true } },
      },
    });
  }

  private async fetchPosts(username: string): Promise<OwnPost[]> {
    // API tidak pernah menjalankan Playwright sendiri: sesi browser tetap milik
    // service crawler, di sini cuma panggilan HTTP.
    const res = await fetch(
      `${this.crawlerUrl}/crawl/profile/${encodeURIComponent(username)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_hours: this.windowHours, limit: 30 }),
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      throw new Error(body.code ?? `crawler responded ${res.status}`);
    }
    const data = (await res.json()) as { posts?: OwnPost[] };
    return data.posts ?? [];
  }

  private async markPublished(
    id: string,
    postUrl: string,
    postPublishedAt: string | null,
  ) {
    const publishedAt = postPublishedAt ? new Date(postPublishedAt) : new Date();
    await this.prisma.affiliateContent.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        postUrl,
        publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        autoPublishedAt: new Date(),
      },
    });
  }
}
