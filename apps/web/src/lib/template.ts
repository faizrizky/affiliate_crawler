/**
 * Nilai placeholder link berurutan: {{affiliate_link_1}}, _2, ... plus alias
 * lama {{affiliate_link}} = link ke-1 (sama dengan renderTemplate di API).
 */
export function linkValues(urls: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  urls.forEach((url, i) => {
    values[`affiliate_link_${i + 1}`] = url;
  });
  if (urls[0]) values.affiliate_link = urls[0];
  return values;
}

/** Nomor link tertinggi yang dipakai isi template (0 kalau tidak ada). */
export function highestLinkNumber(content: string): number {
  let max = /\{\{affiliate_link\}\}/.test(content) ? 1 : 0;
  for (const m of content.matchAll(/\{\{affiliate_link_(\d+)\}\}/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}

export function renderTemplate(
  content: string,
  values: Record<string, string | undefined>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : match;
  });
}
