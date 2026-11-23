import { readSourceJson } from "./sourceUrl.ts";

import { GUO_MODULE_INDEX, parseGuoModules, type GuoModule } from "./guoModuleIndex.ts";
export type { GuoModule } from "./guoModuleIndex.ts";

export async function syncGuoModules(hosted = false): Promise<GuoModule[]> {
  if (!hosted) return parseGuoModules(await readSourceJson(GUO_MODULE_INDEX));
  const response = await fetch("/api/guo-modules");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "玄果模块索引读取失败");
  return data.modules;
}
