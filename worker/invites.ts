import { requireAdmin } from "./accounts";
import { HttpError, json, readJson, type Env } from "./http";

export async function invites(request: Request, env: Env, code?: string) {
  await requireAdmin(request, env);
  if (!code && request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT code, max_uses, used, active FROM invites ORDER BY created_at DESC, code LIMIT 100",
    ).all();
    return json(results);
  }
  if (!code && request.method === "POST") {
    const body = await readJson(request, 4096) as { maxUses?: number } | null;
    const max = body?.maxUses;
    if (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > 1000) {
      throw new HttpError(400, "可使用次数必须是 1 到 1000 的整数");
    }
    const value = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    await env.DB.prepare("INSERT INTO invites (code, max_uses, created_at) VALUES (?, ?, ?)")
      .bind(value, max, Date.now()).run();
    return json({ code: value, max_uses: max, used: 0, active: 1 }, 201);
  }
  if (code && request.method === "PATCH") {
    const body = await readJson(request, 4096) as { active?: boolean } | null;
    if (typeof body?.active !== "boolean") throw new HttpError(400, "邀请码状态无效");
    const result = await env.DB.prepare("UPDATE invites SET active = ? WHERE code = ?").bind(Number(body.active), code).run();
    if (!result.meta.changes) throw new HttpError(404, "邀请码不存在");
    return json({ ok: true });
  }
  throw new HttpError(405, "请求方法不支持");
}
