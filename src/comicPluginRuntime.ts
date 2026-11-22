export type ComicPluginInfo = {key: string; name: string; version: string};
// Data-URL workers have an opaque origin and cannot access document cookies or storage.
export class ComicPluginRuntime {
  private worker: Worker;
  private sequence = 0;
  private closed = false;
  private pending = new Map<number, {resolve:(value:any)=>void; reject:(error:Error)=>void; timer:ReturnType<typeof setTimeout>}>();
  constructor(script: string) {
    if (script.length > 512 * 1024) throw new Error('插件不能超过 512 KB');
    const match = /class\s+([A-Za-z_$][\w$]*)\s+extends\s+ComicSource\b/.exec(script);
    if (!match) throw new Error('没有找到 VeneraX ComicSource 插件类');
    const code = `
      const nativeFetch = fetch.bind(globalThis);
      globalThis.fetch = (url, options={}) => nativeFetch(url, {...options, credentials:'omit', referrerPolicy:'no-referrer'});
      class ComicSource {loadData(k){return this.data?.[k]??null;} saveData(k,v){(this.data??={})[k]=v;} deleteData(k){delete this.data?.[k];} loadSetting(){return null;} get isLogged(){return false;}}
      const Convert={
        encodeUtf8:value=>new TextEncoder().encode(value).buffer,
        decodeUtf8:value=>new TextDecoder().decode(value),
        encodeBase64:value=>{const bytes=new Uint8Array(value);let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);return btoa(raw)},
        decodeBase64:value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0)).buffer,
        hexEncode:value=>Array.from(new Uint8Array(value),byte=>byte.toString(16).padStart(2,'0')).join(''),
        hexDecode:value=>{if(typeof value!=='string'||value.length%2||!/^[a-fA-F0-9]*$/.test(value))throw Error('无效十六进制');return Uint8Array.from(value.match(/.{2}/g)||[],part=>parseInt(part,16)).buffer}
      };
      function createUuid(){return crypto.randomUUID()}
      function randomInt(min,max){return Math.floor(Math.random()*(max-min))+min}
      function randomDouble(min,max){return Math.random()*(max-min)+min}
      function Comic(v){Object.assign(this,v)}
      function ComicDetails(v){Object.assign(this,v)}
      const request = async(method,url,headers,data,bytes=false)=>{
        const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('仅支持 HTTPS 源请求');
        const body = method==='GET'||method==='HEAD' ? undefined : (data && typeof data==='object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data) ? JSON.stringify(data) : data);
        const r=await fetch(u,{method,headers,body,signal:AbortSignal.timeout(12000)});
        const reader=r.body?.getReader();const chunks=[];let size=0;
        if(reader)try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2097152){await reader.cancel();throw Error('源响应不能超过 2 MB')}chunks.push(part.value)}}finally{reader.releaseLock()}
        const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}
        return {status:r.status,statusCode:r.status,body:bytes?buffer.buffer:new TextDecoder().decode(buffer),headers:Object.fromEntries(r.headers)};
      };
      const Network={sendRequest:request,request,fetchBytes:(method,url,headers,data)=>request(method,url,headers,data,true),get:(url,headers)=>request('GET',url,headers),post:(url,headers,data)=>request('POST',url,headers,data),put:(url,headers,data)=>request('PUT',url,headers,data),patch:(url,headers,data)=>request('PATCH',url,headers,data),delete:(url,headers,data)=>request('DELETE',url,headers,data)};
      ${script}
      const source = new ${match[1]}();
      onmessage=async({data:m})=>{try{let value;if(m.action==='info')value={key:source.key,name:source.name,version:source.version};else if(m.action==='search')value=await source.search.load(...m.args);else if(m.action==='infoComic')value=await source.comic.loadInfo(...m.args);else if(m.action==='pages')value=await source.comic.loadEp(...m.args);else throw Error('未知插件操作');postMessage({id:m.id,value});}catch(e){postMessage({id:m.id,error:String(e.message||e)})}};
    `;
    this.worker = new Worker('data:text/javascript;charset=utf-8,' + encodeURIComponent(code));
    this.worker.onmessage = ({data}) => {const request=this.pending.get(data.id);if(!request)return;clearTimeout(request.timer);this.pending.delete(data.id);data.error?request.reject(new Error(data.error)):request.resolve(data.value);};
    this.worker.onerror = () => this.dispose(new Error('漫画插件执行失败，可能使用了尚未适配的原生接口'));
  }
  call<T>(action: 'info'|'search'|'infoComic'|'pages', ...args: unknown[]): Promise<T> {
    if(this.closed) return Promise.reject(new Error('漫画插件已关闭'));
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.dispose(new Error('漫画插件执行超时')),15000);this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({id,action,args});});
  }
  dispose(error=new Error('漫画插件已关闭')) {this.closed=true;this.worker.terminate();for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(error);}this.pending.clear();}
}
