"use client";

import React, { useRef } from "react";
import { RefreshCw, PlusSquare, Sliders, ImagePlus } from "lucide-react";

interface ToolbarProps {
  isAnalyzing: boolean;
  isDrawingNewBox: boolean;
  onReanalyze: () => void;
  onToggleDrawingNewBox: () => void;
  onOpenCleanSettings: () => void;
  onUploadImage: (file: File) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isAnalyzing,
  isDrawingNewBox,
  onReanalyze,
  onToggleDrawingNewBox,
  onOpenCleanSettings,
  onUploadImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto px-4 py-2 flex items-center justify-between gap-2 text-xs text-gray-300">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 重新识别 */}
      <button
        onClick={onReanalyze}
        disabled={isAnalyzing}
        className="flex-1 py-2.5 px-2 rounded-xl bg-[#1e2332] hover:bg-[#282f42] active:bg-[#181c28] border border-[#2d3448] flex items-center justify-center gap-1.5 transition text-gray-200 font-medium disabled:opacity-50"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 text-gray-300 ${isAnalyzing ? "animate-spin text-orange-400" : ""}`}
        />
        <span>重新识别</span>
      </button>

      {/* 手动加框 */}
      <button
        onClick={onToggleDrawingNewBox}
        className={`flex-1 py-2.5 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition font-medium ${
          isDrawingNewBox
            ? "bg-orange-500/20 border-orange-500 text-orange-300"
            : "bg-[#1e2332] hover:bg-[#282f42] active:bg-[#181c28] border-[#2d3448] text-gray-200"
        }`}
      >
        <PlusSquare className="w-3.5 h-3.5 text-gray-300" />
        <span>{isDrawingNewBox ? "松开完成" : "+ 手动加框"}</span>
      </button>

      {/* 清洗设置 */}
      <button
        onClick={onOpenCleanSettings}
        className="flex-1 py-2.5 px-2 rounded-xl bg-[#1e2332] hover:bg-[#282f42] active:bg-[#181c28] border border-[#2d3448] flex items-center justify-center gap-1.5 transition text-gray-200 font-medium"
      >
        <Sliders className="w-3.5 h-3.5 text-gray-300" />
        <span>清洗设置</span>
      </button>

      {/* 加照片 */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex-1 py-2.5 px-2 rounded-xl bg-[#1e2332] hover:bg-[#282f42] active:bg-[#181c28] border border-[#2d3448] flex items-center justify-center gap-1.5 transition text-gray-200 font-medium"
      >
        <ImagePlus className="w-3.5 h-3.5 text-gray-300" />
        <span>+ 加照片</span>
      </button>
    </div>
  );
};
