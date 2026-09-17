"use client";

import React, { useState, useEffect, useRef } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { CanvasEditor } from "@/components/CanvasEditor";
import { QuestionSidebar } from "@/components/QuestionSidebar";
import { DigitizeWorkspace } from "@/components/DigitizeWorkspace";
import { CleanSettingsModal } from "@/components/CleanSettingsModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ExportPdfModal } from "@/components/ExportPdfModal";
import { QuestionBox, CleanSettings } from "@/types/homework";
import { SAMPLE_HOMEWORK_RESULT } from "@/lib/mockData";
import {
  SAMPLE_BLANK_TEST_MARKDOWN,
  SAMPLE_MATH_BLANK_MARKDOWN,
  SAMPLE_MATH_WITH_HANDWRITING_MARKDOWN,
} from "@/lib/sampleMarkdown";
import { compressImageForUpload } from "@/lib/imageUtils";
import { AlertCircle, X } from "lucide-react";

const BLANK_ENGLISH_SAMPLE_QUESTIONS: QuestionBox[] = [
  {
    id: "q_blank_1",
    index: 1,
    is_wrong: false,
    topic: "一、根据音标和句意写出单词 (1~12题)",
    box_2d: [95, 65, 415, 905],
    handwriting_boxes: [],
    ocr_text:
      "一、根据音标和句意写出单词。1. -Do you know the ______ /haɪt/ of the mountain? -No, but I know it's the ______ /'haɪɪst/ in our city.\n2. People in ______ /'ɪtəli/ speak ______ /ɪ'tæliən/...",
  },
  {
    id: "q_blank_2",
    index: 2,
    is_wrong: false,
    topic: "二、请完成以下句子 (1~10题)",
    box_2d: [420, 65, 930, 905],
    handwriting_boxes: [],
    ocr_text:
      "二、请完成以下句子。1. 一旦我们多放几天的假，我就可以有更多的时间做我喜欢的事。\n2. 每个班级有了更少的学生数，老师们可以更多地关注到每一个学生...",
  },
];

export default function HomeworkCorrectorPage() {
  // Mode: "digitize_doc" (Word/Markdown 电子化) or "crop_correct" (切片框选订正)
  const [currentMode, setCurrentMode] = useState<"digitize_doc" | "crop_correct">(
    "digitize_doc"
  );

  // Current active worksheet image
  const [imageSrc, setImageSrc] = useState<string>("/samples/sample_blank_test.jpg");

  // Digitize Markdown State
  const [digitizedMarkdown, setDigitizedMarkdown] = useState<string>(
    SAMPLE_BLANK_TEST_MARKDOWN
  );
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [eraseHandwriting, setEraseHandwriting] = useState<boolean>(true); // 默认打勾：移除手写笔记

  // Questions for Crop & Correction Mode
  const [questions, setQuestions] = useState<QuestionBox[]>(
    BLANK_ENGLISH_SAMPLE_QUESTIONS
  );
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);

  const [modelStats, setModelStats] = useState({
    modelTimeMs: 3820,
    totalTimeMs: 4100,
    modelName: "Ling-3.0-flash-VL",
  });

  const [cleanSettings, setCleanSettings] = useState<CleanSettings>({
    eraseHandwriting: false,
    whiteBalance: true,
    contrastBoost: 1.3,
    removeGradesMark: true,
    highlightWrongOnly: false,
    scannerFilter: false,
    deskCrop: true,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDrawingNewBox, setIsDrawingNewBox] = useState(false);
  const [selectedWrongOnly, setSelectedWrongOnly] = useState(false);

  // Modals
  const [isCleanSettingsOpen, setIsCleanSettingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Draggable sidebar for crop_correct mode
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(384);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleSidebarPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);
  };

  useEffect(() => {
    if (!isDraggingSidebar) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!cropContainerRef.current) return;
      const rect = cropContainerRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      setSidebarWidth(Math.max(260, Math.min(650, newWidth)));
    };

    const handlePointerUp = () => {
      setIsDraggingSidebar(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDraggingSidebar]);

  // Sync saved model choice
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedModel = localStorage.getItem("openrouter_model");
      if (savedModel) {
        setModelStats((prev) => ({
          ...prev,
          modelName: savedModel.includes("ling")
            ? "Ling-3.0-flash-VL"
            : savedModel.split("/").pop() || savedModel,
        }));
      }

      // Global paste listener: paste screenshot directly
      const handlePaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              handleUploadImage(file);
              break;
            }
          }
        }
      };
      window.addEventListener("paste", handlePaste);
      return () => window.removeEventListener("paste", handlePaste);
    }
  }, []);

  // Digitize API call (Photo -> Markdown)
  const runDigitize = async (imgBase64: string, erase: boolean = eraseHandwriting) => {
    setIsDigitizing(true);
    setErrorMessage(null);

    try {
      const apiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("openrouter_api_key") || ""
          : "";
      const model =
        typeof window !== "undefined"
          ? localStorage.getItem("openrouter_model") ||
            "inclusionai/ling-3.0-flash-vl:free"
          : "inclusionai/ling-3.0-flash-vl:free";

      const res = await fetch("/api/digitize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imgBase64,
          apiKey,
          model,
          eraseHandwriting: erase,
        }),
      });

      let data: any;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        if (!res.ok) {
          if (res.status === 504) {
            throw new Error("云端识别超时（试卷图元较多），请稍后重试");
          }
          throw new Error(`服务响应异常 (HTTP ${res.status})，请检查网络或 API Key`);
        }
        throw new Error("返回数据格式异常，请稍后重试");
      }

      if (!res.ok || !data.success) {
        if (data.needKey) {
          setIsSettingsOpen(true);
        }
        throw new Error(data.error || "试卷数字化失败，请检查网络或 API Key");
      }

      setDigitizedMarkdown(data.data.markdown || "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsDigitizing(false);
    }
  };

  // Toggle erase handwriting in Digitize mode
  const handleToggleEraseHandwriting = (val: boolean) => {
    setEraseHandwriting(val);

    // If currently on demo sample "math_graded", switch between blank test vs with handwriting instantly:
    if (imageSrc.includes("sample_homework")) {
      if (val) {
        setDigitizedMarkdown(SAMPLE_MATH_BLANK_MARKDOWN);
      } else {
        setDigitizedMarkdown(SAMPLE_MATH_WITH_HANDWRITING_MARKDOWN);
      }
    } else if (imageSrc.startsWith("data:") || imageSrc.startsWith("blob:")) {
      // For uploaded images, re-run digitize with the new setting
      runDigitize(imageSrc, val);
    }
  };

  // Analyze function (for Bounding Boxes)
  const runAnalysis = async (imgBase64: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const apiKey =
        typeof window !== "undefined"
          ? localStorage.getItem("openrouter_api_key") || ""
          : "";
      const model =
        typeof window !== "undefined"
          ? localStorage.getItem("openrouter_model") ||
            "inclusionai/ling-3.0-flash-vl:free"
          : "inclusionai/ling-3.0-flash-vl:free";

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imgBase64,
          apiKey,
          model,
        }),
      });

      let data: any;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch {
        if (!res.ok) {
          if (res.status === 504) {
            throw new Error("云端分析超时，请稍后重试或使用更小图片");
          }
          throw new Error(`服务响应异常 (HTTP ${res.status})，请检查网络或 API Key`);
        }
        throw new Error("返回数据格式异常，请稍后重试");
      }

      if (!res.ok || !data.success) {
        if (data.needKey) {
          setIsSettingsOpen(true);
        }
        throw new Error(data.error || "切片识别失败，请检查网络或 API Key");
      }

      const result = data.data;
      setQuestions(result.questions || []);
      if (result.meta) {
        setModelStats({
          modelTimeMs: result.meta.modelTimeMs || 4200,
          totalTimeMs: result.meta.totalTimeMs || 4600,
          modelName: result.meta.modelName || "Ling-3.0-flash-VL",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Upload custom image with automatic compression
  const handleUploadImage = async (file: File) => {
    try {
      const compressedBase64 = await compressImageForUpload(file);
      setImageSrc(compressedBase64);
      if (currentMode === "digitize_doc") {
        runDigitize(compressedBase64);
      } else {
        runAnalysis(compressedBase64);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setImageSrc(result);
          if (currentMode === "digitize_doc") {
            runDigitize(result);
          } else {
            runAnalysis(result);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Sample Switcher
  const handleSelectSample = (sampleKey: "blank_english" | "math_graded") => {
    if (sampleKey === "blank_english") {
      setImageSrc("/samples/sample_blank_test.jpg");
      setDigitizedMarkdown(SAMPLE_BLANK_TEST_MARKDOWN);
      setQuestions(BLANK_ENGLISH_SAMPLE_QUESTIONS);
      setCleanSettings((prev) => ({
        ...prev,
        eraseHandwriting: false,
        scannerFilter: false,
      }));
    } else {
      setImageSrc("/samples/sample_homework.png");
      setQuestions(SAMPLE_HOMEWORK_RESULT.questions);
      setDigitizedMarkdown(
        eraseHandwriting
          ? SAMPLE_MATH_BLANK_MARKDOWN
          : SAMPLE_MATH_WITH_HANDWRITING_MARKDOWN
      );
      setCleanSettings((prev) => ({
        ...prev,
        eraseHandwriting: true,
        scannerFilter: false,
      }));
    }
  };

  // Duplicate box
  const handleDuplicateBox = (id: string) => {
    const target = questions.find((q) => q.id === id);
    if (!target) return;
    const [ymin, xmin, ymax, xmax] = target.box_2d;
    const offset = Math.min(50, 1000 - ymax);

    const newQ: QuestionBox = {
      id: `q_${Date.now()}`,
      index: questions.length + 1,
      is_wrong: target.is_wrong,
      topic: `${target.topic} (副本)`,
      box_2d: [ymin + offset, xmin, Math.min(1000, ymax + offset), xmax],
      handwriting_boxes: [],
      ocr_text: target.ocr_text,
    };
    setQuestions([...questions, newQ]);
    setActiveBoxId(newQ.id);
  };

  // Delete box
  const handleDeleteBox = (id: string) => {
    const remaining = questions
      .filter((q) => q.id !== id)
      .map((q, idx) => ({ ...q, index: idx + 1 }));
    setQuestions(remaining);
    if (activeBoxId === id) setActiveBoxId(null);
  };

  // Toggle wrong
  const handleToggleWrong = (id: string) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, is_wrong: !q.is_wrong } : q))
    );
  };

  const displayedQuestions = selectedWrongOnly
    ? questions.filter((q) => q.is_wrong)
    : questions;

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-[#0a0c12]">
      {/* 顶部全局导航栏 */}
      <HeaderBar
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        questionCount={questions.length}
        modelName={modelStats.modelName}
        isAnalyzing={isAnalyzing || isDigitizing}
        currentImageName={imageSrc}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCleanSettings={() => setIsCleanSettingsOpen(true)}
        onOpenExportPdf={() => setIsExportPdfOpen(true)}
        onUploadImage={handleUploadImage}
        onSelectSample={handleSelectSample}
      />

      {/* 错误提示横幅 */}
      {errorMessage && (
        <div className="print-hidden print:hidden mx-4 mt-2 px-4 py-2.5 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-200 flex items-center justify-between z-30 animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="p-1 text-red-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 主工作区 */}
      {currentMode === "digitize_doc" ? (
        /* 模式一：试卷转电子版 (Markdown / Word / 纯净打印) */
        <DigitizeWorkspace
          imageSrc={imageSrc}
          markdown={digitizedMarkdown}
          isDigitizing={isDigitizing}
          eraseHandwriting={eraseHandwriting}
          onToggleEraseHandwriting={handleToggleEraseHandwriting}
          onMarkdownChange={setDigitizedMarkdown}
          onRedigitize={() => runDigitize(imageSrc, eraseHandwriting)}
        />
      ) : (
        /* 模式二：错题切片与订正画布 */
        <div
          ref={cropContainerRef}
          className={`flex-1 flex flex-col lg:flex-row overflow-hidden relative ${
            isDraggingSidebar ? "select-none cursor-col-resize" : ""
          }`}
        >
          <CanvasEditor
            imageSrc={imageSrc}
            questions={displayedQuestions}
            cleanSettings={cleanSettings}
            isDrawingNewBox={isDrawingNewBox}
            activeBoxId={activeBoxId}
            isAnalyzing={isAnalyzing}
            onSelectBox={setActiveBoxId}
            onQuestionsChange={setQuestions}
            onToggleDrawingNewBox={() => setIsDrawingNewBox(!isDrawingNewBox)}
            onStopDrawing={() => setIsDrawingNewBox(false)}
            onToggleScanner={() =>
              setCleanSettings((prev) => ({
                ...prev,
                scannerFilter: !prev.scannerFilter,
              }))
            }
            onToggleHandwriting={() =>
              setCleanSettings((prev) => ({
                ...prev,
                eraseHandwriting: !prev.eraseHandwriting,
              }))
            }
            onReanalyze={() => runAnalysis(imageSrc)}
          />

          {/* Draggable Divider Handle (Desktop) */}
          <div
            onPointerDown={handleSidebarPointerDown}
            onDoubleClick={() => setSidebarWidth(384)}
            title="按住左右拖拽调节侧边栏宽度，双击恢复默认宽度"
            className={`hidden lg:flex w-2 bg-[#141824] hover:bg-orange-500 active:bg-orange-500 cursor-col-resize items-center justify-center transition-colors relative z-30 select-none group shrink-0 ${
              isDraggingSidebar
                ? "bg-orange-500 shadow-lg shadow-orange-500/50"
                : "hover:shadow-md border-x border-[#1f2433]"
            }`}
          >
            <div className="w-1 h-8 rounded-full bg-gray-600 group-hover:bg-white transition-colors" />

            {/* Floating Width Pill while dragging */}
            {isDraggingSidebar && (
              <div className="absolute top-4 right-1/2 translate-x-1/2 bg-gray-900/95 border border-orange-500/80 text-orange-300 font-mono text-[11px] px-2.5 py-1 rounded-full shadow-xl pointer-events-none whitespace-nowrap z-50 animate-in fade-in">
                {Math.round(sidebarWidth)}px
              </div>
            )}
          </div>

          <QuestionSidebar
            questions={questions}
            activeBoxId={activeBoxId}
            selectedWrongOnly={selectedWrongOnly}
            onSelectBox={setActiveBoxId}
            onToggleWrong={handleToggleWrong}
            onDuplicate={handleDuplicateBox}
            onDelete={handleDeleteBox}
            onToggleWrongFilter={() => setSelectedWrongOnly(!selectedWrongOnly)}
            onOpenExportPdf={() => setIsExportPdfOpen(true)}
            width={isDesktop ? sidebarWidth : undefined}
          />
        </div>
      )}

      {/* 弹窗组件 */}
      <CleanSettingsModal
        isOpen={isCleanSettingsOpen}
        settings={cleanSettings}
        onClose={() => setIsCleanSettingsOpen(false)}
        onUpdateSettings={setCleanSettings}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onResetDemo={() => handleSelectSample("blank_english")}
      />

      <ExportPdfModal
        isOpen={isExportPdfOpen}
        questions={questions}
        imageSrc={imageSrc}
        cleanSettings={cleanSettings}
        onClose={() => setIsExportPdfOpen(false)}
        onSwitchToDigitize={() => {
          setIsExportPdfOpen(false);
          setCurrentMode("digitize_doc");
        }}
      />
    </main>
  );
}
