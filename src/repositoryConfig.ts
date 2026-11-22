export const REPOSITORY = "https://github.com/Huaxun233/tvbox";
export const REPOSITORY_CONFIGS = ["9918.json", "0826.json", "jsm.json"] as const;
export type RepositorySite = { key: string; name: string; endpoint?: string; format?: "xml" | "json"; reason?: string };

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function https(value: unknown, base?: string) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol === "https:" && !url.username && !url.password && url.href.length <= 4096) return url;
  } catch { /* unsupported URL */ }
  return undefined;
}

export function parseRepositoryConfig(value: unknown): RepositorySite[] {
  const sites = record(value).sites;
  if (!Array.isArray(sites)) throw new Error("仓库文件没有 TVBox 点播站点列表");
  return sites.filter(site => typeof record(site).name === "string").map((value, index) => {
    const site = record(value);
    const type = Number(site.type);
    const format = type === 0 ? "xml" : type === 1 ? "json" : undefined;
    const endpoint = format ? https(site.api) : undefined;
    return {
      key: String(site.key ?? "site") + "-" + index,
      name: (String(site.name).trim() || "未命名站点").slice(0, 120),
      endpoint: endpoint?.href,
      format,
      reason: endpoint ? undefined : format ? "需要 HTTPS 接口" : "需要独立插件适配",
    };
  });
}

export function repositoryPageUrl(site: RepositorySite, page: number) {
  const url = https(site.endpoint);
  if (!url || url.port || !url.hostname.includes(".") || /^[0-9.]+$/.test(url.hostname) ||
      !Number.isInteger(page) || page < 1 || page > 9999) throw new Error("站点或页码无效");
  url.searchParams.set("ac", "detail");
  url.searchParams.set("pg", String(page));
  url.searchParams.set("at", site.format ?? "json");
  return url;
}
