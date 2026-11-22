// Vice Coast's entrypoint for the make.fun dossier: copy game/ and
// screenshots/ beside it into the output directory (from the
// MAKEFUN_OUTPUT_DIR environment variable, defaulting to /output), then
// write a dossier.json there with the buildDossier helper from the
// vendored make.fun library.
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const here = new URL('.', import.meta.url).pathname;

await mkdir(outDir, { recursive: true });
await cp(join(here, 'game'), join(outDir, 'game'), { recursive: true });
await cp(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
await writeFile(join(outDir, 'dossier.json'), dossier);
console.log(`Vice Coast dossier written to ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
