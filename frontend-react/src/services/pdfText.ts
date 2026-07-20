import * as pdfjsLib from 'pdfjs-dist';

// Use a secure CDN worker to bypass local MIME-type and module loading issues on Windows/FastAPI
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

// Extrae el texto de un PDF completamente en el navegador (no se sube a ningún servidor).
export async function extractTextFromPdf(file: File): Promise<string> {
  const readPromise = (async () => {
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;

    let text = '';
    const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages to avoid performance issues on large files
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ') + '\n';
    }
    return text.trim();
  })();

  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error('El lector de PDF tardó demasiado. Si el archivo es una imagen escaneada muy grande, escribe los datos principales en el campo de texto.')), 8000)
  );

  return Promise.race([readPromise, timeoutPromise]);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
