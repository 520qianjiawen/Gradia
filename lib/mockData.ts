import { HomeworkAnalysisResult } from "@/types/homework";

export const SAMPLE_HOMEWORK_RESULT: HomeworkAnalysisResult = {
  summary: {
    total: 3,
    wrong_count: 1,
  },
  questions: [
    {
      id: "q_1",
      index: 1,
      is_wrong: true,
      topic: "方向与位置",
      box_2d: [218, 172, 432, 888],
      handwriting_boxes: [
        [248, 250, 318, 620],
        [325, 520, 375, 785],
        [360, 270, 395, 360],
      ],
      ocr_text: "1. (2) 在老虎馆、猩猩馆、狮林这三个场所中任选一个，描述它的位置。\n(3) 描述位置时，需要明确的三个要素是(方向)、(角度)和(距离)。\n(4) 若蛇馆在大象馆的南偏东25°方向300m处，则大象馆在蛇馆的(北偏西25°)方向(300)m处。",
      analysis: "第(2)小题手写作答有红笔划线批改痕迹，角度与距离描述不规范判定为错题。",
    },
    {
      id: "q_2",
      index: 2,
      is_wrong: false,
      topic: "方向与位置",
      box_2d: [438, 172, 560, 888],
      handwriting_boxes: [
        [455, 320, 480, 520],
      ],
      ocr_text: "2. 一艘渔船在海上遇险，向搜救中心发出求救信号。搜救中心的信号显示，渔船的位置如下图。请写一写，渔船向搜救中心发出了怎样的信号？",
      analysis: "方向描述正确，无红笔扣分记录。",
    },
    {
      id: "q_3",
      index: 3,
      is_wrong: false,
      topic: "方向与位置",
      box_2d: [568, 172, 732, 888],
      handwriting_boxes: [
        [590, 220, 645, 470],
        [655, 200, 695, 530],
      ],
      ocr_text: "3. 下图是某机场的雷达屏幕，机场在屏幕的中心位置，以机场为参照点，飞机A在南偏东30°方向上，距离机场20km处...\n(3) 如果以飞机B为参照点，飞机E在(东)偏(北)(30)°方向上，距离飞机B(30)km处。",
      analysis: "雷达标点与相对方位计算正确，判定合格。",
    },
  ],
  meta: {
    modelTimeMs: 4490,
    totalTimeMs: 4800,
    modelName: "Ling-3.0-flash-VL",
  },
};
