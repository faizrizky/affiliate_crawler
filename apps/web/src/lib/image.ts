/**
 * URL gambar pihak ketiga (CDN Instagram) yang harus lewat proxy kita karena
 * CDN-nya memasang CORP same-origin. Tidak ada yang disimpan di server —
 * lihat app/api/image/route.ts.
 */
export function proxiedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) return null;
  return `/api/image?url=${encodeURIComponent(url)}`;
}
