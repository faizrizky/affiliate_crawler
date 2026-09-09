export type TopicStatus = "ACTIVE" | "ARCHIVED";

export interface Topic {
  id: string;
  keyword: string;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
  postCount: number;
  lastJobStatus: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | null;
}
