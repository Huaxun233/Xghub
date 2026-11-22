import { HttpError } from './http';
const origin='https://www1.ikanbot.com';
async function get(path:string, referer=origin+'/') {
 let response: Response;
 try { response=await fetch(origin+path,{headers:{'User-Agent':'Mozilla/5.0','Referer':referer},redirect:'error',signal:AbortSignal.timeout(12000)}); } catch (error) { throw new HttpError(502, error instanceof Error && error.name === 'TimeoutError' ? '源站响应超时，请稍后重试' : '无法连接影视源，源站可能限制了服务器访问'); }
 if(!response.ok)throw new HttpError(502,'影视源暂时不可用，请稍后重试');
 const text=await response.text();if(text.length>4*1024*1024)throw new HttpError(502,'影视源响应过大');return text;
}
export async function refreshIkanbot(id:string) {
 if(!/^\d{1,12}$/.test(id))throw new HttpError(400,'影片 ID 无效');
 const html=await get('/play/'+id);
 const fields:Record<string,string>={}; let cover='';
 await new HTMLRewriter().on('input', {element(el){const key=el.getAttribute('id');if(key)fields[key]=el.getAttribute('value')||'';}}).on('img', {element(el){if(!cover)cover=el.getAttribute('data-src')||'';}}).transform(new Response(html)).text();
 const current=fields.current_id||id;let rest=fields.e_token||'',signed='';
 for(const digit of current.slice(-4)){const start=Number(digit)%3+1;if(!Number.isFinite(start)||rest.length<start+8)throw new HttpError(502,'源站没有返回有效播放令牌');signed+=rest.slice(start,start+8);rest=rest.slice(start+8);}
 const params=new URLSearchParams({videoId:current,mtype:fields.mtype||'1',token:signed});
 let payload; try { payload=JSON.parse(await get('/api/getResN?'+params,origin+'/play/'+id)); } catch(error) { if(error instanceof HttpError) throw error; throw new HttpError(502,'源站返回的线路不是有效 JSON'); }
 if(payload.state!==1)throw new HttpError(502,'源站线路解析失败');
 const lines=[];
 for(const row of payload.data?.list||[]){let entries;try{entries=JSON.parse(row.resData)}catch{continue}for(const entry of entries){const episodes=[];for(const [index,pair] of String(entry.url||'').split('#').entries()){const parts=pair.split('$');if(parts.length<2)continue;try{const url=new URL(parts[1]);if(url.protocol!=='https:'||url.username||url.password)continue;episodes.push({id:String(index+1),title:parts[0]||`第 ${index+1} 集`,url:url.href,format:/\.m3u8/i.test(url.pathname)?'hls':'file'});}catch{continue}}if(episodes.length)lines.push({name:String(entry.flag||'默认线路'),episodes});}}
 lines.sort((a,b)=>b.episodes.length-a.episodes.length);if(!lines.length)throw new HttpError(502,'源站暂无可用线路');
 let poster: string|undefined;try{const u=new URL(cover,origin);if(u.protocol==='https:')poster=u.href}catch{}
 return {poster,lines:lines.slice(0,10)};
}
