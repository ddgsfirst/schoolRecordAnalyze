import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";

export async function ocrPdfToText(pdfPath, opts = {}) {
  const {
    maxPages = 30,
    lang = "kor+eng",
    keyword = null,
  } = opts;

  const loadingTask = pdfjsLib.getDocument(pdfPath);
  const doc = await loadingTask.promise;
  const pages = Math.min(doc.numPages, maxPages);

  const worker = await createWorker(lang);
  try {
    let combined = "";
    const keywordRe =
      keyword instanceof RegExp
        ? keyword
        : typeof keyword === "string" && keyword.length > 0
          ? new RegExp(keyword, "i")
          : null;

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
        if (keywordRe && keywordRe.test(pageText)) {
          // 키워드가 있는 페이지를 찾으면 이후 2페이지까지 더 긁고 종료
          const extraPages = Math.min(pages, pageNo + 2);
          for (let p = pageNo + 1; p <= extraPages; p += 1) {
            const pg = await doc.getPage(p);
            const vp = pg.getViewport({ scale: 2.0 });
            const c = createCanvas(vp.width, vp.height);
            const cctx = c.getContext("2d");
            await pg.render({ canvasContext: cctx, viewport: vp }).promise;
            const b = c.toBuffer("image/png");
            const r = await worker.recognize(b);
            const t = String(r?.data?.text || "").trim();
            if (t) combined += `\n\n[page:${p}]\n${t}\n`;
          }
          break;
        }
      }
    }
    return combined.trim();
  } finally {
    await worker.terminate();
  }
}

