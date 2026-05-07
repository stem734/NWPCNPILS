import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PDF_MARGIN_PT = 24;

const sanitizeFilename = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || 'MyMedInfo page';

export async function saveElementAsPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: Math.max(element.scrollWidth, element.clientWidth, 1024),
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const availableWidth = A4_WIDTH_PT - PDF_MARGIN_PT * 2;
  const scale = availableWidth / canvas.width;
  const pageHeightPx = Math.floor((A4_HEIGHT_PT - PDF_MARGIN_PT * 2) / scale);
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  const createSlice = (sourceCanvas: HTMLCanvasElement, y: number, height: number) => {
    const slice = document.createElement('canvas');
    slice.width = sourceCanvas.width;
    slice.height = height;
    const ctx = slice.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(sourceCanvas, 0, y, sourceCanvas.width, height, 0, 0, sourceCanvas.width, height);
    return slice;
  };

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const y = pageIndex * pageHeightPx;
    const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
    const slice = createSlice(canvas, y, sliceHeight);
    if (!slice) continue;
    const sliceData = slice.toDataURL('image/png');
    if (pageIndex > 0) {
      pdf.addPage();
    }
    pdf.addImage(
      sliceData,
      'PNG',
      PDF_MARGIN_PT,
      PDF_MARGIN_PT,
      availableWidth,
      sliceHeight * scale,
      undefined,
      'FAST',
    );
  }

  pdf.save(`${sanitizeFilename(filename)}.pdf`);
}
