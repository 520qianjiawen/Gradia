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
 * Document scanner filter: removes uneven photo shadows, desk background, and bleaches paper to #FFFFFF
 */
export function applyDocumentScanFilter(
  imageSource: HTMLImageElement | HTMLCanvasElement,
  options: {
    contrast?: number;
    threshold?: number;
    cropDeskEdges?: boolean;
    eraseHandwriting?: boolean;
  } = {}
): HTMLCanvasElement {
  const naturalWidth =
    imageSource instanceof HTMLImageElement
      ? imageSource.naturalWidth
      : imageSource.width;
  const naturalHeight =
    imageSource instanceof HTMLImageElement
      ? imageSource.naturalHeight
      : imageSource.height;

  // If cropDeskEdges is true, crop 4% inward from sides to remove cutting mat/desk border
  const cropMarginX = options.cropDeskEdges ? Math.round(naturalWidth * 0.035) : 0;
  const cropMarginY = options.cropDeskEdges ? Math.round(naturalHeight * 0.02) : 0;

  const canvas = document.createElement("canvas");
  canvas.width = naturalWidth - cropMarginX * 2;
  canvas.height = naturalHeight - cropMarginY * 2;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(
    imageSource,
    cropMarginX,
    cropMarginY,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const len = d.length;

  // Estimate local illumination gradient by creating a coarse background map
  // Step 1: Calculate block-based average luminance (block size ~ 32x32)
  const blockSize = 32;
  const blocksX = Math.ceil(canvas.width / blockSize);
  const blocksY = Math.ceil(canvas.height / blockSize);
  const bgMap = new Float32Array(blocksX * blocksY);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let sum = 0;
      let count = 0;
      const startX = bx * blockSize;
      const endX = Math.min(canvas.width, (bx + 1) * blockSize);
      const startY = by * blockSize;
      const endY = Math.min(canvas.height, (by + 1) * blockSize);

      // Sample upper 70th percentile roughly by averaging brighter pixels
      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const idx = (y * canvas.width + x) * 4;
          const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
          sum += lum;
          count++;
        }
      }
      bgMap[by * blocksX + bx] = count > 0 ? sum / count : 200;
    }
  }

  // Step 2: Normalize each pixel by its estimated local background brightness
  const contrastFactor = options.contrast || 1.25;

  for (let y = 0; y < canvas.height; y++) {
    const by = Math.min(blocksY - 1, Math.floor(y / blockSize));
    const byIndex = by * blocksX;

    for (let x = 0; x < canvas.width; x++) {
      const bx = Math.min(blocksX - 1, Math.floor(x / blockSize));
      const bgLum = Math.max(120, bgMap[byIndex + bx]);

      const idx = (y * canvas.width + x) * 4;
      const r = d[idx];
      const g = d[idx + 1];
      const b = d[idx + 2];
      const currentLum = 0.299 * r + 0.587 * g + 0.114 * b;

      // 1. Wipe out colored pen handwriting (blue pen, red pen, colored marks)
      if (options.eraseHandwriting) {
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC - minC > 14) {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
          continue;
        }
      }

      // Illumination ratio: (current / bg)
      const ratio = currentLum / bgLum;

      // When eraseHandwriting is true, use aggressive ratio (0.73 vs 0.88) to wipe out pencil marks
      const cutoff = options.eraseHandwriting ? 0.73 : 0.88;

      if (ratio > cutoff) {
        // Pure white paper background
        d[idx] = 255;
        d[idx + 1] = 255;
        d[idx + 2] = 255;
      } else {
        // Printed text / sharp geometry lines: enhance blackness
        const darkened = Math.max(0, Math.min(255, (currentLum - 128) * contrastFactor + 80));
        // If it's faint ink/pencil in eraseHandwriting mode, suppress it to white
        if (options.eraseHandwriting && darkened > 120) {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
        } else {
          const finalInk = darkened < 140 ? Math.round(darkened * 0.7) : darkened;
          d[idx] = finalInk;
          d[idx + 1] = finalInk;
          d[idx + 2] = finalInk;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
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

    if (r < 180 || g < 180 || b < 180) {
      return "#fdfdfd";
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return "#ffffff";
  }
}

/**
 * Crops a question area and optionally removes handwriting or applies scanner filter
 */
export async function cropQuestionArea(
  imageSource: HTMLImageElement,
  question: QuestionBox,
  options: {
    eraseHandwriting?: boolean;
    whiteBalance?: boolean;
    contrastBoost?: number;
    scannerFilter?: boolean;
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
      const localX = hwGlobalRect.x - qRect.x;
      const localY = hwGlobalRect.y - qRect.y;
      const localW = hwGlobalRect.width;
      const localH = hwGlobalRect.height;

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

      // Dashed outline to indicate answer slot
      ctx.strokeStyle = "rgba(180, 180, 190, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(localX, localY, localW, localH);
      ctx.restore();
    }
  }

  // Scanner filter / whiteout
  if (options.scannerFilter) {
    const scannedCanvas = applyDocumentScanFilter(canvas, {
      contrast: options.contrastBoost || 1.3,
      cropDeskEdges: false,
    });
    return scannedCanvas.toDataURL("image/png");
  }

  // Basic contrast adjustment
  if (options.whiteBalance || (options.contrastBoost && options.contrastBoost > 1)) {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const factor = options.contrastBoost || 1.15;

      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, Math.max(0, (d[i] - 128) * factor + 128));
        d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - 128) * factor + 128));
        d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - 128) * factor + 128));

        if (options.whiteBalance && d[i] > 205 && d[i + 1] > 205 && d[i + 2] > 205) {
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // ignore
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Crops a diagram/geometric illustration from the source image at full native resolution,
 * applying scanner whitening, bleed-through suppression, and contrast boosting.
 */
export async function cropDiagramArea(
  imageSource: HTMLImageElement | string,
  targetRect:
    | { x: number; y: number; width: number; height: number }
    | [number, number, number, number],
  options: {
    cleanFilter?: boolean;
    contrast?: number;
    padding?: number;
    eraseHandwriting?: boolean;
  } = {}
): Promise<string> {
  let img: HTMLImageElement;
  if (typeof imageSource === "string") {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSource;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
  } else {
    img = imageSource;
  }

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (!naturalWidth || !naturalHeight) return "";

  let pixelX = 0,
    pixelY = 0,
    pixelW = 0,
    pixelH = 0;

  if (Array.isArray(targetRect)) {
    // [ymin, xmin, ymax, xmax] in 0..1000 scale
    const [ymin, xmin, ymax, xmax] = targetRect;
    pixelX = Math.round((xmin / 1000) * naturalWidth);
    pixelY = Math.round((ymin / 1000) * naturalHeight);
    pixelW = Math.round(((xmax - xmin) / 1000) * naturalWidth);
    pixelH = Math.round(((ymax - ymin) / 1000) * naturalHeight);
  } else {
    pixelX = Math.round(targetRect.x);
    pixelY = Math.round(targetRect.y);
    pixelW = Math.round(targetRect.width);
    pixelH = Math.round(targetRect.height);
  }

  const padding = options.padding ?? 8;
  pixelX = Math.max(0, pixelX - padding);
  pixelY = Math.max(0, pixelY - padding);
  pixelW = Math.min(naturalWidth - pixelX, pixelW + padding * 2);
  pixelH = Math.min(naturalHeight - pixelY, pixelH + padding * 2);

  if (pixelW <= 5 || pixelH <= 5) return "";

  const canvas = document.createElement("canvas");
  canvas.width = pixelW;
  canvas.height = pixelH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";

  ctx.drawImage(
    img,
    pixelX,
    pixelY,
    pixelW,
    pixelH,
    0,
    0,
    pixelW,
    pixelH
  );

  if (options.cleanFilter !== false) {
    const scanned = applyDocumentScanFilter(canvas, {
      contrast: options.contrast || 1.35,
      cropDeskEdges: false,
      eraseHandwriting: options.eraseHandwriting ?? true,
    });
    return scanned.toDataURL("image/png");
  }

  return canvas.toDataURL("image/png");
}

/**
 * Generates an A4 PDF for printable homework correction / practice sheets (with answer lines)
 */
export async function exportHomeworkPdf(
  questions: QuestionBox[],
  imageSource: HTMLImageElement,
  options: {
    title?: string;
    studentName?: string;
    eraseHandwriting: boolean;
    whiteBalance: boolean;
    scannerFilter?: boolean;
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
  const contentWidth = pageWidth - margin * 2;

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
  const infoText = `学生: ${options.studentName || "______"}    生成时间: ${new Date().toLocaleDateString()}    共 ${questions.length} 道题目`;
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
      scannerFilter: options.scannerFilter,
      contrastBoost: 1.2,
    });

    if (!cropDataUrl) continue;

    const [ymin, xmin, ymax, xmax] = q.box_2d;
    const aspect = (xmax - xmin) / Math.max(1, ymax - ymin);

    let imgW = contentWidth;
    let imgH = imgW / aspect;

    if (imgH > 105) {
      imgH = 105;
      imgW = imgH * aspect;
    }

    const itemTotalHeight = imgH + 32;

    if (currentY + itemTotalHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFillColor(q.is_wrong ? 255 : 240, q.is_wrong ? 235 : 245, q.is_wrong ? 235 : 255);
    doc.roundedRect(margin, currentY, 45, 6, 1, 1, "F");
    doc.setFontSize(9);
    doc.setTextColor(q.is_wrong ? 210 : 30, q.is_wrong ? 30 : 100, q.is_wrong ? 30 : 200);
    doc.text(`第 ${q.index} 题 · ${q.topic || "题目"}`, margin + 2, currentY + 4.2);

    currentY += 8;
    doc.addImage(cropDataUrl, "PNG", margin, currentY, imgW, imgH);
    currentY += imgH + 4;

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
    doc.setLineDashPattern([], 0);

    currentY += 10;
  }

  doc.save(`作业订正本_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Exports a full blank test paper onto standard A4 PDF (No extra answer lines, pure scanner print)
 */
export async function exportFullBlankTestPdf(
  imageSource: HTMLImageElement,
  options: {
    cropDeskEdges?: boolean;
    contrastBoost?: number;
    filename?: string;
  } = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 8; // Narrow margins for test papers

  // Process image with scanner filter (removes phone shadows, cutting mat, whitening paper)
  const scannedCanvas = applyDocumentScanFilter(imageSource, {
    contrast: options.contrastBoost || 1.35,
    cropDeskEdges: options.cropDeskEdges ?? true,
  });

  const scannedDataUrl = scannedCanvas.toDataURL("image/png");
  const aspect = scannedCanvas.width / scannedCanvas.height;

  let renderW = pageWidth - margin * 2;
  let renderH = renderW / aspect;

  if (renderH > pageHeight - margin * 2) {
    renderH = pageHeight - margin * 2;
    renderW = renderH * aspect;
  }

  const posX = (pageWidth - renderW) / 2;
  const posY = (pageHeight - renderH) / 2;

  doc.addImage(scannedDataUrl, "PNG", posX, posY, renderW, renderH);
  doc.save(options.filename || `高清试卷打印版_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Optimizes image file size (bytes) while strictly preserving 100% of its native pixel resolution.
 * Retains 1:1 original dimensions (width & height) for ultra-sharp math formulas, superscripts, and small symbols,
 * while compressing uncompressed/raw camera photos down to lightweight JPEG (~900KB - 1.4MB).
 */
export async function compressImageForUpload(
  fileOrBase64: File | string,
  maxDimension: number = 4096, // Preserves 100% native resolution of smartphone camera photos (up to 4K)
  quality: number = 0.88 // High quality setting for razor-sharp math characters and subscripts
): Promise<string> {
  // If it's already a JPEG file under 2MB, read directly to preserve original untouched bytes
  if (
    typeof fileOrBase64 !== "string" &&
    fileOrBase64.size <= 2 * 1024 * 1024 &&
    (fileOrBase64.type === "image/jpeg" || fileOrBase64.type === "image/jpg")
  ) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      let { width, height } = img;

      // Only downscale if exceeding extreme 4K+ canvas memory limits (4096px)
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(typeof fileOrBase64 === "string" ? fileOrBase64 : "");
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (typeof fileOrBase64 === "string") {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(fileOrBase64);
    }
  });
}

