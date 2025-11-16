/// <reference types="vite/client" />

import type { PDFDocumentProxy, PDFLoadingTask } from 'pdfjs-dist/types/src/display/api'

declare module 'pdfjs-dist/build/pdf.worker?worker&url' {
  const src: string
  export default src
}

declare module 'pdfjs-dist' {
  export const GlobalWorkerOptions: { workerSrc: string }
  export function getDocument(src: unknown): PDFLoadingTask<PDFDocumentProxy>
}
