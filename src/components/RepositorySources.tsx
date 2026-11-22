import { useState } from "react";
import { importRepositoryBatch, REPOSITORY, REPOSITORY_CONFIGS, syncRepository, type RepositorySite } from "../repositorySources";
import type { Source } from "../videoCatalog";

const control = "rounded-lg border border-s4 bg-canvas px-3 py-2 text-sm";
const action = "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50";

export default function RepositorySources({ onLoad, disabled, token }: { onLoad: (source: Source) => void; disabled?: boolean; token?: string }) {
  const [file, setFile] = useState<typeof REPOSITORY_CONFIGS[number]>(REPOSITORY_CONFIGS[0]);
  const [sites, setSites] = useState<RepositorySite[] | null>(null);
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const compatible = sites?.filter(site => site.endpoint) ?? [];
  const unsupported = sites?.filter(site => !site.endpoint) ?? [];
  const site = compatible.find(item => item.key === selected);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setError("");
    try { await task(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }

  async function readFromServer(query: URLSearchParams) {
    const response = await fetch("/api/admin/video-repository/pages?" + query, {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "后台读取源站失败");
    return data;
  }

  async function importSite() {
    if (!site) return;
    const result = await importRepositoryBatch(site, page, count, {
      progress: (current, titles) => setMessage(`正在读取第 ${current} 页，已收录 ${titles} 部。`),
      read: token ? async (start, batchSize) => {
        const query = new URLSearchParams({ file, site: site.key, start: String(start), count: String(batchSize) });
        return (await readFromServer(query)).pages;
      } : undefined,
    });
    onLoad(result.source);
    const continuation = result.resumePage ? "。可从第 " + result.resumePage + " 页继续" : "";
    setMessage("已读取 " + result.pagesRead + " 页，共 " + result.source.series.length + " 部" +
      (result.stopReason ? " · " + result.stopReason : "") + continuation +
      (token ? "。已填入编辑框，确认后点击「保存并发布」。" : "。"));
    if (result.errors.length) setError("部分页面未导入：" + result.errors.slice(0, 3).join("；") +
      (result.errors.length > 3 ? " 等 " + result.errors.length + " 项" : ""));
  }

  return (
    <details className="space-y-3 rounded-xl border border-s3 bg-s1 p-3">
      <summary className="cursor-pointer text-sm font-semibold">仓库站源</summary>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">配置文件
          <select className={control + " ml-2"} value={file} disabled={busy || disabled} onChange={event => {
            setFile(event.target.value as typeof file);
            setSites(null); setSelected(""); setMessage(""); setError("");
          }}>{REPOSITORY_CONFIGS.map(item => <option key={item}>{item}</option>)}</select>
        </label>
        <button type="button" className={action} disabled={busy || disabled} onClick={() => void run(async () => {
          const result: RepositorySite[] = token
            ? (await readFromServer(new URLSearchParams({ file }))).sites
            : await syncRepository(file);
          const count = result.filter(option => option.endpoint).length;
          setSites(result);
          setSelected(result.find(option => option.endpoint)?.key ?? "");
          setMessage("已同步 " + result.length + " 个站点，" + count + " 个可尝试导入。");
        })}>{busy ? "正在读取…" : "同步仓库源"}</button>
        <a href={REPOSITORY} target="_blank" rel="noreferrer" className="px-1 py-2 text-sm text-mut underline">配置仓库</a>
      </div>
      {sites && compatible.length > 0 && <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 text-sm">选择站点
          <select className={control + " ml-2 max-w-48"} value={selected} disabled={busy || disabled}
            onChange={event => setSelected(event.target.value)}>
            {compatible.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">起始页
          <input className={control + " ml-2 w-20"} type="number" min={1} max={9999} step={1} value={page || ""}
            disabled={busy || disabled} onChange={event => setPage(Number(event.target.value))} />
        </label>
        <label className="text-sm">最多读取
          <select className={control + " ml-2"} value={count} disabled={busy || disabled}
            onChange={event => setCount(Number(event.target.value))}>
            {[5, 10, 20, 50].map(amount => <option key={amount} value={amount}>{amount} 页</option>)}
          </select>
        </label>
        <button type="button" className={action}
          disabled={busy || disabled || !site || !Number.isInteger(page) || page < 1 || page + count > 10000}
          onClick={() => void run(importSite)}>{busy ? "正在处理…" : "批量导入"}</button>
      </div>}
      {unsupported.length > 0 && <details className="text-xs text-mut">
        <summary className="cursor-pointer">查看 {unsupported.length} 个暂不兼容的站点</summary>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {unsupported.map(item => <li key={item.key}>{item.name} · {item.reason}</li>)}
        </ul>
      </details>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </details>
  );
}
