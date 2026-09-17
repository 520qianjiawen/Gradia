"use client";

import React, { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { CanvasEditor } from "@/components/CanvasEditor";
import { QuestionSidebar } from "@/components/QuestionSidebar";
import { DigitizeWorkspace } from "@/components/DigitizeWorkspace";
import { CleanSettingsModal } from "@/components/CleanSettingsModal";
import { SettingsModal } from "@/components/SettingsModal";
import { ExportPdfModal } from "@/components/ExportPdfModal";
import { QuestionBox, CleanSettings } from "@/types/homework";
import { SAMPLE_HOMEWORK_RESULT } from "@/lib/mockData";
import { SAMPLE_BLANK_TEST_MARKDOWN } from "@/lib/sampleMarkdown";
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
    scannerFilter: true,
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

  // Digitize API call (Photo -> Markdown)
  const runDigitize = async (imgBase64: string) => {
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
        }),
      });

      const data = await res.json();
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

      const data = await res.json();

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
        scannerFilter: true,
      }));
    } else {
      setImageSrc("/samples/sample_homework.png");
      setQuestions(SAMPLE_HOMEWORK_RESULT.questions);
      setDigitizedMarkdown(`# 数学作业：方向与位置练习卷

**姓名: ________________    得分: ________**

---

## 练习题

1. 在老虎馆、猩猩馆、狮林这三个场所中任选一个，描述它的位置。  
   ____________________________________________________________________________

2. 描述位置时，需要明确的三个要素是（方向）、（角度）和（距离）。

3. 若蛇馆在大象馆的南偏东 25° 方向 300m 处，则大象馆在蛇馆的（________________）方向（________）m 处。

4. 一艘渔船在海上遇险，向搜救中心发出求救信号。搜救中心的信号显示，渔船的位置如下图。请写一写，渔船向搜救中心发出了怎样的信号？  
   ____________________________________________________________________________
`);
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

      {/* 主工作区 */}
      {currentMode === "digitize_doc" ? (
        /* 模式一：试卷转电子版 (Markdown / Word / 纯净打印) */
        <DigitizeWorkspace
          imageSrc={imageSrc}
          markdown={digitizedMarkdown}
          isDigitizing={isDigitizing}
          onMarkdownChange={setDigitizedMarkdown}
          onRedigitize={() => runDigitize(imageSrc)}
        />
      ) : (
        /* 模式二：错题切片与订正画布 */
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
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
      />
    </main>
  );
}
