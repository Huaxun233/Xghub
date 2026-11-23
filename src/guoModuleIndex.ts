export const GUO_MODULE_INDEX = "https://raw.githubusercontent.com/guoapp-modules/index/main/index.json";

/** 本站自维护的额外模块（不在 guoapp-modules 官方索引里）。 */
export const EXTRA_GUO_MODULES: GuoModule[] = [
  { id: "aigo", name: "爱果短剧", version: "1.0.0", adult: true, description: "aigo.me 爱果短剧站源：分类浏览、搜索与在线播放", repository: "https://github.com/Huaxun233/aigo-module" },
];

export type GuoModule = { id: string; name: string; version: string; adult: boolean; description: string; repository: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function parseGuoModules(value: unknown): GuoModule[] {
  const index = record(value);
  if (index.format !== 1 || !Array.isArray(index.modules)) throw new Error("玄果模块索引格式不受支持");
  const seen = new Set<string>();
  return index.modules.flatMap(value => {
    const { id, name, version, adult, repo, api, description } = record(value);
    if (api !== 1 || typeof id !== "string" || !/^[a-z0-9_-]+$/i.test(id) || seen.has(id) ||
        typeof name !== "string" || !name.trim() || typeof version !== "string" ||
        typeof repo !== "string" || !/^guoapp-modules\/[a-z0-9_-]+$/i.test(repo)) return [];
    seen.add(id);
    return [{ id, name: name.slice(0, 100), version: version.slice(0, 40), adult: adult === true, description: typeof description === "string" ? description.slice(0, 180) : "", repository: "https://github.com/" + repo }];
  });
}
