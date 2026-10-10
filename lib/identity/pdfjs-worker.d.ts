// PDF.js ships its worker without type declarations; it is imported only to
// run PDF.js on the page (see prepare.ts).
declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs" {
  export const WorkerMessageHandler: unknown;
}
