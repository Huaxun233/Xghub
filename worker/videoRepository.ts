import { parseRepositoryConfig, REPOSITORY_CONFIGS, repositoryPageUrl } from "../src/repositoryConfig";
import { MAX_SOURCE_BYTES } from "../src/videoCatalog";
import { HttpError, json } from "./http";

async function readUpstream(url: URL) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("源站返回 HTTP " + response.status);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("源站未返回内容");
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
    let size = 0;
    let body = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return body + decoder.decode();
      size += value.length;
      if (size > MAX_SOURCE_BYTES) throw new Error("单页响应超过 512 KB");
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function videoRepositoryPages(url: URL) {
  const file = REPOSITORY_CONFIGS.find(name => name === url.searchParams.get("file"));
  if (!file) throw new HttpError(400, "未知的仓库配置");
  const listing = !url.searchParams.has("site");
  const start = Number(url.searchParams.get("start"));
  const count = Number(url.searchParams.get("count"));
  if (!listing && (!Number.isInteger(start) || start < 1 || start > 9999 ||
      !Number.isInteger(count) || count < 1 || count > 5 || start + count > 10000)) {
    throw new HttpError(400, "仓库文件或页码范围无效");
  }
  let sites;
  try {
    const config = await readUpstream(new URL("https://raw.githubusercontent.com/Huaxun233/tvbox/master/" + file));
    sites = parseRepositoryConfig(JSON.parse(config));
  } catch {
    throw new HttpError(502, "无法读取 GitHub 配置仓库，请稍后重试");
  }
  if (listing) return json({ sites });
  const site = sites.find(item => item.key === url.searchParams.get("site"));
  if (!site?.endpoint) throw new HttpError(400, "站点已变更或不支持，请重新同步配置");
  // The client supplies only a config filename and entry key. Never fetch a client URL or follow redirects.
  const pages = await Promise.all(Array.from({ length: count }, async (_, index) => {
    try {
      return { body: await readUpstream(repositoryPageUrl(site, start + index)) };
    } catch (error) {
      const message = error instanceof Error && /^(源站返回 HTTP|单页响应)/.test(error.message)
        ? error.message : "服务器无法连接该源站或读取响应";
      return { error: message };
    }
  }));
  return json({ pages });
}
