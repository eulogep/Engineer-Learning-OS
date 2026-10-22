"use client";

/**
 * On-device OCR for scanned PDF pages (tesseract.js, French LSTM model).
 * Worker, WebAssembly core and language data are served by the app from
 * public/vendor/tesseract (scripts/vendor-ort.mjs): no CDN, no upload.
 */

export type OcrProgress = Readonly<{ page: number; total: number; ratio: number }>;

const BASE = "/vendor/tesseract";
const RENDER_SCALE = 2;

type PdfPage = import("pdfjs-dist/types/src/display/api").PDFPageProxy;

export async function recognizePages(
  getPage: (pageNumber: number) => Promise<PdfPage>,
  pageNumbers: readonly number[],
  onProgress?: (progress: OcrProgress) => void,
): Promise<Map<number, string>> {
  const { createWorker, OEM } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker("fra", OEM.LSTM_ONLY, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: `${BASE}/core`,
    langPath: `${BASE}/lang`,
    gzip: true,
    workerBlobURL: false,
    logger: (message: { status: string; progress: number }) => {
      if (message.status === "recognizing text") onProgress?.({ page: current, total: pageNumbers.length, ratio: message.progress });
    },
  });
  const results = new Map<number, string>();
  try {
    for (const [index, pageNumber] of pageNumbers.entries()) {
      current = index + 1;
      const page = await getPage(pageNumber);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      results.set(pageNumber, data.text);
      canvas.width = 0; canvas.height = 0;
    }
  } finally {
    await worker.terminate();
  }
  return results;
}
