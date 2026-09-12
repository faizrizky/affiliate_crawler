export interface AffiliateLink {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
}

export interface AffiliateLinkListResult {
  links: AffiliateLink[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AffiliateLinkInput {
  name: string;
  url: string;
}

export type AffiliateLinkUpdateInput = Partial<AffiliateLinkInput>;
