import { parseSource, type Source } from "./videoCatalog";
export { MAX_SOURCE_BYTES, parseEpisode, parseSource } from "./videoCatalog";
export type { Episode, Series, Source } from "./videoCatalog";

export type Progress = { episode: string; time: number; updated: number; complete?: boolean };
export type Library = { sources: Source[]; followed: string[]; progress: Record<string, Progress> };

export const LINKS = "local-links";
const KEY = "hghub_video_library_v1";

export function readLibrary(): Library {
  const empty: Library = { sources: [], followed: [], progress: {} };
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null") as Library | null;
    if (!stored || !Array.isArray(stored.sources)) return empty;
    return {
      sources: stored.sources.map(parseSource),
      followed: Array.isArray(stored.followed) ? stored.followed.filter(key => typeof key === "string") : [],
      progress: stored.progress && typeof stored.progress === "object" ? stored.progress : {},
    };
  } catch {
    return empty;
  }
}

export function saveLibrary(library: Library) {
  localStorage.setItem(KEY, JSON.stringify(library));
}
