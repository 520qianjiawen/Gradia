"use client";

import React, { useRef, useState, useEffect } from "react";
import { QuestionBox, NormalizedBox, CleanSettings } from "@/types/homework";
import { BoundingBoxTag } from "./BoundingBoxTag";
import { boxToPixelRect, pixelRectToBox } from "@/lib/imageUtils";

type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface CanvasEditorProps {
  imageSrc: string;
  questions: QuestionBox[];
  cleanSettings: CleanSettings;
  isDrawingNewBox: boolean;
  onQuestionsChange: (newQuestions: QuestionBox[]) => void;
  onStopDrawing: () => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageSrc,
  questions,
  cleanSettings,
  isDrawingNewBox,
  onQuestionsChange,
  onStopDrawing,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<"move" | HandlePosition | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialBox, setInitialBox] = useState<NormalizedBox | null>(null);

  // For drawing new box
  const [newBoxDraft, setNewBoxDraft] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Keep track of image rendered size
  const updateSize = () => {
    if (imgRef.current) {
      setContainerSize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const wrongCount = questions.filter((q) => q.is_wrong).length;

  // Toggle Wrong
  const handleToggleWrong = (id: string) => {
    onQuestionsChange(
      questions.map((q) => (q.id === id ? { ...q, is_wrong: !q.is_wrong } : q))
    );
  };

  // Duplicate box
  const handleDuplicate = (id: string) => {
    const target = questions.find((q) => q.id === id);
    if (!target) return;
    const [ymin, xmin, ymax, xmax] = target.box_2d;
    const height = ymax - ymin;
    const offset = Math.min(60, 1000 - ymax);

    const newQ: QuestionBox = {
      id: `q_${Date.now()}`,
      index: questions.length + 1,
      is_wrong: target.is_wrong,
      topic: target.topic,
      box_2d: [ymin + offset, xmin, Math.min(1000, ymax + offset), xmax],
      handwriting_boxes: [],
      ocr_text: target.ocr_text,
    };
    onQuestionsChange([...questions, newQ]);
  };

  // Delete box
  const handleDelete = (id: string) => {
    const remaining = questions
      .filter((q) => q.id !== id)
      .map((q, idx) => ({ ...q, index: idx + 1 }));
    onQuestionsChange(remaining);
  };

  // Drag interaction handlers
  const handleMouseDown = (
    e: React.MouseEvent,
    boxId: string,
    mode: "move" | HandlePosition
  ) => {
    e.stopPropagation();
    if (isDrawingNewBox) return;

    setActiveBoxId(boxId);
    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });

    const q = questions.find((item) => item.id === boxId);
    if (q) {
      setInitialBox([...q.box_2d]);
    }
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingNewBox || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setNewBoxDraft({ startX, startY, currentX: startX, currentY: startY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawingNewBox && newBoxDraft && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setNewBoxDraft({
        ...newBoxDraft,
        currentX: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
        currentY: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
      });
      return;
    }

    if (!dragMode || !dragStart || !initialBox || !activeBoxId || !containerRef.current)
      return;

    const { clientWidth: w, clientHeight: h } = containerRef.current;
    if (w <= 0 || h <= 0) return;

    const deltaX = ((e.clientX - dragStart.x) / w) * 1000;
    const deltaY = ((e.clientY - dragStart.y) / h) * 1000;

    const [origYmin, origXmin, origYmax, origXmax] = initialBox;
    let [ymin, xmin, ymax, xmax] = initialBox;

    if (dragMode === "move") {
      const boxW = origXmax - origXmin;
      const boxH = origYmax - origYmin;

      xmin = Math.max(0, Math.min(1000 - boxW, origXmin + deltaX));
      ymin = Math.max(0, Math.min(1000 - boxH, origYmin + deltaY));
      xmax = xmin + boxW;
      ymax = ymin + boxH;
    } else {
      // Handles
      if (dragMode.includes("n")) ymin = Math.max(0, Math.min(origYmax - 20, origYmin + deltaY));
      if (dragMode.includes("s")) ymax = Math.min(1000, Math.max(origYmin + 20, origYmax + deltaY));
      if (dragMode.includes("w")) xmin = Math.max(0, Math.min(origXmax - 20, origXmin + deltaX));
      if (dragMode.includes("e")) xmax = Math.min(1000, Math.max(origXmin + 20, origXmax + deltaX));
    }

    onQuestionsChange(
      questions.map((q) =>
        q.id === activeBoxId
          ? {
              ...q,
              box_2d: [
                Math.round(ymin),
                Math.round(xmin),
                Math.round(ymax),
                Math.round(xmax),
              ],
            }
          : q
      )
    );
  };

  const handleMouseUp = () => {
    if (isDrawingNewBox && newBoxDraft && containerRef.current) {
      const { width: w, height: h } = containerSize;
      const x1 = Math.min(newBoxDraft.startX, newBoxDraft.currentX);
      const y1 = Math.min(newBoxDraft.startY, newBoxDraft.currentY);
      const x2 = Math.max(newBoxDraft.startX, newBoxDraft.currentX);
      const y2 = Math.max(newBoxDraft.startY, newBoxDraft.currentY);

      if (x2 - x1 > 30 && y2 - y1 > 30) {
        const box_2d = pixelRectToBox(
          { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
          w,
          h
        );
        const newQuestion: QuestionBox = {
          id: `q_${Date.now()}`,
          index: questions.length + 1,
          is_wrong: true,
          topic: "新增题目",
          box_2d,
          handwriting_boxes: [],
        };
        onQuestionsChange([...questions, newQuestion]);
      }
      setNewBoxDraft(null);
      onStopDrawing();
    }

    setDragMode(null);
    setDragStart(null);
    setInitialBox(null);
  };

  const renderHandles = (boxId: string) => {
    const handles: { pos: HandlePosition; cursor: string; style: string }[] = [
      { pos: "nw", cursor: "nwse-resize", style: "-top-2 -left-2" },
      { pos: "n", cursor: "ns-resize", style: "-top-2 left-1/2 -translate-x-1/2" },
      { pos: "ne", cursor: "nesw-resize", style: "-top-2 -right-2" },
      { pos: "e", cursor: "ew-resize", style: "top-1/2 -translate-y-1/2 -right-2" },
      { pos: "se", cursor: "nwse-resize", style: "-bottom-2 -right-2" },
      { pos: "s", cursor: "ns-resize", style: "-bottom-2 left-1/2 -translate-x-1/2" },
      { pos: "sw", cursor: "nesw-resize", style: "-bottom-2 -left-2" },
      { pos: "w", cursor: "ew-resize", style: "top-1/2 -translate-y-1/2 -left-2" },
    ];

    return handles.map(({ pos, cursor, style }) => (
      <div
        key={pos}
        onMouseDown={(e) => handleMouseDown(e, boxId, pos)}
        style={{ cursor }}
        className={`absolute w-3.5 h-3.5 bg-white border border-gray-400 rounded-[3px] shadow-sm handle-anchor z-30 ${style}`}
      />
    ));
  };

  return (
    <div
      className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden bg-[#0d0f15]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Centered Image Container with mobile-frame aesthetics matching screenshot */}
      <div
        ref={containerRef}
        onMouseDown={handleContainerMouseDown}
        className={`relative max-w-[460px] w-full max-h-[78vh] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl border border-[#252a38] bg-[#151822] select-none ${
          isDrawingNewBox ? "cursor-crosshair ring-2 ring-orange-500" : ""
        }`}
      >
        {/* The Homework Photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Homework Paper"
          onLoad={updateSize}
          className="w-full h-auto object-contain max-h-[78vh] rounded-xl pointer-events-none"
        />

        {/* Render Detected Question Boxes */}
        {containerSize.width > 0 &&
          questions.map((q) => {
            const rect = boxToPixelRect(
              q.box_2d,
              containerSize.width,
              containerSize.height
            );

            const isWrong = q.is_wrong;
            const borderColor = isWrong ? "#ff3b30" : "#2563eb";

            return (
              <div
                key={q.id}
                onMouseDown={(e) => handleMouseDown(e, q.id, "move")}
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                  borderColor: borderColor,
                }}
                className={`absolute border-2 transition-colors cursor-move z-10 ${
                  isWrong ? "bg-red-500/[0.04]" : "bg-blue-500/[0.04]"
                }`}
              >
                {/* Header Tag with Title & + / x buttons */}
                <BoundingBoxTag
                  question={q}
                  onToggleWrong={handleToggleWrong}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />

                {/* 8 Anchor Handles */}
                {renderHandles(q.id)}

                {/* Render Handwriting Boxes inside this Question */}
                {q.handwriting_boxes.map((hwBox, hwIdx) => {
                  const hwRect = boxToPixelRect(
                    hwBox,
                    containerSize.width,
                    containerSize.height
                  );
                  // Local coordinates relative to question box
                  const localLeft = hwRect.x - rect.x;
                  const localTop = hwRect.y - rect.y;

                  if (cleanSettings.eraseHandwriting) {
                    // Erased view: whiteout / paper color patch
                    return (
                      <div
                        key={hwIdx}
                        style={{
                          left: `${localLeft}px`,
                          top: `${localTop}px`,
                          width: `${hwRect.width}px`,
                          height: `${hwRect.height}px`,
                        }}
                        className="absolute bg-white/95 backdrop-blur-[1px] border border-dashed border-gray-300 rounded shadow-inner z-10 flex items-center justify-center pointer-events-none"
                      >
                        <span className="text-[10px] text-gray-400 font-mono scale-90">
                          已擦除手写
                        </span>
                      </div>
                    );
                  }

                  // Non-erased view: show amber/yellow dashed box
                  return (
                    <div
                      key={hwIdx}
                      style={{
                        left: `${localLeft}px`,
                        top: `${localTop}px`,
                        width: `${hwRect.width}px`,
                        height: `${hwRect.height}px`,
                      }}
                      title="手写答案 / 批改笔迹区域"
                      className="absolute border border-dashed border-amber-400/80 bg-amber-400/10 rounded pointer-events-none z-10"
                    >
                      <span className="absolute -top-3 left-1 text-[9px] text-amber-300 bg-black/60 px-1 rounded">
                        手写作答
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}

        {/* Draft box when user is manually dragging to add a new box */}
        {isDrawingNewBox && newBoxDraft && (
          <div
            style={{
              left: `${Math.min(newBoxDraft.startX, newBoxDraft.currentX)}px`,
              top: `${Math.min(newBoxDraft.startY, newBoxDraft.currentY)}px`,
              width: `${Math.abs(newBoxDraft.currentX - newBoxDraft.startX)}px`,
              height: `${Math.abs(newBoxDraft.currentY - newBoxDraft.startY)}px`,
            }}
            className="absolute border-2 border-dashed border-orange-400 bg-orange-500/20 z-30 pointer-events-none"
          />
        )}

        {/* Floating Detection Status Toast (Matching screenshot bottom banner) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-[#1c2230]/95 backdrop-blur-md border border-[#2d354a] shadow-xl text-xs sm:text-sm text-gray-200 pointer-events-none z-20 flex items-center gap-1.5 whitespace-nowrap soft-toast">
          <span>识别到</span>
          <b className="text-white font-semibold">{questions.length}</b>
          <span>道题，其中</span>
          <b className="text-[#ff453a] font-bold">{wrongCount}</b>
          <span>道做错</span>
        </div>
      </div>
    </div>
  );
};
