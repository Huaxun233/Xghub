import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));
 await page.goto((process.env.XGHUB_TEST_ORIGIN || 'http://127.0.0.1:1422') + '/',{waitUntil:'domcontentloaded'});
 const bytes=await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;document.body.appendChild(canvas);const context=canvas.getContext('2d');context.fillStyle='pink';context.fillRect(0,0,160,90);const stream=canvas.captureStream(0);const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});const chunks=[];const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer())))});recorder.start();for(let frame=0;frame<15;frame++){context.fillStyle=frame%2?'pink':'white';context.fillRect(0,0,160,90);stream.getVideoTracks()[0].requestFrame();await new Promise(resolve=>setTimeout(resolve,100));}recorder.stop();stream.getTracks().forEach(t=>t.stop());return done});
 assert(bytes.length>500,'Generated video must contain encoded frames');console.log('fixture bytes',bytes.length);await page.route('https://video-test.example/test.webm',r=>{console.log('media request',r.request().headers()['range']);return r.fulfill({contentType:'video/webm',headers:{'Access-Control-Allow-Origin':'*'},body:Buffer.from(bytes)});});
 await page.route('**/api/catalog',r=>r.fulfill({json:[]}));await page.route('**/api/account/me',r=>r.fulfill({json:{user:null}}));
 await page.goto((process.env.XGHUB_TEST_ORIGIN || 'http://127.0.0.1:1422') + '/#account',{waitUntil:'domcontentloaded'});
 const fixture={version:1,id:'local-test',name:'本机测试源',series:[{id:'clip',title:'播放验证',category:'测试',episodes:[{id:'one',title:'测试片段',url:'https://video-test.example/test.webm',format:'file'}]}]};
 await page.getByLabel('导入站源',{exact:true}).setInputFiles({name:'video.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByRole('button').filter({hasText:'播放验证'}).first().click();
 const video=page.locator('video');await video.waitFor();console.log('media',await video.evaluate(v=>({src:v.currentSrc,error:v.error?.message,ready:v.readyState})));await video.evaluate(v=>v.play());await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.currentTime>0});
 await page.reload();await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByRole('button').filter({hasText:'播放验证'}).first().waitFor();
 console.log('PASS: web local source import, visibility, real video decode/playback and reload persistence');
}finally{await browser.close()}
