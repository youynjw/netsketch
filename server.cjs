const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/label-layout.js':'label-layout.js'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const port=Number(process.env.PORT)||4173;
http.createServer((req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-cache'});fs.createReadStream(path.join(__dirname,file)).pipe(res)}).listen(port,'127.0.0.1',()=>console.log(`NetSketch: http://localhost:${port}`));

