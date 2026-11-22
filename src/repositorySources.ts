import { readSourceJson, readSourceText } from "./sourceUrl.ts";
import { MAX_SOURCE_BYTES, parseSource, type Episode, type Series } from "./videoCatalog.ts";

import { https, record, parseRepositoryConfig, REPOSITORY_CONFIGS, repositoryPageUrl, type RepositorySite } from "./repositoryConfig.ts";
export { REPOSITORY, REPOSITORY_CONFIGS, type RepositorySite } from "./repositoryConfig.ts";

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
  return { pageCount: Number(list.getAttribute("pagecount")), list: Array.from(list.children).filter(node => node.tagName === "video").slice(0, 300).map(video => {
    const field = (name: string) => Array.from(video.children).find(node => node.tagName === name)?.textContent ?? "";
    return {
      vod_id: field("id"),
      vod_name: field("name"),
      type_name: field("type"),
      vod_pic: field("pic"),
      vod_play_url: Array.from(Array.from(video.getElementsByTagName("dl")).flatMap(line => Array.from(line.getElementsByTagName("dd"))), item => item.textContent).join("$$"),
    };
  }) };
}

export function parseRepositoryPage(body: string, site: RepositorySite) {
  const data = body.trimStart().startsWith("<") ? xmlRecords(body) : (() => {
    try {
      const value = record(JSON.parse(body));
      return { list: value.list, pageCount: Number(value.pagecount) };
    } catch { throw new Error("源站没有返回有效 JSON"); }
  })();
  const { list, pageCount } = data;
  if (!Array.isArray(list)) throw new Error("该站点未返回标准剧集列表");
  const url = repositoryPageUrl(site, 1);
  const seen = new Set<string>();
  const series = list.slice(0, 300).flatMap(value => {
    const row = record(value);
    const title = typeof row.vod_name === "string" ? row.vod_name.trim().slice(0, 120) : "";
    const episodes = title ? episodesFrom(row.vod_play_url) : [];
    const candidate = String(row.vod_id ?? "");
    const identity = candidate || title + ":" + (episodes[0]?.url ?? "");
    let hash = 2166136261;
    for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619);
    const key = /^[A-Za-z0-9_-]{1,60}$/.test(candidate) ? "v-" + candidate : "row-" + (hash >>> 0).toString(16);
    if (!episodes.length || seen.has(key)) return [];
    seen.add(key);
    const category = typeof row.type_name === "string" ? row.type_name.trim().slice(0, 120) : "";
    return [{ id: key, title, category, poster: https(row.vod_pic, url.href)?.href, episodes }];
  });
  return { series, pageCount, empty: list.length === 0 };
}

type PageResponse = { body: string } | { error: string };
export async function importRepositoryBatch(
  site: RepositorySite, start: number, count: number,
  options: {
    read?: (start: number, count: number) => Promise<PageResponse[]>;
    progress?: (page: number, titles: number) => void;
  } = {},
) {
  repositoryPageUrl(site, start);
  if (!Number.isInteger(count) || count < 1 || count > 50 || start + count > 10000) {
    throw new Error("每次最多读取 50 页");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(site.endpoint));
  const id = "tvbox-" + Array.from(new Uint8Array(digest).slice(0, 8), byte => byte.toString(16).padStart(2, "0")).join("") + "-" + start;
  const name = start === 1 ? site.name : site.name.slice(0, 102) + " · 从第 " + start + " 页";
  const series = new Map<string, Series>();
  const encoder = new TextEncoder();
  let bytes = encoder.encode(JSON.stringify({ version: 1, id, name, series: [] })).length;
  const errors: string[] = [];
  let lastPage = start + count - 1;
  let pagesRead = 0;
  let stopReason = "";
  let resumePage: number | undefined;
  let previousSignature = "";
  scan: for (let page = start; page <= lastPage;) {
    const size = Math.min(5, lastPage - page + 1);
    let responses: PageResponse[];
    try {
      responses = options.read ? await options.read(page, size) : await Promise.all(
        Array.from({ length: size }, async (_, offset) => {
          try { return { body: await readSourceText(repositoryPageUrl(site, page + offset).href) }; }
          catch (error) { return { error: (error as Error).message }; }
        }),
      );
    } catch (error) { errors.push((error as Error).message); resumePage = page; break; }
    for (const response of responses) {
      const current = page++;
      if (current > lastPage) break;
      try {
        if ("error" in response) throw new Error(response.error);
        const result = parseRepositoryPage(response.body, site);
        pagesRead++;
        if (result.empty) break scan;
        if (Number.isSafeInteger(result.pageCount) && result.pageCount > 0) {
          lastPage = Math.min(lastPage, result.pageCount);
        }
        const signature = result.series.map(item => item.id).join(",");
        if (signature && signature === previousSignature) {
          stopReason = "源站重复返回同一页，已停止";
          break scan;
        }
        previousSignature = signature;
        for (const raw of result.series) {
          if (series.has(raw.id)) continue;
          const item = parseSource({ version: 1, id, name, series: [raw] }).series[0];
          const size = encoder.encode(JSON.stringify(item)).length + (series.size ? 1 : 0);
          if (size + bytes > MAX_SOURCE_BYTES && !series.size) {
            errors.push("第 " + current + " 页有单部剧集超过目录大小限制，已跳过");
            continue;
          }
          if (series.size >= 300 || size + bytes > MAX_SOURCE_BYTES) {
            stopReason = "已达到单个目录的容量上限";
            resumePage = current;
            break scan;
          }
          series.set(item.id, item);
          bytes += size;
        }
        options.progress?.(current, series.size);
      } catch (error) {
        errors.push("第 " + current + " 页：" + (error as Error).message);
        if (!pagesRead && errors.length >= 5) break scan;
      }
    }
    if (!responses.length) break;
  }
  if (!series.size) throw new Error(errors[0] ?? "这些页面没有可直接播放的 HTTPS MP4 或 M3U8");
  const source = parseSource({ version: 1, id, name, series: [...series.values()] });
  return { source, pagesRead, errors, stopReason, resumePage };
}
