import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../jobs/redis.service";
import { CrawlJobData } from "./crawl.types";

export const CRAWL_QUEUE = "crawl";

@Injectable()
export class CrawlService {
  private readonly queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    redis: RedisService,
  ) {
    this.queue = new Queue(CRAWL_QUEUE, { connection: redis.client });
  }

  async enqueue(topicId: string, keyword: string, limit: number) {
    const job = await this.prisma.crawlJob.create({
      data: { topicId, status: "QUEUED" },
    });
    try {
      await this.queue.add(
        "search",
        { dbJobId: job.id, topicId, keyword, limit } satisfies CrawlJobData,
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      );
    } catch (err) {
      await this.prisma.crawlJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: `Failed to enqueue: ${
            err instanceof Error ? err.message : String(err)
          }`,
          finishedAt: new Date(),
        },
      });
      throw new BadGatewayException("Failed to enqueue crawl job");
    }
    return job;
  }

  async getJob(id: string) {
    const job = await this.prisma.crawlJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException("Crawl job not found");
    }
    return job;
  }

  async updateProgress(id: string, progress: number, total: number) {
    const job = await this.prisma.crawlJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException("Crawl job not found");
    }
    return this.prisma.crawlJob.update({
      where: { id },
      data: { progress, total },
    });
  }
}
