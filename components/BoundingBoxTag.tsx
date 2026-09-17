"use client";

import React from "react";
import { Plus, X } from "lucide-react";
import { QuestionBox } from "@/types/homework";

interface BoundingBoxTagProps {
  question: QuestionBox;
  onToggleWrong: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export const BoundingBoxTag: React.FC<BoundingBoxTagProps> = ({
  question,
  onToggleWrong,
  onDuplicate,
  onDelete,
}) => {
  const isWrong = question.is_wrong;

  return (
    <div className="absolute -top-3.5 left-2 right-2 flex items-center justify-between pointer-events-auto z-20">
      {/* Question Info Pill */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleWrong(question.id);
        }}
        title="点击可切换 对/错 状态"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold shadow-md transition-transform active:scale-95 ${
          isWrong
            ? "bg-[#ff3b30] text-white hover:bg-[#ff5247]"
            : "bg-[#2563eb] text-white hover:bg-[#3b82f6]"
        }`}
      >
        <span>第{question.index}题</span>
        <span>·</span>
        <span
          className={`px-1 rounded text-[11px] ${
            isWrong ? "bg-black/25 text-red-100" : "bg-black/20 text-blue-100"
          }`}
        >
          {isWrong ? "错" : "对"}
        </span>
        <span>·</span>
        <span className="truncate max-w-[120px]">
          {question.topic || "方向与位置"}
        </span>
      </button>

      {/* Action Buttons: Plus & Delete */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(question.id);
          }}
          title="拆分 / 新增候选框"
          className="w-8 h-8 rounded-full bg-[#ff7a29] hover:bg-[#ff8c42] active:scale-90 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 transition-transform"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(question.id);
          }}
          title="删除此框"
          className="w-8 h-8 rounded-full bg-[#2f3542] hover:bg-[#3d4556] active:scale-90 text-gray-300 hover:text-white flex items-center justify-center shadow-lg transition-transform"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
