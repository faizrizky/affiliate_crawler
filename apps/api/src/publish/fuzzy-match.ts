/** Normalisasi + kemiripan teks untuk mencocokkan draft dengan post asli. */

/**
 * Buang beda yang tidak berarti: huruf besar/kecil, emoji, tanda baca, spasi,
 * dan semua bentuk URL — termasuk yang dipotong Threads tanpa skema
 * ("s.shopee.co.id/3qN4G…"), yang tidak pernah sama persis dengan URL di draft.
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w-]+(?:\.[\w-]+)+\/\S*/g, " ")
    .replace(/…/g, " ")
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
 * Porsi kata draft yang muncul BERURUTAN di post (LCS tingkat kata).
 *
 * Teks post yang dibaca dari profil selalu membawa tambahan di sekelilingnya:
 * "<username> 20 menit" di depan dan kartu preview link di belakang. Kemiripan
 * karakter jatuh karena tambahan itu, padahal seluruh kata draft ada di sana.
 */
export function tokenCoverage(draft: string, post: string): number {
  const d = draft.split(" ").filter(Boolean);
  const p = post.split(" ").filter(Boolean);
  if (d.length === 0) return 0;
  let prev = new Array<number>(p.length + 1).fill(0);
  let curr = new Array<number>(p.length + 1).fill(0);
  for (let i = 1; i <= d.length; i += 1) {
    for (let j = 1; j <= p.length; j += 1) {
      curr[j] = d[i - 1] === p[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[p.length] / d.length;
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
  if (p.includes(d) || d.includes(p)) return true;
  // Kata draft hampir semuanya ada, berurutan -> sama, walau dikelilingi
  // header dan preview link (lihat tokenCoverage).
  if (tokenCoverage(d, p) >= threshold) return true;
  return similarity(d, p) >= threshold;
}
