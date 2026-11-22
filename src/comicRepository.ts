export const COMIC_REPOSITORY_URL = 'https://cdn.jsdelivr.net/gh/venera-app/venera-configs@latest/index.json';
export type ComicRepositoryEntry = {key:string;name:string;version:string;url:string};
export function parseComicRepository(value:unknown):ComicRepositoryEntry[] {
 if(!Array.isArray(value)||value.length>1000)throw Error('漫画源仓库格式无效');
 const keys=new Set<string>();
 return value.map(item=>{
  if(!item||typeof item.key!=='string'||!item.key||typeof item.name!=='string'||!item.name||typeof item.fileName!=='string'||!/^[a-zA-Z0-9_-]+\.js$/.test(item.fileName)||keys.has(item.key))throw Error('漫画源仓库包含无效或重复条目');
  keys.add(item.key);return {key:item.key,name:item.name,version:typeof item.version==='string'?item.version:'',url:new URL(item.fileName,COMIC_REPOSITORY_URL).href};
 });
}
