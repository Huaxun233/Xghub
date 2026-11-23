export interface PortfolioProject {
 id: string;
 name: string;
 description: string;
 url: string;
 sourceUrl: string;
 icon: string;
}
export const defaultProjects = (): PortfolioProject[] => [
 {
  id: "xghub", name: "玄果 Xghub",
  description: "影视与漫画客户端，支持管理内容源、搜索作品、观看视频和使用漫画书架。提供 Android、Windows 和网页入口。",
  url: "https://aokorin.xyz/app", sourceUrl: "https://github.com/Huaxun233/Xghub", icon: "🎬",
 },
 {
  id: "christmas-tree", name: "圣诞树工作室",
  description: "在线定制互动圣诞树。填写祝福题字、上传照片并实时预览，生成专属分享链接，把节日祝福送给朋友。支持手势互动。",
  url: "https://christmas-tree-studio-cd0.pages.dev/", sourceUrl: "https://github.com/Huaxun233/christmas-tree-studio", icon: "🎄",
 },
];
function projectLink(value: unknown, optional = false): string {
 const address = text(value, 2048, "项目链接");
 if (!address && optional) return "";
 try {
  const url = new URL(address);
  if (url.protocol === "https:" && !url.username && !url.password) return url.href;
 } catch {}
 throw new Error("项目链接必须为不含登录凭据的 HTTPS 地址");
}
function parseProjects(value: unknown): PortfolioProject[] {
 if (value === undefined) return defaultProjects();
 if (!Array.isArray(value) || value.length > 30) throw new Error("最多添加30个项目");
 const ids = new Set<string>();
 return value.map(item => {
  if (!item || typeof item !== "object") throw new Error("项目内容无效");
  const id = text(item.id, 64, "项目标识");
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error("项目标识无效或重复");
  ids.add(id);
  const name = text(item.name, 100, "项目名称");
  if (!name) throw new Error("项目名称不能为空");
  return {id, name, description: text(item.description, 2000, "项目介绍"),
   url: projectLink(item.url), sourceUrl: projectLink(item.sourceUrl ?? "", true),
   icon: text(item.icon ?? "", 12, "项目图标")};
 });
}
export interface ProjectConfig {
 projects: PortfolioProject[];
 title:string; introduction:string; backgroundColor:string; backgroundImage:string; theme:'light'|'dark'; galleryTitle:string;
 music:{url:string;title:string;autoplay:boolean;volume:number}; photos:{id:string;url:string;alt:string}[];
}
export const defaultProjectConfig=():ProjectConfig=>({projects:defaultProjects(),title:'hayasiの项目首页',introduction:'这里记录我的应用与小作品。选择一个项目，查看介绍并直接体验。',backgroundColor:'#f9f4f5',backgroundImage:'',theme:'light',galleryTitle:'照片墙',music:{url:'',title:'背景音乐',autoplay:false,volume:0.5},photos:[]});
function text(v:unknown,max:number,label:string){if(typeof v!=='string'||v.length>max)throw new Error(label+'内容无效');return v.trim();}
function media(v:unknown,optional=true){const s=text(v,2048,'地址');if(!s&&optional)return s;if(/^\/api\/project\/media\/[a-f0-9-]{36}\.(webp|png|jpg|gif|mp3|m4a|ogg|wav|webm)$/.test(s))return s;try{const u=new URL(s);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}throw new Error('地址必须是 HTTPS 或已上传的文件');}
export function parseProjectConfig(input:unknown):ProjectConfig {
 if(!input||typeof input!=='object')throw new Error('项目配置无效');const v=input as ProjectConfig;
 const title=text(v.title,60,'标题');if(!title)throw new Error('标题不能为空');
 if(!/^#[a-fA-F0-9]{6}$/.test(v.backgroundColor))throw new Error('背景颜色无效');if(v.theme!=='light'&&v.theme!=='dark')throw new Error('主题无效');
 if(!v.music||!Number.isFinite(v.music.volume)||v.music.volume<0||v.music.volume>1)throw new Error('音量无效');
 if(!Array.isArray(v.photos)||v.photos.length>24)throw new Error('照片最多24张');const ids=new Set<string>();
 const photos=v.photos.map(p=>{const id=text(p.id,64,'照片标识');if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('照片标识无效');if(ids.has(id))throw new Error('照片标识重复');ids.add(id);return{id,url:media(p.url,false),alt:text(p.alt??'',180,'照片描述')};});
 return{projects:parseProjects(v.projects),title,introduction:text(v.introduction,600,'介绍'),backgroundColor:v.backgroundColor,backgroundImage:media(v.backgroundImage),theme:v.theme,galleryTitle:text(v.galleryTitle,60,'照片墙标题'),music:{url:media(v.music.url),title:text(v.music.title,100,'音乐标题'),autoplay:v.music.autoplay===true,volume:v.music.volume},photos};
}
