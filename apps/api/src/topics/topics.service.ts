import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CrawlService } from "../crawl/crawl.service";

@Injectable()
export class TopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crawl: CrawlService,
  ) {}

  async list() {
    const topics = await this.prisma.topic.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { posts: true } },
        crawlJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return topics.map(({ _count, crawlJobs, ...topic }) => ({
      ...topic,
      postCount: _count.posts,
      lastJobStatus: crawlJobs[0]?.status ?? null,
    }));
  }

  async delete(id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) {
      throw new NotFoundException("Topic not found");
    }
    await this.prisma.topic.delete({ where: { id } });
  }

  async get(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        crawlJobs: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { posts: true } },
      },
    });
    if (!topic) {
      throw new NotFoundException("Topic not found");
    }
    return topic;
  }

  async getPosts(id: string, page: number, pageSize: number) {
    const topic = await this.prisma.topic.findUnique({ where: { id } });
    if (!topic) {
      throw new NotFoundException("Topic not found");
    }
    // Top post Threads jarang dari hari ini, jadi jangan filter per tanggal:
    // tampilkan semua post hasil crawl yang benar-benar match keyword
    // (score > 0), diurutkan relevansi dulu lalu yang terbaru.
    const where = {
      topicId: id,
      relevanceScore: { gt: 0 },
    };
    const [posts, total] = await Promise.all([
      this.prisma.threadPost.findMany({
        where,
        orderBy: [
          { relevanceScore: { sort: "desc", nulls: "last" } },
          { publishedAt: { sort: "desc", nulls: "last" } },
          { crawledAt: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.threadPost.count({ where }),
    ]);
    return {
      posts,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async search(keyword: string, limit: number, userId: string) {
    const existing = await this.prisma.topic.findFirst({
      where: { keyword: { equals: keyword.trim(), mode: "insensitive" } },
    });
    const topic =
      existing ??
      (await this.prisma.topic.create({ data: { keyword, userId } }));
    const activeJob = await this.prisma.crawlJob.findFirst({
      where: { topicId: topic.id, status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (activeJob) {
      return {
        topicId: topic.id,
        jobId: activeJob.id,
        status: activeJob.status,
      };
    }
    const job = await this.crawl.enqueue(topic.id, keyword, limit);
    return { topicId: topic.id, jobId: job.id, status: job.status };
  }
}
