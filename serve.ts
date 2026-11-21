// Vice Coast round-7 dev server (Node 22, standard library only).
// Serves the game and its staged screenshots side by side so a shot can
// be viewed next to the game without a second server:
//
//   node serve.ts [--port 8080] [--host 127.0.0.1]
//
//   /                 the game (game/index.html)
//   /shots/1-chase.jpg   a staged screenshot (screenshots/ under /shots/)
//   /shots            the shot manifest as JSON (name, query, wanted,
//                     time of day, staging note, hero flag) for the
//                     staging driver
//
// Every static file gets an ETag and no-store caching, HEAD works like
// GET without a body, every request is logged with method, path and
// status, and paths are refused when they climb out of their root.
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameRoot = resolve(here, 'game');
const shotsRoot = resolve(here, 'screenshots');
const manifestPath = resolve(here, 'shots.json');

function flagValue(args, name, fallback) {
  const at = args.indexOf(name);
  if (at === -1 || at + 1 >= args.length) return fallback;
  return args[at + 1];
}

const args = process.argv.slice(2);
const host = flagValue(args, '--host', '127.0.0.1');
const portRaw = Number(flagValue(args, '--port', '8080'));
const port = Number.isInteger(portRaw) && portRaw > 0 && portRaw < 65536 ? portRaw : 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function etagFor(size, mtimeMs) {
  return `"${createHash('sha1').update(`${size}-${Math.floor(mtimeMs)}`).digest('hex')}"`;
}

function inside(root, file) {
  return file === root || file.startsWith(root + sep);
}

function log(request, status, ms) {
  const started = new Date().toISOString();
  console.log(`${started} ${request.method} ${request.url} -> ${status} (${ms}ms)`);
}

function sendFile(request, response, file, started) {
  let stats;
  try {
    stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
  } catch {
    response.writeHead(404).end('not found');
    log(request, 404, Date.now() - started);
    return;
  }
  const tag = etagFor(stats.size, stats.mtimeMs);
  if (request.headers['if-none-match'] === tag) {
    response.writeHead(304, { etag: tag, 'cache-control': 'no-store' }).end();
    log(request, 304, Date.now() - started);
    return;
  }
  const headers = {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': stats.size,
    'cache-control': 'no-store',
    etag: tag,
  };
  if (request.method === 'HEAD') {
    response.writeHead(200, headers).end();
    log(request, 200, Date.now() - started);
    return;
  }
  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
  response.on('finish', () => log(request, 200, Date.now() - started));
}

function sendManifest(request, response, started) {
  let body;
  try {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const shots = Array.isArray(raw) ? raw : raw.shots || [];
    body = JSON.stringify({
      seed: raw.seed ?? null,
      shots: shots.map((s) => ({
        name: s.name,
        query: s.query,
        shot: s.shot ?? String(s.name || '').replace(/^\d+-/, '').replace(/\.(jpg|jpeg|png)$/i, ''),
        wanted: s.wanted ?? null,
        timeOfDay: s.timeOfDay ?? null,
        staging: s.staging ?? null,
        hero: !!s.hero,
      })),
    });
  } catch {
    response.writeHead(500).end('manifest unreadable');
    log(request, 500, Date.now() - started);
    return;
  }
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    etag: etagFor(body.length, Date.now()),
  };
  if (request.method === 'HEAD') {
    response.writeHead(200, headers).end();
    log(request, 200, Date.now() - started);
    return;
  }
  response.writeHead(200, headers).end(body);
  log(request, 200, Date.now() - started);
}

createServer((request, response) => {
  const started = Date.now();
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    log(request, 400, Date.now() - started);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end('method not allowed');
    log(request, 405, Date.now() - started);
    return;
  }
  // The manifest endpoint: /shots with no trailing file.
  if (pathname === '/shots' || pathname === '/shots/') {
    sendManifest(request, response, started);
    return;
  }
  // Screenshots live under /shots/<file>; everything else is the game.
  const root = pathname.startsWith('/shots/') ? shotsRoot : gameRoot;
  const rel = pathname.startsWith('/shots/') ? pathname.slice('/shots/'.length) : pathname;
  const target = rel.endsWith('/') || rel === '' ? 'index.html' : rel;
  const file = resolve(join(root, normalize(target)));
  if (!inside(root, file)) {
    response.writeHead(403).end('forbidden');
    log(request, 403, Date.now() - started);
    return;
  }
  sendFile(request, response, file, started);
}).listen(port, host, () => {
  console.log(`Vice Coast round 7 — game/ on http://${host}:${port}/`);
  console.log(`staged shots: http://${host}:${port}/shots/ (manifest at /shots)`);
  console.log(`play a shot: http://${host}:${port}/?shot=chase&seed=23 (hero first)`);
});
