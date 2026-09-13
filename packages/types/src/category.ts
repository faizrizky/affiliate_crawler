export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CategoryListItem extends Category {
  /** Template yang kehilangan kategori (jadi tanpa kategori) kalau ini dihapus. */
  _count: { templates: number; links: number };
}
