"use client";

import React from "react";
import { QuestionBox } from "@/types/homework";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Copy,
  FileDown,
  Printer,
  Sparkles,
  Layers,
  Filter,
} from "lucide-react";

interface QuestionSidebarProps {
  questions: QuestionBox[];
  activeBoxId: string | null;
  selectedWrongOnly: boolean;
  onSelectBox: (id: string) => void;
  onToggleWrong: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleWrongFilter: () => void;
  onOpenExportPdf: () => void;
}

export const QuestionSidebar: React.FC<QuestionSidebarProps> = ({
  questions,
  activeBoxId,
  selectedWrongOnly,
  onSelectBox,
  onToggleWrong,
  onDuplicate,
  onDelete,
  onToggleWrongFilter,
  onOpenExportPdf,
}) => {
  const wrongCount = questions.filter((q) => q.is_wrong).length;
  const filteredQuestions = selectedWrongOnly
    ? questions.filter((q) => q.is_wrong)
    : questions;

  return (
    <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#1f2433] bg-[#11131a] flex flex-col h-[40vh] lg:h-full z-20 select-none">
      {/* Sidebar Header: Overview Stats */}
      <div className="p-4 border-b border-[#1f2433] bg-[#141822]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400" />
            <h2 className="font-bold text-sm text-gray-100">切片题目清单</h2>
          </div>
          <button
            onClick={onToggleWrongFilter}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              selectedWrongOnly
                ? "bg-orange-500/20 text-orange-300 border border-orange-500/50"
                : "bg-[#1d2230] text-gray-400 hover:text-gray-200 border border-[#2b3348]"
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>仅看错题 ({wrongCount})</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-[#1a1f2c] border border-[#272e40]">
            <div className="text-gray-400 text-[11px]">总识别题目</div>
            <div className="font-bold text-base text-gray-100 mt-0.5">
              {questions.length}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[#1a1f2c] border border-[#272e40]">
            <div className="text-gray-400 text-[11px]">做错题目</div>
            <div className="font-bold text-base text-red-400 mt-0.5">
              {wrongCount}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[#1a1f2c] border border-[#272e40]">
            <div className="text-gray-400 text-[11px]">正确 / 空白</div>
            <div className="font-bold text-base text-blue-400 mt-0.5">
              {questions.length - wrongCount}
            </div>
          </div>
        </div>
      </div>

      {/* Question Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredQuestions.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            {selectedWrongOnly
              ? "暂无错题，卷面全部做对或为纯空白试卷 🎉"
              : "暂无识别题目，请点击画布下方【+ 手动加框】或【重新识别】"}
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const isSelected = q.id === activeBoxId;
            return (
              <div
                key={q.id}
                onClick={() => onSelectBox(q.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#1e2535] border-orange-500 shadow-md shadow-orange-500/10 ring-1 ring-orange-500/50"
                    : "bg-[#151822] hover:bg-[#1a1f2c] border-[#222838]"
                }`}
              >
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-gray-100">
                      第 {q.index} 题
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWrong(q.id);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition ${
                        q.is_wrong
                          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40"
                          : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/40"
                      }`}
                      title="点击切换对/错状态"
                    >
                      {q.is_wrong ? (
                        <>
                          <XCircle className="w-3 h-3 text-red-400" />
                          <span>错题</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-blue-400" />
                          <span>正确/待做</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Actions: Duplicate & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(q.id);
                      }}
                      title="拆分 / 复制框"
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252c3e] transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(q.id);
                      }}
                      title="删除此框"
                      className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-[#252c3e] transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Topic / Knowledge point */}
                <div className="mt-1.5 text-xs text-gray-300 font-medium truncate">
                  {q.topic || "综合练习题"}
                </div>

                {/* OCR text snippet */}
                {q.ocr_text && (
                  <p className="mt-1 text-[11px] text-gray-400 line-clamp-2 leading-relaxed bg-[#0e1017] p-1.5 rounded-lg border border-[#1b202c]">
                    {q.ocr_text}
                  </p>
                )}

                {/* Handwriting info */}
                {q.handwriting_boxes.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400/80">
                    <Sparkles className="w-3 h-3" />
                    <span>检测到 {q.handwriting_boxes.length} 处学生手写痕迹 (已支持自动擦除)</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Actions */}
      <div className="p-3.5 border-t border-[#1f2433] bg-[#141822] space-y-2">
        <button
          onClick={onOpenExportPdf}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition"
        >
          <Printer className="w-4 h-4" />
          <span>导出 A4 打印卷 / 订正本</span>
        </button>
      </div>
    </aside>
  );
};
