import { useState } from "react";
import { syncGuoModules, type GuoModule } from "../guoModules";

export default function GuoModules({ hosted = false }: { hosted?: boolean }) {
  const [modules, setModules] = useState<GuoModule[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sync() {
    setBusy(true);
    setError("");
    try { setModules(await syncGuoModules(hosted)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "小果模块索引读取失败"); }
    finally { setBusy(false); }
  }

  return (
    <details className="space-y-3 rounded-xl border border-s3 bg-s1 p-3">
      <summary className="cursor-pointer text-sm font-semibold">小果模块目录</summary>
      <p className="text-xs text-mut">查看客户端可安装的视频插件。网页版可使用上面的仓库站源、JSON 目录或视频直链。</p>
      <button type="button" disabled={busy} onClick={() => void sync()}
        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
        {busy ? "正在同步…" : "同步小果模块"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {modules && <div>
        <p role="status" className="text-sm">已读取 {modules.length} 个模块</p>
        <ul className="mt-2 space-y-1">
          {modules.map(module => <li key={module.id} className="text-sm">
            <a href={module.repository} target="_blank" rel="noreferrer" className="underline">{module.name}</a>
            <span className="ml-2 text-mut">{module.version}{module.adult ? " · 限制级" : ""} · 客户端</span>
            {module.description && <p className="text-xs text-mut">{module.description}</p>}
          </li>)}
        </ul>
      </div>}
    </details>
  );
}
