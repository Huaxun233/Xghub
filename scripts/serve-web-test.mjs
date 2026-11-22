import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist-worker');
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)); if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;} const data=await fs.readFile(file); res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}}).listen(1422,'127.0.0.1',()=>console.log('Static web ready on 1422'));
