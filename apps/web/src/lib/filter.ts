/** Nilai opsi filter untuk item tanpa kategori. */
export const UNCATEGORIZED = "none";

/**
 * OR di dalam satu filter: lolos kalau nilainya salah satu yang dipilih.
 * Tanpa pilihan = tidak memfilter. null/undefined dicocokkan ke UNCATEGORIZED.
 */
export function matchesAny(value: string | null | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(value ?? UNCATEGORIZED);
}

/** Buang pilihan yang opsinya sudah tidak ada (mis. kategori yang dihapus). */
export function keepKnown(selected: string[], known: string[]): string[] {
  const set = new Set(known);
  return selected.filter((value) => set.has(value));
}
