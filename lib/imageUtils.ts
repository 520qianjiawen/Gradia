import { NormalizedBox, QuestionBox } from "@/types/homework";

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts [ymin, xmin, ymax, xmax] (0..1000) to actual pixel rectangle
 */
export function boxToPixelRect(
  box: NormalizedBox,
  containerWidth: number,
  containerHeight: number
): PixelRect {
  const [ymin, xmin, ymax, xmax] = box;
  const x = (xmin / 1000) * containerWidth;
  const y = (ymin / 1000) * containerHeight;
  const width = ((xmax - xmin) / 1000) * containerWidth;
  const height = ((ymax - ymin) / 1000) * containerHeight;

  return { x, y, width, height };
}

/**
 * Converts pixel rect to [ymin, xmin, ymax, xmax] (0..1000)
 */
export function pixelRectToBox(
  rect: PixelRect,
  containerWidth: number,
  containerHeight: number
): NormalizedBox {
  const ymin = Math.max(0, Math.min(1000, Math.round((rect.y / containerHeight) * 1000)));
  const xmin = Math.max(0, Math.min(1000, Math.round((rect.x / containerWidth) * 1000)));
  const ymax = Math.max(
    0,
    Math.min(1000, Math.round(((rect.y + rect.height) / containerHeight) * 1000))
  );
  const xmax = Math.max(
    0,
    Math.min(1000, Math.round(((rect.x + rect.width) / containerWidth) * 1000))
  );

  return [ymin, xmin, ymax, xmax];
}

/**
 * Samples surrounding paper background color to seamlessly patch/erase handwriting
 */
function samplePaperColor(
  ctx: CanvasRenderingContext2D,
  hwX: number,
  hwY: number,
  hwW: number,
  hwH: number,
  canvasW: number,
  canvasH: number
): string {
  try {
    // Sample a few pixels around the outer perimeter of the handwriting box
    const samplePoints = [
      { x: Math.max(2, hwX - 4), y: Math.max(2, hwY - 4) },
      { x: Math.min(canvasW - 4, hwX + hwW + 4), y: Math.max(2, hwY - 4) },
      { x: Math.max(2, hwX - 4), y: Math.min(canvasH - 4, hwY + hwH + 4) },
      { x: Math.min(canvasW - 4, hwX + hwW + 4), y: Math.min(canvasH - 4, hwY + hwH + 4) },
    ];

    let rTotal = 0,
      gTotal = 0,
      bTotal = 0;
    for (const pt of samplePoints) {
      const data = ctx.getImageData(pt.x, pt.y, 1, 1).data;
      rTotal += data[0];
      gTotal += data[1];
      bTotal += data[2];
    }
    const r = Math.round(rTotal / samplePoints.length);
    const g = Math.round(gTotal / samplePoints.length);
    const b = Math.round(bTotal / samplePoints.length);

    // If sampling returned too dark (like hitting text), fallback to near-white paper color
    if (r < 180 || g < 180 || b < 180) {
      return "#f8f9fa";
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return "#fdfdfd";
  }
}

/**
 * Crops a question area and optionally removes handwriting
 */
export async function cropQuestionArea(
  imageSource: HTMLImageElement,
  question: QuestionBox,
  options: {
    eraseHandwriting?: boolean;
    whiteBalance?: boolean;
    contrastBoost?: number;
  } = {}
): Promise<string> {
  const { naturalWidth, naturalHeight } = imageSource;
  const qRect = boxToPixelRect(question.box_2d, naturalWidth, naturalHeight);

  if (qRect.width <= 0 || qRect.height <= 0) {
    return "";
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(10, Math.round(qRect.width));
  canvas.height = Math.max(10, Math.round(qRect.height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";

  // Draw base question crop
  ctx.drawImage(
    imageSource,
    qRect.x,
    qRect.y,
    qRect.width,
    qRect.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Erase handwriting if requested
  if (options.eraseHandwriting && question.handwriting_boxes.length > 0) {
    for (const hwBox of question.handwriting_boxes) {
      const hwGlobalRect = boxToPixelRect(hwBox, naturalWidth, naturalHeight);
      // Convert to local crop coordinates
      const localX = hwGlobalRect.x - qRect.x;
      const localY = hwGlobalRect.y - qRect.y;
      const localW = hwGlobalRect.width;
      const localH = hwGlobalRect.height;

      // Sample paper color around the handwriting box
      const paperColor = samplePaperColor(
        ctx,
        Math.max(0, localX),
        Math.max(0, localY),
        localW,
        localH,
        canvas.width,
        canvas.height
      );

      ctx.save();
      ctx.fillStyle = paperColor;
      ctx.fillRect(localX - 2, localY - 2, localW + 4, localH + 4);

      // Light dashed outline to indicate answer slot
      ctx.strokeStyle = "rgba(180, 180, 190, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(localX, localY, localW, localH);
      ctx.restore();
    }
  }

  // White balance / contrast adjustment for high clarity printing
  if (options.whiteBalance || (options.contrastBoost && options.contrastBoost > 1)) {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const factor = options.contrastBoost || 1.15;

      for (let i = 0; i < d.length; i += 4) {
        // Simple contrast curve: (color - 128) * factor + 128
        d[i] = Math.min(255, Math.max(0, (d[i] - 128) * factor + 128));
        d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - 128) * factor + 128));
        d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - 128) * factor + 128));

        // Brighten grayish paper backgrounds to crisp white
        if (options.whiteBalance && d[i] > 205 && d[i + 1] > 205 && d[i + 2] > 205) {
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // ignore security origin limitations if any
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Generates an A4 PDF for printable homework correction / practice sheets
 */
export async function exportHomeworkPdf(
  questions: QuestionBox[],
  imageSource: HTMLImageElement,
  options: {
    title?: string;
    studentName?: string;
    eraseHandwriting: boolean;
    whiteBalance: boolean;
  }
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  let currentY = margin;

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 35);
  doc.text(options.title || "作业错题重做订正集", margin, currentY);

  currentY += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 105, 115);
  const infoText = `学生: ${options.studentName || "______"}    生成时间: ${new Date().toLocaleDateString()}    共 ${questions.length} 道题目 (需重新订正)`;
  doc.text(infoText, margin, currentY);

  currentY += 4;
  doc.setDrawColor(220, 224, 230);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const cropDataUrl = await cropQuestionArea(imageSource, q, {
      eraseHandwriting: options.eraseHandwriting,
      whiteBalance: options.whiteBalance,
      contrastBoost: 1.1,
    });

    if (!cropDataUrl) continue;

    const [ymin, xmin, ymax, xmax] = q.box_2d;
    const aspect = (xmax - xmin) / Math.max(1, ymax - ymin);

    // Calculate height of image in mm
    let imgW = contentWidth;
    let imgH = imgW / aspect;

    // Cap image height if it's too tall
    if (imgH > 95) {
      imgH = 95;
      imgW = imgH * aspect;
    }

    const itemTotalHeight = imgH + 32; // image + answer lines + header tag

    // New page check
    if (currentY + itemTotalHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    // Question Tag Badge
    doc.setFillColor(q.is_wrong ? 255 : 230, q.is_wrong ? 235 : 240, q.is_wrong ? 235 : 255);
    doc.roundedRect(margin, currentY, 45, 6, 1, 1, "F");
    doc.setFontSize(9);
    doc.setTextColor(q.is_wrong ? 210 : 30, q.is_wrong ? 30 : 100, q.is_wrong ? 30 : 200);
    doc.text(`第 ${q.index} 题 · ${q.topic || "题目"}`, margin + 2, currentY + 4.2);

    currentY += 8;

    // Draw question image
    doc.addImage(cropDataUrl, "PNG", margin, currentY, imgW, imgH);
    currentY += imgH + 4;

    // Answer lines for student re-writing
    doc.setFontSize(8.5);
    doc.setTextColor(140, 145, 155);
    doc.text("【自主订正 / 作答区域】:", margin, currentY);
    currentY += 3;

    doc.setDrawColor(225, 230, 235);
    doc.setLineDashPattern([2, 2], 0);
    for (let l = 0; l < 3; l++) {
      currentY += 5;
      doc.line(margin, currentY, margin + contentWidth, currentY);
    }
    doc.setLineDashPattern([], 0); // reset dash

    currentY += 10;
  }

  doc.save(`作业订正本_${new Date().toISOString().slice(0, 10)}.pdf`);
}
