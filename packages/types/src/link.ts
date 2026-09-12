export interface AffiliateLink {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
}

export interface AffiliateLinkListItem extends AffiliateLink {
  /** Jumlah template & draft yang akan kehilangan referensi kalau link dihapus. */
  _count: {
    templates: number;
    affiliateContents: number;
  };
}

export interface AffiliateLinkListResult {
  links: AffiliateLinkListItem[];
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
