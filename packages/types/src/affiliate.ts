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
  /** Diisi saat draft benar-benar terbit (auto-publish atau ditandai manual). */
  publishedAt: string | null;
  /** URL post asli di Threads, hanya ada kalau auto-publish menemukannya. */
  postUrl: string | null;
  /** Kapan job auto-publish mencocokkan draft ini. */
  autoPublishedAt: string | null;
  /** Link post balasan yang di-paste user; username-nya dipakai auto-publish. */
  replyLink: string | null;
  templateId: string;
  topicId: string | null;
  threadPostId: string | null;
  linkId: string | null;
}

export interface AffiliateContentListItem extends AffiliateContent {
  template: {
    id: string;
    name: string;
    /** Untuk filter kategori di Reply Queue. */
    categoryId: string | null;
  };
  /** null kalau link-nya sudah dihapus; affiliateLink menyimpan URL snapshot. */
  link: {
    id: string;
    name: string;
    url: string;
  } | null;
  threadPost: {
    id: string;
    sourceUrl: string;
    authorUsername: string;
    authorDisplayName: string | null;
    authorAvatarUrl: string | null;
    content: string;
  } | null;
}

export interface AffiliateContentUpdateInput {
  replyLink?: string;
  product?: string;
  category?: string;
  context?: string;
  affiliateLink?: string;
  content?: string;
  status?: AffiliateContentStatus;
}

export interface AffiliateGenerateInput {
  templateId: string;
  /** Urutan = nomor placeholder. Kosong -> link yang terpasang di template. */
  linkIds: string[];
  topicId?: string;
  threadPostId?: string;
  product: string;
  category?: string;
  context?: string;
}

export interface AffiliateGenerateBatchInput {
  templateId: string;
  /** Urutan = nomor placeholder. Kosong -> link yang terpasang di template. */
  linkIds: string[];
  threadPostIds: string[];
  topicId?: string;
  product: string;
  category?: string;
  context?: string;
}

export interface AffiliateGenerateBatchResult {
  created: AffiliateContent[];
  skippedIds: string[];
}
