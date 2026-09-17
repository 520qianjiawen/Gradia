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
} from "lucide-react";
import { exportMarkdownToDocx } from "@/lib/docxExporter";
import { normalizeMathDelimiters, renderLatexToHtml } from "@/lib/mathUtils";

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
 * Helper to render inline LaTeX math formulas ($...$, $$...$$, \(...\), etc.) safely with KaTeX
 */
function renderLineWithMath(rawText: string): React.ReactNode {
  const normalized = normalizeMathDelimiters(rawText);

  // If no math indicator, return original text
  if (
    !normalized.includes("$") &&
    !normalized.includes("\\frac{") &&
    !normalized.includes("\\sqrt{")
  ) {
    return rawText;
  }

  // Matches $$...$$, $...$, or unwrapped LaTeX commands like \frac{...}{...}
  const mathRegex =
    /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$|\\frac\{[^{}]+\}\{[^{}]+\}(?:\s*(?:\\[a-zA-Z]+|[a-zA-Z0-9]))?)/g;
  const parts = normalized.split(mathRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        let isMath = false;
        const mathContent = part.trim();
        let displayMode = false;

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
        } else if (mathContent.startsWith("\\frac{")) {
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
                    : "inline-block px-0.5 align-baseline"
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

        return <span key={i}>{part}</span>;
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

  const handlePointerDownImage = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
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
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    setPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    });
  };

  const handlePointerUpImage = (e: React.PointerEvent) => {
    setIsPanning(false);
    panStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheelImage = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setLeftZoom((z) => Math.max(0.5, Math.min(3.5, Math.round((z + delta) * 100) / 100)));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
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
    window.print();
  };

  return (
    <div
      ref={workspaceRef}
      className={`flex-1 w-full h-full flex flex-col lg:flex-row overflow-hidden bg-[#090b10] ${
        isDragging ? "select-none cursor-col-resize" : ""
      }`}
    >
      {/* Left Column: Original Photo with Zoom */}
      <div
        style={isDesktop ? { width: `${splitPercent}%` } : undefined}
        className="w-full h-[40vh] lg:h-full border-b lg:border-b-0 border-[#1f2433] bg-[#0c0e14] relative flex flex-col overflow-hidden shrink-0"
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
          <div className="flex items-center gap-1">
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
          onPointerDown={handlePointerDownImage}
          onPointerMove={handlePointerMoveImage}
          onPointerUp={handlePointerUpImage}
          onPointerCancel={handlePointerUpImage}
          onWheel={handleWheelImage}
          onDoubleClick={handleDoubleClickImage}
          className={`flex-1 overflow-hidden relative flex items-center justify-center p-4 select-none touch-none bg-[#0a0c12] ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
          title="按住鼠标拖动平移图片，双击快速缩放，触控板/滚轮可平移"
        >
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${leftZoom})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.12s ease-out",
            }}
            className="flex items-center justify-center max-w-full max-h-full will-change-transform pointer-events-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
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
        className={`hidden lg:flex w-2 bg-[#141824] hover:bg-orange-500 active:bg-orange-500 cursor-col-resize items-center justify-center transition-colors relative z-30 select-none group shrink-0 ${
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
        className="w-full lg:flex-1 h-[60vh] lg:h-full flex flex-col bg-[#11131a] overflow-hidden min-w-0"
      >
        {/* Workspace Action Toolbar */}
        <div className="p-3 border-b border-[#1f2433] bg-[#141824] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0d0f17]">
          {viewTab === "preview" ? (
            /* Pristine A4 Exam Paper Style Preview */
            <div className="w-full max-w-[760px] mx-auto bg-white text-gray-900 p-8 sm:p-14 shadow-2xl rounded-sm font-sans min-h-full h-fit space-y-4 print:p-0 print:shadow-none print:m-0 print:w-full print:max-w-none">
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
                        {trimmed.replace(/^#\s+/, "")}
                      </h1>
                    );
                  }

                  // ## Section
                  if (trimmed.startsWith("## ")) {
                    return (
                      <h2
                        key={idx}
                        className="text-base sm:text-lg font-bold text-gray-900 pt-3 pb-1 border-b border-gray-200"
                      >
                        {trimmed.replace(/^##\s+/, "")}
                      </h2>
                    );
                  }

                  // ### Sub-section
                  if (trimmed.startsWith("### ")) {
                    return (
                      <h3
                        key={idx}
                        className="text-sm font-bold text-gray-900 pt-2"
                      >
                        {trimmed.replace(/^###\s+/, "")}
                      </h3>
                    );
                  }

                  // Name / Date Info
                  if (trimmed.includes("Name:") || trimmed.includes("姓名")) {
                    return (
                      <div
                        key={idx}
                        className="text-xs sm:text-sm text-gray-700 text-right font-medium py-1"
                      >
                        {trimmed.replace(/\*\*/g, "")}
                      </div>
                    );
                  }

                  // Normal Question or Math Line
                  const isNumbered = /^\d+\.\s/.test(trimmed);
                  const cleanText = trimmed.replace(/\*\*/g, "");

                  return (
                    <div
                      key={idx}
                      className={`text-xs sm:text-sm text-gray-900 font-normal leading-relaxed ${
                        isNumbered ? "mt-3 pl-1 font-medium" : "mt-1 pl-4"
                      }`}
                    >
                      {renderLineWithMath(cleanText)}
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
                  支持标准 Markdown 语法与 LaTeX 公式
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
    </div>
  );
};
