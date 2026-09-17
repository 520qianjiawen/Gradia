"use client";

import React from "react";
import { Sparkles, ChevronLeft, ChevronRight, Settings } from "lucide-react";

interface HeaderBarProps {
  questionCount: number;
  candidateCount: number;
  modelTime?: number;
  totalTime?: number;
  modelName: string;
  isAnalyzing: boolean;
  onOpenSettings: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  questionCount,
  candidateCount,
  modelTime,
  totalTime,
  modelName,
  isAnalyzing,
  onOpenSettings,
}) => {
  return (
    <header className="h-14 border-b border-[#212636] bg-[#12151f]/95 backdrop-blur px-4 flex items-center justify-between text-sm select-none z-30">
      {/* Left: Brand & Model Pill */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-orange-600 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          </div>
          <span className="font-bold tracking-wide text-gray-100 text-base">
            错题速抠
          </span>
        </div>

        <button
          onClick={onOpenSettings}
          title="点击切换模型或配置 API Key"
          className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/40 text-orange-400 hover:border-orange-400 hover:text-orange-300 transition-all flex items-center gap-1.5"
        >
          <Sparkles className="w-3 h-3 text-orange-400" />
          <span>{modelName || "Ling-3.0-flash-VL"}</span>
        </button>
      </div>

      {/* Center: Page & Candidate count */}
      <div className="flex items-center gap-2">
        <button
          disabled
          className="p-1 rounded text-gray-500 hover:text-gray-300 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <div className="text-xs font-semibold text-gray-200">1 / 1</div>
          <div className="text-[10px] text-gray-400">
            {candidateCount} 个候选框
          </div>
        </div>
        <button
          disabled
          className="p-1 rounded text-gray-500 hover:text-gray-300 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Timing Stats & Settings button */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="text-amber-400 font-semibold">{questionCount} 题</span>
          <span className="text-gray-500">·</span>
          {isAnalyzing ? (
            <span className="text-orange-400 animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              模型推理中...
            </span>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <span>
                模型{" "}
                <b className="text-emerald-400 font-mono">
                  {modelTime ? (modelTime / 1000).toFixed(2) : "4.49"}s
                </b>
              </span>
              <span>·</span>
              <span>
                端到端{" "}
                <b className="text-cyan-400 font-mono">
                  {totalTime ? (totalTime / 1000).toFixed(2) : "4.80"}s
                </b>
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onOpenSettings}
          title="设置 API Key / 模型"
          className="p-2 rounded-lg bg-[#1a1f2c] hover:bg-[#252b3d] text-gray-300 hover:text-white transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
