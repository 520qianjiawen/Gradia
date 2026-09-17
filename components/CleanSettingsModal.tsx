"use client";

import React from "react";
import { X, Eraser, Sun, Contrast, CheckCircle2 } from "lucide-react";
import { CleanSettings } from "@/types/homework";

interface CleanSettingsModalProps {
  isOpen: boolean;
  settings: CleanSettings;
  onClose: () => void;
  onUpdateSettings: (newSettings: CleanSettings) => void;
}

export const CleanSettingsModal: React.FC<CleanSettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-[#171b26] border border-[#2b3347] shadow-2xl overflow-hidden text-gray-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#252c3d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <Eraser className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-gray-100">画面清洗与订正设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#23293a] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-sm">
          {/* 擦除手写笔迹 */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1f2535] border border-[#2d364d]">
            <div className="space-y-0.5">
              <div className="font-semibold text-gray-100 flex items-center gap-1.5">
                <Eraser className="w-4 h-4 text-orange-400" />
                <span>擦除手写笔迹（白底化重做）</span>
              </div>
              <p className="text-xs text-gray-400">
                利用 Ling-3.0 定位的手写区域，自动抹去学生作答与红笔批改痕迹
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.eraseHandwriting}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, eraseHandwriting: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#323b52] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* 纸张白平衡增白 */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1f2535] border border-[#2d364d]">
            <div className="space-y-0.5">
              <div className="font-semibold text-gray-100 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                <span>纸张去黄增白</span>
              </div>
              <p className="text-xs text-gray-400">
                提亮拍照发暗的作业纸张背景，导出打印更清晰省墨
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.whiteBalance}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, whiteBalance: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#323b52] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {/* 打印对比度增强 */}
          <div className="p-3.5 rounded-xl bg-[#1f2535] border border-[#2d364d] space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-100 flex items-center gap-1.5">
                <Contrast className="w-4 h-4 text-cyan-400" />
                <span>字迹对比度锐化</span>
              </div>
              <span className="text-xs font-mono text-cyan-400">
                {settings.contrastBoost.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="1.5"
              step="0.05"
              value={settings.contrastBoost}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  contrastBoost: parseFloat(e.target.value),
                })
              }
              className="w-full accent-orange-500 h-1.5 bg-[#2d364d] rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#12151f] border-t border-[#252c3d] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>完成设置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
