import { GUO_MODULE_INDEX } from "../src/guoModuleIndex";
import { readUpstream } from "./videoRepository";
import { HttpError, json } from "./http";

const MANIFEST_BYTES = 64 * 1024;
const ENTRY_BYTES = 4 * 1024 * 1024;

type IndexEntry = {
  id?: unknown;
  repo?: unknown;
  tag?: unknown;
  adult?: unknown;
  sha256?: unknown;
};

async function fetchModuleFile(repo: string, tag: string, name: string, sha: unknown): Promise<string> {
  const limit = name === "main.js" ? ENTRY_BYTES : MANIFEST_BYTES;
  const expected = typeof sha === "string" && /^[0-9a-fA-F]{64}$/.test(sha) ? sha.toLowerCase() : "";
  const addresses = [
    `https://raw.githubusercontent.com/${repo}/${tag}/${name}`,
    `https://cdn.jsdelivr.net/gh/${repo}@${tag}/${name}`,
  ];
  let lastError = "模块文件下载失败";
  for (const address of addresses) {
    try {
      const response = await fetch(address, { cf: { cacheTtl: 3600 } });
      if (!response.ok) {
        lastError = `模块文件下载失败 (${response.status})`;
        continue;
      }
      const data = await response.arrayBuffer();
      if (data.byteLength > limit) {
        lastError = "模块文件超出大小限制";
        continue;
      }
      if (expected) {
        const digest = await crypto.subtle.digest("SHA-256", data);
        const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
        if (hex !== expected) {
          lastError = "模块文件校验不符";
          continue;
        }
      }
      return new TextDecoder().decode(data);
    } catch {
      lastError = "模块文件下载失败";
    }
  }
  throw new HttpError(502, lastError);
}

/** GET /api/guo-module/:id — 下载并校验模块的 manifest.json + main.js。 */
export async function guoModuleFile(id: string, url: URL): Promise<Response> {
  const cacheKey = new URL(`/api/guo-module/${id}`, url.origin).toString();
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  let index: unknown;
  try {
    index = JSON.parse(await readUpstream(new URL(GUO_MODULE_INDEX)));
  } catch {
    throw new HttpError(502, "小果模块仓库暂时无法读取");
  }
  const record = index as { format?: unknown; modules?: unknown };
  if (record?.format !== 1 || !Array.isArray(record.modules)) throw new HttpError(502, "小果模块索引格式不受支持");
  const entry = record.modules.find((item): item is IndexEntry =>
    !!item && typeof item === "object" && (item as IndexEntry).id === id);
  if (!entry) throw new HttpError(404, "模块不存在");
  if (typeof entry.repo !== "string" || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(entry.repo) ||
      typeof entry.tag !== "string" || !/^v\d+\.\d+\.\d+$/.test(entry.tag)) {
    throw new HttpError(404, "模块不支持在线安装");
  }

  const sha = entry.sha256 && typeof entry.sha256 === "object" ? entry.sha256 as Record<string, unknown> : {};
  const [manifest, code] = await Promise.all([
    fetchModuleFile(entry.repo, entry.tag, "manifest.json", sha["manifest.json"]),
    fetchModuleFile(entry.repo, entry.tag, "main.js", sha["main.js"]),
  ]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    throw new HttpError(502, "模块清单无法解析");
  }
  const meta = parsed as { id?: unknown; api?: unknown; runtime?: unknown };
  if (meta?.id !== id || meta?.api !== 1 || meta?.runtime !== "js") throw new HttpError(502, "模块清单与索引不符");

  const response = json({ manifest: parsed, code, adult: entry.adult === true }, 200,
    { "Cache-Control": "public, max-age=600" });
  await caches.default.put(cacheKey, response.clone());
  return response;
}
