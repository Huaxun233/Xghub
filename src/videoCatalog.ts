export type Episode = { id: string; title: string; url: string; format: "file" | "hls" };
export type Series = { id: string; title: string; category: string; description: string; poster?: string; episodes: Episode[] };
export type Source = { version: 1; id: string; name: string; series: Series[] };

export const MAX_SOURCE_BYTES = 512 * 1024;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("站源数据格式有误");
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, max = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new Error(label + "为空或超出长度限制");
  }
  return value.trim();
}

function identifier(value: unknown) {
  const id = string(value, "ID", 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("ID 只能使用字母、数字、下划线和连字符");
  return id;
}

function collection<T extends { id: string }>(value: unknown, max: number, parse: (item: unknown) => T) {
  if (!Array.isArray(value) || !value.length || value.length > max) throw new Error("目录为空或条目过多");
  const items = value.map(parse);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error("目录中有重复 ID");
  return items;
}

export function parseEpisode(value: unknown): Episode {
  const row = object(value);
  let url: URL;
  try {
    url = new URL(string(row.url, "播放地址", 4096));
  } catch {
    throw new Error("请输入完整的 HTTPS 播放地址");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("播放地址须为不含登录凭据的 HTTPS 链接");
  }
  const format = row.format ?? (/\.m3u8$/i.test(url.pathname) ? "hls" : "file");
  if (format !== "file" && format !== "hls") throw new Error("视频格式应为 file 或 hls");
  return { id: identifier(row.id), title: string(row.title, "集名"), url: url.href, format };
}

function parsePoster(value: unknown) {
  if (typeof value !== "string" || value.length > 4096) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function parseSeries(value: unknown): Series {
  const row = object(value);
  return {
    id: identifier(row.id),
    title: string(row.title, "剧名"),
    category: row.category ? string(row.category, "分类") : "未分类",
    description: row.description ? string(row.description, "简介", 1200) : "",
    poster: parsePoster(row.poster) ?? parsePoster(row.cover) ?? parsePoster(row.vod_pic),
    episodes: collection(row.episodes, 500, parseEpisode),
  };
}

export function parseSource(value: unknown): Source {
  const row = object(value);
  if (row.version !== 1) throw new Error("请使用第 1 版 JSON 站源格式");
  return {
    version: 1,
    id: identifier(row.id),
    name: string(row.name, "站源名称"),
    series: collection(row.series, 300, parseSeries),
  };
}
