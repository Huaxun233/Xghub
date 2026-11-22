import { useEffect, useRef, useState } from 'react';
import { ComicPluginRuntime, type ComicPluginInfo } from '../comicPluginRuntime';
import { parseComicCatalog, type WebComic } from '../comicCatalog';
import { readSourceText } from '../sourceUrl';
const button='rounded-xl bg-s3 px-4 py-2 text-sm';
export default function ComicPlugins({onRead}:{onRead:(comic:WebComic,source:string)=>void}) {
 const runtime=useRef<ComicPluginRuntime|null>(null);
 const [info,setInfo]=useState<ComicPluginInfo|null>(null);
 const [keyword,setKeyword]=useState(''); const [address,setAddress]=useState('');
 const [results,setResults]=useState<any[]>([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 useEffect(()=>{let cancelled=false;try{const script=localStorage.getItem('xghub.web.comic-plugin.v1');if(script){const next=new ComicPluginRuntime(script);runtime.current=next;void next.call<ComicPluginInfo>('info').then(metadata=>{if(!cancelled)setInfo(metadata)}).catch(e=>{if(!cancelled)setError((e as Error).message)});}}catch(e){setError((e as Error).message)}return()=>{cancelled=true;runtime.current?.dispose();}},[]);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function install(script:string){const next=new ComicPluginRuntime(script);try{const metadata=await next.call<ComicPluginInfo>('info');if(!metadata.key||!metadata.name)throw Error('插件缺少名称或 key');runtime.current?.dispose();runtime.current=next;localStorage.setItem('xghub.web.comic-plugin.v1',script);setInfo(metadata);setResults([]);}catch(e){next.dispose();throw e}}
 async function open(item:any){
  if(!runtime.current||!info)return;
  const details=await runtime.current.call<any>('infoComic',item.id);
  const chapters=Object.entries(details.chapters||{});
  if(!chapters.length)throw Error('插件未返回可读取的章节');
  // Fetch one chapter on selection instead of downloading an entire comic.
  setDetail({id:item.id,title:details.title||item.title,cover:details.cover||item.cover,description:details.description||'',chapters});
 }
 const [detail,setDetail]=useState<{id:string;title:string;cover?:string;description:string;chapters:[string,unknown][]}|null>(null);
 return <details className="mb-6 rounded-2xl border border-s3 bg-s1 p-4"><summary className="cursor-pointer font-semibold">JavaScript 漫画插件{info?' · '+info.name:''}</summary>
 <p className="my-3 text-sm text-mut">支持基础 VeneraX 搜索、详情与章节接口。需要原生解密、验证码或特殊请求头的源可能不兼容；源站须允许浏览器跨域访问。插件在独立执行环境运行，保存在当前浏览器，刷新后自动恢复。</p>
 <div className="flex flex-wrap gap-2"><label className={button}>导入 JS 插件<input aria-label="导入 JS 漫画插件" className="hidden" type="file" accept=".js,text/javascript" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void run(async()=>{if(f.size>524288)throw Error('插件不能超过 512 KB');await install(await f.text())});e.target.value=''}}/></label></div>
 {info&&<button className={button} disabled={busy} onClick={()=>{try{localStorage.removeItem('xghub.web.comic-plugin.v1');runtime.current?.dispose();runtime.current=null;setInfo(null);setResults([]);setDetail(null);}catch{setError('插件移除失败')}}}>移除当前插件</button>}
 <form className="my-3 flex gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>install(await readSourceText(address)))}}><input aria-label="漫画插件网址" type="url" required placeholder="HTTPS 插件网址" className="min-w-0 flex-1 rounded-xl bg-bg p-2" value={address} onChange={e=>setAddress(e.target.value)}/><button className={button} disabled={busy}>导入插件网址</button></form>
 {info&&<form className="my-3 flex gap-2" onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await runtime.current!.call<any>('search',keyword,1,[]);if(!Array.isArray(result.comics))throw Error('搜索结果格式不受支持');setResults(result.comics);setDetail(null)})}}><input aria-label="搜索插件漫画" required className="min-w-0 flex-1 rounded-xl bg-bg p-2" placeholder="搜索当前插件" value={keyword} onChange={e=>setKeyword(e.target.value)}/><button className={button} disabled={busy}>搜索插件</button></form>}
 {busy&&<p role="status">正在读取插件…</p>}{error&&<p role="alert" className="text-red-400">{error}</p>}
 {detail?<div><h2 className="my-3 font-semibold">{detail.title}</h2><div className="flex flex-wrap gap-2">{detail.chapters.map(([id,title])=><button className={button} disabled={busy} key={id} onClick={()=>void run(async()=>{const pages=await runtime.current!.call<any>('pages',detail.id,id);const catalog=parseComicCatalog({version:1,id:info!.key,name:info!.name,comics:[{...detail,chapters:[{id,title:String(title),pages:pages.images}]}]});onRead(catalog.comics[0],catalog.id)})}>{String(title)}</button>)}</div></div>:<ul className="divide-y divide-s3">{results.map((item,i)=><li key={String(item.id)+i}><button className="w-full py-3 text-left" disabled={busy} onClick={()=>void run(()=>open(item))}>{String(item.title||item.id)}</button></li>)}</ul>}
 </details>;
}
