import ProjectSettings from '../components/ProjectSettings';
import { lazy, Suspense } from 'react';
const Comics = lazy(() => import('./Comics'));
import GuoModules from "../components/GuoModules";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Logo } from "../icons";
import { MAX_SOURCE_BYTES, parseSource, type Source } from "../videoCatalog";
import Videos from "./Videos";
import SourceUrlInput from "../components/SourceUrlInput";
import RepositorySources from "../components/RepositorySources";
import WebTheme from "../components/WebTheme";

const button = "rounded-(--r-ctl) bg-s3 px-3 py-2 text-sm font-medium hover:bg-s4 disabled:opacity-50";
const primary = "rounded-(--r-ctl) bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50";
const field = "block w-full min-w-0 rounded-(--r-ctl) border border-s4 bg-canvas px-3 py-2 text-sm";
const panel = "space-y-3 rounded-(--r-md) border border-s3 bg-s1 p-4";

type User = { username: string };
type AccountPage = { accounts: (User & { id: number; created_at: number; invite_code: string | null })[]; next: number | null };
type Invite = { code: string; max_uses: number; used: number; active: number };
type Section = "comics" | "home" | "library" | "search" | "account" | "sources" | "admin";

async function api<T>(path: string, options?: { method?: string; body?: unknown; token?: string; signal?: AbortSignal }): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options?.body !== undefined) headers.set("Content-Type", "application/json");
  if (options?.token) headers.set("Authorization", "Bearer " + options.token);
  const response = await fetch("/api/" + path, {
    method: options?.method,
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    signal: options?.signal,
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) throw new Error(data?.error || "服务连接失败，请重试");
  return data as T;
}

function Account({ user, onUser }: { user: User | null; onUser: (user: User | null) => void }) {
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (register) {
        await api("account/register", { method: "POST", body: { username, password, inviteCode } });
        setInviteCode("");
        setRegister(false);
        setMessage("账号已注册，请登录。");
      } else {
        const result = await api<{ user: User }>("account/login", { method: "POST", body: { username, password } });
        onUser(result.user);
      }
      setPassword("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("account/logout", { method: "POST" });
      onUser(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4 p-5 sm:p-7">
      <h1 className="text-2xl font-bold">{user ? "我的账号" : register ? "注册账号" : "账号登录"}</h1>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {message && <p role="status" className="text-sm text-mut">{message}</p>}
      {user ? (
        <div className={panel}>
          <p className="break-words font-semibold">{user.username}</p>
          <button className={button} disabled={busy} onClick={() => void logout()}>退出登录</button>
        </div>
      ) : (
        <form onSubmit={submit} className={panel}>
          <label className="block space-y-1 text-sm"><span>用户名</span>
            <input className={field} value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" required minLength={3} maxLength={24} />
          </label>
          <label className="block space-y-1 text-sm"><span>密码</span>
            <input className={field} value={password} onChange={e => setPassword(e.target.value)}
              type="password" autoComplete={register ? "new-password" : "current-password"}
              required minLength={10} maxLength={128} />
          </label>
          {register && <label className="block space-y-1 text-sm"><span>邀请码</span>
            <input className={field + " font-mono uppercase"} value={inviteCode} onChange={e => setInviteCode(e.target.value)}
              autoCapitalize="characters" autoComplete="off" spellCheck={false} minLength={16} maxLength={16} required />
          </label>}
          {register && <p className="text-xs text-mut">用户名 3–24 个字符，密码至少 10 个字符。注册需要管理员提供的邀请码。</p>}
          <div className="flex flex-wrap gap-2">
            <button className={primary} disabled={busy}>{register ? "注册" : "登录"}</button>
            <button className={button} type="button" disabled={busy} onClick={() => {
              setRegister(!register); setError(""); setMessage(""); setPassword("");
            }}>{register ? "返回登录" : "创建账号"}</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Admin({ sources, reload }: { sources: Source[]; reload: () => Promise<void> }) {
  const [draftToken, setDraftToken] = useState("");
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [page, setPage] = useState<AccountPage>({ accounts: [], next: null });
  const [inviteList, setInviteList] = useState<Invite[] | null>(null);
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try { await action(); }
    catch (failure) {
      setError(failure instanceof SyntaxError ? "请检查 JSON 格式" : (failure as Error).message);
    } finally { setBusy(false); }
  }

  async function readAccounts(secret: string, before?: number) {
    const data = await api<AccountPage>("admin/accounts" + (before ? "?before=" + before : ""), { token: secret });
    setPage(previous => ({ ...data, accounts: before ? [...previous.accounts, ...data.accounts] : data.accounts }));
  }

  function connect(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await readAccounts(draftToken.trim());
      setToken(draftToken.trim());
      setDraftToken("");
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (new TextEncoder().encode(input).length > MAX_SOURCE_BYTES) throw new Error("站源文件不能超过 512 KB");
      const source = parseSource(JSON.parse(input));
      await api("admin/catalog/" + source.id, { method: "PUT", body: source, token });
      await reload();
      setStatus("已发布 " + source.name);
    });
  }

  function remove(source: Source) {
    if (!window.confirm("确定从网站下架「" + source.name + "」和它的全部剧集？")) return;
    void run(async () => {
      await api("admin/catalog/" + source.id, { method: "DELETE", token });
      await reload();
      setStatus("已下架 " + source.name);
    });
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">管理后台</h1>
        {token && <button className={button} disabled={busy} onClick={() => {
          setToken(""); setInput(""); setPage({ accounts: [], next: null }); setInviteList(null); setError(""); setStatus("");
        }}>锁定后台</button>}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {status && <p role="status" className="text-sm text-mut">{status}</p>}
      {!token ? (
        <form onSubmit={connect} className={panel + " max-w-md"}>
          <label className="block space-y-1 text-sm"><span>管理密钥</span>
            <input className={field} type="password" required minLength={20} maxLength={128} autoComplete="off"
              value={draftToken} onChange={e => setDraftToken(e.target.value)} />
          </label>
          <button className={primary} disabled={busy}>解锁后台</button>
        </form>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
          <ProjectSettings token={token} />
          <div className={panel + " lg:row-span-2"}>
            <h2 className="text-lg font-semibold">站源与剧集</h2>
            {sources.length ? <ul className="divide-y divide-s3">
              {sources.map(source => <li key={source.id} className="flex flex-wrap items-center gap-2 py-2">
                <p className="min-w-0 flex-1 break-words text-sm">{source.name} · {source.series.length} 部</p>
                <button className={button} disabled={busy} aria-label={"编辑 " + source.name}
                  onClick={() => setInput(JSON.stringify(source, null, 2))}>编辑</button>
                <button className={button} disabled={busy} aria-label={"下架 " + source.name}
                  onClick={() => remove(source)}>下架</button>
              </li>)}
            </ul> : <p className="text-sm text-mut">暂无已发布的站源。</p>}
            <form onSubmit={save} className="space-y-3">
              <SourceUrlInput disabled={busy} successHint="内容已填入下方编辑框，点「保存并发布」后才会出现在片库。"
                onLoad={source => setInput(JSON.stringify(source, null, 2))} />
              <GuoModules hosted />
              <RepositorySources token={token} disabled={busy} onLoad={source => {
                setInput(JSON.stringify(source));
                setStatus("仓库站源已载入编辑框。确认内容后可保存并发布。");
              }} onBatch={async source => {
                await api("admin/catalog/" + source.id, { method: "PUT", body: source, token });
                await reload();
              }} />
              <div className="flex flex-wrap gap-2">
                <label className={button + " cursor-pointer focus-within:ring-2 focus-within:ring-primary"}>
                  导入 JSON
                  <input aria-label="导入 JSON" type="file" accept=".json,application/json" className="sr-only"
                    disabled={busy} onChange={event => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void run(async () => {
                        if (file.size > MAX_SOURCE_BYTES) throw new Error("站源文件不能超过 512 KB");
                        setInput(await file.text());
                      });
                    }} />
                </label>
                <button type="button" className={button} disabled={busy} onClick={() => void run(async () => {
                  const response = await fetch("/video-source.example.json");
                  if (!response.ok) throw new Error("示例加载失败");
                  setInput(await response.text());
                })}>载入站源示例</button>
              </div>
              <label className="block space-y-1 text-sm"><span>站源 JSON</span>
                <textarea className={field + " min-h-52 font-mono"} required maxLength={MAX_SOURCE_BYTES}
                  value={input} onChange={e => setInput(e.target.value)} spellCheck={false} />
              </label>
              <p className="text-xs text-mut">保存后访客可见。同一个站源 ID 会更新已有内容。剧集可填写 poster，支持 HTTPS 封面地址。</p>
              <button className={primary} disabled={busy}>保存并发布</button>
            </form>
          </div>
          <div className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">注册账号</h2>
              <button className={button} disabled={busy} onClick={() => void run(() => readAccounts(token))}>刷新</button>
            </div>
            {page.accounts.length ? <ul className="divide-y divide-s3">
              {page.accounts.map(item => <li key={item.id} className="space-y-0.5 py-2 text-sm">
                <div className="break-words font-medium">{item.username}</div>
                <div className="break-all text-xs text-mut">{item.invite_code ? "邀请码 " + item.invite_code : "历史账号 · 无邀请码"}</div>
                <time className="text-xs text-mut" dateTime={new Date(item.created_at).toISOString()}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
              </li>)}
            </ul> : <p className="text-sm text-mut">暂无注册账号。</p>}
            {page.next && <button className={button} disabled={busy}
              onClick={() => void run(() => readAccounts(token, page.next ?? undefined))}>加载更多</button>}
          </div>
          <div className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">邀请码</h2>
              <button className={button} disabled={busy} onClick={() => void run(async () => {
                setInviteList(await api<Invite[]>("admin/invites", { token }));
              })}>{inviteList ? "刷新邀请码" : "查看邀请码"}</button>
            </div>
            <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
              event.preventDefault();
              void run(async () => {
                const invite = await api<Invite>("admin/invites", { method: "POST", body: { maxUses }, token });
                setInviteList(await api<Invite[]>("admin/invites", { token }));
                setStatus("已创建邀请码 " + invite.code);
              });
            }}>
              <label className="space-y-1 text-sm"><span>可使用次数</span>
                <input className={field + " max-w-36"} type="number" min={1} max={1000} step={1} required
                  value={maxUses || ""} onChange={e => setMaxUses(Number(e.target.value))} />
              </label>
              <button className={primary} disabled={busy}>生成邀请码</button>
            </form>
            {inviteList?.length === 0 && <p className="text-sm text-mut">暂无邀请码。</p>}
            {inviteList && <ul className="divide-y divide-s3">
              {inviteList.map(invite => <li key={invite.code} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <code className="select-text break-all text-sm">{invite.code}</code>
                  <p className="text-xs text-mut">{invite.active ? "启用" : "停用"} · 已使用 {invite.used}/{invite.max_uses}</p>
                </div>
                <button className={button} disabled={busy} onClick={() => void run(async () => {
                  await navigator.clipboard.writeText(invite.code);
                  setStatus("邀请码已复制");
                })}>复制</button>
                <button className={button} disabled={busy} onClick={() => void run(async () => {
                  const active = !invite.active;
                  await api("admin/invites/" + invite.code, { method: "PATCH", body: { active }, token });
                  setInviteList(current => current?.map(item => item.code === invite.code ? { ...item, active: Number(active) } : item) ?? null);
                })}>{invite.active ? "停用" : "启用"}</button>
              </li>)}
            </ul>}
          </div>
        </div>
      )}
    </section>
  );
}

function currentSection(): Section {
  if (window.location.pathname === "/admin" || window.location.pathname === "/admin/") return "admin";
  const selection = window.location.hash.slice(1);
  return selection === "comics" || selection === "library" || selection === "search" || selection === "account" || selection === "sources" ? selection : "home";
}

export default function Platform() {
  const [section, setSection] = useState(currentSection);
  const [user, setUser] = useState<User | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try { setSources(await api<Source[]>("catalog", { signal })); }
    catch (failure) {
      if (!signal?.aborted) setError((failure as Error).message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const onHashChange = () => setSection(currentSection());
    window.addEventListener("hashchange", onHashChange);
    void load(signal);
    void api<{ user: User | null }>("account/me", { signal }).then(result => setUser(result.user)).catch(() => {});
    return () => {
      controller.abort();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [load]);

  return (
    <div className="absolute inset-0 flex">
      <aside className="flex w-20 shrink-0 flex-col gap-3 overflow-y-auto border-r border-s3 bg-bg p-2 sm:w-44 sm:p-4">
          <a href="/" aria-label="玄果首页" className="flex items-center justify-center gap-2 font-bold sm:justify-start"><Logo size={26} /><span className="hidden sm:inline">Xghub</span></a>
          {section === "admin" ? <a href="/" className="text-sm text-mut hover:text-on">返回网站</a> : (
          <nav aria-label="主导航" className="grid gap-1">
            {([{ id: "home", label: "影视" }, { id: "comics", label: "漫画" }, { id: "library", label: "分类" },
              { id: "search", label: "搜索" }, { id: "sources", label: "站源" }, { id: "account", label: "我的" }] as const)
              .map(item => <a key={item.id} href={"#" + item.id} aria-current={section === item.id ? "page" : undefined}
                className={"rounded-lg px-2 py-3 text-center text-sm sm:text-left " + (section === item.id ? "bg-pc text-on-pc font-semibold" : "text-mut hover:bg-s3")}>{item.label}</a>)}
          </nav>
          )}
          <div className="mt-auto grid gap-2">
            <a className={button + ' text-center'} href="https://github.com/Huaxun233/Xghub/releases/download/xghub-v2.2.1-127/guoapp-2.2.1%2B127-arm64-v8a.apk" target="_blank" rel="noopener noreferrer" aria-label="下载 Android 手机版">Android 下载</a>
            <a className={button + ' text-center'} href="https://github.com/Huaxun233/Xghub/releases/download/xghub-v2.2.1-127/guoapp-2.2.1%2B127-windows-x64-setup.exe" target="_blank" rel="noopener noreferrer" aria-label="下载 Windows 版">Windows 下载</a>
            <a className={button + ' text-center'} href="/">项目主页</a>
            <WebTheme />
          </div>
      </aside>
      <main className="relative min-w-0 flex-1">
        {section === "comics" ? <Suspense fallback={<p role="status" className="p-8 text-mut">正在加载漫画阅读器…</p>}><Comics /></Suspense> : section === "home" || section === "library" || section === "search" || section === "sources" ? (
          <Videos active platform={{ section, sources, loading, error, reload: () => void load() }} />
        ) : (
          <div className="absolute inset-0 scroll-y">
            {section === "account" ? <>
              <Account user={user} onUser={setUser} />
              <div className="relative h-[65vh]"><Videos active platform={{ section: "personal", sources, loading, error, reload: () => void load() }} /></div>
            </> : <Admin sources={sources} reload={load} />}
          </div>
        )}
      </main>
    </div>
  );
}
