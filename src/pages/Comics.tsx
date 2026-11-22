import ComicPlugins from '../components/ComicPlugins';
import { readSourceText } from '../sourceUrl';
import { useState } from 'react';
import { parseComicCatalog, type ComicCatalog, type WebComic } from '../comicCatalog';
const key = 'xghub.web.comics.v1';
function saved<T>(name: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(name) || 'null') ?? fallback; } catch { return fallback; } }
const button = 'rounded-xl bg-s3 px-4 py-2 text-sm hover:bg-s4';
export default function Comics() {
  const [catalogs, setCatalogs] = useState<ComicCatalog[]>(() => saved<unknown[]>(key, []).flatMap(item => { try { return [parseComicCatalog(item)]; } catch { return []; } }));
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  async function cloud(mode: 'upload' | 'download') {
    setBusy(true); setError(''); setSyncMessage('');
    try {
      const response = await fetch('/api/comics/state', {credentials:'same-origin',cache:'no-store'});
      const snapshot = await response.json(); if(!response.ok) throw new Error(snapshot.error || '读取云端失败');
      if(mode === 'upload') {
        const progress: Record<string, number> = {};
        for(const name of Object.keys(localStorage)) if(name.startsWith(key+'.progress.')) {const value=Number(localStorage.getItem(name)); if(Number.isSafeInteger(value) && value>=0) progress[name.slice((key+'.progress.').length)]=value;}
        const result = await fetch('/api/comics/state', {method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:snapshot.revision,catalogs,shelf,progress})});
        const data = await result.json(); if(!result.ok) throw new Error(data.error || '上传失败');
        setSyncMessage('漫画目录和书架已上传');
      } else {
        if(!snapshot.state) throw new Error('当前账号还没有云端书架');
        const imported = snapshot.state.catalogs.map(parseComicCatalog) as ComicCatalog[];
        const next = [...catalogs.filter(c => !imported.some(n => n.id === c.id)), ...imported];
        const nextShelf = [...new Set<string>([...shelf,...snapshot.state.shelf])];
        localStorage.setItem(key,JSON.stringify(next)); localStorage.setItem(key+'.shelf',JSON.stringify(nextShelf));
        for(const [id,value] of Object.entries(snapshot.state.progress ?? {})) if(Number.isSafeInteger(value) && Number(value)>=0 && Number(value)<2000) localStorage.setItem(key+'.progress.'+id,String(value));
        setCatalogs(next); setShelf(nextShelf); setSyncMessage('云端书架和章节进度已合并到本机');
      }
    } catch(e) {setError((e as Error).message)} finally {setBusy(false)}
  }
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ comic: WebComic; source: string } | null>(null);
  const [chapter, setChapter] = useState(0);
  const [shelf, setShelf] = useState<string[]>(() => saved(key + '.shelf', []));
  const [onlyShelf, setOnlyShelf] = useState(false);
  function importText(text: string) {
    try {
      if (text.length > 2 * 1024 * 1024) throw new Error('目录文件不能超过 2 MB');
      const catalog = parseComicCatalog(JSON.parse(text));
      const next = [...catalogs.filter(item => item.id !== catalog.id), catalog];
      localStorage.setItem(key, JSON.stringify(next)); setCatalogs(next); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  function choose(index: number) {
    if (!selected) return;
    try { localStorage.setItem(key + '.progress.' + selected.source + ':' + selected.comic.id, String(index)); setChapter(index); }
    catch { setError('无法保存阅读进度，请检查浏览器存储空间'); }
  }
  if (selected) return <section className="absolute inset-0 overflow-y-auto bg-bg p-4 sm:p-8">
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-bg py-3">
      <button className={button} onClick={() => setSelected(null)}>返回漫画</button><h1 className="font-bold">{selected.comic.title}</h1>
      <select aria-label="选择章节" className={button} value={chapter} onChange={e => choose(Number(e.target.value))}>{selected.comic.chapters.map((c, i) => <option key={c.id} value={i}>{c.title}</option>)}</select>
      <button className={button} onClick={() => { const id = selected.source + ':' + selected.comic.id; const next = shelf.includes(id) ? shelf.filter(v => v !== id) : [...shelf, id]; try { localStorage.setItem(key + '.shelf', JSON.stringify(next)); setShelf(next); } catch { setError('书架保存失败'); } }}>{shelf.includes(selected.source + ':' + selected.comic.id) ? '移出书架' : '加入书架'}</button>
    </header>
    {error && <p role="alert">{error}</p>}
    <div className="mx-auto max-w-3xl">{selected.comic.chapters[chapter].pages.map((url, i) => <figure key={url + i}><img src={url} alt={'第 ' + (i + 1) + ' 页'} loading={i ? 'lazy' : 'eager'} referrerPolicy="no-referrer" className="h-auto w-full" onError={e => { e.currentTarget.alt = '图片加载失败：第 ' + (i + 1) + ' 页，请检查源地址'; }} /></figure>)}</div>
    <footer className="flex justify-center gap-4 py-8"><button className={button} disabled={!chapter} onClick={() => choose(chapter - 1)}>上一章</button><button className={button} disabled={chapter === selected.comic.chapters.length - 1} onClick={() => choose(chapter + 1)}>下一章</button></footer>
  </section>;
  const entries = catalogs.flatMap(source => source.comics.map(comic => ({ source, comic }))).filter(({source, comic}) => (!onlyShelf || shelf.includes(source.id + ':' + comic.id)) && (comic.title + comic.category).toLowerCase().includes(query.toLowerCase()));
  return <section className="absolute inset-0 overflow-y-auto p-4 sm:p-8">
    <header className="mb-6"><div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-200 text-3xl font-black text-pink-950" role="img" aria-label="玄果漫画 X 书本图标">X<span className="text-lg">▤</span></div><h1 className="text-3xl font-bold">玄果漫画</h1><p className="mt-1 text-xs text-mut">基于 VeneraX</p><p className="mt-2 text-sm text-mut">导入网页漫画目录，搜索、阅读章节并收藏到本机书架。</p></header>
    <div className="mb-6 flex flex-wrap gap-3"><input aria-label="搜索漫画" placeholder="搜索漫画或分类" className="min-w-0 flex-1 rounded-xl border border-s3 bg-s1 px-4 py-2" value={query} onChange={e => setQuery(e.target.value)} /><button className={button} aria-pressed={onlyShelf} onClick={() => setOnlyShelf(!onlyShelf)}>{onlyShelf ? '查看全部' : '我的书架'}</button><label className={button}>导入目录<input aria-label="导入漫画目录" className="hidden" type="file" accept="application/json,.json" onChange={e => { const file = e.target.files?.[0]; if(file) { if(file.size > 2 * 1024 * 1024) setError('目录文件不能超过 2 MB'); else void file.text().then(importText).catch(() => setError('文件读取失败')); } e.target.value = ''; }} /></label></div>
    <div className="mb-4 flex flex-wrap items-center gap-2"><button className={button} disabled={busy} onClick={() => void cloud('upload')}>上传书架到账号</button><button className={button} disabled={busy} onClick={() => void cloud('download')}>合并云端书架</button><span role="status" className="text-sm text-mut">{syncMessage}</span></div>
    <p className="mb-4 text-xs text-mut">需先在「我的」登录。上传会替换当前账号云端目录和书架；下载会合并到本机，同 ID 目录使用云端版本。合并时同一漫画的章节进度使用云端版本。</p>
    <ComicPlugins onRead={(comic, source) => {
      try {
        const existing = catalogs.find(c => c.id === source);
        const previous = existing?.comics.find(c => c.id === comic.id);
        const merged = {...comic, chapters: [...(previous?.chapters.filter(c => !comic.chapters.some(n => n.id === c.id)) ?? []), ...comic.chapters]};
        const catalog: ComicCatalog = {version: 1, id: source, name: existing?.name ?? source, comics: [...(existing?.comics.filter(c => c.id !== comic.id) ?? []), merged]};
        const next = [...catalogs.filter(c => c.id !== source), catalog];
        localStorage.setItem(key, JSON.stringify(next)); setCatalogs(next);
        setSelected({comic: merged, source}); setChapter(merged.chapters.findIndex(c => c.id === comic.chapters[0].id));
      } catch { setError('无法保存插件章节，请检查浏览器存储空间'); }
    }} />
    <details className="mb-6 rounded-2xl border border-s3 bg-s1 p-4">
      <summary className="cursor-pointer font-medium">漫画源管理 · {catalogs.length} 个目录</summary>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setBusy(true); setError(''); void readSourceText(address).then(importText).catch(e => setError((e as Error).message)).finally(() => setBusy(false)); }}>
        <input aria-label="漫画目录网址" type="url" required placeholder="https://example.com/comics.json" className="min-w-0 flex-1 rounded-xl border border-s3 bg-bg px-3 py-2" value={address} onChange={e => setAddress(e.target.value)} />
        <button className={button} disabled={busy}>{busy ? '正在导入…' : '从网址导入'}</button>
      </form>
      <p className="mt-2 text-xs text-mut">网址须支持浏览器跨域读取。目录和书架保存在当前浏览器，清除网站数据后会丢失。</p>
      <ul className="mt-3 divide-y divide-s3">{catalogs.map(c => <li key={c.id} className="flex items-center justify-between gap-3 py-2"><span>{c.name} · {c.comics.length} 部</span><button className={button} onClick={() => { try { const next = catalogs.filter(v => v.id !== c.id); localStorage.setItem(key, JSON.stringify(next)); setCatalogs(next); } catch { setError('目录删除失败'); } }}>删除目录</button></li>)}</ul>
    </details>
    {error && <p role="alert" className="mb-4 text-red-400">{error}</p>}
    {!entries.length && <div className="rounded-2xl border border-s3 bg-s1 p-8 text-mut">{catalogs.length ? '没有匹配的漫画。' : '还没有漫画目录。网页 JSON 目录需包含漫画、章节和 HTTPS 图片地址。JavaScript 插件请使用上方独立的插件入口。'}</div>}
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">{entries.map(({source, comic}) => <button key={source.id + ':' + comic.id} className="text-left" onClick={() => { setSelected({comic, source: source.id}); const p = Number(saved(key + '.progress.' + source.id + ':' + comic.id, 0)); setChapter(Number.isInteger(p) && p >= 0 && p < comic.chapters.length ? p : 0); }}><div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-s3">{comic.cover ? <img src={comic.cover} alt={comic.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <span className="p-4 text-muted">{comic.title}</span>}</div><h2 className="mt-2 truncate font-semibold">{comic.title}</h2><p className="text-xs text-mut">{comic.category} · {comic.chapters.length} 章</p></button>)}</div>
  </section>;
}
