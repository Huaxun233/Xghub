import type { PasswordHasher } from "./passwordHasher";

export interface Env {
  DB: D1Database;
  PROJECT_MEDIA?: R2Bucket;
  ASSETS: Fetcher;
  AUTH_LIMIT: RateLimit;
  PASSWORD_HASHER: DurableObjectNamespace<PasswordHasher>;
  ADMIN_TOKEN?: string;
  PASSWORD_PEPPER?: string;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(value: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(jsonHeaders);
  new Headers(headers).forEach((value, key) => responseHeaders.set(key, value));
  return new Response(JSON.stringify(value), { status, headers: responseHeaders });
}

export async function readJson(request: Request, limit: number): Promise<unknown> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "请提交 JSON");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请求内容为空");
  const bytes = new Uint8Array(limit);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.length > limit) {
        await reader.cancel().catch(() => {});
        throw new HttpError(413, "请求文件过大");
      }
      bytes.set(value, length);
      length += value.length;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes.subarray(0, length)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "JSON 内容无效");
  } finally {
    reader.releaseLock();
  }
}

export async function limit(env: Env, key: string) {
  if (!(await env.AUTH_LIMIT.limit({ key })).success) {
    throw new HttpError(429, "操作太频繁，请稍后再试");
  }
}

export const clientAddress = (request: Request) => request.headers.get("CF-Connecting-IP") || "local";
