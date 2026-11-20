import { useEffect, useRef, useState, type FormEvent } from "react";
import VideoSurface, { type VideoHandle } from "../components/VideoSurface";
import { IClapper, IHist, ILink, IPlayF, IStar, IStarF } from "../icons";
import {
  LINKS, MAX_SOURCE_BYTES, parseEpisode, parseSource, readLibrary, saveLibrary,
  type Episode, type Library, type Series, type Source,
} from "../videoLibrary";

const button = "rounded-(--r-ctl) bg-s3 px-3.5 py-2 text-sm font-medium hover:bg-s4";
const primary = "rounded-(--r-ctl) bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary";
const field = "w-full min-w-0 rounded-(--r-ctl) border border-s4 bg-canvas px-3 py-2 text-sm";

type View = "all" | "followed" | "history";
type Entry = { key: string; series: Series; source: Source };

function Playback({ episode, start, save }: {
  episode: Episode;
  start: number;
  save: (time: number, complete?: boolean) => void;
}) {
  const video = useRef<VideoHandle>(null);
  const restore = useRef(start);
  const lastSave = useRef(start);
  const finished = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = video.current?.el();
    if (!el) return;
    const flush = () => record(el.currentTime, true);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      if (Math.abs(el.currentTime - lastSave.current) >= 0.25) flush();
    };
  }, []);
  useEffect(() => {
    if (!restore.current) return;
    const el = video.current?.el();
    if (!el) return;
    const resume = () => {
      if (!Number.isFinite(el.duration) || !restore.current) return;
      const time = restore.current;
      restore.current = 0;
      if (time < el.duration - 0.5) video.current?.seek(time, false);
    };
    el.addEventListener("loadedmetadata", resume);
    if (el.readyState) resume();
    return () => el.removeEventListener("loadedmetadata", resume);
  }, []);

  const record = (time: number, force = false) => {
    if (restore.current || finished.current || !Number.isFinite(time) || (!force && Math.abs(time - lastSave.current) < 3)) return;
    lastSave.current = time;
    save(time);
  };

  return (
    <div className="relative aspect-video max-h-[60vh] overflow-hidden rounded-(--r-md) bg-black">
      <VideoSurface ref={video} src={episode.url} direct={episode.format} autoPlay={false}
        onTime={record}
        onPause={() => record(video.current?.el()?.currentTime || 0, true)}
        onPlaying={() => { finished.current = false; setFailed(false); }}
        onEnded={() => { finished.current = true; save(0, true); }}
        onError={() => setFailed(true)} />
      {failed && <div role="alert" className="absolute inset-0 grid place-content-center gap-3 bg-black/90 px-4 text-center text-sm text-white">
        <p>播放失败。请检查链接、视频格式和站源的跨域设置。</p>
        <button className={primary + " justify-self-center"} onClick={() => {
          setFailed(false);
          video.current?.reload();
        }}>重试</button>
      </div>}
    </div>
  );
}

type PlatformCatalog = {
  section: "home" | "library" | "search" | "personal";
  sources: Source[];
  loading: boolean;
  error: string;
  reload: () => void;
};

export default function Videos({ active, bottomInset = 0, platform }: {
  active: boolean; bottomInset?: number; platform?: PlatformCatalog;
}) {
  const [library, setLibrary] = useState(readLibrary);
  const latest = useRef(library);
  const [view, setView] = useState<View>(platform?.section === "personal" ? "history" : "all");
  const [sourceId, setSourceId] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<{ key: string; episode: string }>();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const player = useRef<HTMLElement>(null);

  const update = (change: (previous: Library) => Library) => {
    const next = change(latest.current);
    latest.current = next;
    setLibrary(next);
    try {
      saveLibrary(next);
    } catch {
      setError("设备存储空间不足或不可用，本次更改只在当前会话保留。");
    }
  };
  const sources = platform?.sources ?? library.sources;
  const entries = sources.flatMap(source => source.series.map(series => ({
    key: (platform ? "shared:" : "") + source.id + "/" + series.id, source, series,
  })));
  const categories = platform ? [...new Set(entries.map(entry => entry.series.category))].sort() : [];
  const selected = entries.find(entry => entry.key === selection?.key);
  const current = selected?.series.episodes.find(episode => episode.id === selection?.episode);
  const visible = entries.filter(({ key, series, source }) => {
    if (sourceId && sourceId !== source.id) return false;
    if (category && category !== series.category) return false;
    if (view === "followed" && !library.followed.includes(key)) return false;
    if (view === "history" && !library.progress[key]) return false;
    const haystack = [series.title, series.category, series.description, source.name].join(" ").toLocaleLowerCase();
    return haystack.includes(query.trim().toLocaleLowerCase());
  });
  if (view === "history") {
    visible.sort((a, b) => library.progress[b.key].updated - library.progress[a.key].updated);
  }

  function select(entry: Entry, episodeId?: string) {
    const progress = latest.current.progress[entry.key];
    const series = entry.series.episodes;
    const previousIndex = series.findIndex(episode => episode.id === progress?.episode);
    const resumeIndex = progress?.complete && previousIndex + 1 < series.length ? previousIndex + 1 : previousIndex;
    setSelection({ key: entry.key, episode: episodeId ?? series[Math.max(resumeIndex, 0)].id });
    window.requestAnimationFrame(() => player.current?.scrollIntoView({ block: "nearest" }));
  }

  async function importSource(file: File) {
    setMessage("");
    setError("");
    try {
      if (file.size > MAX_SOURCE_BYTES) throw new Error("站源文件不能超过 512 KB");
      const source = parseSource(JSON.parse(await file.text()));
      if (source.id === LINKS) throw new Error("此 ID 保留给视频直链");
      update(previous => ({
        ...previous, sources: [...previous.sources.filter(item => item.id !== source.id), source],
      }));
      setSourceId(source.id);
      setView("all");
      setQuery("");
      setMessage("已导入 " + source.name);
    } catch (reason) {
      setError(reason instanceof SyntaxError ? "无法读取 JSON，请检查站源文件格式。" : (reason as Error).message);
    }
  }

  function addLink(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const episode = parseEpisode({ id: "video", title: "正片", url });
      const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      const series = { id, title: title.trim() || "未命名视频", category: "直链", description: "", episodes: [episode] };
      const links = latest.current.sources.find(source => source.id === LINKS);
      const source = parseSource({ version: 1, id: LINKS, name: "视频直链", series: [...(links?.series ?? []), series] });
      update(previous => ({
        ...previous, sources: [...previous.sources.filter(item => item.id !== LINKS), source],
      }));
      setTitle("");
      setUrl("");
      setView("all");
      setSourceId(LINKS);
      setQuery("");
      select({ key: LINKS + "/" + id, series, source });
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  function removeSource() {
    const source = library.sources.find(item => item.id === sourceId);
    if (!source) return;
    update(previous => ({ ...previous, sources: previous.sources.filter(item => item.id !== sourceId) }));
    if (selected?.source.id === sourceId) setSelection(undefined);
    setSourceId("");
    setMessage("已移除 " + source.name);
  }

  function toggleFollow(key: string) {
    update(previous => ({
      ...previous,
      followed: previous.followed.includes(key) ? previous.followed.filter(item => item !== key) : [...previous.followed, key],
    }));
  }

  return (
    <div className="absolute inset-0 scroll-y px-4 sm:px-7"
      style={{ paddingTop: "calc(var(--sat, 0px) + 20px)", paddingBottom: "calc(var(--sab, 0px) + " + (bottomInset + 24) + "px)" }}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{platform?.section === "home" ? "首页" : platform?.section === "library" ? "分类" : platform?.section === "search" ? "搜索" : platform?.section === "personal" ? "我的片单" : "视频库"}</h1>
          {!platform && <label className={button + " relative cursor-pointer focus-within:ring-2 focus-within:ring-primary"}>
            导入站源
            <input className="sr-only" aria-label="导入站源" type="file" accept=".json,application/json"
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void importSource(file);
              }} />
          </label>}
        </div>
        {!platform && <form onSubmit={addLink} className="grid gap-2 rounded-(--r-md) bg-s1 p-3 sm:grid-cols-[1fr_2fr_auto]">
          <input className={field} aria-label="视频名称" placeholder="视频名称（选填）" value={title}
            onChange={event => setTitle(event.target.value)} maxLength={120} />
          <input className={field} aria-label="HTTPS 播放地址" placeholder="HTTPS 视频直链（MP4 或 M3U8）"
            type="url" required value={url} onChange={event => setUrl(event.target.value)} />
          <button className={primary + " inline-flex items-center justify-center gap-2"}><ILink size={16} />添加直链</button>
        </form>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {message && <p role="status" className="text-sm text-mut">{message}</p>}
        {platform?.error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
          {platform.error}<button className={button} onClick={platform.reload}>重试</button>
        </div>}

        {platform?.section === "home" && !selected && entries[0] && (
          <section className="flex min-h-64 flex-col justify-end gap-3 rounded-3xl border border-s3 bg-linear-to-br from-pc via-s2 to-s1 p-6 shadow-xl sm:min-h-80 sm:p-10">
            <div className="text-sm text-mut">最新上架</div>
            <h2 className="max-w-xl break-words text-3xl font-bold">{entries[0].series.title}</h2>
            {entries[0].series.description && <p className="max-w-xl break-words text-sm text-mut">{entries[0].series.description}</p>}
            <button className={primary + " flex w-fit items-center gap-2"} onClick={() => select(entries[0])}>
              <IPlayF size={15} />立即播放
            </button>
          </section>
        )}

        {selected && current && (
          <section ref={player} aria-label="播放器" className="space-y-3 rounded-(--r-md) bg-s1 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold">{selected.series.title}</h2>
                <p className="break-words text-sm text-mut">{selected.source.name} · {current.title}</p>
              </div>
              <div className="flex gap-2">
                <button className={button} onClick={() => toggleFollow(selected.key)}>
                  {library.followed.includes(selected.key) ? "取消追剧" : "追剧"}
                </button>
                <button className={button} onClick={() => setSelection(undefined)}>关闭播放器</button>
              </div>
            </div>
            {active && <Playback key={selected.key + "/" + current.id + "/" + current.url} episode={current}
              start={library.progress[selected.key]?.episode === current.id ? library.progress[selected.key].time : 0}
              save={(time, complete) => {
                update(previous => {
                  const existing = previous.progress[selected.key];
                  if (time < 0.5 && !complete && existing?.episode !== current.id) return previous;
                  return {
                    ...previous,
                    progress: { ...previous.progress, [selected.key]: { episode: current.id, time, complete, updated: Date.now() } },
                  };
                });
              }} />}
            {selected.series.description && <p className="break-words text-sm text-mut">{selected.series.description}</p>}
            {selected.series.episodes.length > 1 && (
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto" aria-label="选集">
                {selected.series.episodes.map(episode => (
                  <button key={episode.id} className={episode.id === current.id ? primary : button}
                    aria-pressed={episode.id === current.id} onClick={() => select(selected, episode.id)}>{episode.title}</button>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {([{ id: "all", label: "全部" }, { id: "followed", label: "追剧" }, { id: "history", label: "观看记录" }] as const)
            .map(item => <button key={item.id} className={view === item.id ? primary : button}
              aria-pressed={view === item.id} onClick={() => { setView(item.id); setSourceId(""); setCategory(""); }}>{item.label}</button>)}
          <div className="ml-auto flex flex-wrap gap-2">
            <select aria-label="筛选站源" className={field + " max-w-52"} value={sourceId} onChange={event => setSourceId(event.target.value)}>
              <option value="">所有站源</option>
              {sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
            </select>
            {platform && categories.length > 0 && (
              <select aria-label="筛选分类" className={field + " max-w-52"} value={category} onChange={event => setCategory(event.target.value)}>
                <option value="">所有分类</option>
                {categories.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            )}
            {!platform && sourceId && <button onClick={removeSource} className={button}>移除所选站源</button>}
          </div>
          <input className={field} type="search" aria-label="搜索视频库" placeholder="按名称或分类搜索" value={query}
            onChange={event => setQuery(event.target.value)} />
        </div>

        {visible.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map(entry => {
              const followed = library.followed.includes(entry.key);
              const progress = library.progress[entry.key];
              return <li key={entry.key} className="relative min-w-0 overflow-hidden rounded-2xl border border-s3 bg-s1 transition hover:border-primary">
                <button className="block w-full min-w-0 text-left" onClick={() => select(entry)}>
                  <span className="grid aspect-video place-items-center bg-linear-to-br from-pc to-s2 text-primary">
                    {progress ? <IHist size={26} /> : <IPlayF size={26} />}
                  </span>
                  <span className="block min-w-0 p-3">
                    <span className="block truncate font-semibold">{entry.series.title}</span>
                    <span className="block truncate text-xs text-mut">{entry.source.name} · {entry.series.category} · {entry.series.episodes.length} 集</span>
                  </span>
                </button>
                <button className={button + " absolute right-2 top-2"} aria-label={(followed ? "取消追剧 " : "追剧 ") + entry.series.title}
                  aria-pressed={followed} onClick={() => toggleFollow(entry.key)}>
                  {followed ? <IStarF size={17} className="text-amber" /> : <IStar size={17} />}
                </button>
              </li>;
            })}
          </ul>
        ) : <div className="grid justify-items-center gap-2 rounded-(--r-md) bg-s1 px-3 py-10 text-center text-sm text-mut">
          <IClapper size={30} />
          <p>{sources.length ? "没有符合条件的视频" :
            platform?.loading ? "正在加载视频…" : platform ? "暂无已发布的视频" : "导入 JSON 站源或添加视频直链后开始播放"}</p>
        </div>}
      </div>
    </div>
  );
}
