"use client";

import React, { useState, useEffect } from "react";
import { X, FileDown, CheckCircle2, Eraser, Loader2, Scan, Printer, BookOpen } from "lucide-react";
import { QuestionBox, CleanSettings } from "@/types/homework";
import {
  cropQuestionArea,
  exportHomeworkPdf,
  exportFullBlankTestPdf,
  applyDocumentScanFilter,
} from "@/lib/imageUtils";

interface ExportPdfModalProps {
  isOpen: boolean;
  questions: QuestionBox[];
  imageSrc: string;
  cleanSettings: CleanSettings;
  onClose: () => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  questions,
  imageSrc,
  cleanSettings,
  onClose,
}) => {
  // Mode selection: 'corrections' (错题订正本) or 'blank_test' (空白试卷原样打印)
  const [exportMode, setExportMode] = useState<"blank_test" | "corrections">(
    questions.some((q) => q.is_wrong) ? "corrections" : "blank_test"
  );

  const [title, setTitle] = useState("作业错题重做订正集");
  const [studentName, setStudentName] = useState("小明");
  const [exportWrongOnly, setExportWrongOnly] = useState(
    questions.some((q) => q.is_wrong)
  );
  const [eraseHandwriting, setEraseHandwriting] = useState(
    cleanSettings.eraseHandwriting
  );
  const [whiteBalance, setWhiteBalance] = useState(cleanSettings.whiteBalance);
  const [cropDeskEdges, setCropDeskEdges] = useState(true);
  const [scannerFilter, setScannerFilter] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [scannedFullPreview, setScannedFullPreview] = useState<string>("");
  const [previewThumbnails, setPreviewThumbnails] = useState<
    { id: string; url: string; isWrong: boolean; index: number; topic: string }[]
  >([]);

  const filteredQuestions = exportWrongOnly
    ? questions.filter((q) => q.is_wrong)
    : questions;

  // Generate previews depending on mode
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const generatePreview = async () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      if (exportMode === "blank_test") {
        // Generate full-page scanner preview
        const canvas = applyDocumentScanFilter(img, {
          contrast: 1.35,
          cropDeskEdges: cropDeskEdges,
        });
        if (isMounted) {
          setScannedFullPreview(canvas.toDataURL("image/jpeg", 0.85));
        }
      } else {
        // Generate cropped question thumbnails
        const thumbs: {
          id: string;
          url: string;
          isWrong: boolean;
          index: number;
          topic: string;
        }[] = [];

        for (const q of filteredQuestions) {
          const url = await cropQuestionArea(img, q, {
            eraseHandwriting,
            whiteBalance,
            scannerFilter,
            contrastBoost: 1.15,
          });
          if (url) {
            thumbs.push({
              id: q.id,
              url,
              isWrong: q.is_wrong,
              index: q.index,
              topic: q.topic,
            });
          }
        }

        if (isMounted) {
          setPreviewThumbnails(thumbs);
        }
      }
    };

    generatePreview();
    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    exportMode,
    cropDeskEdges,
    exportWrongOnly,
    eraseHandwriting,
    whiteBalance,
    scannerFilter,
    imageSrc,
    questions,
  ]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      if (exportMode === "blank_test") {
        // Full Page Blank Test Print
        await exportFullBlankTestPdf(img, {
          cropDeskEdges,
          contrastBoost: 1.35,
          filename: `高清试卷_${new Date().toISOString().slice(0, 10)}.pdf`,
        });
      } else {
        // Questions Correction Book
        await exportHomeworkPdf(filteredQuestions, img, {
          title,
          studentName,
          eraseHandwriting,
          whiteBalance,
          scannerFilter,
        });
      }
      onClose();
    } catch (err) {
      alert(`导出 PDF 失败: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-[#161a25] border border-[#2c354a] shadow-2xl overflow-hidden text-gray-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#252c3e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <Printer className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-gray-100">打印与导出 A4 试卷</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#222838] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 pb-1 border-b border-[#212638] bg-[#12151f] flex gap-2">
          <button
            onClick={() => setExportMode("blank_test")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              exportMode === "blank_test"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                : "bg-[#1b202e] text-gray-400 hover:text-gray-200"
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>空白试卷原版打印 (去阴影·清爽A4原卷)</span>
          </button>

          <button
            onClick={() => setExportMode("corrections")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              exportMode === "corrections"
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                : "bg-[#1b202e] text-gray-400 hover:text-gray-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>错题订正本 (附订正答题区)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {exportMode === "blank_test" ? (
            /* Mode 1: Blank Test Paper Re-print */
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-200 leading-relaxed">
                💡 <b>已启用专业试卷扫描滤镜</b>：自动消除手机拍照不均匀光斑、纸面阴影及发黄背景，并将四周桌面/切割垫裁切干净，直接还原成如同 Word 排版的高清白底打印卷！
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-[#1d2232] border border-[#2b3346] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cropDeskEdges}
                    onChange={(e) => setCropDeskEdges(e.target.checked)}
                    className="rounded accent-orange-500 w-4 h-4"
                  />
                  <span className="text-gray-200">自动切除桌面黑边与垫板</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-[#1d2232] border border-[#2b3346] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scannerFilter}
                    onChange={(e) => setScannerFilter(e.target.checked)}
                    className="rounded accent-orange-500 w-4 h-4"
                  />
                  <span className="text-gray-200">去阴影与纸面漂白 (#FFFFFF)</span>
                </label>
              </div>

              {/* Live Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span className="font-semibold">打印效果实时预览 (A4 单页)</span>
                  <span className="text-emerald-400 font-mono text-[11px]">
                    纯白无杂底 · 省墨极清
                  </span>
                </div>
                <div className="rounded-xl border border-[#2b3346] p-2 bg-[#0c0e14] flex items-center justify-center max-h-64 overflow-hidden">
                  {scannedFullPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={scannedFullPreview}
                      alt="Scanned Preview"
                      className="max-h-60 rounded shadow-md object-contain border border-gray-300 bg-white"
                    />
                  ) : (
                    <div className="py-12 text-xs text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                      <span>正在渲染高清扫描效果...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Corrections Book */
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">试卷标题</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1e2332] border border-[#313b52] text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">学生姓名</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1e2332] border border-[#313b52] text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExportWrongOnly(true)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    exportWrongOnly
                      ? "bg-orange-500/20 border-orange-500 text-orange-300"
                      : "bg-[#1e2332] border-[#2d354b] text-gray-400"
                  }`}
                >
                  <span>仅导出错题 ({questions.filter((q) => q.is_wrong).length} 题)</span>
                </button>
                <button
                  onClick={() => setExportWrongOnly(false)}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    !exportWrongOnly
                      ? "bg-orange-500/20 border-orange-500 text-orange-300"
                      : "bg-[#1e2332] border-[#2d354b] text-gray-400"
                  }`}
                >
                  <span>导出全部题目 ({questions.length} 题)</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1c2230] border border-[#2b3346] text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eraseHandwriting}
                    onChange={(e) => setEraseHandwriting(e.target.checked)}
                    className="rounded accent-orange-500 w-4 h-4"
                  />
                  <span className="text-gray-200 flex items-center gap-1">
                    <Eraser className="w-3.5 h-3.5 text-orange-400" />
                    擦除学生手写笔迹
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scannerFilter}
                    onChange={(e) => setScannerFilter(e.target.checked)}
                    className="rounded accent-orange-500 w-4 h-4"
                  />
                  <span className="text-gray-200">纯白扫描增强</span>
                </label>
              </div>

              {/* Thumbnails */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-300">
                  排版切片预览 ({previewThumbnails.length} 题)
                </div>
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {previewThumbnails.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-xl bg-[#11131c] border border-[#262c3e] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded font-medium ${
                            item.isWrong
                              ? "bg-red-500/20 text-red-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          第 {item.index} 题 · {item.topic}
                        </span>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt="Question slice"
                        className="w-full rounded border border-[#2b3346] object-contain max-h-32 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#12151f] border-t border-[#252c3e] flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-400">
            {exportMode === "blank_test"
              ? "满幅 A4 试卷格式，直接接打印机"
              : "标准 A4 错题排版，附带答题虚线"}
          </span>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>正在生成高清 PDF...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>立即下载 A4 PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
