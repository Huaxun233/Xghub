export type ComicChapter = { id: string; title: string; pages: string[] };
export type WebComic = { id: string; title: string; cover?: string; description: string; category: string; chapters: ComicChapter[] };
export type ComicCatalog = { version: 1; id: string; name: string; comics: WebComic[] };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('漫画目录格式有误');
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(name + '无效');
  return value.trim();
}
function url(value: unknown): string {
  const parsed = new URL(text(value, '图片地址', 4096));
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('图片须使用 HTTPS 地址');
  return parsed.href;
}
function list<T>(value: unknown, max: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || !value.length || value.length > max) throw new Error('漫画目录为空或条目过多');
  return value.map(parse);
}
function unique<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('漫画目录中有重复 ID');
  return items;
}
export function parseComicCatalog(value: unknown): ComicCatalog {
  const source = object(value);
  if (source.version !== 1) throw new Error('不支持此漫画目录版本');
  return {
    version: 1, id: text(source.id, '站源 ID', 100), name: text(source.name, '站源名称'),
    comics: unique(list(source.comics, 1000, value => {
      const comic = object(value);
      return {
        id: text(comic.id, '漫画 ID', 100), title: text(comic.title, '漫画名称'),
        cover: comic.cover ? url(comic.cover) : undefined,
        description: comic.description ? text(comic.description, '简介', 4000) : '',
        category: comic.category ? text(comic.category, '分类') : '未分类',
        chapters: unique(list(comic.chapters, 2000, value => {
          const chapter = object(value);
          return { id: text(chapter.id, '章节 ID', 100), title: text(chapter.title, '章节名称'), pages: list(chapter.pages, 1000, url) };
        })),
      };
    })),
  };
}
