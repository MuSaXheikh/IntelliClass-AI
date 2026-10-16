/**
 * Vendors tesseract.js so the on-device screen check never touches a CDN: the worker, the WASM
 * cores and the English language data go to public/tesseract/. Runs on `pnpm install`; the
 * language file is downloaded once (about 2 MB) and skipped when it already exists or when offline.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, "public", "tesseract");
const langDir = join(target, "lang");
mkdirSync(langDir, { recursive: true });

const workerSource = join(
  dirname(require.resolve("tesseract.js/package.json")),
  "dist",
  "worker.min.js",
);
copyFileSync(workerSource, join(target, "worker.min.js"));

const coreDir = dirname(require.resolve("tesseract.js-core/package.json"));
let cores = 0;
for (const file of readdirSync(coreDir)) {
  if (file.endsWith(".wasm") || file.endsWith(".wasm.js")) {
    copyFileSync(join(coreDir, file), join(target, file));
    cores += 1;
  }
}
console.log(`Copied tesseract worker and ${cores} core files to public/tesseract`);

const langFile = join(langDir, "eng.traineddata.gz");
if (existsSync(langFile)) {
  console.log("English OCR data already present");
} else {
  const url = "https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(langFile, Buffer.from(await res.arrayBuffer()));
    console.log("Downloaded English OCR data to public/tesseract/lang");
  } catch (error) {
    console.warn(
      `Could not download OCR language data (${error}). The screen check will be unavailable until public/tesseract/lang/eng.traineddata.gz exists.`,
    );
  }
}
