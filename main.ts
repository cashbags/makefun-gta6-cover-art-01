// Neon Sunset Cover Studio — the entrypoint (Node 22, standard library only).
//
// The app itself is plain static files in app/ (index.html and its ES
// modules, no library and no network request), and this program hands it
// in: it copies app/ and screenshots/ from beside this file into /output
// and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the app locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The directory this file sits in, and the directory the entry goes to.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the scorer enforces on what lands in /output: the dossier's
// text budget, at most 4 screenshots of at most 256 KiB each, and app/
// within 993 files and 48 MiB, beside /output's own 1000-entry cap.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, dossierCaps));

// A one-line receipt on stdout, so a run's result is visible without
// opening the dossier: where it went and how big the summary is.
const dossierBytes = statSync(join(outputDir, 'dossier.json')).size;
console.log(`entry written to ${outputDir} (dossier ${dossierBytes} bytes)`);
