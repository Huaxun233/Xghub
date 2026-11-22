import { HttpError } from './http';
import { parseComicRepository } from '../src/comicRepository';
const bases = ['https://raw.githubusercontent.com/venera-app/venera-configs/main/', 'https://cdn.jsdelivr.net/gh/venera-app/venera-configs@latest/'];
const limit = 512 * 1024;
type CacheStore = Pick<Cache, 'match' | 'put'>;
export async function comicRepository(request: Request, file: string, options: {fetcher?:typeof fetch;cache?:CacheStore} = {}) {
 if (request.method !== 'GET' || new URL(request.url).search || !/^(index\.json|[a-zA-Z0-9_-]+\.js)$/.test(file)) throw new HttpError(400, '仓库文件地址无效');
 const key = new Request(new URL('/api/comics/repository/'+file, request.url));
 const cache = options.cache;
 if(cache){try{const saved=await cache.match(key);if(saved)return saved;}catch{}}
 for(const base of bases){
  try {
   const response = await (options.fetcher ?? fetch)(base+file,{redirect:'manual',signal:AbortSignal.timeout(4000),headers:{Accept:file==='index.json'?'application/json':'text/plain'}});
   if(!response.ok){console.warn('Comic repository upstream status',new URL(base).hostname,response.status);continue;}
   const reader=response.body?.getReader();if(!reader)continue;
   const chunks:Uint8Array[]=[];let size=0;
   try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();throw Error('Repository file too large')}chunks.push(part.value)}}finally{reader.releaseLock()}
   const bytes=new Uint8Array(size);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length}
   let text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes);
   if(file==='index.json'){
    const value=JSON.parse(text);parseComicRepository(value);
    text=JSON.stringify(value.map((item:Record<string,unknown>)=>({...item,url:new URL('/api/comics/repository/'+item.fileName,request.url).href})));
   }else if(!text.trim() || /^\s*</.test(text) || response.headers.get('Content-Type')?.includes('text/html'))throw Error('Invalid plugin response');
   const result=new Response(text,{headers:{'Content-Type':file==='index.json'?'application/json; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'}});
   if(cache){try{await cache.put(key,result.clone())}catch{}}
   return result;
  }catch(error){console.warn('Comic repository upstream failed',new URL(base).hostname,error instanceof Error?error.message:'Unknown error');}
 }
 throw new HttpError(503,'漫画源仓库上游暂时不可用，请稍后重试');
}
