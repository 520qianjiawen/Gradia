# 错题速抠 - Ling-3.0-flash-VL 智能作业订正与切片工具

基于蚂蚁集团百灵团队开源的 **Ling-3.0-flash-VL** 原生多模态视觉大模型（通过 OpenRouter 接入）打造的现代化作业订正与错题切片 Web 工具。

支持直接一键部署到 **Vercel**。

---

## ✨ 核心特性

1. **全幅作业题目切分**：
   - 自动识别整张作业中的题目边界，输出归一化矩形坐标 `[ymin, xmin, ymax, xmax]`（0~1000）。
2. **错题精准判别**：
   - 自动检测老师批改符号（红叉、扣分、问号、圈注），标记错题并提取对应考点标签（如“方向与位置”）。
3. **手写痕迹与答案定位**：
   - 提取学生手写笔迹与批改区域坐标，支持**一键擦除手写笔迹/白底化**，重构原卷空白题目供学生重新订正作答。
4. **高保真可交互画板**：
   - 8 个锚点自由缩放调节，支持移动、拆分（`+`）、删除（`×`）、新增选框。
   - 对/错状态可一键自由切换。
5. **A4 错题订正本 PDF 导出**：
   - 依据所选题目切片，自动排版至标准 A4 页面，附带自主订正作答虚线区，可直接连接打印机打印练习。
6. **零门槛体验与部署**：
   - 内置离线示例作业与解析数据，无需配置 API Key 亦可完整体验所有画板与 PDF 导出功能。
   - 支持在网页端直接设置私有 OpenRouter Key，也可在 Vercel 环境变量中全局配置。

---

## 🚀 部署到 Vercel

本项目为原生 Next.js 14 App Router 架构，完全契合 Vercel Serverless 环境。

### 方式一：Vercel 网页控制台导入（推荐）

1. 将本项目代码推送到你的 GitHub / GitLab 仓库。
2. 登录 [Vercel 控制台](https://vercel.com)，点击 **"Add New Project"** 并选择该仓库。
3. 在 **Environment Variables**（环境变量）中添加：
   * `OPENROUTER_API_KEY`: 你的 OpenRouter API 密钥（获取地址：https://openrouter.ai/keys）
4. 点击 **"Deploy"**，约 1 分钟即可完成自动化部署并获得线上访问域名！

### 方式二：使用 Vercel CLI 部署

在项目根目录下执行：

```bash
# 1. 安装 Vercel CLI (如未安装)
npm i -g vercel

# 2. 一键构建并部署
vercel

# 3. 部署生产环境
vercel --prod
```

---

## 💻 本地运行与开发

```bash
# 1. 进入项目目录
cd homework-corrector

# 2. 安装依赖 (已安装则跳过)
npm install

# 3. 启动开发服务器
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 即可开始使用。

---

## 🛠️ 技术栈

* **框架**：Next.js 14 (App Router) + React 18 + TypeScript
* **样式**：Tailwind CSS + Lucide React 图标库
* **PDF 生成**：jsPDF + HTML5 Canvas 实时图像切片与色彩采样插值
* **视觉模型**：`inclusionai/ling-3.0-flash-vl:free`（OpenRouter 免费端点）/ 可无缝切换 Qwen2.5-VL 等其他视觉模型
