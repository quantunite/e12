// Local preview server for the e12 site. node serve.mjs -> http://localhost:4519
// Auto-exits after 6 hours so it never lingers.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".json": "application/json", ".mp4": "video/mp4"
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    // Directory requests serve their index.html, the way GitHub Pages does.
    if (path.endsWith("/")) path += "index.html";
    else if (!extname(path)) path += "/index.html";
    const file = normalize(join(root, path));
    if (!file.startsWith(normalize(root))) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
});

server.listen(4519, () => console.log("e12 preview on http://localhost:4519"));
setTimeout(() => process.exit(0), 6 * 60 * 60 * 1000);
