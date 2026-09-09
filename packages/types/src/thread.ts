export interface ThreadPost {
  id: string;
  externalId: string;
  authorUsername: string;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  content: string;
  mediaUrls: string[];
  likeCount: number;
  replyCount: number;
  repostCount: number;
  sourceUrl: string;
  publishedAt: string | null;
  relevanceScore: number | null;
  affiliateScore: number | null;
  crawledAt: string;
  topicId: string;
}

export interface CrawledPost {
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

export interface ThreadPostList {
  posts: ThreadPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
