// Vice Coast's static server: serves game/ at /, the screenshots under
// /shots/, a JSON /shots manifest, and a /health endpoint that reports
// the game file count and total bytes. Standard library only, no
// dependencies. Run: `node serve.ts [--port 8000] [--host 127.0.0.1]`.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
const manifestPath = join(root, 'shots.json');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const args = process.argv.slice(2);
let port = 8000;
let host = '127.0.0.1';
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--port' && args[i + 1]) port = Number(args[i + 1]);
  if (args[i] === '--host' && args[i + 1]) host = args[i + 1];
}

function etag(bytes: Buffer): string {
  return `"${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}"`;
}

function log(req: IncomingMessage, status: number, bytes: number): void {
  const stamp = new Date().toISOString();
  console.log(`${stamp} ${req.method} ${req.url} ${status} ${bytes}b`);
}

// Resolve a request path under a base directory, refusing anything that
// climbs out of it (a path-traversal guard).
function safeJoin(base: string, rel: string): string | null {
  const cleaned = rel.split('/').filter((s) => s !== '' && s !== '.').join(sep);
  const full = resolve(join(base, cleaned));
  if (full !== base && !full.startsWith(base + sep)) return null;
  return full;
}

async function sendFile(res: ServerResponse, filePath: string, req: IncomingMessage): Promise<void> {
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('not found');
    log(req, 404, 9);
    return;
  }
  const tag = etag(bytes);
  const headers: Record<string, string> = {
    'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'content-length': String(bytes.length),
    etag: tag,
    'cache-control': 'no-store',
  };
  if (req.headers['if-none-match'] === tag) {
    res.writeHead(304, headers);
    res.end();
    log(req, 304, 0);
    return;
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    log(req, 200, 0);
    return;
  }
  res.writeHead(200, headers);
  res.end(bytes);
  log(req, 200, bytes.length);
}

async function sendJson(res: ServerResponse, value: unknown, req: IncomingMessage): Promise<void> {
  const bytes = Buffer.from(JSON.stringify(value), 'utf8');
  const tag = etag(bytes);
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(bytes.length),
    etag: tag,
    'cache-control': 'no-store',
  };
  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    log(req, 200, 0);
    return;
  }
  res.writeHead(200, headers);
  res.end(bytes);
  log(req, 200, bytes.length);
}

// The /health endpoint: the game file count and total bytes, the shot
// count, and whether the manifest parses — a quick liveness check for
// the playtest harness and for anyone serving the game.
async function health(): Promise<Record<string, unknown>> {
  let gameFiles = 0;
  let gameBytes = 0;
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) {
        gameFiles += 1;
        gameBytes += (await stat(full)).size;
      }
    }
  }
  try {
    await walk(gameDir);
  } catch {
    // A missing game/ is reported, not hidden.
  }
  let shots = 0;
  try {
    shots = (await readdir(shotsDir)).filter((n) => n.endsWith('.jpg') || n.endsWith('.png')).length;
  } catch {
    shots = 0;
  }
  let manifestOk = false;
  try {
    JSON.parse(await readFile(manifestPath, 'utf8'));
    manifestOk = true;
  } catch {
    manifestOk = false;
  }
  return { ok: gameFiles > 0 && manifestOk, gameFiles, gameBytes, shots, manifestOk };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = decodeURIComponent(url.pathname);
    if (path === '/health') {
      await sendJson(res, await health(), req);
      return;
    }
    if (path === '/shots') {
      // The manifest, optionally filtered by time of day:
      // /shots?timeOfDay=sunset returns only the sunset shots.
      const raw = await readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(raw) as { shots?: Array<{ timeOfDay?: string }> };
      const wanted = url.searchParams.get('timeOfDay');
      if (wanted && Array.isArray(manifest.shots)) {
        await sendJson(res, { ...manifest, shots: manifest.shots.filter((s) => s.timeOfDay === wanted) }, req);
      } else {
        await sendJson(res, manifest, req);
      }
      return;
    }
    if (path.startsWith('/shots/')) {
      const file = safeJoin(shotsDir, path.slice('/shots/'.length));
      if (!file) {
        res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        res.end('bad path');
        log(req, 400, 8);
        return;
      }
      await sendFile(res, file, req);
      return;
    }
    const rel = path === '/' ? 'index.html' : path.slice(1);
    const file = safeJoin(gameDir, rel);
    if (!file) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end('bad path');
      log(req, 400, 8);
      return;
    }
    await sendFile(res, file, req);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('server error');
    log(req, 500, 12);
    console.error(err);
  }
});

server.listen(port, host, () => {
  console.log(`Vice Coast serving game/ on http://${host}:${port}/ — /shots manifest, /shots/*.jpg, /health live`);
});
