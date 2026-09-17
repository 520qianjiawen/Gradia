"use client";

import React from "react";
import { FileDown, Eye } from "lucide-react";

interface BottomBarProps {
  wrongCount: number;
  selectedWrongOnly: boolean;
  onToggleWrongFilter: () => void;
  onExportPdf: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  wrongCount,
  selectedWrongOnly,
  onToggleWrongFilter,
  onExportPdf,
}) => {
  return (
    <div className="w-full max-w-[480px] mx-auto px-4 pb-5 pt-2 flex items-center gap-3">
      {/* 错题过滤胶囊按钮 */}
      <button
        onClick={onToggleWrongFilter}
        title={selectedWrongOnly ? "已筛选：仅看错题" : "点击筛选仅看错题"}
        className={`h-12 px-4 rounded-xl border flex items-center justify-center gap-2.5 transition active:scale-95 ${
          selectedWrongOnly
            ? "bg-orange-500/20 border-orange-500 text-orange-200"
            : "bg-[#161a24] border-[#293042] hover:bg-[#1f2535] text-gray-200"
        }`}
      >
        <span className="w-6 h-6 rounded-full bg-[#ff7a29] text-black font-bold text-xs flex items-center justify-center shadow-md">
          {wrongCount}
        </span>
        <span className="font-semibold text-sm">道错题</span>
        <Eye className="w-3.5 h-3.5 opacity-60 ml-0.5" />
      </button>

      {/* 导出 PDF 主按钮 */}
      <button
        onClick={onExportPdf}
        className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#ff6a1f] to-[#ff8c38] hover:from-[#ff792e] hover:to-[#ff9b4f] active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 transition-all tracking-wider"
      >
        <FileDown className="w-5 h-5" />
        <span>导出 PDF</span>
      </button>
    </div>
  );
};
