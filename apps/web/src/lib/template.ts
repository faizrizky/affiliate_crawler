export function renderTemplate(
  content: string,
  values: Record<string, string | undefined>,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : match;
  });
}
