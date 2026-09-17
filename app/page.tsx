"use client";

import React, { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { CanvasEditor } from "@/components/CanvasEditor";
import { Toolbar } from "@/components/Toolbar";
import { BottomBar } from "@/components/BottomBar";
import { CleanSettingsModal } from "@/components/CleanSettingsModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ExportPdfModal } from "@/components/ExportPdfModal";
import { QuestionBox, CleanSettings } from "@/types/homework";
import { SAMPLE_HOMEWORK_RESULT } from "@/lib/mockData";
import { AlertCircle, X } from "lucide-react";

export default function HomeworkCorrectorPage() {
  const [imageSrc, setImageSrc] = useState<string>("/samples/sample_homework.png");
  const [questions, setQuestions] = useState<QuestionBox[]>(
    SAMPLE_HOMEWORK_RESULT.questions
  );
  const [modelStats, setModelStats] = useState({
    modelTimeMs: SAMPLE_HOMEWORK_RESULT.meta?.modelTimeMs || 4490,
    totalTimeMs: SAMPLE_HOMEWORK_RESULT.meta?.totalTimeMs || 4800,
    modelName: SAMPLE_HOMEWORK_RESULT.meta?.modelName || "Ling-3.0-flash-VL",
  });

  const [cleanSettings, setCleanSettings] = useState<CleanSettings>({
    eraseHandwriting: true,
    whiteBalance: true,
    contrastBoost: 1.15,
    removeGradesMark: true,
    highlightWrongOnly: false,
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
    }
  }, []);

  // Analyze function
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
        // Automatically analyze the newly uploaded image
        runAnalysis(result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Re-analyze
  const handleReanalyze = () => {
    runAnalysis(imageSrc);
  };

  // Reset to demo
  const handleResetDemo = () => {
    setImageSrc("/samples/sample_homework.png");
    setQuestions(SAMPLE_HOMEWORK_RESULT.questions);
    setModelStats({
      modelTimeMs: 4490,
      totalTimeMs: 4800,
      modelName: "Ling-3.0-flash-VL",
    });
    setErrorMessage(null);
  };

  // Filtered questions to display if user toggled "仅看错题"
  const displayedQuestions = selectedWrongOnly
    ? questions.filter((q) => q.is_wrong)
    : questions;

  const wrongCount = questions.filter((q) => q.is_wrong).length;

  return (
    <main className="h-screen w-screen flex flex-col justify-between overflow-hidden bg-[#0d0f15]">
      {/* 顶部状态栏 */}
      <HeaderBar
        questionCount={questions.length}
        candidateCount={questions.length}
        modelTime={modelStats.modelTimeMs}
        totalTime={modelStats.totalTimeMs}
        modelName={modelStats.modelName}
        isAnalyzing={isAnalyzing}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 错误提示横幅 */}
      {errorMessage && (
        <div className="mx-4 mt-2 px-4 py-2.5 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-200 flex items-center justify-between z-30 animate-in fade-in">
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

      {/* 核心画布编辑器 */}
      <CanvasEditor
        imageSrc={imageSrc}
        questions={displayedQuestions}
        cleanSettings={cleanSettings}
        isDrawingNewBox={isDrawingNewBox}
        onQuestionsChange={setQuestions}
        onStopDrawing={() => setIsDrawingNewBox(false)}
      />

      {/* 底部功能条与导出栏 */}
      <div className="bg-[#12151f]/95 backdrop-blur border-t border-[#202534] z-20">
        <Toolbar
          isAnalyzing={isAnalyzing}
          isDrawingNewBox={isDrawingNewBox}
          onReanalyze={handleReanalyze}
          onToggleDrawingNewBox={() => setIsDrawingNewBox(!isDrawingNewBox)}
          onOpenCleanSettings={() => setIsCleanSettingsOpen(true)}
          onUploadImage={handleUploadImage}
        />

        <BottomBar
          wrongCount={wrongCount}
          selectedWrongOnly={selectedWrongOnly}
          onToggleWrongFilter={() => setSelectedWrongOnly(!selectedWrongOnly)}
          onExportPdf={() => setIsExportPdfOpen(true)}
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
        onResetDemo={handleResetDemo}
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
