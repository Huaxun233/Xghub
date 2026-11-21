import { MAX_SOURCE_BYTES, parseSource } from "./videoCatalog.ts";

export async function readSourceJson(address: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  let url: URL;
  try { url = new URL(address.trim()); }
  catch { throw new Error("请输入完整的 HTTPS 站源地址"); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("只支持不含登录凭据的 HTTPS 站源地址");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    let response: Response;
    try {
      response = await fetcher(url, {
        signal: controller.signal, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", cache: "no-cache",
      });
    } catch {
      throw new Error(controller.signal.aborted ? "读取站源超时" : "无法读取地址，请检查网络、重定向或源站跨域设置");
    }
    if (!response.ok) throw new Error("站源服务器返回 HTTP " + response.status);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("站源返回了空文件");
    const buffer = new Uint8Array(MAX_SOURCE_BYTES);
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (size + value.length > buffer.length) {
          await reader.cancel().catch(() => {});
          throw new Error("站源文件不能超过 512 KB");
        }
        buffer.set(value, size);
        size += value.length;
      }
    } finally {
      reader.releaseLock();
    }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size))); }
    catch { throw new Error("此地址没有返回可读取的 JSON 站源"); }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("读取站源超时");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadSource(address: string, fetcher: typeof fetch = fetch) {
  const value = await readSourceJson(address, fetcher);
  if (value && typeof value === "object" && ("sites" in value || "spider" in value || "urls" in value || "lives" in value)) {
    throw new Error("检测到 TVBox 配置，请使用「同步仓库源」查看兼容站点。");
  }
  return parseSource(value);
}
