import { videoRepositoryPages, readUpstream } from "./videoRepository";
import { GUO_MODULE_INDEX, EXTRA_GUO_MODULES, parseGuoModules } from "../src/guoModuleIndex";
import { guoModuleFile, guoProxy } from "./guoModule";
import { project } from './project';
import { comicRepository } from './comicRepository';
import { comicState } from './comicState';
import { refreshIkanbot } from './videoResolver';
import { MAX_SOURCE_BYTES, parseSource } from "../src/videoCatalog";
import { account, requireAdmin } from "./accounts";
import { invites } from "./invites";
import { HttpError, json, jsonHeaders, readJson, clientAddress, limit, type Env } from "./http";
export { PasswordHasher } from "./passwordHasher";

const MAX_PUBLIC_SOURCES = 16;
const ACCOUNT_PAGE_SIZE = 30;

async function api(request: Request, env: Env, url: URL) {
  const { pathname } = url;
  const method = request.method;
  const origin = request.headers.get("Origin");
  if (method !== "GET" && origin && origin !== url.origin) throw new HttpError(403, "请求来源不匹配");

  if (method === "GET" && pathname === "/api/admin/video-repository/pages") {
    await requireAdmin(request, env, "admin-video-repository");
    return videoRepositoryPages(url);
  }

  if (method === "GET" && pathname === "/api/video-repository/pages") {
    await limit(env, "public-video-repository:" + clientAddress(request));
    return videoRepositoryPages(url);
  }
  if (method === "GET" && pathname === "/api/guo-modules") {
    await limit(env, "guo-module-index:" + clientAddress(request));
    try {
      const modules = parseGuoModules(JSON.parse(await readUpstream(new URL(GUO_MODULE_INDEX))));
      const seen = new Set(modules.map(item => item.id));
      for (const extra of EXTRA_GUO_MODULES) if (!seen.has(extra.id)) modules.push(extra);
      return json({ modules }, 200, { "Cache-Control": "public, max-age=120" });
    } catch {
      throw new HttpError(502, "玄果模块仓库暂时无法读取");
    }
  }

  const guoModuleRoute = /^\/api\/guo-module\/([a-z0-9][a-z0-9_-]{0,31})$/.exec(pathname);
  if (method === "GET" && guoModuleRoute) {
    await limit(env, "guo-module-file:" + clientAddress(request));
    return guoModuleFile(guoModuleRoute[1], url);
  }

  if (pathname === "/api/guo-proxy") {
    await limit(env, "guo-proxy:" + clientAddress(request));
    return guoProxy(request, url);
  }

  const projectResponse = await project(request, env, url);
  if (projectResponse) return projectResponse;
  const comicFile = /^\/api\/comics\/repository\/([^/]+)$/.exec(pathname);
  if(comicFile) return comicRepository(request, comicFile[1], {cache:caches.default});
  if (method === "GET" && pathname === "/api/health") {
    await env.DB.prepare("SELECT id FROM catalog_sources LIMIT 1").first();
    return json({ ok: true });
  }
  if (method === "GET" && pathname === "/api/catalog") {
    const { results } = await env.DB.prepare(
      "SELECT document FROM catalog_sources ORDER BY updated_at DESC, id",
    ).all<{ document: string }>();
    return new Response("[" + results.map(row => row.document).join(",") + "]", { headers: jsonHeaders });
  }

  const refreshRoute = /^\/api\/video\/ikanbot\/(\d{1,12})$/.exec(pathname);
  if (method === 'GET' && refreshRoute) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await env.AUTH_LIMIT.limit({key:'video-refresh:'+ip})).success) throw new HttpError(429, '刷新过于频繁，请稍后重试');
    const row = await env.DB.prepare('SELECT document FROM catalog_sources WHERE id = ?').bind('ikanbot').first<{document:string}>();
    if (!row || !parseSource(JSON.parse(row.document)).series.some(item => item.id === refreshRoute[1])) throw new HttpError(404, '影片不在共享片库');
    return json(await refreshIkanbot(refreshRoute[1]));
  }
  if (pathname === '/api/comics/state') return comicState(request, env);

  const action = /^\/api\/account\/(me|register|login|logout)$/.exec(pathname);
  if (action) return account(request, env, action[1]);
  const inviteRoute = /^\/api\/admin\/invites(?:\/([A-Z0-9]{16}))?$/.exec(pathname);
  if (inviteRoute) return invites(request, env, inviteRoute[1]);

  if (pathname === "/api/admin/accounts" && method === "GET") {
    await requireAdmin(request, env);
    const before = url.searchParams.get("before");
    if (before !== null && (!/^[1-9]\d{0,14}$/.test(before))) throw new HttpError(400, "分页参数无效");
    const { results } = await env.DB.prepare(
      "SELECT id, username, created_at, invite_code FROM accounts WHERE id < ? ORDER BY id DESC LIMIT ?",
    ).bind(before ? Number(before) : Number.MAX_SAFE_INTEGER, ACCOUNT_PAGE_SIZE + 1)
      .all<{ id: number; username: string; created_at: number }>();
    const accounts = results.slice(0, ACCOUNT_PAGE_SIZE);
    return json({ accounts, next: results.length > ACCOUNT_PAGE_SIZE ? accounts.at(-1)?.id : null });
  }

  const sourceRoute = /^\/api\/admin\/catalog\/([a-zA-Z0-9_-]{1,64})$/.exec(pathname);
  if (sourceRoute && (method === "PUT" || method === "DELETE")) {
    await requireAdmin(request, env);
    const id = sourceRoute[1];
    if (method === "DELETE") {
      const result = await env.DB.prepare("DELETE FROM catalog_sources WHERE id = ?").bind(id).run();
      if (!result.meta.changes) throw new HttpError(404, "站源已删除或不存在");
      return json({ ok: true });
    }
    const body = await readJson(request, MAX_SOURCE_BYTES);
    let source;
    try { source = parseSource(body); }
    catch (error) { throw new HttpError(400, (error as Error).message); }
    if (source.id !== id) throw new HttpError(400, "站源 ID 与请求不匹配");
    const document = JSON.stringify(source);
    if (new TextEncoder().encode(document).length > MAX_SOURCE_BYTES) throw new HttpError(413, "站源内容过大");
    const result = await env.DB.prepare(
      "INSERT INTO catalog_sources (id, document, updated_at) SELECT ?, ?, ? " +
      "WHERE EXISTS (SELECT 1 FROM catalog_sources WHERE id = ?) OR (SELECT count(*) FROM catalog_sources) < ? " +
      "ON CONFLICT(id) DO UPDATE SET document = excluded.document, updated_at = excluded.updated_at",
    ).bind(id, document, Date.now(), id, MAX_PUBLIC_SOURCES).run();
    if (!result.meta.changes) throw new HttpError(409, "共享站源已达上限");
    return json({ ok: true });
  }
  throw new HttpError(404, "接口不存在");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/admin" || url.pathname === "/admin/" || url.pathname === "/app" || url.pathname === "/app/") {
      return env.ASSETS.fetch(new Request(new URL("/", url), request));
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, url);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error("API request failed", request.method, url.pathname,
        error instanceof Error ? error.name + ": " + error.message : "Unknown error");
      return json({ error: "服务暂不可用，请稍后再试" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
