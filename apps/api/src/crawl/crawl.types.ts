export interface CrawlJobData {
  dbJobId: string;
  topicId: string;
  keyword: string;
  limit: number;
}

export interface CrawlerPost {
  externalId: string;
  authorUsername: string;
  authorDisplayName?: string | null;
  authorAvatarUrl?: string | null;
  content: string;
  mediaUrls: string[];
  likeCount: number;
  replyCount: number;
  repostCount: number;
  sourceUrl: string;
  relevanceScore?: number | null;
  affiliateScore?: number | null;
}

export interface CrawlResult {
  posts: CrawlerPost[];
}
