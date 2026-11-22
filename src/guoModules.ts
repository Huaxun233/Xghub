import { readSourceJson } from "./sourceUrl.ts";

export const GUO_MODULE_INDEX = "https://raw.githubusercontent.com/guoapp-modules/index/main/index.json";

export type GuoModule = { id: string; name: string; version: string; adult: boolean; repository: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function parseGuoModules(value: unknown): GuoModule[] {
  const index = record(value);
  if (index.format !== 1 || !Array.isArray(index.modules)) throw new Error("小果模块索引格式不受支持");
  const seen = new Set<string>();
  return index.modules.flatMap(value => {
    const { id, name, version, adult, repo, api } = record(value);
    if (api !== 1 || typeof id !== "string" || !/^[a-z0-9_-]+$/i.test(id) || seen.has(id) ||
        typeof name !== "string" || !name.trim() || typeof version !== "string" ||
        typeof repo !== "string" || !/^guoapp-modules\/[a-z0-9_-]+$/i.test(repo)) return [];
    seen.add(id);
    return [{ id, name: name.slice(0, 100), version: version.slice(0, 40), adult: adult === true, repository: "https://github.com/" + repo }];
  });
}

export async function syncGuoModules(fetcher: typeof fetch = fetch) {
  return parseGuoModules(await readSourceJson(GUO_MODULE_INDEX, fetcher));
}
