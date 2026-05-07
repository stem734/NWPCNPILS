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

  const imageData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const availableWidth = A4_WIDTH_PT - PDF_MARGIN_PT * 2;
  const renderedHeight = (canvas.height * availableWidth) / canvas.width;
  const printablePageHeight = A4_HEIGHT_PT - PDF_MARGIN_PT * 2;

  let remainingHeight = renderedHeight;
  let imageOffset = PDF_MARGIN_PT;

  pdf.addImage(imageData, 'PNG', PDF_MARGIN_PT, imageOffset, availableWidth, renderedHeight, undefined, 'FAST');
  remainingHeight -= printablePageHeight;

  while (remainingHeight > 0) {
    imageOffset -= printablePageHeight;
    pdf.addPage();
    pdf.addImage(imageData, 'PNG', PDF_MARGIN_PT, imageOffset, availableWidth, renderedHeight, undefined, 'FAST');
    remainingHeight -= printablePageHeight;
  }

  pdf.save(`${sanitizeFilename(filename)}.pdf`);
}
