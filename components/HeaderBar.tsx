"use client";

import React, { useRef } from "react";
import { Sparkles, Settings, Upload, FileDown, Sliders, FileText } from "lucide-react";

interface HeaderBarProps {
  questionCount: number;
  modelTime?: number;
  totalTime?: number;
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
  questionCount,
  modelTime,
  totalTime,
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
    <header className="h-14 border-b border-[#212636] bg-[#11131a] px-4 lg:px-6 flex items-center justify-between text-sm select-none z-30 shrink-0">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left: Brand & Model Pill */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold tracking-wide text-gray-100 text-base">
              Gradia
            </span>
            <span className="hidden md:inline-block text-[11px] text-gray-400 ml-2 font-normal border-l border-gray-700 pl-2">
              作业订正与试卷切片工具
            </span>
          </div>
        </div>

        {/* Model Tag */}
        <button
          onClick={onOpenSettings}
          title="点击切换视觉模型或配置 API Key"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:border-orange-400 hover:text-orange-300 transition-all"
        >
          <Sparkles className="w-3 h-3 text-orange-400" />
          <span>{modelName || "Ling-3.0-flash-VL"}</span>
        </button>
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
          <span>8A U2 英语空白卷 (拍照原卷)</span>
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

      {/* Right: Actions (Upload, Clean settings, API Settings, Export) */}
      <div className="flex items-center gap-2.5">
        {/* Upload Image Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-xl bg-[#1b2130] hover:bg-[#252c40] border border-[#2c354a] text-gray-200 text-xs font-medium flex items-center gap-1.5 transition"
        >
          <Upload className="w-3.5 h-3.5 text-orange-400" />
          <span className="hidden sm:inline">上传试卷/作业</span>
          <span className="sm:hidden">上传</span>
        </button>

        {/* Clean Settings */}
        <button
          onClick={onOpenCleanSettings}
          title="画面清洗与扫描设置"
          className="p-2 rounded-xl bg-[#1b2130] hover:bg-[#252c40] border border-[#2c354a] text-gray-300 hover:text-white transition"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Settings modal button */}
        <button
          onClick={onOpenSettings}
          title="模型与 API Key 设置"
          className="p-2 rounded-xl bg-[#1b2130] hover:bg-[#252c40] border border-[#2c354a] text-gray-300 hover:text-white transition"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Primary Export Button */}
        <button
          onClick={onOpenExportPdf}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-orange-500/20 transition"
        >
          <FileDown className="w-4 h-4" />
          <span>导出 PDF</span>
        </button>
      </div>
    </header>
  );
};
