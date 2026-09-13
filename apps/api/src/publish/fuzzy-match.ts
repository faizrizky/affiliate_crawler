/** Normalisasi + kemiripan teks untuk mencocokkan draft dengan post asli. */

/**
 * Buang beda yang tidak berarti: huruf besar/kecil, emoji, tanda baca, dan
 * spasi berlebih. "🎉 Promo Hemat 50% 🎉" dan "promo hemat 50%" jadi identik.
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1;
  // Pra-saring murah: beda panjang ekstrem tidak mungkin lolos ambang,
  // dan Levenshtein O(n*m) tidak perlu dijalankan untuk itu.
  if (shorter.length / longer.length < 0.5) return shorter.length / longer.length;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
}

/**
 * Penjaga tambahan: nama produk draft harus muncul di teks post.
 *
 * Tanpa ini, dua draft dari template yang sama hanya beda nama produk
 * ("Honestly <A> is doing..." vs "Honestly <B> is doing...") punya kemiripan
 * >95% dan satu post asli akan menerbitkan keduanya. Terbukti saat uji:
 * draft "AutoPub Lain" ikut PUBLISHED oleh post milik "AutoPub Kembar".
 */
export function mentionsProduct(product: string, post: string): boolean {
  const needle = normalizeForMatch(product);
  if (!needle) return true;
  return normalizeForMatch(post).includes(needle);
}

export function fuzzyMatch(draft: string, post: string, threshold: number): boolean {
  const d = normalizeForMatch(draft);
  const p = normalizeForMatch(post);
  if (!d || !p) return false;
  // Post di Threads sering memuat teks draft plus tambahan (hashtag, sapaan).
  // Substring dianggap cocok supaya kasus itu tidak lolos begitu saja.
  if (p.includes(d) || d.includes(p)) return true;
  return similarity(d, p) >= threshold;
}
