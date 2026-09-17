"use client";

import React, { useRef } from "react";
import {
  Sparkles,
  Settings,
  Upload,
  FileDown,
  Sliders,
  FileText,
  Layers,
  FileSpreadsheet,
} from "lucide-react";

interface HeaderBarProps {
  currentMode: "crop_correct" | "digitize_doc";
  onModeChange: (mode: "crop_correct" | "digitize_doc") => void;
  questionCount: number;
  modelName: string;
  isAnalyzing: boolean;
  currentImageName: string;
  onOpenSettings: () => void;
  onOpenCleanSettings: () => void;
  onOpenExportPdf: () => void;
  onUploadImage: (file: File) => void;
  onSelectSample: (sampleKey: "blank_english" | "math_graded") => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentMode,
  onModeChange,
  questionCount,
  modelName,
  isAnalyzing,
  currentImageName,
  onOpenSettings,
  onOpenCleanSettings,
  onOpenExportPdf,
  onUploadImage,
  onSelectSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
    }
  };

  return (
    <header className="h-14 border-b border-[#212636] bg-[#11131a] px-3 sm:px-6 flex items-center justify-between text-sm select-none z-30 shrink-0">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left: Brand & Mode Tabs */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold tracking-wide text-gray-100 text-base">
              Gradia
            </span>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-[#181d2a] p-1 rounded-xl border border-[#262f44]">
          <button
            onClick={() => onModeChange("digitize_doc")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              currentMode === "digitize_doc"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>试卷转电子版 (Markdown/Word)</span>
          </button>

          <button
            onClick={() => onModeChange("crop_correct")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              currentMode === "crop_correct"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>错题切片订正</span>
          </button>
        </div>
      </div>

      {/* Center: Sample switcher */}
      <div className="hidden xl:flex items-center gap-2 bg-[#161a25] p-1 rounded-xl border border-[#232b3c]">
        <span className="text-[11px] text-gray-400 px-2">快速载入样例:</span>
        <button
          onClick={() => onSelectSample("blank_english")}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            currentImageName.includes("blank")
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>英语默写卷 (拍照原卷)</span>
        </button>
        <button
          onClick={() => onSelectSample("math_graded")}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            currentImageName.includes("homework")
              ? "bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>数学作业 (错题批改)</span>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-xl bg-[#1b2130] hover:bg-[#252c40] border border-[#2c354a] text-gray-200 text-xs font-medium flex items-center gap-1.5 transition"
        >
          <Upload className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline">上传新试卷</span>
          <span className="sm:hidden">上传</span>
        </button>

        {currentMode === "crop_correct" && (
          <button
            onClick={onOpenCleanSettings}
            title="画面清洗与扫描设置"
            className="p-2 rounded-xl bg-[#1b2130] hover:bg-[#252c40] border border-[#2c354a] text-gray-300 hover:text-white transition"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="模型与 API Key 设置"
          className="p-2 rounded-xl bg-[#1b2130] hover:bg-[#252c40] border border-[#2c354a] text-gray-300 hover:text-white transition"
        >
          <Settings className="w-4 h-4" />
        </button>

        {currentMode === "crop_correct" && (
          <button
            onClick={onOpenExportPdf}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-orange-500/20 transition"
          >
            <FileDown className="w-4 h-4" />
            <span>导出 PDF</span>
          </button>
        )}
      </div>
    </header>
  );
};
