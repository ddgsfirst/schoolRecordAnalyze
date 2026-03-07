import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";

export async function ocrPdfToText(pdfPath, opts = {}) {
  const {
    maxPages = Number.POSITIVE_INFINITY,
    lang = "kor+eng",
  } = opts;

  const loadingTask = pdfjsLib.getDocument(pdfPath);
  const doc = await loadingTask.promise;
  const pages = Math.min(doc.numPages, maxPages);

  const worker = await createWorker(lang);
  try {
    let combined = "";

    for (let pageNo = 1; pageNo <= pages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const png = canvas.toBuffer("image/png");
      const {
        data: { text },
      } = await worker.recognize(png);

      const pageText = String(text || "").trim();
      if (pageText) {
        combined += `\n\n[page:${pageNo}]\n${pageText}\n`;
      }
    }

    return combined.trim();
  } finally {
    await worker.terminate();
  }
}
