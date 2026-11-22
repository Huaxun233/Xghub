import htmlBridge from "./comicHtmlBundle.js?raw";

export type GuoModuleManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  runtime?: string;
  api?: number;
  hosts?: string[];
  capabilities?: string[];
  adult?: boolean;
  allowEmptyCatalog?: boolean;
};

export type GuoModuleBundle = { manifest: GuoModuleManifest; code: string; adult: boolean };

export type GuoDrama = {
  id: string;
  source?: string;
  sourceId?: string;
  title?: string;
  name?: string;
  desc?: string;
  intro?: string;
  cover?: unknown;
  coverUrl?: unknown;
  image?: unknown;
  poster?: unknown;
  pic?: unknown;
  totalEpisode?: unknown;
  category?: string;
  categoryName?: string;
  remark?: string;
  score?: string;
  [key: string]: unknown;
};

export type GuoChapter = {
  id: string;
  source?: string;
  title?: string;
  videoUrl?: string;
  currentEpisode?: unknown;
  pageUrl?: string;
  vip?: boolean;
  [key: string]: unknown;
};

export type GuoMedia = {
  credentials?: { cookie?: string; origin?: string; referer?: string; userAgent?: string; expiresMs?: number };
  url?: string;
  referer?: string;
  playlist?: string;
  quality?: number;
  durationMs?: number;
  variants?: GuoMedia[];
};

const STATE_PREFIX = "xghub.guoModule.state.";

/** 网页版小果模块运行时：数据 URL/Blob Worker + 同步 XHR，接口对齐 native/core 的 host 对象。 */
export class GuoModuleRuntime {
  readonly manifest: GuoModuleManifest;
  private worker: Worker;
  private sequence = 0;
  private closed = false;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  private constructor(bundle: GuoModuleBundle) {
    this.manifest = bundle.manifest;
    const id = bundle.manifest.id;
    const code = `${htmlBridge}
const MODULE_SOURCE = ${JSON.stringify(id)};
const MODULE_HOSTS = ${JSON.stringify(bundle.manifest.hosts ?? [])};
const MODULE_CODE = ${JSON.stringify(bundle.code)};
${WORKER_SHIM}`;
    const blob = new Blob([code], { type: "text/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
    const stored = (() => { try { return localStorage.getItem(STATE_PREFIX + id); } catch { return null; } })();
    let restored: Record<string, string> = {};
    if (stored) { try { restored = JSON.parse(stored) as Record<string, string>; } catch { restored = {}; } }
    this.worker.postMessage({ action: "restore", data: restored });
    this.worker.onmessage = ({ data }: MessageEvent) => {
      if (data && typeof data === "object" && data.storage) {
        try { localStorage.setItem(STATE_PREFIX + id, JSON.stringify(data.storage)); } catch { /* 状态过大时放弃持久化 */ }
        return;
      }
      const request = this.pending.get(data?.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(data.id);
      data.error ? request.reject(new Error(data.error)) : request.resolve(data.value);
    };
    this.worker.onerror = () => this.dispose(new Error("模块执行失败，可能使用了网页版不支持的能力"));
  }

  static async load(id: string): Promise<GuoModuleRuntime> {
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(id)) throw new Error("模块 ID 无效");
    const response = await fetch(`/api/guo-module/${encodeURIComponent(id)}`);
    const payload = await response.json().catch(() => null).then(value => value as (GuoModuleBundle & { error?: string }) | null);
    if (!response.ok || !payload || typeof payload.code !== "string" || !payload.manifest) {
      throw new Error(payload?.error || `模块下载失败 (${response.status})`);
    }
    const { manifest } = payload;
    if (manifest.id !== id || manifest.api !== 1 || manifest.runtime !== "js") throw new Error("模块清单与索引不符");
    if (!Array.isArray(manifest.hosts) || !manifest.hosts.length) throw new Error("模块未声明可访问的站点");
    return new GuoModuleRuntime(payload);
  }

  call<T>(fn: string, ...args: unknown[]): Promise<T> {
    if (this.closed) return Promise.reject(new Error("模块已关闭"));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.dispose(new Error("模块执行超时")), 60000);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      this.worker.postMessage({ id, fn, args });
    });
  }

  categories(force = false) { return this.call<{ id: string; name: string }[] | { items: { id: string; name: string }[]; incomplete?: boolean }>("categories", force); }
  catalogPage(page: number, category: string) { return this.call<{ items: GuoDrama[]; hasMore: boolean; warning?: string }>("catalogPage", page, category); }
  search(page: number, query: string) { return this.call<{ items: GuoDrama[]; hasMore: boolean; warning?: string }>("search", page, query); }
  detail(sourceId: string) { return this.call<{ drama: GuoDrama; chapters: GuoChapter[] }>("detail", sourceId); }
  resolveMedia(task: unknown) { return this.call<GuoMedia>("resolveMedia", task); }

  dispose(error = new Error("模块已关闭")) {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
  }
}

/** Worker 内宿主实现：同步 XHR + 纯 JS AES/HKDF + linkedom parseHtml。 */
const WORKER_SHIM = String.raw`
// ---------- 基础字节工具 ----------
const encoder = new TextEncoder(), decoder = new TextDecoder();
function bytesOf(value) {
  if (typeof value === 'string') return encoder.encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('需要字符串或字节数组');
}
const bytesValue = data => new Uint8Array(data);
const hexEncode = data => [...bytesOf(data)].map(b => b.toString(16).padStart(2, '0')).join('');
function hexDecode(text) {
  text = String(text ?? '').trim();
  if (text.length % 2 || !/^[0-9a-fA-F]*$/.test(text)) throw new Error('十六进制内容无效');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function base64Encode(data) {
  const bytes = bytesOf(data); let raw = '';
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  return btoa(raw);
}
function base64Decode(text) {
  text = String(text ?? '').trim();
  let raw;
  try { raw = atob(text); } catch { raw = atob(text + '='.repeat((4 - text.length % 4) % 4)); }
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
const utf8Encode = text => encoder.encode(String(text ?? ''));
const utf8Decode = data => decoder.decode(bytesOf(data));
const md5 = data => new Uint8Array(globalThis.ComicHashes.md5(bytesOf(data)));
const sha256 = data => new Uint8Array(globalThis.ComicHashes.sha256(bytesOf(data)));
const sha512 = data => new Uint8Array(globalThis.ComicHashes.sha512(bytesOf(data)));

// ---------- 纯 JS AES（CBC + GCM，同步） ----------
const AES_SBOX = new Uint8Array(256), AES_INV = new Uint8Array(256);
(() => {
  const p = new Uint8Array(256), log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { p[i] = x; log[x] = i; x = (((x << 1) & 0xff) ^ ((x & 0x80) ? 0x1b : 0)) ^ x; } // 乘 3：3 是本域生成元，2 的阶只有 51
  AES_SBOX[0] = 0x63;
  for (let i = 0; i < 255; i++) {
    const inv = p[(255 - i) % 255];
    let s = inv;
    for (let r = 1; r <= 4; r++) s ^= ((inv << r) | (inv >>> (8 - r))) & 0xff;
    AES_SBOX[p[i]] = (s ^ 0x63) & 0xff;
  }
  for (let i = 0; i < 256; i++) AES_INV[AES_SBOX[i]] = i;
})();
const xtime = b => ((b << 1) & 0xff) ^ ((b & 0x80) ? 0x1b : 0);
function gmulByte(a, b) { let r = 0; while (b) { if (b & 1) r ^= a; a = xtime(a); b >>= 1; } return r; }
function aesExpand(key) {
  const nk = key.length >> 2, nr = nk + 6, total = 4 * (nr + 1);
  const w = new Uint8Array(4 * total);
  w.set(key);
  let rcon = 1;
  for (let i = nk; i < total; i++) {
    let t0 = w[4 * (i - 1)], t1 = w[4 * (i - 1) + 1], t2 = w[4 * (i - 1) + 2], t3 = w[4 * (i - 1) + 3];
    if (i % nk === 0) {
      const tmp = t0;
      t0 = AES_SBOX[t1] ^ rcon; t1 = AES_SBOX[t2]; t2 = AES_SBOX[t3]; t3 = AES_SBOX[tmp];
      rcon = ((rcon << 1) & 0xff) ^ ((rcon & 0x80) ? 0x1b : 0);
    } else if (nk > 6 && i % nk === 4) {
      t0 = AES_SBOX[t0]; t1 = AES_SBOX[t1]; t2 = AES_SBOX[t2]; t3 = AES_SBOX[t3];
    }
    w[4 * i] = w[4 * (i - nk)] ^ t0; w[4 * i + 1] = w[4 * (i - nk) + 1] ^ t1;
    w[4 * i + 2] = w[4 * (i - nk) + 2] ^ t2; w[4 * i + 3] = w[4 * (i - nk) + 3] ^ t3;
  }
  return { w, nr };
}
function addRoundKey(s, w, round) { const o = 16 * round; for (let i = 0; i < 16; i++) s[i] ^= w[o + i]; }
function subShift(s) {
  for (let i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
  let t = s[1]; s[1] = s[5]; s[5] = s[9]; s[9] = s[13]; s[13] = t;
  t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[3]; s[3] = s[15]; s[15] = s[11]; s[11] = s[7]; s[7] = t;
}
function mixColumns(s) {
  for (let c = 0; c < 4; c++) {
    const o = 4 * c, a0 = s[o], a1 = s[o + 1], a2 = s[o + 2], a3 = s[o + 3];
    const x = a0 ^ a1 ^ a2 ^ a3;
    s[o] ^= x ^ xtime(a0 ^ a1);
    s[o + 1] ^= x ^ xtime(a1 ^ a2);
    s[o + 2] ^= x ^ xtime(a2 ^ a3);
    s[o + 3] ^= x ^ xtime(a3 ^ a0);
  }
}
function invSubShift(s) {
  for (let i = 0; i < 16; i++) s[i] = AES_INV[s[i]];
  let t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
  t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = s[3]; s[3] = t;
}
function invMixColumns(s) {
  for (let c = 0; c < 4; c++) {
    const o = 4 * c, a0 = s[o], a1 = s[o + 1], a2 = s[o + 2], a3 = s[o + 3];
    s[o] = gmulByte(a0, 14) ^ gmulByte(a1, 11) ^ gmulByte(a2, 13) ^ gmulByte(a3, 9);
    s[o + 1] = gmulByte(a0, 9) ^ gmulByte(a1, 14) ^ gmulByte(a2, 11) ^ gmulByte(a3, 13);
    s[o + 2] = gmulByte(a0, 13) ^ gmulByte(a1, 9) ^ gmulByte(a2, 14) ^ gmulByte(a3, 11);
    s[o + 3] = gmulByte(a0, 11) ^ gmulByte(a1, 13) ^ gmulByte(a2, 9) ^ gmulByte(a3, 14);
  }
}
function aesEncryptBlock(cipher, block) {
  addRoundKey(block, cipher.w, 0);
  for (let round = 1; round < cipher.nr; round++) { subShift(block); mixColumns(block); addRoundKey(block, cipher.w, round); }
  subShift(block); addRoundKey(block, cipher.w, cipher.nr);
}
function aesDecryptBlock(cipher, block) {
  addRoundKey(block, cipher.w, cipher.nr);
  for (let round = cipher.nr - 1; round >= 1; round--) { invSubShift(block); addRoundKey(block, cipher.w, round); invMixColumns(block); }
  invSubShift(block); addRoundKey(block, cipher.w, 0);
}
function checkAesKey(key) { if (key.length !== 16 && key.length !== 24 && key.length !== 32) throw new Error('AES 密钥长度无效'); }
function aesCbcEncrypt(key, iv, data) {
  checkAesKey(key);
  if (iv.length !== 16 || data.length % 16) throw new Error('AES 向量或数据长度无效');
  const cipher = aesExpand(key), out = new Uint8Array(data.length), block = new Uint8Array(16);
  let prev = iv;
  for (let off = 0; off < data.length; off += 16) {
    for (let i = 0; i < 16; i++) block[i] = data[off + i] ^ prev[i];
    aesEncryptBlock(cipher, block);
    out.set(block, off); prev = block;
  }
  return out;
}
function aesCbcDecrypt(key, iv, data) {
  checkAesKey(key);
  if (iv.length !== 16 || data.length % 16) throw new Error('AES 向量或数据长度无效');
  const cipher = aesExpand(key), out = new Uint8Array(data.length), block = new Uint8Array(16);
  let prev = iv;
  for (let off = 0; off < data.length; off += 16) {
    block.set(data.subarray(off, off + 16));
    const saved = new Uint8Array(block);
    aesDecryptBlock(cipher, block);
    for (let i = 0; i < 16; i++) out[off + i] = block[i] ^ prev[i];
    prev = saved;
  }
  return out;
}
// GCM：BigInt 上的 GHASH + CTR
const GCM_R = 0xe1000000000000000000000000000000n;
function bytesToBigInt(bytes, off) { let v = 0n; for (let i = 0; i < 16; i++) v = (v << 8n) | BigInt(bytes[off + i] || 0); return v; }
function bigIntToBytes(v, out, off) { for (let i = 15; i >= 0; i--) { out[off + i] = Number(v & 0xffn); v >>= 8n; } }
function gmul(X, Y) { let Z = 0n, V = Y; for (let i = 127; i >= 0; i--) { if ((X >> BigInt(i)) & 1n) Z ^= V; V = (V >> 1n) ^ ((V & 1n) ? GCM_R : 0n); } return Z; } // x_0 = MSB，先处理高位
function ghash(H, data) {
  let Y = 0n;
  const full = data.length - (data.length % 16);
  for (let off = 0; off < full; off += 16) { Y ^= bytesToBigInt(data, off); Y = gmul(Y, H); }
  const rest = data.length % 16;
  if (rest) {
    let v = 0n;
    for (let i = 0; i < rest; i++) v = (v << 8n) | BigInt(data[full + i]);
    v <<= 8n * BigInt(16 - rest);
    Y ^= v; Y = gmul(Y, H);
  }
  return Y;
}
function inc32(block) { let carry = 1; for (let i = 15; i >= 12; i--) { carry += block[i]; block[i] = carry & 0xff; carry >>= 8; } }
function gcmJ0(nonce, H) {
  if (nonce.length === 12) { const b = new Uint8Array(16); b.set(nonce); b[15] = 1; return b; }
  // SP 800-38D: J0 = GHASH(IV || 0^(s+64) || [len(IV)]_64)——s 位对齐填充之外还要 64 位零
  const pad = (16 - (nonce.length % 16)) % 16;
  const data = new Uint8Array(nonce.length + pad + 8 + 8);
  data.set(nonce);
  const bits = BigInt(nonce.length) * 8n;
  for (let i = 0; i < 8; i++) data[nonce.length + pad + 8 + i] = Number((bits >> BigInt(8 * (7 - i))) & 0xffn);
  const b = new Uint8Array(16); bigIntToBytes(ghash(H, data), b, 0); return b;
}
function gcm(key, nonce) {
  checkAesKey(key);
  if (!nonce.length || nonce.length > 256) throw new Error('AES-GCM 随机数长度无效');
  const cipher = aesExpand(key);
  const H = new Uint8Array(16); aesEncryptBlock(cipher, H);
  const Hb = bytesToBigInt(H, 0);
  const j0 = gcmJ0(nonce, Hb);
  function ctr(data) {
    const out = new Uint8Array(data.length), counter = new Uint8Array(j0), ks = new Uint8Array(16);
    inc32(counter); // SP 800-38D：密文计数器从 inc32(J0) 开始，J0 只用于 tag
    for (let off = 0; off < data.length; off += 16) {
      ks.set(counter); aesEncryptBlock(cipher, ks);
      const n = Math.min(16, data.length - off);
      for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
      inc32(counter);
    }
    return out;
  }
  function tag(cipherText, aad) {
    const padA = (16 - (aad.length % 16)) % 16, padC = (16 - (cipherText.length % 16)) % 16;
    const data = new Uint8Array(aad.length + padA + cipherText.length + padC + 16);
    data.set(aad); data.set(cipherText, aad.length + padA);
    const tail = data.length - 16;
    const aBits = BigInt(aad.length) * 8n, cBits = BigInt(cipherText.length) * 8n;
    for (let i = 0; i < 8; i++) {
      data[tail + i] = Number((aBits >> BigInt(8 * (7 - i))) & 0xffn);
      data[tail + 8 + i] = Number((cBits >> BigInt(8 * (7 - i))) & 0xffn);
    }
    const S = new Uint8Array(16); bigIntToBytes(ghash(Hb, data), S, 0);
    const ekJ0 = new Uint8Array(j0); aesEncryptBlock(cipher, ekJ0);
    for (let i = 0; i < 16; i++) S[i] ^= ekJ0[i];
    return S;
  }
  return {
    seal(plain, extra) {
      const ct = ctr(plain), t = tag(ct, extra || new Uint8Array(0));
      const out = new Uint8Array(ct.length + 16); out.set(ct); out.set(t, ct.length); return out;
    },
    open(sealed, extra) {
      if (sealed.length < 16) throw new Error('AES-GCM 校验失败');
      const ct = sealed.subarray(0, sealed.length - 16), t = sealed.subarray(sealed.length - 16);
      const want = tag(ct, extra || new Uint8Array(0));
      for (let i = 0; i < 16; i++) if (want[i] !== t[i]) throw new Error('AES-GCM 校验失败');
      return ctr(ct);
    }
  };
}
function hkdfSha256(secret, salt, info, length) {
  if (length < 1 || length > 1024) throw new Error('HKDF 长度无效');
  const hashes = globalThis.ComicHashes;
  const prk = new Uint8Array(hashes.hmac(salt.length ? salt : new Uint8Array(32), secret, 'sha256'));
  const out = new Uint8Array(length);
  let t = new Uint8Array(0), pos = 0, counter = 1;
  while (pos < length) {
    const msg = new Uint8Array(t.length + info.length + 1);
    msg.set(t); msg.set(info, t.length); msg[msg.length - 1] = counter++;
    t = new Uint8Array(hashes.hmac(prk, msg, 'sha256'));
    const n = Math.min(t.length, length - pos);
    out.set(t.subarray(0, n), pos); pos += n;
  }
  return out;
}

// ---------- 同步 XHR 网络 ----------
function hostAllowed(hostname) {
  for (const pattern of MODULE_HOSTS) {
    if (pattern === '*' || pattern === hostname) return true;
    if (pattern.startsWith('*.')) { const suffix = pattern.slice(1); if (hostname.endsWith(suffix)) return true; }
  }
  return false;
}
function allowedAddress(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('请求地址无效'); }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname) throw new Error('请求地址无效');
  if (!hostAllowed(url.hostname)) throw new Error('模块清单未声明访问 ' + url.hostname);
  return url;
}
const FORBIDDEN_HEADER = /^(cookie|user-agent|referer|origin|host|content-length|connection|accept-encoding)$/i;
const BODY_LIMIT = 20 * 1024 * 1024;
function syncFetch(url, request) {
  allowedAddress(url);
  const xhr = new XMLHttpRequest();
  xhr.open(request.method, url, false);
  xhr.timeout = Math.min(Math.max(request.timeoutMs, 1), 60000);
  xhr.responseType = request.binary ? 'arraybuffer' : 'text';
  for (const [name, value] of Object.entries(request.headers || {})) {
    if (FORBIDDEN_HEADER.test(name) || typeof value !== 'string') continue;
    try { xhr.setRequestHeader(name, value); } catch { /* 浏览器禁设的头直接跳过 */ }
  }
  let networkError = false;
  try { xhr.send(request.body ?? null); } catch { networkError = true; }
  const headers = {};
  for (const line of (xhr.getAllResponseHeaders() || '').split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    (headers[name] ??= []).push(line.slice(idx + 1).trim());
  }
  const status = xhr.status;
  const body = request.binary ? new Uint8Array(xhr.response || 0) : String(xhr.responseText ?? '');
  if (networkError || status === 0) {
    const error = new Error('网络请求失败'); error.blocked = false; error.status = 0; error.oversized = false; throw error;
  }
  if (body.length > request.limit) {
    const error = new Error('响应内容过大'); error.oversized = true; error.status = status; error.blocked = false; throw error;
  }
  const ok = request.anyStatus || (status >= 200 && status < 300) || (request.acceptStatus || []).includes(status);
  if (!ok) {
    const error = new Error('HTTP ' + status); error.status = status; error.body = body; error.blocked = false; error.oversized = false; throw error;
  }
  return { status, headers, body, blocked: false, oversized: false, url: xhr.responseURL || url };
}
function moduleFetch(request) {
  request = request || {};
  return syncFetch(String(request.url ?? ''), {
    method: String(request.method || 'GET').toUpperCase(),
    headers: request.headers || {},
    body: request.body == null ? null : bytesOf(request.body),
    binary: !!request.binary,
    timeoutMs: Number(request.timeoutMs) || 30000,
    limit: Number(request.limit) || BODY_LIMIT,
    anyStatus: !!request.anyStatus,
    acceptStatus: Array.isArray(request.acceptStatus) ? request.acceptStatus : [],
  });
}
function fetchText(request) {
  request = request || {};
  const candidates = [String(request.url ?? '')];
  for (const mirror of request.mirrors || []) if (mirror) candidates.push(String(mirror));
  let lastError = null;
  for (const url of candidates) {
    try { allowedAddress(url); } catch (error) { continue; }
    try {
      const response = syncFetch(url, {
        method: request.body ? 'POST' : 'GET', headers: {},
        body: request.body ? encoder.encode(String(request.body)) : null,
        binary: false, timeoutMs: 30000, limit: BODY_LIMIT, anyStatus: true, acceptStatus: [],
      });
      return { body: response.body, url: response.url };
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('网络请求失败');
}
function m3u8DurationMs(text) {
  let total = 0;
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = /^#EXTINF:([\d.]+)/.exec(line);
    if (match) total += parseFloat(match[1]);
  }
  return Math.round(total * 1000);
}
function fetchPlaylist(request) {
  request = request || {};
  const response = syncFetch(String(request.url ?? ''), {
    method: 'GET', headers: {}, body: null, binary: false, timeoutMs: 30000, limit: BODY_LIMIT, anyStatus: true, acceptStatus: [],
  });
  return { playlist: response.body, url: response.url, durationMs: m3u8DurationMs(response.body) };
}

// ---------- 其余宿主工具 ----------
function parseUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('地址无效'); }
  return {
    scheme: url.protocol.replace(/:$/, ''), host: url.host, hostname: url.hostname, port: url.port,
    path: url.pathname, query: url.search.replace(/^\?/, ''), fragment: url.hash.replace(/^#/, ''),
    userInfo: !!(url.username || url.password), href: url.href,
  };
}
function resolveUrl(base, ref) {
  let baseUrl, refUrl;
  try { baseUrl = new URL(base); } catch { throw new Error('地址无效'); }
  try { refUrl = new URL(ref, baseUrl); } catch { throw new Error('地址无效'); }
  return refUrl.href;
}
function parseHtml(text) {
  if (typeof text !== 'string' || text.length > 8 << 20) throw new Error('网页内容过大');
  let document;
  try { document = new globalThis.HtmlDocument(text).document; } catch { throw new Error('网页无法解析'); }
  return { children: [htmlNodeToTree(document.documentElement)] };
}
function htmlNodeToTree(node) {
  if (node.nodeType === 3) return { text: node.data };
  const out = { tag: String(node.tagName || '').toLowerCase() };
  const attrs = {};
  if (node.attributes) for (const attr of node.attributes) attrs[attr.name] = attr.value;
  if (Object.keys(attrs).length) out.attrs = attrs;
  const children = [];
  for (const child of node.childNodes || []) {
    if (child.nodeType === 3) { if (child.data) children.push({ text: child.data }); }
    else if (child.nodeType === 1) children.push(htmlNodeToTree(child));
  }
  if (children.length) out.children = children;
  return out;
}
function preserveIntegers(text) {
  let out = '', inString = false, escaped = false;
  for (let index = 0; index < text.length;) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      out += char; index++; continue;
    }
    if (char === '"') { inString = true; out += char; index++; continue; }
    if (char === '-' || (char >= '0' && char <= '9')) {
      let end = index + 1;
      while (end < text.length && '0123456789+-.eE'.includes(text[end])) end++;
      const token = text.slice(index, end);
      if (!/[.eE+]/.test(token)) {
        const value = Number(token);
        if (!Number.isFinite(value) || !Number.isSafeInteger(value)) out += '"' + token + '"';
        else out += token;
      } else out += token;
      index = end; continue;
    }
    out += char; index++;
  }
  return out;
}
const moduleCache = new Map();
function cacheGet(key) {
  const entry = moduleCache.get(key);
  if (!entry) return null;
  if (entry.expires && Date.now() >= entry.expires) { moduleCache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value, ttl) {
  if (value == null) { moduleCache.delete(key); return; }
  const text = String(value);
  if (text.length > 1 << 20) throw new Error('缓存内容过大');
  if (moduleCache.size >= 512 && !moduleCache.has(key)) {
    const now = Date.now();
    for (const [name, entry] of moduleCache) if (entry.expires && now >= entry.expires) moduleCache.delete(name);
    if (moduleCache.size >= 512) {
      for (const [name, entry] of moduleCache) if (entry.expires) { moduleCache.delete(name); break; }
    }
    if (moduleCache.size >= 512) throw new Error('不过期的缓存项过多');
  }
  moduleCache.set(key, { value: text, expires: ttl > 0 ? Date.now() + ttl : 0 });
}
function sleep(ms) {
  ms = Number(ms) || 0;
  if (ms > 10000) throw new Error('网页版 sleep 上限 10 秒');
  const end = Date.now() + Math.max(0, ms);
  while (Date.now() < end) { /* Worker 内同步忙等，对齐原生同步语义 */ }
}

// ---------- 宿主对象 ----------
let state = {}, stateDirty = false;
const unsupported = name => { throw new Error('网页版暂不支持 ' + name + '，请在客户端使用'); };
const host = {
  source: MODULE_SOURCE,
  dramaId: sourceID => MODULE_SOURCE + ':' + String(sourceID ?? '').trim(),
  chapterId: (sourceID, key) => MODULE_SOURCE + ':' + String(sourceID ?? '').trim() + ':' + String(key ?? '').trim(),
  fetch: moduleFetch,
  fetchText,
  parseUrl,
  preferredSite: () => '',
  fetchPlaylist,
  exclusive: fn => { if (typeof fn !== 'function') throw new TypeError('exclusive 需要一个函数'); return fn(); },
  prepareWebMedia: media => media,
  loadState: name => (name in state ? state[name] : null),
  saveState(name, value) { state[name] = String(value ?? ''); stateDirty = true; },
  log: message => console.log('[小果模块]', MODULE_SOURCE, message),
  retries: () => 0,
  maxPages: () => 20,
  reserve: request => { allowedAddress(String(request?.url ?? '')); return 0; },
  finishMedia: media => media,
  catalogContext: () => ({ more: false, background: false }),
  isKnown: () => false,
  reportProgress: () => {},
  cacheGet, cacheSet, preserveIntegers, resolveUrl, parseHtml,
  utf8Encode, utf8Decode, hexEncode, hexDecode, base64Encode, base64Decode,
  md5, sha256, sha512,
  randomBytes: size => {
    size = Number(size) || 0;
    if (size < 0 || size > 1024) throw new Error('随机字节数无效');
    const out = new Uint8Array(size);
    crypto.getRandomValues(out);
    return out;
  },
  aesCbcEncrypt: (key, iv, data) => aesCbcEncrypt(bytesOf(key), bytesOf(iv), bytesOf(data)),
  aesCbcDecrypt: (key, iv, data) => aesCbcDecrypt(bytesOf(key), bytesOf(iv), bytesOf(data)),
  aesGcmSeal: (key, nonce, plain, extra) => gcm(bytesOf(key), bytesOf(nonce)).seal(plain == null ? new Uint8Array(0) : bytesOf(plain), extra == null ? new Uint8Array(0) : bytesOf(extra)),
  aesGcmOpen: (key, nonce, sealed, extra) => gcm(bytesOf(key), bytesOf(nonce)).open(bytesOf(sealed), extra == null ? new Uint8Array(0) : bytesOf(extra)),
  gzip: () => unsupported('gzip'),
  gunzip: () => unsupported('gunzip'),
  ecdhP256KeyPair: () => unsupported('ecdhP256KeyPair'),
  ecdhP256: () => unsupported('ecdhP256'),
  hkdfSha256: (secret, salt, info, length) => hkdfSha256(bytesOf(secret), bytesOf(salt), bytesOf(info), Number(length) || 0),
};

// ---------- 模块加载与调用 ----------
const moduleObject = { exports: {} };
new Function('module', 'exports', 'host', MODULE_CODE)(moduleObject, moduleObject.exports, host);
function invoke(name, args) {
  const target = moduleObject.exports[name];
  if (typeof target !== 'function') throw new Error('模块未导出函数 ' + name);
  const result = target.apply(moduleObject.exports, args);
  if (result instanceof Promise) throw new Error('模块函数 ' + name + ' 不能是异步函数');
  return result === undefined ? null : result;
}
onmessage = ({ data: message }) => {
  if (message && message.action === 'restore') { state = message.data || {}; return; }
  try {
    const value = invoke(message.fn, message.args);
    postMessage({ id: message.id, value, ...(stateDirty ? { storage: state } : {}) });
    stateDirty = false;
  } catch (error) {
    postMessage({ id: message.id, error: String((error && error.message) || error) });
  }
};
`;
