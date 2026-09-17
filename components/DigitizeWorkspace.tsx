"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Copy,
  Check,
  Download,
  Printer,
  Edit3,
  Eye,
  RefreshCw,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Eraser,
  Move,
  Scissors,
  Crop,
  Trash2,
  X,
  Plus,
} from "lucide-react";
import { exportMarkdownToDocx } from "@/lib/docxExporter";
import { cropDiagramArea } from "@/lib/imageUtils";
import {
  normalizeMathDelimiters,
  renderLatexToHtml,
  latexToReadableUnicode,
  parseChoiceOptions,
} from "@/lib/mathUtils";

interface DigitizeWorkspaceProps {
  imageSrc: string;
  markdown: string;
  isDigitizing: boolean;
  eraseHandwriting?: boolean;
  onToggleEraseHandwriting?: (checked: boolean) => void;
  onMarkdownChange: (md: string) => void;
  onRedigitize: () => void;
}

/**
 * Helper to render inline LaTeX math formulas ($...$, $$...$$, etc.), markdown bold (**...**), and clean typography
 */
function renderFormattedLine(rawText: string): React.ReactNode {
  if (!rawText) return null;

  const normalized = normalizeMathDelimiters(rawText);

  // If no math or markdown indicators, clean plain text directly
  const hasFormatting =
    normalized.includes("$") ||
    normalized.includes("\\frac{") ||
    normalized.includes("\\sqrt{") ||
    normalized.includes("**") ||
    normalized.includes("\\angle") ||
    normalized.includes("\\triangle") ||
    normalized.includes("^\\circ");

  if (!hasFormatting) {
    return latexToReadableUnicode(normalized);
  }

  // Matches $$...$$, $...$, unwrapped \frac{...}{...}, unwrapped \sqrt{...}, or markdown bold **...**
  const tokenRegex =
    /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt\{[^{}]+\}|\*\*[^*]+?\*\*)/g;
  const parts = normalized.split(tokenRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // 1. Markdown bold: **text**
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
          const inner = part.slice(2, -2);
          return (
            <strong key={i} className="font-bold text-gray-900">
              {renderFormattedLine(inner)}
            </strong>
          );
        }

        // 2. Math Formula
        let isMath = false;
        let displayMode = false;
        const mathContent = part.trim();

        if (
          mathContent.startsWith("$$") &&
          mathContent.endsWith("$$") &&
          mathContent.length > 4
        ) {
          isMath = true;
          displayMode = true;
        } else if (
          mathContent.startsWith("$") &&
          mathContent.endsWith("$") &&
          mathContent.length > 2
        ) {
          isMath = true;
        } else if (
          mathContent.startsWith("\\frac{") ||
          mathContent.startsWith("\\sqrt{")
        ) {
          isMath = true;
        }

        if (isMath) {
          const { html, fallback } = renderLatexToHtml(mathContent, displayMode);
          if (html) {
            return (
              <span
                key={i}
                dangerouslySetInnerHTML={{ __html: html }}
                className={
                  displayMode
                    ? "block my-2 text-center"
                    : "inline-block px-0.5 align-baseline text-gray-900"
                }
              />
            );
          }
          return (
            <span
              key={i}
              className="inline-block px-0.5 font-serif italic text-gray-900"
            >
              {fallback || part}
            </span>
          );
        }

        // 3. Plain text: convert any loose LaTeX commands to readable unicode
        return <span key={i}>{latexToReadableUnicode(part)}</span>;
      })}
    </>
  );
}

export const DigitizeWorkspace: React.FC<DigitizeWorkspaceProps> = ({
  imageSrc,
  markdown,
  isDigitizing,
  eraseHandwriting = true,
  onToggleEraseHandwriting,
  onMarkdownChange,
  onRedigitize,
}) => {
  const [viewTab, setViewTab] = useState<"preview" | "edit">("preview");
  const [isCopied, setIsCopied] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [leftZoom, setLeftZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const imageViewportRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);

  // Manual Crop Diagram Tool
  const [isCropMode, setIsCropMode] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropBox, setCropBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [pendingDiagram, setPendingDiagram] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [selectedTargetQuestion, setSelectedTargetQuestion] = useState<string>("");
  const [isCopiedDiagram, setIsCopiedDiagram] = useState(false);
  const [replacingDiagramLineIdx, setReplacingDiagramLineIdx] = useState<number | null>(null);
  const [replacingDiagramSrc, setReplacingDiagramSrc] = useState<string | null>(null);

  const handleStartReplaceDiagram = (lineIdx: number, currentSrc?: string) => {
    setReplacingDiagramLineIdx(lineIdx);
    if (currentSrc) {
      setReplacingDiagramSrc(currentSrc);
    }
    setIsCropMode(true);
    if (isDesktop && splitPercent < 30) {
      setSplitPercent(50);
    }
    if (!isDesktop && workspaceRef.current) {
      workspaceRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Auto-resolve [插图: ymin, xmin, ymax, xmax] tags emitted by vision LLM
  useEffect(() => {
    const diagramRegex = /\[插图:\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/g;
    if (!diagramRegex.test(markdown)) return;

    let isMounted = true;
    const processAutoDiagrams = async () => {
      let currentMd = markdown;
      let match;
      const re = /\[插图:\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]/g;
      const tasks: { tag: string; coords: [number, number, number, number] }[] = [];
      while ((match = re.exec(markdown)) !== null) {
        tasks.push({
          tag: match[0],
          coords: [
            parseInt(match[1], 10),
            parseInt(match[2], 10),
            parseInt(match[3], 10),
            parseInt(match[4], 10),
          ],
        });
      }

      for (const t of tasks) {
        try {
          const cropped = await cropDiagramArea(imageSrc, t.coords, {
            cleanFilter: true,
            eraseHandwriting: true,
          });
          if (cropped && isMounted) {
            currentMd = currentMd.replace(t.tag, `\n\n![几何配图](${cropped})\n`);
          }
        } catch (err) {
          console.warn("Failed to auto-crop diagram:", err);
        }
      }

      if (isMounted && currentMd !== markdown) {
        onMarkdownChange(currentMd);
      }
    };

    processAutoDiagrams();
    return () => {
      isMounted = false;
    };
  }, [markdown, imageSrc, onMarkdownChange]);

  // Detected questions list from markdown
  const detectedQuestions = React.useMemo(() => {
    const lines = markdown.split("\n");
    const result: { index: number; title: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        /^(?:\d+[\.、]|\(\d+\)|（\d+）|[①②③④⑤⑥⑦⑧⑨⑩]|##?\s*(?:\d+[\.、]|\(\d+\)|（\d+）))/.test(
          line
        )
      ) {
        const clean = line.replace(/^[#\*\s]+/, "").slice(0, 35);
        result.push({ index: i, title: clean });
      }
    }
    return result;
  }, [markdown]);

  // Crop pointer event handlers
  const handlePointerDownCrop = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsCropping(true);
    setCropBox({
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMoveCrop = (e: React.PointerEvent) => {
    if (!isCropping || !cropBox) return;
    e.stopPropagation();
    setCropBox((prev) =>
      prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null
    );
  };

  const handlePointerUpCrop = async (e: React.PointerEvent) => {
    if (!isCropping || !cropBox) return;
    e.stopPropagation();
    setIsCropping(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const minX = Math.min(cropBox.startX, cropBox.currentX);
    const maxX = Math.max(cropBox.startX, cropBox.currentX);
    const minY = Math.min(cropBox.startY, cropBox.currentY);
    const maxY = Math.max(cropBox.startY, cropBox.currentY);
    const width = maxX - minX;
    const height = maxY - minY;

    setCropBox(null);

    if (width < 20 || height < 20) {
      return;
    }

    const imgEl = imgElementRef.current;
    if (!imgEl) return;

    const imgRect = imgEl.getBoundingClientRect();
    const clampMinX = Math.max(imgRect.left, minX);
    const clampMaxX = Math.min(imgRect.right, maxX);
    const clampMinY = Math.max(imgRect.top, minY);
    const clampMaxY = Math.min(imgRect.bottom, maxY);

    if (clampMaxX - clampMinX < 15 || clampMaxY - clampMinY < 15) return;

    const relX = (clampMinX - imgRect.left) / imgRect.width;
    const relY = (clampMinY - imgRect.top) / imgRect.height;
    const relW = (clampMaxX - clampMinX) / imgRect.width;
    const relH = (clampMaxY - clampMinY) / imgRect.height;

    const natW = imgEl.naturalWidth || imgEl.width;
    const natH = imgEl.naturalHeight || imgEl.height;

    const pixelRect = {
      x: relX * natW,
      y: relY * natH,
      width: relW * natW,
      height: relH * natH,
    };

    try {
      const croppedBase64 = await cropDiagramArea(imgEl, pixelRect, {
        cleanFilter: true,
        eraseHandwriting: true,
      });
      if (croppedBase64) {
        if (replacingDiagramLineIdx !== null || replacingDiagramSrc !== null) {
          const lines = markdown.split("\n");
          let targetIdx = replacingDiagramLineIdx;
          if (replacingDiagramSrc) {
            const foundIdx = lines.findIndex((l) => l.includes(replacingDiagramSrc));
            if (foundIdx !== -1) {
              targetIdx = foundIdx;
            }
          }
          if (targetIdx !== null && targetIdx >= 0 && targetIdx < lines.length) {
            lines[targetIdx] = `![几何配图](${croppedBase64})`;
            onMarkdownChange(lines.join("\n"));
          }
          setReplacingDiagramLineIdx(null);
          setReplacingDiagramSrc(null);
          setIsCropMode(false);
        } else {
          setPendingDiagram({
            dataUrl: croppedBase64,
            width: Math.round(pixelRect.width),
            height: Math.round(pixelRect.height),
          });
          setIsCropMode(false);
          if (detectedQuestions.length > 0) {
            setSelectedTargetQuestion(detectedQuestions[0].index.toString());
          } else {
            setSelectedTargetQuestion("end");
          }
        }
      }
    } catch (err) {
      console.error("Failed to crop diagram:", err);
    }
  };

  const handleCancelCrop = (e: React.PointerEvent) => {
    setIsCropping(false);
    setCropBox(null);
    setReplacingDiagramLineIdx(null);
    setReplacingDiagramSrc(null);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleInsertDiagramToMarkdown = () => {
    if (!pendingDiagram) return;

    const imgMarkdownTag = `\n\n![几何配图](${pendingDiagram.dataUrl})\n`;
    const lines = markdown.split("\n");

    if (selectedTargetQuestion === "end" || !selectedTargetQuestion) {
      onMarkdownChange(markdown + imgMarkdownTag);
    } else {
      const targetIdx = parseInt(selectedTargetQuestion, 10);
      if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= lines.length) {
        onMarkdownChange(markdown + imgMarkdownTag);
      } else {
        lines.splice(targetIdx + 1, 0, imgMarkdownTag);
        onMarkdownChange(lines.join("\n"));
      }
    }

    setPendingDiagram(null);
  };

  const handleCopyDiagram = async () => {
    if (!pendingDiagram) return;
    try {
      const res = await fetch(pendingDiagram.dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setIsCopiedDiagram(true);
      setTimeout(() => setIsCopiedDiagram(false), 2000);
    } catch {
      await navigator.clipboard.writeText(pendingDiagram.dataUrl);
      setIsCopiedDiagram(true);
      setTimeout(() => setIsCopiedDiagram(false), 2000);
    }
  };

  const handleDownloadDiagram = () => {
    if (!pendingDiagram) return;
    const a = document.createElement("a");
    a.href = pendingDiagram.dataUrl;
    a.download = `试卷插图_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Strictly trap wheel & trackpad pinch gestures inside the viewport (prevents browser page zoom)
  useEffect(() => {
    const el = imageViewportRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // e.preventDefault() blocks browser from zooming the entire page/windows!
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch-to-zoom or Ctrl+wheel: ONLY zoom the left photo
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        setLeftZoom((z) =>
          Math.max(0.5, Math.min(3.5, Math.round((z + delta) * 100) / 100))
        );
      } else {
        // Trackpad 2-finger scroll or wheel: ONLY pan the left photo
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };

    const handleGesture = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Must be { passive: false } to allow e.preventDefault() to block browser-level page zoom
    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    el.addEventListener("gesturestart", handleGesture, { passive: false });
    el.addEventListener("gesturechange", handleGesture, { passive: false });
    el.addEventListener("gestureend", handleGesture, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleNativeWheel);
      el.removeEventListener("gesturestart", handleGesture);
      el.removeEventListener("gesturechange", handleGesture);
      el.removeEventListener("gestureend", handleGesture);
    };
  }, []);

  const handlePointerDownImage = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsPanning(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveImage = (e: React.PointerEvent) => {
    if (!isPanning || !panStartRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  };

  const handlePointerUpImage = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsPanning(false);
    panStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleResetZoomAndPan = () => {
    setLeftZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDoubleClickImage = () => {
    if (leftZoom > 1.1) {
      handleResetZoomAndPan();
    } else {
      setLeftZoom(1.8);
    }
  };

  // Resizable split pane state
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState<number>(50); // 20 ~ 80%
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  // Detect desktop screen width (>= 1024px) for split-pane layout
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const newPercent = (currentX / rect.width) * 100;
      setSplitPercent(Math.max(20, Math.min(80, newPercent)));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging]);

  // Copy Markdown
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
    } catch {
      alert("复制失败，请手动选择复制");
    }
  };

  // Export Docx
  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      let filename = "电子试卷.docx";
      const titleMatch = markdown.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        filename = `${titleMatch[1].trim()}.docx`;
      }
      await exportMarkdownToDocx(markdown, filename);
    } catch (err) {
      alert(`导出 Word 失败: ${(err as Error).message}`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Print A4
  const handlePrint = () => {
    if (viewTab !== "preview") {
      setViewTab("preview");
      setTimeout(() => {
        window.print();
      }, 150);
    } else {
      window.print();
    }
  };

  return (
    <div
      ref={workspaceRef}
      className={`workspace-container flex-1 w-full h-full flex flex-col lg:flex-row overflow-hidden bg-[#090b10] ${
        isDragging ? "select-none cursor-col-resize" : ""
      }`}
    >
      {/* Left Column: Original Photo with Zoom */}
      <div
        style={isDesktop ? { width: `${splitPercent}%` } : undefined}
        className="workspace-left-pane print-hidden print:hidden w-full h-[40vh] lg:h-full border-b lg:border-b-0 border-[#1f2433] bg-[#0c0e14] relative flex flex-col overflow-hidden shrink-0"
      >
        <div className="h-10 px-4 border-b border-[#1f2433] bg-[#12151e] flex items-center justify-between text-xs text-gray-400 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              拍照原卷对比
            </span>
            {(leftZoom > 1 || pan.x !== 0 || pan.y !== 0) && (
              <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/25 flex items-center gap-1 animate-in fade-in">
                <Move className="w-3 h-3" />
                <span>可按住拖动 / 滚轮平移</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Diagram Crop Tool Toggle */}
            <button
              onClick={() => {
                setIsCropMode((prev) => {
                  if (prev) {
                    setReplacingDiagramLineIdx(null);
                    setReplacingDiagramSrc(null);
                  }
                  return !prev;
                });
                setIsCropping(false);
                setCropBox(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                isCropMode
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/40 ring-1 ring-white/50"
                  : "bg-[#1d2332] text-gray-300 hover:text-white hover:bg-[#273045] border border-[#2d3850]"
              }`}
              title={
                isCropMode
                  ? "点击退出截图模式"
                  : "点击后在原图上拉框即可精准截取几何图/示意图并插入试卷"
              }
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{isCropMode ? "退出截图" : "✂️ 框选提取插图"}</span>
            </button>

            <div className="h-3.5 w-px bg-gray-700/60 mx-0.5" />

            <button
              onClick={() => setLeftZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))}
              className="p-1 hover:text-white"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] w-9 text-center text-gray-300">
              {Math.round(leftZoom * 100)}%
            </span>
            <button
              onClick={() => setLeftZoom((z) => Math.min(3.5, Math.round((z + 0.15) * 100) / 100))}
              className="p-1 hover:text-white"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoomAndPan}
              className="p-1 hover:text-white"
              title="重置缩放与居中"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={imageViewportRef}
          onPointerDown={isCropMode ? handlePointerDownCrop : handlePointerDownImage}
          onPointerMove={isCropMode ? handlePointerMoveCrop : handlePointerMoveImage}
          onPointerUp={isCropMode ? handlePointerUpCrop : handlePointerUpImage}
          onPointerCancel={isCropMode ? handleCancelCrop : handlePointerUpImage}
          onDoubleClick={isCropMode ? undefined : handleDoubleClickImage}
          className={`flex-1 overflow-hidden relative flex items-center justify-center p-4 select-none touch-none bg-[#0a0c12] ${
            isCropMode
              ? "cursor-crosshair"
              : isPanning
              ? "cursor-grabbing"
              : "cursor-grab"
          }`}
          title={
            isCropMode
              ? "按住鼠标左键在几何图上拖拽拉框即可高精度截取"
              : "按住鼠标拖动平移图片，双击快速缩放，触控板/滚轮可平移"
          }
        >
          {/* Crop Mode Banner */}
          {isCropMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-orange-600/95 text-white text-xs px-3.5 py-1.5 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in border border-orange-400/40 whitespace-nowrap">
              <Scissors className="w-3.5 h-3.5 animate-pulse shrink-0" />
              <span>
                {replacingDiagramLineIdx !== null
                  ? "正在重新截取插图：请在原图上按住拉框，松开即可替换"
                  : "请在原卷几何图上按住鼠标拉框截取（松开自动增白去印）"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCropMode(false);
                  setReplacingDiagramLineIdx(null);
                  setReplacingDiagramSrc(null);
                  setCropBox(null);
                }}
                className="ml-1 px-2 py-0.5 bg-black/30 hover:bg-black/50 text-[11px] rounded-md font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          )}

          {/* Active Crop Selection Box */}
          {isCropping && cropBox && imageViewportRef.current && (
            <div
              style={{
                left:
                  Math.min(cropBox.startX, cropBox.currentX) -
                  imageViewportRef.current.getBoundingClientRect().left,
                top:
                  Math.min(cropBox.startY, cropBox.currentY) -
                  imageViewportRef.current.getBoundingClientRect().top,
                width: Math.abs(cropBox.currentX - cropBox.startX),
                height: Math.abs(cropBox.currentY - cropBox.startY),
              }}
              className="absolute border-2 border-orange-500 bg-orange-500/25 pointer-events-none rounded z-30 shadow-lg ring-2 ring-orange-500/30"
            />
          )}

          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${leftZoom})`,
              transformOrigin: "center center",
              transition: isPanning || isCropping ? "none" : "transform 0.12s ease-out",
            }}
            className="flex items-center justify-center max-w-full max-h-full will-change-transform pointer-events-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgElementRef}
              src={imageSrc}
              alt="Original Photo"
              draggable={false}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-xl border border-[#23293a] select-none"
            />
          </div>
        </div>
      </div>

      {/* Draggable Divider Handle (Desktop) */}
      <div
        onPointerDown={handlePointerDown}
        onDoubleClick={() => setSplitPercent(50)}
        title="按住左右拖拽调节窗口宽度，双击恢复 50:50 居中"
        className={`workspace-divider print-hidden print:hidden hidden lg:flex w-2 bg-[#141824] hover:bg-orange-500 active:bg-orange-500 cursor-col-resize items-center justify-center transition-colors relative z-30 select-none group shrink-0 ${
          isDragging
            ? "bg-orange-500 shadow-lg shadow-orange-500/50"
            : "hover:shadow-md border-x border-[#1f2433]"
        }`}
      >
        <div className="w-1 h-8 rounded-full bg-gray-600 group-hover:bg-white transition-colors" />

        {/* Floating Split Ratio Pill while dragging */}
        {isDragging && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/95 border border-orange-500/80 text-orange-300 font-mono text-[11px] px-2.5 py-1 rounded-full shadow-xl pointer-events-none whitespace-nowrap z-50 animate-in fade-in">
            {Math.round(splitPercent)}% : {Math.round(100 - splitPercent)}%
          </div>
        )}
      </div>

      {/* Right Column: Digitized Paper (Markdown / Word / Print) */}
      <div
        className="workspace-right-pane w-full lg:flex-1 h-[60vh] lg:h-full flex flex-col bg-[#11131a] overflow-hidden min-w-0"
      >
        {/* Workspace Action Toolbar */}
        <div className="workspace-toolbar print-hidden print:hidden p-3 border-b border-[#1f2433] bg-[#141824] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
          {/* View Tab Switcher & Handwriting Erase Checkbox */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1 bg-[#1a202e] p-1 rounded-xl border border-[#283248]">
              <button
                onClick={() => setViewTab("preview")}
                className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  viewTab === "preview"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>标准试卷排版</span>
              </button>
              <button
                onClick={() => setViewTab("edit")}
                className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  viewTab === "edit"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>编辑 Markdown</span>
              </button>
            </div>

            {/* 移除手写笔记选项（默认打勾） */}
            <label
              title="打勾后自动擦除做题手写笔记、涂鸦与红笔批改，还原为纯净空白试卷"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition ${
                eraseHandwriting
                  ? "bg-orange-500/15 border-orange-500/40 text-orange-200 hover:bg-orange-500/20"
                  : "bg-[#1a202e] border-[#283248] text-gray-400 hover:text-gray-200"
              }`}
            >
              <input
                type="checkbox"
                checked={eraseHandwriting}
                onChange={(e) => onToggleEraseHandwriting?.(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500 text-orange-500 bg-[#0e121a] border-gray-600 focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 font-medium text-xs">
                <Eraser
                  className={`w-3.5 h-3.5 ${
                    eraseHandwriting ? "text-orange-400" : "text-gray-400"
                  }`}
                />
                <span>移除手写笔记</span>
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onRedigitize}
              disabled={isDigitizing}
              className="px-2.5 py-1.5 rounded-xl bg-[#1d2332] hover:bg-[#252d40] border border-[#2b354c] text-gray-200 flex items-center gap-1.5 transition disabled:opacity-50"
              title="重新调用视觉大模型提取电子文本"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isDigitizing ? "animate-spin text-orange-400" : ""}`}
              />
              <span>{isDigitizing ? "识别中..." : "重新识别"}</span>
            </button>

            <button
              onClick={handleCopy}
              className="px-2.5 py-1.5 rounded-xl bg-[#1d2332] hover:bg-[#252d40] border border-[#2b354c] text-gray-200 flex items-center gap-1.5 transition active:scale-95"
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">已复制</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-300" />
                  <span>复制 MD</span>
                </>
              )}
            </button>

            <button
              onClick={handleExportDocx}
              disabled={isExportingDocx}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 shadow-md transition active:scale-95 disabled:opacity-50"
              title="导出标准微软 Word .docx 格式"
            >
              {isExportingDocx ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>导出 Word (.docx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 text-white font-bold flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition active:scale-95"
              title="调用系统打印，输出纯净无阴影矢量 A4 试卷"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>纯净打印</span>
            </button>
          </div>
        </div>

        {/* Workspace Body: Natural Block Scrolling */}
        <div className="workspace-body flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0d0f17]">
          {viewTab === "preview" ? (
            /* Pristine A4 Exam Paper Style Preview */
            <div className="printable-exam-paper print-page w-full max-w-[760px] mx-auto bg-white text-gray-900 p-8 sm:p-14 shadow-2xl rounded-sm font-sans min-h-full h-fit space-y-4 print:p-0 print:shadow-none print:m-0 print:w-full print:max-w-none">
              <div
                className={`text-[11px] px-3 py-1.5 rounded flex items-center gap-1.5 print:hidden border ${
                  eraseHandwriting
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : "text-blue-700 bg-blue-50 border-blue-200"
                }`}
              >
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    eraseHandwriting ? "text-emerald-600" : "text-blue-600"
                  }`}
                />
                <span>
                  {eraseHandwriting ? (
                    <>
                      <b>纯净空白卷排版</b>：已自动擦除所有拍照阴影与手写笔记，填空处已还原为作答横线，可直接编辑或打印。
                    </>
                  ) : (
                    <>
                      <b>试卷电子化（含作答）</b>：已保留原卷学生手写答案与做题记录，可直接编辑或导出 Word。
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-3 leading-relaxed text-gray-900">
                {markdown.split("\n").map((line, idx) => {
                  const trimmed = line.trim();
                  if (!trimmed) {
                    return <div key={idx} className="h-2" />;
                  }

                  if (trimmed === "[分页]" || trimmed === "[换页]" || trimmed === "<!-- pagebreak -->") {
                    return (
                      <div
                        key={idx}
                        className="print-page-break my-4 border-t border-dashed border-gray-300 print:border-none relative flex items-center justify-center text-[10px] text-gray-400 print:hidden"
                      >
                        <span className="bg-white px-2">--- 打印在此处分页 ---</span>
                      </div>
                    );
                  }

                  if (trimmed === "---" || trimmed === "***") {
                    return (
                      <hr key={idx} className="my-4 border-t border-gray-300" />
                    );
                  }

                  // # Title
                  if (trimmed.startsWith("# ")) {
                    return (
                      <h1
                        key={idx}
                        className="text-xl sm:text-2xl font-bold text-center text-gray-900 tracking-wide pt-2 pb-1"
                      >
                        {renderFormattedLine(trimmed.replace(/^#\s+/, ""))}
                      </h1>
                    );
                  }

                  // ## Section or Sub-question heading
                  if (trimmed.startsWith("## ")) {
                    const content = trimmed.replace(/^##\s+/, "");
                    const isMajorSection =
                      /^[一二三四五六七八九十]+[、.．]/.test(content) ||
                      /^第[一二三四五六七八九十]+部分/.test(content) ||
                      /^(?:选择题|填空题|解答题|计算题|证明题|练习题|综合题|根据)/.test(content);

                    if (isMajorSection) {
                      return (
                        <h2
                          key={idx}
                          className="text-base sm:text-lg font-bold text-gray-900 pt-3 pb-1 border-b border-gray-200"
                        >
                          {renderFormattedLine(content)}
                        </h2>
                      );
                    }

                    // For sub-questions like "## (1) 求证..." or "## 1. ..."
                    const isSubQuestion =
                      /^(?:\d+[\.、]|\(\d+\)|（\d+）|[①②③④⑤⑥⑦⑧⑨⑩])/.test(content);

                    return (
                      <div
                        key={idx}
                        className={`text-sm sm:text-base font-bold text-gray-900 pt-2.5 pb-0.5 ${
                          isSubQuestion ? "pl-1" : ""
                        }`}
                      >
                        {renderFormattedLine(content)}
                      </div>
                    );
                  }

                  // ### Sub-section
                  if (trimmed.startsWith("### ")) {
                    return (
                      <h3
                        key={idx}
                        className="text-sm font-bold text-gray-900 pt-2"
                      >
                        {renderFormattedLine(trimmed.replace(/^###\s+/, ""))}
                      </h3>
                    );
                  }

                  // #### Sub-sub-section
                  if (trimmed.startsWith("#### ")) {
                    return (
                      <h4
                        key={idx}
                        className="text-xs sm:text-sm font-bold text-gray-800 pt-1.5"
                      >
                        {renderFormattedLine(trimmed.replace(/^####\s+/, ""))}
                      </h4>
                    );
                  }

                  // Name / Date Info
                  if (trimmed.includes("Name:") || trimmed.includes("姓名")) {
                    return (
                      <div
                        key={idx}
                        className="text-xs sm:text-sm text-gray-700 text-right font-medium py-1"
                      >
                        {renderFormattedLine(trimmed)}
                      </div>
                    );
                  }

                  // Markdown Image: ![alt](url)
                  if (
                    trimmed.startsWith("![") &&
                    trimmed.includes("](") &&
                    trimmed.endsWith(")")
                  ) {
                    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
                    if (imgMatch) {
                      const alt = imgMatch[1] || "试卷插图";
                      const src = imgMatch[2];
                      const isTargetBeingReplaced =
                        replacingDiagramLineIdx === idx ||
                        (replacingDiagramSrc !== null && src === replacingDiagramSrc);
                      return (
                        <div
                          key={idx}
                          className="print-avoid-break my-4 flex flex-col items-center justify-center group relative max-w-md mx-auto print:my-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt=""
                            onClick={() => handleStartReplaceDiagram(idx, src)}
                            title="点击可直接在左侧原图上重新框选截取此插图"
                            className={`max-h-64 w-auto object-contain bg-white cursor-pointer transition-all duration-150 ${
                              isTargetBeingReplaced
                                ? "ring-2 ring-orange-500 rounded shadow-md scale-[1.01]"
                                : "hover:ring-2 hover:ring-orange-400/80 hover:rounded"
                            }`}
                          />
                          {/* Quick Action Overlay on Hover */}
                          <div className="absolute -top-3 right-0 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-xl border border-gray-700 text-xs print:hidden z-20">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartReplaceDiagram(idx, src);
                              }}
                              title="在左侧原图上按住鼠标重新拉框，松开后自动替换此插图"
                              className="px-2 py-0.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-colors shadow-sm"
                            >
                              <Scissors className="w-3 h-3" />
                              <span>重新框选截取</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newLines = markdown.split("\n");
                                newLines.splice(idx, 1);
                                onMarkdownChange(newLines.join("\n"));
                              }}
                              title="从试卷中删除此插图"
                              className="p-1 text-gray-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Active replacement indicator */}
                          {isTargetBeingReplaced && (
                            <div className="mt-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[11px] font-medium flex items-center gap-1.5 border border-orange-200 animate-pulse print:hidden">
                              <Scissors className="w-3 h-3 text-orange-600" />
                              <span>请在左侧原图拖拽拉框，松开后将直接替换...</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                  }

                  // Multiple Choice Options (e.g. A. ... B. ... C. ... D. ...)
                  const choiceOptions = parseChoiceOptions(trimmed);
                  if (choiceOptions) {
                    const isFour = choiceOptions.length >= 4;
                    const isTwo = choiceOptions.length === 2;

                    return (
                      <div
                        key={idx}
                        className={`my-2 pl-4 sm:pl-7 text-xs sm:text-sm grid ${
                          isFour
                            ? "grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2"
                            : isTwo
                            ? "grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5"
                            : "grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2"
                        }`}
                      >
                        {choiceOptions.map((opt) => (
                          <div
                            key={opt.label}
                            className="flex items-start gap-1.5 min-w-0"
                          >
                            <span className="font-bold text-gray-950 shrink-0">
                              {opt.label}
                            </span>
                            <span className="text-gray-800 break-words">
                              {renderFormattedLine(opt.text)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Single Option Line (e.g. "A. ...")
                  const singleOptMatch = trimmed.match(
                    /^([A-D][\.、．\)]|[（\(][A-D][\)）])\s*(.*)$/
                  );
                  if (singleOptMatch) {
                    const label = singleOptMatch[1];
                    const text = singleOptMatch[2];
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 pl-4 sm:pl-7 my-1.5 text-xs sm:text-sm text-gray-800"
                      >
                        <span className="font-bold text-gray-950 shrink-0">
                          {label}
                        </span>
                        <span>{renderFormattedLine(text)}</span>
                      </div>
                    );
                  }

                  // Normal Question or Math Line
                  const isNumbered =
                    /^(?:\d+[\.、]|\(\d+\)|（\d+）|[①②③④⑤⑥⑦⑧⑨⑩])/.test(trimmed);

                  return (
                    <div
                      key={idx}
                      className={`print-avoid-break text-xs sm:text-sm text-gray-900 leading-relaxed ${
                        isNumbered
                          ? "mt-6 pt-2 pl-1 font-semibold text-gray-950 border-t border-gray-100/90 first:border-none first:pt-0 first:mt-2"
                          : "mt-1.5 pl-4 sm:pl-6 font-normal text-gray-850"
                      }`}
                    >
                      {renderFormattedLine(trimmed)}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Markdown Source Editor */
            <div className="w-full max-w-3xl mx-auto h-full flex flex-col space-y-2">
              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span>Markdown 源码编辑（修改后实时生效）:</span>
                <span className="text-[11px] text-gray-500">
                  支持标准 Markdown 语法与 LaTeX 公式及图片
                </span>
              </div>
              <textarea
                value={markdown}
                onChange={(e) => onMarkdownChange(e.target.value)}
                className="flex-1 w-full p-4 rounded-xl bg-[#161a26] border border-[#283248] text-gray-100 font-mono text-xs sm:text-sm focus:outline-none focus:border-orange-500 leading-relaxed resize-none selection:bg-orange-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Extracted Diagram Insert / Export Modal */}
      {pendingDiagram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in print:hidden">
          <div className="bg-[#151824] border border-[#2d374d] rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232a3b] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-100">
                    已成功提取几何插图
                  </h3>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <Check className="w-3 h-3" />
                    <span>已自动增白纸张底色、滤除背面透印与手写杂质</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingDiagram(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image Preview */}
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-gray-300 max-h-60 overflow-hidden shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingDiagram.dataUrl}
                alt="Extracted Diagram"
                className="max-h-48 w-auto object-contain select-none"
              />
            </div>

            {/* Target Question Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>插入到试卷位置：</span>
                <span className="text-[10px] text-gray-500 font-normal">
                  (共检测到 {detectedQuestions.length} 道题目)
                </span>
              </label>
              <select
                value={selectedTargetQuestion}
                onChange={(e) => setSelectedTargetQuestion(e.target.value)}
                className="w-full bg-[#1b2030] border border-[#313c54] text-gray-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                {detectedQuestions.length > 0 ? (
                  detectedQuestions.map((q, qIdx) => (
                    <option key={qIdx} value={q.index}>
                      插入到 {q.title} 下方
                    </option>
                  ))
                ) : (
                  <option value="end">直接追加到试卷末尾</option>
                )}
                <option value="end">追加到试卷末尾</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-[#232a3b]">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyDiagram}
                  className="px-3 py-2 rounded-xl bg-[#1f2638] hover:bg-[#28324a] text-gray-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isCopiedDiagram ? "已复制！" : "复制图片"}</span>
                </button>
                <button
                  onClick={handleDownloadDiagram}
                  className="px-3 py-2 rounded-xl bg-[#1f2638] hover:bg-[#28324a] text-gray-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载单图</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPendingDiagram(null)}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleInsertDiagramToMarkdown}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-orange-500/25 transition active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>一键插入试卷</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
