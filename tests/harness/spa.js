// Static server with SPA fallback for the Expo web export.
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = (process.env.HARNESS || "/tmp/sb") + "/dist-web";
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".ttf": "font/ttf" };
http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(8082, "127.0.0.1");
