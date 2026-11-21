// Vice Coast v6 entrypoint: assembles the submission directory and writes
// its dossier. It copies game/ and screenshots/ beside it into the output
// directory (MAKEFUN_OUTPUT_DIR, defaulting to /output), then writes
// dossier.json there with the make.fun dossier helper and the bounty caps:
// text at most 163840 bytes, at most 4 screenshots each at most 262144
// bytes, the game at most 993 files and 50331648 bytes in all, game paths
// at most 1000 bytes. Node 22, standard library only, no build step.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) copyFileSync(src, dst);
  }
}

function main() {
  const gameSrc = join(here, 'game');
  const shotsSrc = join(here, 'screenshots');
  if (!existsSync(gameSrc) || !statSync(gameSrc).isDirectory()) {
    throw new Error('main.ts: no game/ directory next to main.ts');
  }
  if (!existsSync(shotsSrc) || !statSync(shotsSrc).isDirectory()) {
    throw new Error('main.ts: no screenshots/ directory next to main.ts');
  }
  mkdirSync(outDir, { recursive: true });
  for (const name of ['game', 'screenshots', 'dossier.json']) {
    const target = join(outDir, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  copyTree(gameSrc, join(outDir, 'game'));
  copyTree(shotsSrc, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`dossier written: ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
