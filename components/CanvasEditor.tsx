"use client";

import React, { useRef, useState, useEffect } from "react";
import { QuestionBox, NormalizedBox, CleanSettings } from "@/types/homework";
import { boxToPixelRect, pixelRectToBox, applyDocumentScanFilter } from "@/lib/imageUtils";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Eraser,
  RefreshCw,
  PlusSquare,
  Plus,
  Sliders,
  Check,
  X,
} from "lucide-react";

type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface CanvasEditorProps {
  imageSrc: string;
  questions: QuestionBox[];
  cleanSettings: CleanSettings;
  isDrawingNewBox: boolean;
  activeBoxId: string | null;
  isAnalyzing: boolean;
  onSelectBox: (id: string | null) => void;
  onQuestionsChange: (newQuestions: QuestionBox[]) => void;
  onToggleDrawingNewBox: () => void;
  onStopDrawing: () => void;
  onToggleScanner?: () => void;
  onToggleHandwriting: () => void;
  onReanalyze: () => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageSrc,
  questions,
  cleanSettings,
  isDrawingNewBox,
  activeBoxId,
  isAnalyzing,
  onSelectBox,
  onQuestionsChange,
  onToggleDrawingNewBox,
  onStopDrawing,
  onToggleScanner,
  onToggleHandwriting,
  onReanalyze,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [dragMode, setDragMode] = useState<"move" | HandlePosition | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialBox, setInitialBox] = useState<NormalizedBox | null>(null);

  const [displaySrc, setDisplaySrc] = useState<string>(imageSrc);

  // Draft box when user is manually dragging to add a new box
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

  // Scanner filter live preview
  useEffect(() => {
    let isMounted = true;
    if (cleanSettings.scannerFilter) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      img.onload = () => {
        if (!isMounted) return;
        const canvas = applyDocumentScanFilter(img, {
          contrast: cleanSettings.contrastBoost || 1.3,
          cropDeskEdges: cleanSettings.deskCrop,
        });
        setDisplaySrc(canvas.toDataURL("image/jpeg", 0.9));
      };
    } else {
      setDisplaySrc(imageSrc);
    }
    return () => {
      isMounted = false;
    };
  }, [
    imageSrc,
    cleanSettings.scannerFilter,
    cleanSettings.deskCrop,
    cleanSettings.contrastBoost,
  ]);

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
    const offset = Math.min(50, 1000 - ymax);

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

    onSelectBox(boxId);
    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });

    const q = questions.find((item) => item.id === boxId);
    if (q) {
      setInitialBox([...q.box_2d]);
    }
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingNewBox || !containerRef.current) {
      onSelectBox(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / zoom;
    const startY = (e.clientY - rect.top) / zoom;
    setNewBoxDraft({ startX, startY, currentX: startX, currentY: startY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDrawingNewBox && newBoxDraft && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setNewBoxDraft({
        ...newBoxDraft,
        currentX: Math.max(0, Math.min(rect.width / zoom, (e.clientX - rect.left) / zoom)),
        currentY: Math.max(0, Math.min(rect.height / zoom, (e.clientY - rect.top) / zoom)),
      });
      return;
    }

    if (!dragMode || !dragStart || !initialBox || !activeBoxId || !containerRef.current)
      return;

    const { clientWidth: w, clientHeight: h } = containerRef.current;
    if (w <= 0 || h <= 0) return;

    const deltaX = (((e.clientX - dragStart.x) / zoom) / w) * 1000;
    const deltaY = (((e.clientY - dragStart.y) / zoom) / h) * 1000;

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
      if (dragMode.includes("n")) ymin = Math.max(0, Math.min(origYmax - 15, origYmin + deltaY));
      if (dragMode.includes("s")) ymax = Math.min(1000, Math.max(origYmin + 15, origYmax + deltaY));
      if (dragMode.includes("w")) xmin = Math.max(0, Math.min(origXmax - 15, origXmin + deltaX));
      if (dragMode.includes("e")) xmax = Math.min(1000, Math.max(origXmin + 15, origXmax + deltaX));
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

      if (x2 - x1 > 20 && y2 - y1 > 20) {
        const box_2d = pixelRectToBox(
          { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
          w,
          h
        );
        const newQuestion: QuestionBox = {
          id: `q_${Date.now()}`,
          index: questions.length + 1,
          is_wrong: false,
          topic: `题目 ${questions.length + 1}`,
          box_2d,
          handwriting_boxes: [],
        };
        onQuestionsChange([...questions, newQuestion]);
        onSelectBox(newQuestion.id);
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
      { pos: "nw", cursor: "nwse-resize", style: "-top-1.5 -left-1.5" },
      { pos: "n", cursor: "ns-resize", style: "-top-1.5 left-1/2 -translate-x-1/2" },
      { pos: "ne", cursor: "nesw-resize", style: "-top-1.5 -right-1.5" },
      { pos: "e", cursor: "ew-resize", style: "top-1/2 -translate-y-1/2 -right-1.5" },
      { pos: "se", cursor: "nwse-resize", style: "-bottom-1.5 -right-1.5" },
      { pos: "s", cursor: "ns-resize", style: "-bottom-1.5 left-1/2 -translate-x-1/2" },
      { pos: "sw", cursor: "nesw-resize", style: "-bottom-1.5 -left-1.5" },
      { pos: "w", cursor: "ew-resize", style: "top-1/2 -translate-y-1/2 -left-1.5" },
    ];

    return handles.map(({ pos, cursor, style }) => (
      <div
        key={pos}
        onMouseDown={(e) => handleMouseDown(e, boxId, pos)}
        style={{ cursor }}
        className={`absolute w-3 h-3 bg-white border border-gray-500 rounded-sm shadow-sm hover:scale-125 transition-transform z-30 ${style}`}
      />
    ));
  };

  return (
    <div
      className="relative flex-1 w-full h-full flex flex-col items-center justify-center p-3 sm:p-6 overflow-auto bg-[#090b10]"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Responsive Canvas Container */}
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          transition: dragMode ? "none" : "transform 0.15s ease",
        }}
        className="relative flex items-center justify-center max-w-full max-h-[82vh]"
      >
        <div
          ref={containerRef}
          onMouseDown={handleContainerMouseDown}
          className={`relative rounded-xl overflow-hidden shadow-2xl border border-[#212636] bg-[#12151e] select-none ${
            isDrawingNewBox ? "cursor-crosshair ring-2 ring-orange-500" : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={displaySrc}
            alt="Worksheet"
            onLoad={updateSize}
            className={`max-h-[78vh] w-auto max-w-full object-contain rounded-lg pointer-events-none block ${
              cleanSettings.scannerFilter ? "bg-white" : ""
            }`}
          />

          {/* Render Detected Question Boxes */}
          {containerSize.width > 0 &&
            questions.map((q) => {
              const rect = boxToPixelRect(
                q.box_2d,
                containerSize.width,
                containerSize.height
              );

              const isSelected = q.id === activeBoxId;
              const isWrong = q.is_wrong;
              const borderColor = isWrong ? "#ef4444" : "#3b82f6";

              return (
                <div
                  key={q.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBox(q.id);
                  }}
                  onMouseDown={(e) => handleMouseDown(e, q.id, "move")}
                  style={{
                    left: `${rect.x}px`,
                    top: `${rect.y}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                    borderColor: borderColor,
                  }}
                  className={`absolute border-2 cursor-move z-10 transition-colors ${
                    isWrong ? "bg-red-500/[0.05]" : "bg-blue-500/[0.05]"
                  } ${isSelected ? "ring-2 ring-white/60 shadow-lg" : ""}`}
                >
                  {/* Clean, Non-blocking Header Tag */}
                  <div className="absolute -top-3.5 left-1 flex items-center gap-1 z-20 pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleWrong(q.id);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-md flex items-center gap-1 transition ${
                        isWrong ? "bg-[#ef4444]" : "bg-[#2563eb]"
                      }`}
                    >
                      <span>第{q.index}题</span>
                      <span>·</span>
                      <span>{isWrong ? "错" : "对"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(q.id);
                        }}
                        title="复制框"
                        className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 shadow"
                      >
                        <Plus className="w-3 h-3 stroke-[3]" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(q.id);
                        }}
                        title="删除框"
                        className="w-5 h-5 rounded-full bg-[#2f3545] text-gray-300 flex items-center justify-center hover:text-white shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* 8 Anchor Handles (render on all or selected) */}
                  {renderHandles(q.id)}

                  {/* Handwriting sub-boxes */}
                  {q.handwriting_boxes.map((hwBox, hwIdx) => {
                    const hwRect = boxToPixelRect(
                      hwBox,
                      containerSize.width,
                      containerSize.height
                    );
                    const localLeft = hwRect.x - rect.x;
                    const localTop = hwRect.y - rect.y;

                    if (cleanSettings.eraseHandwriting) {
                      return (
                        <div
                          key={hwIdx}
                          style={{
                            left: `${localLeft}px`,
                            top: `${localTop}px`,
                            width: `${hwRect.width}px`,
                            height: `${hwRect.height}px`,
                          }}
                          className="absolute bg-white/95 backdrop-blur-[1px] border border-dashed border-gray-300 rounded pointer-events-none z-10"
                        />
                      );
                    }

                    return (
                      <div
                        key={hwIdx}
                        style={{
                          left: `${localLeft}px`,
                          top: `${localTop}px`,
                          width: `${hwRect.width}px`,
                          height: `${hwRect.height}px`,
                        }}
                        className="absolute border border-dashed border-amber-400 bg-amber-400/15 rounded pointer-events-none z-10"
                      />
                    );
                  })}
                </div>
              );
            })}

          {/* Draft box when user is manually adding a box */}
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
        </div>
      </div>

      {/* Floating Canvas Action Dock (Modern Glassmorphism) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-2xl bg-[#141824]/90 backdrop-blur-md border border-[#2b3348] shadow-2xl flex items-center gap-2 z-30 text-xs text-gray-200">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 border-r border-[#262f44] pr-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="p-1.5 rounded-lg hover:bg-[#202738] text-gray-400 hover:text-white"
            title="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] w-9 text-center text-gray-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
            className="p-1.5 rounded-lg hover:bg-[#202738] text-gray-400 hover:text-white"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg hover:bg-[#202738] text-gray-400 hover:text-white"
            title="重置 100%"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Feature toggles */}
        <button
          onClick={onToggleHandwriting}
          className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition font-medium ${
            cleanSettings.eraseHandwriting
              ? "bg-orange-500/20 border-orange-500 text-orange-300"
              : "bg-[#1b2130] border-[#2b344a] text-gray-300 hover:text-white"
          }`}
          title="擦除手写答案，生成空白重做题目"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span>{cleanSettings.eraseHandwriting ? "手写已擦除" : "擦除手写"}</span>
        </button>

        <button
          onClick={onToggleDrawingNewBox}
          className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition font-medium ${
            isDrawingNewBox
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-[#1b2130] border-[#2b344a] text-gray-300 hover:text-white"
          }`}
        >
          <PlusSquare className="w-3.5 h-3.5" />
          <span>{isDrawingNewBox ? "松开完成" : "手动框"}</span>
        </button>

        <button
          onClick={onReanalyze}
          disabled={isAnalyzing}
          className="px-2.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white flex items-center gap-1.5 transition font-medium disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`}
          />
          <span>重新识别</span>
        </button>
      </div>
    </div>
  );
};
