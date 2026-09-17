"use client";

import React, { useState, useEffect } from "react";
import { X, FileDown, CheckCircle2, Eraser, Loader2 } from "lucide-react";
import { QuestionBox, CleanSettings } from "@/types/homework";
import { cropQuestionArea, exportHomeworkPdf } from "@/lib/imageUtils";

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
  const [title, setTitle] = useState("作业错题重做订正集");
  const [studentName, setStudentName] = useState("小明");
  const [exportWrongOnly, setExportWrongOnly] = useState(true);
  const [eraseHandwriting, setEraseHandwriting] = useState(
    cleanSettings.eraseHandwriting
  );
  const [whiteBalance, setWhiteBalance] = useState(cleanSettings.whiteBalance);
  const [isExporting, setIsExporting] = useState(false);
  const [previewThumbnails, setPreviewThumbnails] = useState<
    { id: string; url: string; isWrong: boolean; index: number; topic: string }[]
  >([]);

  const filteredQuestions = exportWrongOnly
    ? questions.filter((q) => q.is_wrong)
    : questions;

  // Generate previews
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadThumbnails = async () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

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
          contrastBoost: 1.1,
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
    };

    loadThumbnails();
    return () => {
      isMounted = false;
    };
  }, [isOpen, exportWrongOnly, eraseHandwriting, whiteBalance, imageSrc, questions]);

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

      await exportHomeworkPdf(filteredQuestions, img, {
        title,
        studentName,
        eraseHandwriting,
        whiteBalance,
      });
      onClose();
    } catch (err) {
      alert(`导出 PDF 失败: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-[#161a25] border border-[#2c354a] shadow-2xl overflow-hidden text-gray-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#252c3e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <FileDown className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-gray-100">导出 A4 错题订正本</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#222838] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Form Options */}
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

          {/* Scope selection */}
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

          {/* Clean options */}
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
                擦除学生手写，生成空白重做练习卷
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={whiteBalance}
                onChange={(e) => setWhiteBalance(e.target.checked)}
                className="rounded accent-orange-500 w-4 h-4"
              />
              <span className="text-gray-200">去黄增白</span>
            </label>
          </div>

          {/* Live Preview of Cropped Questions */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-gray-300">
              排版切片预览 ({previewThumbnails.length} 题)
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
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
                    <span className="text-gray-500">
                      {eraseHandwriting ? "已遮罩手写" : "原手写保留"}
                    </span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt="Question slice"
                    className="w-full rounded border border-[#2b3346] object-contain max-h-36 bg-white"
                  />
                  <div className="text-[10px] text-gray-500 italic">
                    下方将自动留空 3 行虚线答题区供打印书写
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#12151f] border-t border-[#252c3e] flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-400">
            生成标准 A4 页面，支持直接打印
          </span>
          <button
            onClick={handleExport}
            disabled={isExporting || filteredQuestions.length === 0}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>正在排版切图...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>生成并下载 PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
