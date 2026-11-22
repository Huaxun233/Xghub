import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.XGHUB_TEST_ORIGIN||'http://127.0.0.1:1422';
const index='https://cdn.jsdelivr.net/gh/venera-app/venera-configs@latest/index.json';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/catalog',r=>r.fulfill({json:[]}));await page.route('**/api/account/me',r=>r.fulfill({json:{user:null}}));
 await page.route(index,r=>r.fulfill({json:[{key:'demo',name:'Test Source',fileName:'demo.js',version:'1.0'},{key:'second',name:'Second Source',fileName:'second.js',version:'1.0'},{key:'broken',name:'Broken Source',fileName:'broken.js',version:'1.0'}]}));
 await page.route('https://cdn.jsdelivr.net/gh/venera-app/venera-configs@latest/demo.js',async r=>r.fulfill({contentType:'text/javascript',body:await fs.readFile('../guoapp-client/test/support/xghub_comic_source.js','utf8')}));
 await page.route('https://cdn.jsdelivr.net/gh/venera-app/venera-configs@latest/second.js',async r=>r.fulfill({contentType:'text/javascript',body:(await fs.readFile('../guoapp-client/test/support/xghub_comic_source.js','utf8')).replaceAll('xghub_demo','second').replaceAll('Xghub Integration Demo','Second Demo')}));
 await page.route('https://cdn.jsdelivr.net/gh/venera-app/venera-configs@latest/broken.js',r=>r.fulfill({status:503,body:'unavailable'}));
 await page.goto(origin+'/#comics');await page.getByText('JavaScript 漫画插件',{exact:true}).click();
 await page.getByRole('button',{name:'同步内置仓库',exact:true}).click();await page.getByLabel('选择仓库漫画源').selectOption('demo');
 await page.getByRole('button',{name:'安装选中漫画源',exact:true}).click();await page.getByText('JavaScript 漫画插件 · Xghub Integration Demo',{exact:true}).waitFor();
 await page.getByRole('button',{name:'全选',exact:true}).click();await page.getByRole('button',{name:'批量安装（3）',exact:true}).click();await page.getByLabel('批量安装结果').getByText('Broken Source：站源服务器返回 HTTP 503',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('切换已安装漫画源').locator('option:not([disabled])').count(),2);
 await page.getByLabel('切换已安装漫画源').selectOption('xghub_demo');await page.getByText('JavaScript 漫画插件 · Xghub Integration Demo',{exact:true}).waitFor();await page.reload();await page.getByText('JavaScript 漫画插件 · Xghub Integration Demo',{exact:true}).click();assert.equal(await page.getByLabel('切换已安装漫画源').locator('option:not([disabled])').count(),2);
 assert(await page.evaluate(()=>!!localStorage.getItem('xghub.web.comic-plugin.v1')));assert.deepEqual(errors,[]);
 console.log('PASS: built-in repository sync, selection, installation and script persistence');
}finally{await browser.close()}
