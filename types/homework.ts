export type NormalizedBox = [number, number, number, number]; // [ymin, xmin, ymax, xmax], 0..1000

export interface QuestionBox {
  id: string;
  index: number;
  is_wrong: boolean;
  topic: string;
  box_2d: NormalizedBox;
  handwriting_boxes: NormalizedBox[];
  ocr_text?: string;
  analysis?: string;
}

export interface HomeworkAnalysisResult {
  summary: {
    total: number;
    wrong_count: number;
  };
  questions: QuestionBox[];
  meta?: {
    modelTimeMs?: number;
    totalTimeMs?: number;
    modelName?: string;
  };
}

export interface CleanSettings {
  eraseHandwriting: boolean;
  whiteBalance: boolean;
  contrastBoost: number; // 1.0 to 1.5
  removeGradesMark: boolean;
  highlightWrongOnly: boolean;
}
