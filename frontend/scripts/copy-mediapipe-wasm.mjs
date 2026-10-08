/**
 * Copies the MediaPipe tasks-vision WASM runtime into public/ so the app never loads it from a CDN.
 * Runs on `pnpm install` (postinstall) and can be run manually: `node scripts/copy-mediapipe-wasm.mjs`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = join(root, "public", "mediapipe", "wasm");

if (!existsSync(source)) {
  console.error(`MediaPipe WASM not found at ${source}. Run pnpm install first.`);
  process.exit(1);
}
mkdirSync(target, { recursive: true });
for (const file of readdirSync(source)) {
  cpSync(join(source, file), join(target, file));
}
console.log(`Copied ${readdirSync(source).length} MediaPipe WASM files to public/mediapipe/wasm`);
