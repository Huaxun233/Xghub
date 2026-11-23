import {useEffect,useState,type FormEvent} from 'react';
import {defaultProjectConfig,type ProjectConfig} from '../projectConfig';
import '../pages/ProjectHome.css';
type Media={id:string;url:string;type:string;size:number};
export default function ProjectSettings({token}:{token:string}){const [config,setConfig]=useState(defaultProjectConfig);const [revision,setRevision]=useState(0);const [connected,setConnected]=useState(false);const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [files,setFiles]=useState<Media[]>([]);
 async function api(path:string,init:RequestInit={}){const headers=new Headers(init.headers);headers.set('Authorization','Bearer '+token);const r=await fetch('/api/admin/project'+path,{...init,headers});const data=await r.json();if(!r.ok)throw Error(data.error||'操作失败');return data;}
 async function load(){const data=await api('');setConfig(data.config);setRevision(data.revision);setConnected(data.storageConnected);setLoaded(true);if(data.storageConnected)setFiles((await api('/media')).files);}
 useEffect(()=>{void load().catch(e=>setMessage(e.message));},[token]);
 async function run(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function save(e:FormEvent){e.preventDefault();await run(async()=>{const data=await api('',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({config,revision})});setConfig(data.config);setRevision(data.revision);setMessage('已保存，首页会显示新配置。');});}
 function update(value:Partial<ProjectConfig>){setConfig(c=>({...c,...value}));}
 async function upload(input:HTMLInputElement,kind:'background'|'music'|'photos'){const chosen=Array.from(input.files??[]);input.value='';if(!chosen.length)return;await run(async()=>{if(chosen.length>4)throw Error('每次最多上传4个文件');if(kind==='photos'&&config.photos.length+chosen.length>24)throw Error('照片墙最多24张');const data=new FormData();for(const f of chosen){if(kind==='music'){data.append('files',f);continue;}const bitmap=await createImageBitmap(f);try{const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('图片处理失败')),'image/webp',0.86));data.append('files',blob,'photo.webp');}finally{bitmap.close();}}
 const result=await api('/media',{method:'POST',body:data}) as {files:Media[]};setFiles(f=>[...f,...result.files]);setConfig(current=>kind==='background'?{...current,backgroundImage:result.files[0].url}:kind==='music'?{...current,music:{...current.music,url:result.files[0].url}}:{...current,photos:[...current.photos,...result.files.map(f=>({id:crypto.randomUUID(),url:f.url,alt:''}))].slice(0,24)});setMessage('上传成功，请保存设置后发布到首页。');});}
 return <section className="project-settings"><h2 className="text-xl font-semibold">项目首页管理</h2><p className="my-3 text-sm">管理项目列表、项目介绍、背景、音乐和照片墙。<a href="/" target="_blank" rel="noreferrer" className="underline">查看首页 ↗</a></p><p role="status" className="my-3">{message}</p>{!loaded?<button onClick={()=>void run(load)}>重新加载</button>:<form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0,display:'contents'}}>

 <fieldset>
  <legend>项目列表（最多30个）</legend>
  {config.projects.map((project, index) => <fieldset key={project.id}>
   <legend>{project.name || "新项目"}</legend>
   <label>项目名称<input required maxLength={100} value={project.name}
    onChange={event => update({projects:config.projects.map(item => item.id === project.id ? {...item,name:event.target.value} : item)})}/></label>
   <label>项目介绍<textarea rows={4} maxLength={2000} value={project.description}
    onChange={event => update({projects:config.projects.map(item => item.id === project.id ? {...item,description:event.target.value} : item)})}/></label>
   <label>项目地址<input required type="url" value={project.url}
    onChange={event => update({projects:config.projects.map(item => item.id === project.id ? {...item,url:event.target.value} : item)})}/></label>
   <label>源码地址（可选）<input type="url" value={project.sourceUrl}
    onChange={event => update({projects:config.projects.map(item => item.id === project.id ? {...item,sourceUrl:event.target.value} : item)})}/></label>
   <label>图标（表情符号）<input maxLength={12} value={project.icon}
    onChange={event => update({projects:config.projects.map(item => item.id === project.id ? {...item,icon:event.target.value} : item)})}/></label>
   <div>
    <button type="button" disabled={index === 0} onClick={() => {
      const projects=[...config.projects];
      [projects[index-1],projects[index]]=[projects[index],projects[index-1]];
      update({projects});
    }}>上移</button>
    <button type="button" disabled={index === config.projects.length-1} onClick={() => {
      const projects=[...config.projects];
      [projects[index+1],projects[index]]=[projects[index],projects[index+1]];
      update({projects});
    }}>下移</button>
    <button type="button" onClick={() => update({projects:config.projects.filter(item => item.id !== project.id)})}>移除项目</button>
   </div>
  </fieldset>)}
  <button type="button" disabled={config.projects.length >= 30} onClick={() => update({
   projects:[...config.projects,{id:crypto.randomUUID(),name:"",description:"",url:"",sourceUrl:"",icon:"📁"}]
  })}>添加项目</button>
  <p>修改后点击下方「保存并发布首页」。首页按此处顺序展示项目。</p>
 </fieldset>
 <label>网站名称<input maxLength={60} value={config.title} onChange={e=>update({title:e.target.value})}/></label><label>网站介绍<textarea maxLength={600} rows={3} value={config.introduction} onChange={e=>update({introduction:e.target.value})}/></label><label>主题<select value={config.theme} onChange={e=>update({theme:e.target.value as 'light'|'dark'})}><option value="light">浅色</option><option value="dark">深色</option></select></label><label>背景颜色<input type="color" value={config.backgroundColor} onChange={e=>update({backgroundColor:e.target.value})}/></label><label>背景图片地址<input value={config.backgroundImage} onChange={e=>update({backgroundImage:e.target.value})} placeholder="HTTPS 地址或上传文件"/></label>
 {!connected&&<p className="rounded-lg border border-pink-300 p-3">文件存储暂时不可用，请稍后重试。现有设置仍可保存。</p>}
 <label>上传背景图片<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy||!connected} onChange={e=>void upload(e.target,'background')}/></label><fieldset><legend>背景音乐</legend><label>标题<input value={config.music.title} maxLength={100} onChange={e=>update({music:{...config.music,title:e.target.value}})}/></label><label>音乐地址<input value={config.music.url} onChange={e=>update({music:{...config.music,url:e.target.value}})}/></label><label>上传音乐（最大15MB）<input type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav" disabled={busy||!connected} onChange={e=>void upload(e.target,'music')}/></label><label>音量<input type="range" min="0" max="1" step="0.05" value={config.music.volume} onChange={e=>update({music:{...config.music,volume:Number(e.target.value)}})}/></label><p className="text-sm">访客点击播放后才播放音乐，避免浏览器拦截自动播放。</p></fieldset>
 <fieldset><legend>照片墙（最多24张）</legend><label>标题<input maxLength={60} value={config.galleryTitle} onChange={e=>update({galleryTitle:e.target.value})}/></label><label>批量上传照片（每次最多4张）<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy||!connected} onChange={e=>void upload(e.target,'photos')}/></label><div className="project-media-list">{config.photos.map((p,i)=><div key={p.id}><img src={p.url} alt={p.alt}/><label>图片描述<input maxLength={180} value={p.alt} onChange={e=>update({photos:config.photos.map(x=>x.id===p.id?{...x,alt:e.target.value}:x)})}/></label><button type="button" disabled={i===0} onClick={()=>{const photos=[...config.photos];[photos[i-1],photos[i]]=[photos[i],photos[i-1]];update({photos});}}>前移</button><button type="button" onClick={()=>update({photos:config.photos.filter(x=>x.id!==p.id)})}>移除</button></div>)}</div></fieldset>
 <div><button disabled={busy} type="submit">{busy?'处理中…':'保存并发布首页'}</button><button type="button" disabled={busy} onClick={()=>void run(load)}>重新加载已保存配置</button></div>
 {connected&&<details><summary>媒体库 · 删除未使用文件</summary><p className="text-sm">移除照片后先保存，再删除文件。正在使用的文件不能删除。</p><div className="project-media-list">{files.map(f=><div key={f.id}>{f.type.startsWith('image/')?<img src={f.url} alt="已上传文件"/>:<p>音乐文件</p>}<p>{f.id} · {Math.round(f.size/1024)} KB</p>{f.type.startsWith('image/')?<><button type="button" onClick={()=>update({backgroundImage:f.url})}>设为背景</button><button type="button" disabled={config.photos.length>=24} onClick={()=>update({photos:[...config.photos,{id:crypto.randomUUID(),url:f.url,alt:''}]})}>加入照片墙</button></>:<button type="button" onClick={()=>update({music:{...config.music,url:f.url}})}>设为音乐</button>}<button type="button" disabled={busy} onClick={()=>void run(async()=>{await api('/media/'+f.id,{method:'DELETE'});setFiles(a=>a.filter(x=>x.id!==f.id));setMessage('文件已删除。');})}>删除文件</button></div>)}</div></details>}
 </fieldset></form>}</section>;
}
