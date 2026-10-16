import { createWorker } from "tesseract.js";
import { TESSERACT_BASE } from "@/lib/config";

export interface OcrResult {
  text: string;
  confidence: number;
}

export interface Ocr {
  recognize: (source: HTMLCanvasElement) => Promise<OcrResult>;
  terminate: () => Promise<void>;
}

/**
 * tesseract.js with every file served from this origin (worker, WASM core, language data copied
 * by scripts/copy-tesseract.mjs), so the screen check works offline and nothing is fetched from a
 * CDN. The recognised text stays on the device.
 */
export async function createOcr(): Promise<Ocr> {
  const worker = await createWorker("eng", 1, {
    workerPath: `${TESSERACT_BASE}/worker.min.js`,
    corePath: TESSERACT_BASE,
    langPath: `${TESSERACT_BASE}/lang`,
    gzip: true,
    workerBlobURL: false,
  });
  return {
    async recognize(source) {
      const { data } = await worker.recognize(source);
      return { text: data.text, confidence: data.confidence };
    },
    terminate: () => worker.terminate().then(() => undefined),
  };
}
