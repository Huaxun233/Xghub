import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8795';const auth={Authorization:'Bearer local-project-test-key-not-a-secret'};
async function api(path,init={}){return fetch(origin+path,init);}
assert.equal((await api('/api/admin/project')).status,401);
const initial=await (await api('/api/admin/project',{headers:auth})).json();assert.equal(initial.storageConnected,true);
const form=new FormData();form.append('files',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');
const upload=await api('/api/admin/project/media',{method:'POST',headers:auth,body:form});assert.equal(upload.status,201,await upload.clone().text());const file=(await upload.json()).files[0];
const full=await api(file.url);assert.equal(full.status,200);const bytes=await full.arrayBuffer();assert.equal(full.headers.get('Content-Type'),'image/png');assert.equal((await api(file.url,{method:'HEAD'})).headers.get('Content-Length'),String(bytes.byteLength));
const ranged=await api(file.url,{headers:{Range:'bytes=0-7'}});assert.equal(ranged.status,206);assert.equal((await ranged.arrayBuffer()).byteLength,8);assert.equal((await api(file.url,{headers:{Range:'bytes=99999-'}})).status,416);
const config={...initial.config,backgroundImage:file.url,photos:[{id:'test',url:file.url,alt:'Synthetic test'}]};const save=()=>api('/api/admin/project',{method:'PUT',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({config,revision:initial.revision})});const saved=await save();assert.equal(saved.status,200);assert.equal((await save()).status,409);const stored=await (await api('/api/project')).json();assert.equal(stored.config.backgroundImage,file.url);assert.equal((await api('/api/admin/project/media/'+file.id,{method:'DELETE',headers:auth})).status,409);
assert.equal((await api('/api/admin/project',{method:'PUT',headers:{...auth,Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status,403);
const bad=new FormData();bad.append('files',new Blob(['<svg onload=alert(1)>'],{type:'image/svg+xml'}),'x.svg');assert.equal((await api('/api/admin/project/media',{method:'POST',headers:auth,body:bad})).status,415);
assert.equal((await api('/api/admin/project',{method:'PUT',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({config:initial.config,revision:stored.revision})})).status,200);assert.equal((await api('/api/admin/project/media/'+file.id,{method:'DELETE',headers:auth})).status,200);assert.equal((await api(file.url)).status,404);
for(const path of ['/','/app','/admin'])assert.equal((await api(path)).status,200);
console.log('PASS: local D1/R2 upload, signature rejection, auth, origin, optimistic writes, range/HEAD, in-use deletion guard, cleanup and routes');
