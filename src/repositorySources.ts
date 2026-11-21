import { readSourceJson, readSourceText } from "./sourceUrl.ts";
import { parseSource, type Episode } from "./videoCatalog.ts";

export const REPOSITORY = "https://github.com/Huaxun233/tvbox";
export const REPOSITORY_CONFIGS = ["9918.json", "0826.json", "jsm.json"] as const;
export type RepositorySite = { key: string; name: string; endpoint?: string; format?: "xml" | "json"; reason?: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function https(value: unknown, base?: string) {
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

export async function syncRepository(file: typeof REPOSITORY_CONFIGS[number], fetcher: typeof fetch = fetch) {
  if (!REPOSITORY_CONFIGS.includes(file)) throw new Error("未知的仓库配置");
  return parseRepositoryConfig(await readSourceJson(
    "https://raw.githubusercontent.com/Huaxun233/tvbox/master/" + file, fetcher,
  ));
}

function episodesFrom(value: unknown): Episode[] {
  if (typeof value !== "string") return [];
  for (const line of value.split("$$$")) {
    const episodes: Episode[] = [];
    for (const part of line.split("#")) {
      const separator = part.indexOf("$");
      const url = https(separator < 0 ? part : part.slice(separator + 1));
      if (!url || !/\.(m3u8|mp4)$/i.test(url.pathname)) continue;
      episodes.push({
        id: "ep-" + (episodes.length + 1),
        title: (separator < 0 ? "" : part.slice(0, separator).trim()).slice(0, 120) || "第 " + (episodes.length + 1) + " 集",
        url: url.href, format: /\.m3u8$/i.test(url.pathname) ? "hls" : "file",
      });
      if (episodes.length === 500) break;
    }
    if (episodes.length) return episodes;
  }
  return [];
}

function xmlRecords(body: string) {
  if (/<!DOCTYPE/i.test(body)) throw new Error("XML 站源不能包含文档类型声明");
  const document = new DOMParser().parseFromString(body, "application/xml");
  const list = Array.from(document.documentElement.children).find(node => node.tagName === "list");
  if (document.documentElement.tagName !== "rss" || !list || document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("该站点未返回标准 XML 剧集列表");
  }
  return Array.from(list.children).filter(node => node.tagName === "video").slice(0, 300).map(video => {
    const field = (name: string) => Array.from(video.children).find(node => node.tagName === name)?.textContent ?? "";
    return {
      vod_id: field("id"),
      vod_name: field("name"),
      type_name: field("type"),
      vod_pic: field("pic"),
      vod_play_url: Array.from(Array.from(video.getElementsByTagName("dl")).flatMap(line => Array.from(line.getElementsByTagName("dd"))), item => item.textContent).join("$$"),
    };
  });
}

export async function importRepositorySite(site: RepositorySite, page: number, fetcher: typeof fetch = fetch) {
  const url = https(site.endpoint);
  if (!url || !Number.isInteger(page) || page < 1 || page > 9999) throw new Error("站点或页码无效");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url.href));
  const id = "tvbox-" + Array.from(new Uint8Array(hash).slice(0, 8), b => b.toString(16).padStart(2, "0")).join("") + "-" + page;
  url.searchParams.set("ac", "detail");
  url.searchParams.set("pg", String(page));
  const format = site.format ?? "json";
  url.searchParams.set("at", format);
  const list = format === "xml" ? xmlRecords(await readSourceText(url.href, fetcher)) :
    record(await readSourceJson(url.href, fetcher)).list;
  if (!Array.isArray(list)) throw new Error("该站点未返回标准 JSON 剧集列表");
  const seen = new Set<string>();
  const series = list.slice(0, 300).flatMap((value, index) => {
    const row = record(value);
    const candidate = String(row.vod_id || index);
    const key = /^[A-Za-z0-9_-]{1,60}$/.test(candidate) ? "v-" + candidate : "row-" + index;
    const title = typeof row.vod_name === "string" ? row.vod_name.trim().slice(0, 120) : "";
    const episodes = title ? episodesFrom(row.vod_play_url) : [];
    if (!episodes.length || seen.has(key)) return [];
    seen.add(key);
    const category = typeof row.type_name === "string" ? row.type_name.trim().slice(0, 120) : "";
    return [{ id: key, title, category, poster: https(row.vod_pic, url.href)?.href, episodes }];
  });
  if (!series.length) throw new Error("这一页没有可直接播放的 HTTPS MP4 或 M3U8");
  return parseSource({ version: 1, id, name: (site.name.slice(0, 105) + " · 第 " + page + " 页"), series });
}
