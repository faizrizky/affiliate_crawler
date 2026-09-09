export type CrawlJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface CrawlJob {
  id: string;
  status: CrawlJobStatus;
  progress: number;
  total: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  topicId: string;
}

export interface SearchInput {
  keyword: string;
  limit?: number;
}

export interface SearchResponse {
  topicId: string;
  jobId: string;
  status: CrawlJobStatus;
}
