import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../jobs/redis.service";
import { CrawlJobData, CrawlResult } from "./crawl.types";
import { CRAWL_QUEUE } from "./crawl.service";

@Injectable()
export class CrawlWorker implements OnModuleDestroy {
  private readonly logger = new Logger(CrawlWorker.name);
  private readonly worker: Worker;

  constructor(
    config: ConfigService,
    prisma: PrismaService,
    redis: RedisService,
  ) {
    this.worker = new Worker<CrawlJobData>(
      CRAWL_QUEUE,
      async (job) => {
        const { dbJobId, topicId, keyword, limit } = job.data;
        const timeout = Number(config.get("CRAWLER_TIMEOUT") ?? 60);
        await prisma.crawlJob.update({
          where: { id: dbJobId },
          data: { status: "RUNNING", startedAt: new Date() },
        });
        let result: CrawlResult;
        try {
          const res = await fetch(
            `${config.get("CRAWLER_API_URL")}/crawl`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ keyword, limit }),
              signal: AbortSignal.timeout(timeout * 1000),
            },
          );
          if (!res.ok) {
            throw new Error(`Crawler responded ${res.status}`);
          }
          result = (await res.json()) as CrawlResult;
        } catch (err) {
          await prisma.crawlJob.update({
            where: { id: dbJobId },
            data: {
              status: "FAILED",
              error: err instanceof Error ? err.message : String(err),
              finishedAt: new Date(),
            },
          });
          throw err;
        }
        await this.persistPosts(prisma, topicId, result);
        await prisma.crawlJob.update({
          where: { id: dbJobId },
          data: {
            status: "COMPLETED",
            progress: 100,
            total: result.posts.length,
            finishedAt: new Date(),
          },
        });
        this.logger.log(
          `Job ${dbJobId} completed with ${result.posts.length} posts`,
        );
      },
      { connection: redis.client, concurrency: 1 },
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
  }

  private async persistPosts(
    prisma: PrismaService,
    topicId: string,
    result: CrawlResult,
  ) {
    await prisma.$transaction(
      result.posts.map((p) =>
        prisma.threadPost.upsert({
          where: {
            topicId_externalId: { topicId, externalId: p.externalId },
          },
          create: {
            topicId,
            externalId: p.externalId,
            authorUsername: p.authorUsername,
            authorDisplayName: p.authorDisplayName ?? null,
            authorAvatarUrl: p.authorAvatarUrl ?? null,
            content: p.content,
            mediaUrls: p.mediaUrls ?? [],
            likeCount: p.likeCount ?? 0,
            replyCount: p.replyCount ?? 0,
            repostCount: p.repostCount ?? 0,
            sourceUrl: p.sourceUrl,
            relevanceScore: p.relevanceScore ?? null,
            affiliateScore: p.affiliateScore ?? null,
          },
          update: {
            authorDisplayName: p.authorDisplayName ?? null,
            authorAvatarUrl: p.authorAvatarUrl ?? null,
            content: p.content,
            mediaUrls: p.mediaUrls ?? [],
            likeCount: p.likeCount ?? 0,
            replyCount: p.replyCount ?? 0,
            repostCount: p.repostCount ?? 0,
            sourceUrl: p.sourceUrl,
            // undefined omits the field from UPDATE: a re-crawl without scores
            // keeps the stored ones instead of wiping them
            relevanceScore: p.relevanceScore ?? undefined,
            affiliateScore: p.affiliateScore ?? undefined,
          },
        }),
      ),
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
