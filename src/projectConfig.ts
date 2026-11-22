export interface ProjectConfig {
 title:string; introduction:string; backgroundColor:string; backgroundImage:string; theme:'light'|'dark'; galleryTitle:string;
 music:{url:string;title:string;autoplay:boolean;volume:number}; photos:{id:string;url:string;alt:string}[];
}
export const defaultProjectConfig=():ProjectConfig=>({title:'玄果 Xghub',introduction:'影视与漫画，放在一起。选择客户端，或直接在浏览器中打开。',backgroundColor:'#f9f4f5',backgroundImage:'',theme:'light',galleryTitle:'照片墙',music:{url:'',title:'背景音乐',autoplay:false,volume:0.5},photos:[]});
function text(v:unknown,max:number,label:string){if(typeof v!=='string'||v.length>max)throw new Error(label+'内容无效');return v.trim();}
function media(v:unknown,optional=true){const s=text(v,2048,'地址');if(!s&&optional)return s;if(/^\/api\/project\/media\/[a-f0-9-]{36}\.(webp|png|jpg|gif|mp3|m4a|ogg|wav|webm)$/.test(s))return s;try{const u=new URL(s);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}throw new Error('地址必须是 HTTPS 或已上传的文件');}
export function parseProjectConfig(input:unknown):ProjectConfig {
 if(!input||typeof input!=='object')throw new Error('项目配置无效');const v=input as ProjectConfig;
 const title=text(v.title,60,'标题');if(!title)throw new Error('标题不能为空');
 if(!/^#[a-fA-F0-9]{6}$/.test(v.backgroundColor))throw new Error('背景颜色无效');if(v.theme!=='light'&&v.theme!=='dark')throw new Error('主题无效');
 if(!v.music||!Number.isFinite(v.music.volume)||v.music.volume<0||v.music.volume>1)throw new Error('音量无效');
 if(!Array.isArray(v.photos)||v.photos.length>24)throw new Error('照片最多24张');const ids=new Set<string>();
 const photos=v.photos.map(p=>{const id=text(p.id,64,'照片标识');if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('照片标识无效');if(ids.has(id))throw new Error('照片标识重复');ids.add(id);return{id,url:media(p.url,false),alt:text(p.alt??'',180,'照片描述')};});
 return{title,introduction:text(v.introduction,600,'介绍'),backgroundColor:v.backgroundColor,backgroundImage:media(v.backgroundImage),theme:v.theme,galleryTitle:text(v.galleryTitle,60,'照片墙标题'),music:{url:media(v.music.url),title:text(v.music.title,100,'音乐标题'),autoplay:v.music.autoplay===true,volume:v.music.volume},photos};
}
