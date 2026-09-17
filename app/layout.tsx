import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gradia - 智能作业订正与试卷切片工具",
  description: "基于多模态视觉大模型的智能作业切题、错题识别与试卷转电子版 Word/Markdown 工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#0b0d13] text-gray-100 min-h-screen antialiased selection:bg-orange-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
