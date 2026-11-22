import {md5,sha1} from '@noble/hashes/legacy.js';
import {sha256,sha512} from '@noble/hashes/sha2.js';
import {hmac} from '@noble/hashes/hmac.js';
import { DOMParser } from 'linkedom';
const wrap=node=>node?new HtmlElement(node):null;
class HtmlElement {
 constructor(node){this.node=node}
 get text(){return this.node.textContent||''}
 get attributes(){return Object.fromEntries(Array.from(this.node.attributes||[],a=>[a.name,a.value]))}
 querySelector(query){return wrap(this.node.querySelector(query))}
 querySelectorAll(query){return Array.from(this.node.querySelectorAll(query),wrap)}
 get children(){return Array.from(this.node.children||[],wrap)}
 get nodes(){return Array.from(this.node.childNodes||[],node=>({text:node.textContent||'',type:node.nodeType}))}
 get innerHTML(){return this.node.innerHTML||''}
 get parent(){return wrap(this.node.parentElement)}
 get classNames(){return Array.from(this.node.classList||[])}
 get id(){return this.node.getAttribute('id')}
 get localName(){return this.node.localName}
 get previousElementSibling(){return wrap(this.node.previousElementSibling)}
 get nextElementSibling(){return wrap(this.node.nextElementSibling)}
}
class HtmlDocument {
 constructor(html){if(typeof html!=='string'||html.length>2097152)throw Error('HTML 文档过大或格式错误');this.document=new DOMParser().parseFromString(html,'text/html')}
 querySelector(query){return wrap(this.document.querySelector(query))}
 querySelectorAll(query){return Array.from(this.document.querySelectorAll(query),wrap)}
 getElementById(id){return wrap(this.document.getElementById(id))}
 dispose(){this.document=null}
}
globalThis.HtmlDocument=HtmlDocument;
globalThis.HtmlElement=HtmlElement;

const hashes={md5,sha1,sha256,sha512};
const bytes=value=>ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):new Uint8Array(value);
globalThis.ComicHashes=Object.fromEntries(Object.entries(hashes).map(([name,hash])=>[name,value=>hash(bytes(value)).buffer]));
globalThis.ComicHashes.hmac=(key,value,name)=>{if(!hashes[name])throw Error('不支持此 HMAC 算法');return hmac(hashes[name],bytes(key),bytes(value)).buffer};