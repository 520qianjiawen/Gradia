import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "错题速抠 - Ling 3.0 Flash VL 作业订正神器",
  description: "基于蚂蚁百灵 Ling-3.0-flash-VL 视觉大模型的智能作业切题、错题识别与手写笔迹擦除工具",
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
