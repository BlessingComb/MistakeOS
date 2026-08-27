export type SupabaseConfig = { url: string; anonKey: string };
export function resolveSupabaseConfig(input: { url?: string; anonKey?: string }): SupabaseConfig | null {
  const url = input.url?.trim(); const anonKey = input.anonKey?.trim();
  if (!url || !anonKey) return null;
  try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) return null; } catch { return null; }
  if (/service_role|sb_secret/i.test(anonKey)) return null;
  return { url, anonKey };
}
