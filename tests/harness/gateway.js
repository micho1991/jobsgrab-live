// Test gateway mimicking Supabase: /auth/v1 → Auth, /rest/v1 → PostgREST,
// /storage/v1 → a minimal Storage API that enforces storage.objects RLS by
// running each operation in Postgres as the caller (like Supabase Storage).
const http = require("http"), crypto = require("crypto"), fs = require("fs"), path = require("path");
const { Pool } = require("pg"); const Busboy = require("busboy");
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const FILES = (process.env.HARNESS || "/tmp/sb") + "/files";
const pool = new Pool({ host: "/tmp", user: "postgres", database: "sb" });

const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
function claimsFrom(req) {
  const tok = (req.headers.authorization || "").replace(/^Bearer /, "");
  const [h, p, s] = tok.split(".");
  if (!s || crypto.createHmac("sha256", SECRET).update(h + "." + p).digest("base64url") !== s) return null;
  return JSON.parse(Buffer.from(p, "base64url").toString());
}
async function asCaller(claims, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const role = ["authenticated", "service_role"].includes(claims.role) ? claims.role : "anon";
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const r = await fn(c); await c.query("commit"); return r;
  } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
}
const readBody = (req) => new Promise((ok) => { const b = []; req.on("data", (d) => b.push(d)); req.on("end", () => ok(Buffer.concat(b))); });
const sign = (key, exp) => crypto.createHmac("sha256", SECRET).update(key + "|" + exp).digest("base64url");

async function storage(req, res, url) {
  const u = new URL(url, "http://x");
  const parts = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  // GET /object/sign/:bucket/*path?token=..  (signed download, no auth header)
  if (req.method === "GET" && parts[0] === "object" && parts[1] === "sign") {
    const key = parts.slice(2).join("/"); const [exp, sig] = (u.searchParams.get("token") || "").split(".");
    if (!sig || sig !== sign(key, exp) || Date.now() / 1000 > +exp) return json(res, 400, { statusCode: "400", error: "InvalidSignature", message: "invalid signature" });
    const file = path.join(FILES, key); if (!fs.existsSync(file)) return json(res, 404, { message: "Object not found" });
    const meta = JSON.parse(fs.readFileSync(file + ".meta"));
    const headers = { "Content-Type": meta.mimetype, "Content-Length": meta.size };
    if (u.searchParams.has("download")) headers["Content-Disposition"] = `attachment; filename="${u.searchParams.get("download") || path.basename(key)}"`;
    res.writeHead(200, headers); return fs.createReadStream(file).pipe(res);
  }
  const claims = claimsFrom(req); if (!claims) return json(res, 401, { statusCode: "401", error: "Unauthorized", message: "Invalid JWT" });

  // POST /object/sign/:bucket/*path  → create signed URL (requires SELECT under RLS)
  if (req.method === "POST" && parts[0] === "object" && parts[1] === "sign") {
    const bucket = parts[2], name = parts.slice(3).join("/");
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const found = await asCaller(claims, (c) => c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [bucket, name]));
    if (!found.rowCount) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    const exp = Math.floor(Date.now() / 1000) + (body.expiresIn || 60); const key = `${bucket}/${name}`;
    return json(res, 200, { signedURL: `/object/sign/${key}?token=${exp}.${sign(key, exp)}` });
  }
  // POST /object/list/:bucket  {prefix, limit, offset} → direct children of prefix
  if (req.method === "POST" && parts[0] === "object" && parts[1] === "list") {
    const bucket = parts[2]; const b = JSON.parse((await readBody(req)).toString() || "{}");
    const prefix = (b.prefix || "").replace(/\/$/, "");
    const r = await asCaller(claims, (c) => c.query(
      "select id, name, metadata from storage.objects where bucket_id=$1 and name like $2 order by name limit $3 offset $4",
      [bucket, prefix ? prefix + "/%" : "%", b.limit || 100, b.offset || 0]));
    const rows = r.rows.map((o) => ({ ...o, name: prefix ? o.name.slice(prefix.length + 1) : o.name })).filter((o) => !o.name.includes("/"));
    return json(res, 200, rows);
  }
  // DELETE /object/:bucket  {prefixes:[...]}
  if (req.method === "DELETE" && parts[0] === "object" && parts.length === 2) {
    const bucket = parts[1]; const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
    const r = await asCaller(claims, (c) => c.query("delete from storage.objects where bucket_id=$1 and name = any($2) returning name", [bucket, prefixes]));
    r.rows.forEach(({ name }) => { try { fs.unlinkSync(path.join(FILES, bucket, name)); } catch {} });
    return json(res, 200, r.rows.map((x) => ({ name: x.name, bucket_id: bucket })));
  }
  // POST /object/:bucket/*path  → upload (multipart from browsers, raw otherwise)
  if (req.method === "POST" && parts[0] === "object") {
    const bucket = parts[1], name = parts.slice(2).join("/");
    let buf, mimetype;
    if ((req.headers["content-type"] || "").startsWith("multipart/form-data")) {
      ({ buf, mimetype } = await new Promise((ok, fail) => {
        const bb = Busboy({ headers: req.headers }); let out = null;
        bb.on("file", (_n, stream, info) => { const ch = []; stream.on("data", (d) => ch.push(d)); stream.on("end", () => (out = { buf: Buffer.concat(ch), mimetype: info.mimeType })); });
        bb.on("finish", () => (out ? ok(out) : fail(new Error("no file")))); req.pipe(bb);
      }));
    } else { buf = await readBody(req); mimetype = req.headers["content-type"]; }
    const { rows: [b] } = await pool.query("select * from storage.buckets where id=$1", [bucket]);
    if (!b) return json(res, 400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
    if (b.file_size_limit && buf.length > +b.file_size_limit) return json(res, 413, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
    if (b.allowed_mime_types && !b.allowed_mime_types.includes(mimetype)) return json(res, 415, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${mimetype} is not supported` });
    try {
      const r = await asCaller(claims, (c) => c.query(
        "insert into storage.objects (bucket_id, name, owner_id, metadata) values ($1,$2,$3,$4) returning id",
        [bucket, name, claims.sub, { mimetype, size: buf.length }]));
      const file = path.join(FILES, bucket, name); fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf); fs.writeFileSync(file + ".meta", JSON.stringify({ mimetype, size: buf.length }));
      return json(res, 200, { Key: `${bucket}/${name}`, Id: r.rows[0].id });
    } catch (e) {
      if (/row-level security|permission denied/.test(e.message)) return json(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      if (e.code === "23505") return json(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      return json(res, 500, { statusCode: "500", error: "internal", message: e.message });
    }
  }
  json(res, 404, { message: "no route" });
}

const routes = [["/auth/v1", 9999], ["/rest/v1", 3001], ["/functions/v1/process-deletion", 8000], ["/functions/v1/maintenance", 8001]];
http.createServer((req, res) => {
  // CORS like hosted Supabase, for the mobile app's web build (different origin).
  const origin = req.headers.origin;
  if (origin) {
    const writeHead = res.writeHead.bind(res);
    res.writeHead = (code, headers = {}) => {
      for (const k of Object.keys(headers)) if (k.toLowerCase().startsWith("access-control-")) delete headers[k];
      return writeHead(code, { ...headers, "Access-Control-Allow-Origin": origin, "Access-Control-Expose-Headers": "Content-Range, Content-Disposition, X-Total-Count", "Vary": "Origin" });
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] || "*", "Access-Control-Max-Age": "600" });
      return res.end();
    }
  }
  if (req.url.startsWith("/storage/v1")) return storage(req, res, req.url.slice("/storage/v1".length)).catch((e) => json(res, 500, { message: e.message }));
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404); return res.end("no route"); }
  const p = http.request({ host: "127.0.0.1", port: r[1], path: req.url.slice(r[0].length) || "/", method: req.method, headers: { ...req.headers, host: "127.0.0.1:" + r[1] } },
    (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); });
  p.on("error", (e) => { res.writeHead(502); res.end(String(e)); }); req.pipe(p);
}).listen(54321, "127.0.0.1");
