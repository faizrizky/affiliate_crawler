export type AffiliateContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface AffiliateContent {
  id: string;
  product: string;
  category: string | null;
  context: string | null;
  affiliateLink: string | null;
  content: string;
  status: AffiliateContentStatus;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  topicId: string | null;
}

export interface AffiliateContentListItem extends AffiliateContent {
  template: {
    id: string;
    name: string;
  };
}

export interface AffiliateContentUpdateInput {
  product?: string;
  category?: string;
  context?: string;
  affiliateLink?: string;
  content?: string;
  status?: AffiliateContentStatus;
}

export interface AffiliateGenerateInput {
  templateId: string;
  topicId?: string;
  product: string;
  category?: string;
  context?: string;
  affiliateLink?: string;
}
