"use client";

import React, { useState, useEffect } from "react";
import { X, Key, Cpu, RotateCcw, Check, ExternalLink } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetDemo: () => void;
}

const PRESET_MODELS = [
  {
    id: "inclusionai/ling-3.0-flash-vl:free",
    name: "Ling 3.0 Flash VL (Free 推荐)",
    desc: "蚂蚁百灵 124B MoE (5.5B 激活)，原生支持视觉定位与自纠错，支持免费调用",
  },
  {
    id: "inclusionai/ling-3.0-flash-vl",
    name: "Ling 3.0 Flash VL (标准版)",
    desc: "高并发专用节点，无速率限制",
  },
  {
    id: "qwen/qwen-2.5-vl-72b-instruct:free",
    name: "Qwen 2.5 VL 72B (Free 备选)",
    desc: "阿里通义开源视觉大模型，复杂试卷 OCR 与中文理解稳定",
  },
  {
    id: "google/gemini-2.0-flash-exp:free",
    name: "Gemini 2.0 Flash (Free 备选)",
    desc: "谷歌超快速原生多模态大模型，响应快、极少宕机",
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetDemo,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("inclusionai/ling-3.0-flash-vl:free");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("openrouter_api_key") || "";
      const savedModel =
        localStorage.getItem("openrouter_model") ||
        "inclusionai/ling-3.0-flash-vl:free";
      setApiKey(savedKey);
      setModel(savedModel);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("openrouter_api_key", apiKey.trim());
      localStorage.setItem("openrouter_model", model.trim());
    }
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#161a25] border border-[#2d364c] shadow-2xl overflow-hidden text-gray-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#252c3e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-gray-100">模型与 API 设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#222838] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 text-sm">
          {/* API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-400" />
                <span>OpenRouter API Key</span>
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-orange-400 hover:text-orange-300 flex items-center gap-1"
              >
                <span>获取免费 Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1e2433] border border-[#313b52] focus:border-orange-500 focus:outline-none text-sm text-gray-100 placeholder-gray-500 transition font-mono"
            />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              部署在 Vercel 时，也可以直接在项目环境变量中配置{" "}
              <code className="px-1 py-0.5 rounded bg-[#232a3d] text-orange-300">
                OPENROUTER_API_KEY
              </code>
              ，无需在此手动填写。
            </p>
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>选择视觉大模型</span>
            </label>
            <div className="space-y-2">
              {PRESET_MODELS.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setModel(item.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    model === item.id
                      ? "bg-orange-500/10 border-orange-500 text-white"
                      : "bg-[#1d2230] border-[#2c3447] text-gray-300 hover:border-gray-500"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-gray-100">
                      {item.name}
                    </span>
                    {model === item.id && (
                      <Check className="w-4 h-4 text-orange-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reset Demo button */}
          <div className="pt-2 border-t border-[#252c3e] flex items-center justify-between">
            <span className="text-xs text-gray-400">想直接体验交互效果？</span>
            <button
              onClick={() => {
                onResetDemo();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#22283a] hover:bg-[#2b334a] text-gray-200 text-xs flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>一键恢复原题体验样例</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#12151f] border-t border-[#252c3e] flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
          >
            {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{isSaved ? "已保存" : "保存设置"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
