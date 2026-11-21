// Vice Coast round-7 entrypoint (Node 22, standard library only).
// Packs the playable game and its staged screenshots into the output
// directory the scorer reads, then writes the dossier that describes
// them:
//
//   MAKEFUN_OUTPUT_DIR=/output node main.ts
//
// The output holds game/ (the static game, Three.js from the CDN import
// map — nothing vendored), screenshots/ (the four staged renders) and
// dossier.json, built by the make.fun library under vendor/ with the
// bounty's caps: at most 163840 bytes of dossier text, at most 4
// screenshots of at most 262144 bytes each, the game at most 993 files
// and 50331648 bytes in all, game paths at most 1000 bytes.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) throw new Error(`missing ${name}/ in ${repoRoot}`);
  cpSync(from, to, { recursive: true });
  return to;
}

function main() {
  mkdirSync(outputDir, { recursive: true });
  // Start clean so a stale screenshot or dossier from an older run can
  // never ride along with this one.
  for (const stale of ['game', 'screenshots', 'dossier.json']) {
    const target = join(outputDir, stale);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  copyTree('game');
  copyTree('screenshots');
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`Vice Coast round 7 packed into ${outputDir}`);
  console.log(`  game/ + screenshots/ copied, dossier.json written (${dossier.length} bytes)`);
}

main();
