import { requireAccount } from './accounts';
import { HttpError, json, readJson, type Env } from './http';
import { parseComicCatalog } from '../src/comicCatalog';
export async function comicState(request:Request,env:Env) {
 const id=await requireAccount(request,env);
 if(request.method==='GET') {
  const row=await env.DB.prepare('SELECT document,revision FROM comic_state WHERE account_id=?').bind(id).first<{document:string;revision:number}>();
  return json({state:row?JSON.parse(row.document):null,revision:row?.revision??0});
 }
 if(request.method!=='PUT')throw new HttpError(405,'请求方法不支持');
 const body=await readJson(request,524288) as any;
 if(!body||!Number.isSafeInteger(body.revision)||body.revision<0||!Array.isArray(body.catalogs)||body.catalogs.length>30||!Array.isArray(body.shelf)||body.shelf.length>5000)throw new HttpError(400,'漫画同步数据格式有误');
 const catalogs=body.catalogs.map(parseComicCatalog);
 if(body.shelf.some((item:unknown)=>typeof item!=='string'||item.length>300))throw new HttpError(400,'书架条目无效');
 const progress = body.progress ?? {};
 if(!progress || typeof progress !== 'object' || Array.isArray(progress) || Object.keys(progress).length > 5000 || Object.entries(progress).some(([key,value]) => key.length > 300 || !Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1999)) throw new HttpError(400,'阅读进度数据无效');
 const document=JSON.stringify({catalogs,shelf:body.shelf,progress});
 if(new TextEncoder().encode(document).length>524288)throw new HttpError(413,'同步数据不能超过 512 KB');
 const result=body.revision===0
  ? await env.DB.prepare('INSERT INTO comic_state(account_id,document,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(account_id) DO NOTHING').bind(id,document,Date.now()).run()
  : await env.DB.prepare('UPDATE comic_state SET document=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=?').bind(document,Date.now(),id,body.revision).run();
 if(!result.meta.changes)throw new HttpError(409,'云端数据已变化，请先下载最新书架');
 return json({revision:body.revision+1});
}
