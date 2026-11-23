import { useEffect, useRef, useState } from "react";
import VideoSurface from "./VideoSurface";
import { syncGuoModules, type GuoModule } from "../guoModules";
import { GuoModuleRuntime, type GuoChapter, type GuoDrama, type GuoMedia } from "../guoModuleRuntime";
import { addPin, readPins, removePin } from "../guoModulePins";

function coverOf(drama: GuoDrama): string | undefined {
  for (const key of ["coverUrl", "cover", "image", "imageUrl", "img", "pic", "poster", "thumb", "thumbnail"]) {
    const value = drama[key];
    if (typeof value === "string" && /^https:\/\//.test(value)) return value;
  }
  return undefined;
}

function titleOf(drama: GuoDrama): string {
  return String(drama.title || drama.name || "短剧");
}

function mediaSource(media: GuoMedia): { src: string; direct: "file" | "hls" } | null {
  if (media.url) return { src: media.url, direct: /\.m3u8($|\?)/i.test(media.url) ? "hls" : "file" };
  if (media.playlist) return { src: URL.createObjectURL(new Blob([media.playlist], { type: "application/vnd.apple.mpegurl" })), direct: "hls" };
  return null;
}

export function GuoModuleTrial({ module, onClose, onReload }: {  module: Pick<GuoModule, "id" | "name">; onClose: () => void; onReload?: () => void;
}) {
  const [runtime, setRuntime] = useState<GuoModuleRuntime | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("正在加载模块…");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<GuoDrama[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<{ drama: GuoDrama; chapters: GuoChapter[] } | null>(null);
  const [playing, setPlaying] = useState<{ src: string; direct: "file" | "hls"; title: string } | null>(null);
  const [pinned, setPinned] = useState(() => readPins().some(pin => pin.id === module.id));
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    GuoModuleRuntime.load(module.id).then(async instance => {
      if (!alive) { instance.dispose(); return; }
      setRuntime(instance);
      try {
        const result = await instance.categories(false);
        const list = Array.isArray(result) ? result : result?.items ?? [];
        setCategories((list ?? []).filter(item => item && typeof item.id === "string").slice(0, 60));
        setStatus("");
      } catch (failure) {
        setStatus("");
        setError(failure instanceof Error ? failure.message : "模块目录读取失败");
      }
    }).catch(failure => {
      if (alive) setError(failure instanceof Error ? failure.message : "模块加载失败");
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id]);

  useEffect(() => () => runtime?.dispose(), [runtime]);

  async function run(task: () => Promise<{ items: GuoDrama[]; hasMore: boolean }>, nextPage: number) {
    if (!runtime || busy.current) return;
    busy.current = true;
    setError("");
    try {
      const result = await task();
      setItems(result.items ?? []);
      setHasMore(!!result.hasMore);
      setPage(nextPage);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "模块调用失败");
    } finally { busy.current = false; }
  }

  async function openDetail(drama: GuoDrama) {
    if (!runtime || busy.current) return;
    busy.current = true;
    setError("");
    try {
      const result = await runtime.detail(String(drama.sourceId ?? drama.id));
      setDetail({ drama: result?.drama ?? drama, chapters: Array.isArray(result?.chapters) ? result.chapters : [] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "详情读取失败");
    } finally { busy.current = false; }
  }

  async function play(chapter: GuoChapter, index: number) {
    if (!runtime || !detail || busy.current) return;
    busy.current = true;
    setError("");
    try {
      const drama = detail.drama;
      const media = await runtime.resolveMedia({
        dramaId: drama.id,
        dramaTitle: titleOf(drama),
        chapter,
        index,
        total: detail.chapters.length,
      });
      const source = media && mediaSource(media);
      if (!source) throw new Error("模块没有返回可播放的地址");
      setPlaying({ ...source, title: `${titleOf(drama)} · ${String(chapter.title || chapter.currentEpisode || "播放")}` });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "播放地址解析失败");
    } finally { busy.current = false; }
  }

  if (playing) return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{playing.title}</p>
        <button type="button" className="shrink-0 rounded-lg border border-s3 px-2 py-1 text-xs" onClick={() => setPlaying(null)}>返回</button>
      </div>
      <div className="overflow-hidden rounded-xl bg-black">
        <VideoSurface src={playing.src} direct={playing.direct} autoPlay active className="aspect-video w-full" />
      </div>
      <p className="text-xs text-mut">部分站点需要 Cookie / Referer 凭据，若播放失败请在客户端使用。</p>
    </div>
  );

  if (detail) return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{titleOf(detail.drama)}</p>
        <button type="button" className="shrink-0 rounded-lg border border-s3 px-2 py-1 text-xs" onClick={() => setDetail(null)}>返回</button>
      </div>
      {coverOf(detail.drama) && <img src={coverOf(detail.drama)} alt="" className="max-h-40 rounded-lg" loading="lazy" />}
      <p className="text-xs text-mut">{String(detail.drama.desc || detail.drama.intro || "")}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {detail.chapters.map((chapter, index) => (
          <button key={chapter.id || index} type="button" onClick={() => void play(chapter, index)}
            className="truncate rounded-lg border border-s3 px-2 py-1.5 text-xs hover:border-primary">
            {String(chapter.title || chapter.currentEpisode || `第 ${index + 1} 集`)}
          </button>
        ))}
      </div>
      {!detail.chapters.length && <p className="text-sm text-mut">模块没有返回剧集</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{module.name}</p>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="rounded-lg border border-s3 px-2 py-1 text-xs hover:border-primary"
            onClick={() => {
              if (pinned) { removePin(module.id); setPinned(false); }
              else { addPin({ id: module.id, name: module.name }); setPinned(true); }
            }}>
            {pinned ? "从首页移除" : "添加到首页"}
          </button>
          <button type="button" className="rounded-lg border border-s3 px-2 py-1 text-xs" onClick={onClose}>关闭</button>
        </div>
      </div>
      {status && <p className="text-sm text-mut">{status}</p>}
      {error && <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
        {error}
        {onReload && <button type="button" className="rounded-lg border border-s3 px-2 py-1 text-xs" onClick={onReload}>重新加载</button>}
      </p>}
      <form className="flex gap-2" onSubmit={event => {
        event.preventDefault();
        if (query.trim()) void run(() => runtime!.search(1, query.trim()), 1);
      }}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索本模块"
          className="min-w-0 flex-1 rounded-lg border border-s3 bg-s1 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary">搜索</button>
      </form>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => void run(() => runtime!.catalogPage(1, ""), 1)}
            className={`rounded-full border px-2.5 py-1 text-xs ${category === "" ? "border-primary text-primary" : "border-s3"}`}>全部</button>
          {categories.map(item => (
            <button key={item.id} type="button" onClick={() => { setCategory(item.id); void run(() => runtime!.catalogPage(1, item.id), 1); }}
              className={`rounded-full border px-2.5 py-1 text-xs ${category === item.id ? "border-primary text-primary" : "border-s3"}`}>
              {item.name}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((drama, index) => (
          <button key={drama.id || index} type="button" onClick={() => void openDetail(drama)}
            className="space-y-1 text-left">
            {coverOf(drama)
              ? <img src={coverOf(drama)} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
              : <div className="aspect-[2/3] w-full rounded-lg bg-s2" />}
            <p className="truncate text-xs">{titleOf(drama)}</p>
          </button>
        ))}
      </div>
      {!items.length && !status && <p className="text-sm text-mut">没有内容，试试搜索或换分类</p>}
      {items.length > 0 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <button type="button" className="rounded-lg border border-s3 px-3 py-1.5 text-xs"
            onClick={() => void run(() => query.trim() ? runtime!.search(page - 1, query.trim()) : runtime!.catalogPage(page - 1, category), page - 1)}>上一页</button>}
          {hasMore && <button type="button" className="rounded-lg border border-s3 px-3 py-1.5 text-xs"
            onClick={() => void run(() => query.trim() ? runtime!.search(page + 1, query.trim()) : runtime!.catalogPage(page + 1, category), page + 1)}>下一页</button>}
        </div>
      )}
    </div>
  );
}

export default function GuoModules({ hosted = false }: { hosted?: boolean }) {
  const [modules, setModules] = useState<GuoModule[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trial, setTrial] = useState<GuoModule | null>(null);
  const [trialKey, setTrialKey] = useState(0);

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
      <p className="text-xs text-mut">客户端可安装的视频插件。网页版可直接试用：在浏览器沙箱里运行模块的目录、搜索与播放解析。</p>
      <button type="button" disabled={busy} onClick={() => void sync()}
        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
        {busy ? "正在同步…" : "同步小果模块"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {trial && <div className="rounded-xl border border-s3 p-3">
        <GuoModuleTrial key={trialKey} module={trial} onClose={() => setTrial(null)} onReload={() => setTrialKey(key => key + 1)} />
      </div>}
      {modules && <div>
        <p role="status" className="text-sm">已读取 {modules.length} 个模块</p>
        <ul className="mt-2 space-y-1">
          {modules.map(module => <li key={module.id} className="text-sm">
            <a href={module.repository} target="_blank" rel="noreferrer" className="underline">{module.name}</a>
            <span className="ml-2 text-mut">{module.version}{module.adult ? " · 限制级" : ""}</span>
            <button type="button" onClick={() => setTrial(module)}
              className="ml-2 rounded-lg border border-s3 px-2 py-0.5 text-xs hover:border-primary">网页试用</button>
            {module.description && <p className="text-xs text-mut">{module.description}</p>}
          </li>)}
        </ul>
      </div>}
    </details>
  );
}
