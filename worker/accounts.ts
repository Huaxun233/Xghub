import { clientAddress, HttpError, json, limit, readJson, type Env } from "./http";

const COOKIE = "__Host-hghub";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encode = new TextEncoder();
const hex = (value: ArrayBuffer | Uint8Array) =>
  Array.from(value instanceof Uint8Array ? value : new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
const random = (size: number) => hex(crypto.getRandomValues(new Uint8Array(size)));

async function digest(value: string) {
  return crypto.subtle.digest("SHA-256", encode.encode(value));
}

export async function requireAdmin(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 20) {
    throw new HttpError(503, "站点管理员尚未配置管理密钥");
  }
  await limit(env, "admin:" + clientAddress(request));
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ") || header.length > 1024 ||
      !crypto.subtle.timingSafeEqual(await digest(header.slice(7)), await digest(env.ADMIN_TOKEN))) {
    throw new HttpError(401, "管理密钥无效");
  }
}

function cookie(token: string, maxAge: number) {
  return COOKIE + "=" + token + "; Path=/; Max-Age=" + maxAge + "; HttpOnly; Secure; SameSite=Lax";
}

function sessionToken(request: Request) {
  return /(?:^|;\s*)__Host-hghub=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get("Cookie") || "")?.[1];
}

function passwordHash(env: Env, password: string, salt: string) {
  return env.PASSWORD_HASHER.getByName("password-" + salt.slice(0, 2)).hash(password, salt);
}

export async function account(request: Request, env: Env, action: string) {
  if (action === "me" && request.method === "GET") {
    const token = sessionToken(request);
    const user = token ? await env.DB.prepare(
      "SELECT accounts.username FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE token_hash = ? AND expires_at > ?",
    ).bind(hex(await digest(token)), Date.now()).first<{ username: string }>() : null;
    return json({ user });
  }
  if (request.method !== "POST" || action === "me") throw new HttpError(405, "请求方法不支持");
  if (action === "logout") {
    const token = sessionToken(request);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hex(await digest(token))).run();
    return json({ user: null }, 200, { "Set-Cookie": cookie("", 0) });
  }

  await limit(env, "auth:" + clientAddress(request));
  const body = await readJson(request, 4096) as { username?: unknown; password?: unknown; inviteCode?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = body?.password;
  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(username) ||
      typeof password !== "string" || password.length < 10 || password.length > 128) {
    throw new HttpError(400, "用户名为 3–24 个字母、汉字、数字、下划线或连字符，密码为 10–128 个字符");
  }
  if (!env.PASSWORD_PEPPER || env.PASSWORD_PEPPER.length < 32) {
    throw new HttpError(503, "站点尚未启用注册登录");
  }
  const key = username.toLowerCase();
  await limit(env, "username:" + key);
  if (action === "register") {
    const invite = typeof body?.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{16}$/.test(invite)) throw new HttpError(400, "请输入有效的邀请码");
    const salt = random(16);
    const hash = await passwordHash(env, password, salt);
    const result = await env.DB.prepare(
      "INSERT INTO accounts (username, salt, password_hash, created_at, invite_code) " +
      "SELECT ?, ?, ?, ?, code FROM invites WHERE code = ? AND active = 1 AND used < max_uses " +
      "ON CONFLICT(username) DO NOTHING",
    ).bind(key, salt, hash, Date.now(), invite).run();
    if (!result.meta.changes) {
      const existing = await env.DB.prepare("SELECT id FROM accounts WHERE username = ?").bind(key).first();
      if (existing) throw new HttpError(409, "此用户名已被使用");
      throw new HttpError(400, "邀请码无效、已停用或已用完");
    }
    return json({ registered: true }, 201);
  }

  const user = await env.DB.prepare(
    "SELECT id, username, salt, password_hash FROM accounts WHERE username = ?",
  ).bind(key).first<{ id: number; username: string; salt: string; password_hash: string }>();
  const hash = await passwordHash(env, password, user?.salt ?? "0".repeat(32));
  const matches = crypto.subtle.timingSafeEqual(encode.encode(hash), encode.encode(user?.password_hash ?? "0".repeat(64)));
  if (!user || !matches) throw new HttpError(401, "用户名或密码不正确");

  const token = random(32);
  const previous = sessionToken(request);
  const now = Date.now();
  const statements = [
    env.DB.prepare("DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE expires_at <= ? LIMIT 30)").bind(now),
    env.DB.prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
      .bind(hex(await digest(token)), user.id, now + SESSION_SECONDS * 1000),
  ];
  if (previous) statements.push(env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hex(await digest(previous))));
  await env.DB.batch(statements);
  return json({ user: { username: user.username } }, 200, { "Set-Cookie": cookie(token, SESSION_SECONDS) });
}
