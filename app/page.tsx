"use client";

import React, { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { CanvasEditor } from "@/components/CanvasEditor";
import { QuestionSidebar } from "@/components/QuestionSidebar";
import { CleanSettingsModal } from "@/components/CleanSettingsModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ExportPdfModal } from "@/components/ExportPdfModal";
import { QuestionBox, CleanSettings } from "@/types/homework";
import { SAMPLE_HOMEWORK_RESULT } from "@/lib/mockData";
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
      "一、根据音标和句意写出单词。1. -Do you know the ______ /haɪt/ of the mountain? -No, but I know it's the ______ /'haɪɪst/ in our city.\n2. People in ______ /'ɪtəli/ speak ______ /ɪ'tæliən/.\n3. Xixi is from ______ /speɪn/ and he speaks ______ /'spænɪʃ/...",
  },
  {
    id: "q_blank_2",
    index: 2,
    is_wrong: false,
    topic: "二、请完成以下句子 (1~10题)",
    box_2d: [420, 65, 930, 905],
    handwriting_boxes: [],
    ocr_text:
      "二、请完成以下句子。1. 一旦我们多放几天的假，我就可以有更多的时间做我喜欢的事。\n2. 每个班级有了更少的学生数，老师们可以更多地关注到每一个学生。\n3. 在我们五个人中，智也参加的社团最少...",
  },
];

export default function HomeworkCorrectorPage() {
  // Default to the real blank test paper uploaded by user
  const [imageSrc, setImageSrc] = useState<string>("/samples/sample_blank_test.jpg");
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
    scannerFilter: true, // Default to true for photograph of document
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

  // Analyze function with Ling-3.0-flash-VL
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

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.needKey) {
          setIsSettingsOpen(true);
        }
        throw new Error(data.error || "识别作业失败，请检查网络或 API Key");
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

  // Upload custom image
  const handleUploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setImageSrc(result);
        runAnalysis(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Sample Switcher
  const handleSelectSample = (sampleKey: "blank_english" | "math_graded") => {
    if (sampleKey === "blank_english") {
      setImageSrc("/samples/sample_blank_test.jpg");
      setQuestions(BLANK_ENGLISH_SAMPLE_QUESTIONS);
      setCleanSettings((prev) => ({
        ...prev,
        eraseHandwriting: false,
        scannerFilter: true,
      }));
      setModelStats({
        modelTimeMs: 3820,
        totalTimeMs: 4100,
        modelName: "Ling-3.0-flash-VL",
      });
    } else {
      setImageSrc("/samples/sample_homework.png");
      setQuestions(SAMPLE_HOMEWORK_RESULT.questions);
      setCleanSettings((prev) => ({
        ...prev,
        eraseHandwriting: true,
        scannerFilter: false,
      }));
      setModelStats({
        modelTimeMs: 4490,
        totalTimeMs: 4800,
        modelName: "Ling-3.0-flash-VL",
      });
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
        questionCount={questions.length}
        modelTime={modelStats.modelTimeMs}
        totalTime={modelStats.totalTimeMs}
        modelName={modelStats.modelName}
        isAnalyzing={isAnalyzing}
        currentImageName={imageSrc}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCleanSettings={() => setIsCleanSettingsOpen(true)}
        onOpenExportPdf={() => setIsExportPdfOpen(true)}
        onUploadImage={handleUploadImage}
        onSelectSample={handleSelectSample}
      />

      {/* 错误提示横幅 */}
      {errorMessage && (
        <div className="mx-4 mt-2 px-4 py-2.5 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-200 flex items-center justify-between z-30 animate-in fade-in shrink-0">
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

      {/* 核心响应式工作区：大屏双栏 (左大画布 + 右清单)，小屏上下自适应 */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* 左侧/中心：完全响应式缩放与自适应交互画布 */}
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

        {/* 右侧：题目切片清单与操作面板 */}
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
        />
      </div>

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
      />
    </main>
  );
}
