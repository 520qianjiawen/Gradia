"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { exportMarkdownToDocx } from "@/lib/docxExporter";

interface DigitizeWorkspaceProps {
  imageSrc: string;
  markdown: string;
  isDigitizing: boolean;
  onMarkdownChange: (md: string) => void;
  onRedigitize: () => void;
}

export const DigitizeWorkspace: React.FC<DigitizeWorkspaceProps> = ({
  imageSrc,
  markdown,
  isDigitizing,
  onMarkdownChange,
  onRedigitize,
}) => {
  const [viewTab, setViewTab] = useState<"preview" | "edit">("preview");
  const [isCopied, setIsCopied] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [leftZoom, setLeftZoom] = useState(1);

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
    <div className="flex-1 w-full h-full flex flex-col lg:flex-row overflow-hidden bg-[#090b10]">
      {/* Left Column: Original Photo with Zoom */}
      <div className="w-full lg:w-1/2 h-[40vh] lg:h-full border-b lg:border-b-0 lg:border-r border-[#1f2433] bg-[#0c0e14] relative flex flex-col overflow-hidden">
        <div className="h-10 px-4 border-b border-[#1f2433] bg-[#12151e] flex items-center justify-between text-xs text-gray-400 shrink-0 select-none">
          <span className="font-semibold text-gray-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            拍照原卷对比
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLeftZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1 hover:text-white"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] w-8 text-center text-gray-300">
              {Math.round(leftZoom * 100)}%
            </span>
            <button
              onClick={() => setLeftZoom((z) => Math.min(2.5, z + 0.1))}
              className="p-1 hover:text-white"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLeftZoom(1)}
              className="p-1 hover:text-white"
              title="重置"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <div
            style={{
              transform: `scale(${leftZoom})`,
              transformOrigin: "center center",
              transition: "transform 0.15s ease",
            }}
            className="flex items-center justify-center max-w-full max-h-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Original Photo"
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-xl border border-[#23293a]"
            />
          </div>
        </div>
      </div>

      {/* Right Column: Digitized Paper (Markdown / Word / Print) */}
      <div className="w-full lg:w-1/2 h-[60vh] lg:h-full flex flex-col bg-[#11131a] overflow-hidden">
        {/* Workspace Action Toolbar */}
        <div className="p-3 border-b border-[#1f2433] bg-[#141824] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
          {/* View Tab Switcher */}
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Redigitize */}
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

            {/* Copy MD */}
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

            {/* Export Word */}
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

            {/* Print A4 */}
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

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-[#0d0f17]">
          {viewTab === "preview" ? (
            /* Pristine A4 Exam Paper Style Preview */
            <div className="w-full max-w-[760px] bg-white text-gray-900 p-8 sm:p-12 shadow-2xl rounded-sm font-sans min-h-[950px] space-y-4 print:p-0 print:shadow-none print:m-0 print:w-full print:max-w-none">
              <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded flex items-center gap-1.5 print:hidden">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  <b>数字化重构完成</b>：已彻底消除拍照阴影、暗角和折痕。打印或导出 Word 均为 100% 纯净矢量排版。
                </span>
              </div>

              <div className="space-y-3 leading-relaxed">
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
                        className="text-base sm:text-lg font-bold text-gray-800 pt-3 pb-1 border-b border-gray-200"
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
                        className="text-sm font-bold text-gray-800 pt-2"
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
                        className="text-xs sm:text-sm text-gray-600 text-right font-medium py-1"
                      >
                        {trimmed.replace(/\*\*/g, "")}
                      </div>
                    );
                  }

                  // Normal Question item with Underlines
                  const isNumbered = /^\d+\.\s/.test(trimmed);
                  return (
                    <div
                      key={idx}
                      className={`text-xs sm:text-sm text-gray-800 font-normal ${
                        isNumbered ? "mt-2.5 pl-1" : "mt-1 pl-4"
                      }`}
                    >
                      {trimmed.replace(/\*\*/g, "")}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Markdown Source Editor */
            <div className="w-full max-w-3xl h-full flex flex-col space-y-2">
              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span>Markdown 源码编辑（修改后实时生效）:</span>
                <span className="text-[11px] text-gray-500">
                  支持标准 Markdown 语法与音标
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
