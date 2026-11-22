import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({ entryPoints: ["src/repositorySources.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { importRepositoryBatch } = await import("data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64"));
const site = { name: "Example", endpoint: "https://api.example/vod", key: "example-0" };
const item = id => ({ vod_id: id, vod_name: "Title " + id, vod_pic: "/poster.jpg", vod_play_url: "E1$https://media.example/example.mp4" });
const page = (...list) => ({ body: JSON.stringify({ pagecount: 4, list }) });
const calls = [];
const result = await importRepositoryBatch(site, 1, 50, { read: async (start, count) => {
  calls.push([start, count]);
  return [page( item(1), item(2)), { error: "HTTP 503" }, page(item(2), item(3)), page(item(4)), page(item(5))];
} });
assert.deepEqual(calls, [[1, 5]]);
assert.deepEqual(result.source.series.map(x => x.id), ["v-1", "v-2", "v-3", "v-4"]);
assert.equal(result.source.series[0].poster, "https://api.example/poster.jpg");
assert.equal(result.errors.length, 1);
assert.equal(result.pagesRead, 3);
await assert.rejects(importRepositoryBatch(site, 1, 5, { read: async () => Array(5).fill({ error: "网络失败" }) }), /第 1 页：网络失败/);
console.log("PASS batch import: page limit, partial failure, stable deduplication, cover URL, total failure");
