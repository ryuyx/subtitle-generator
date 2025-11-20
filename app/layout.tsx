import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "语音转字幕服务",
  description: "上传音频文件，自动生成多语种字幕",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
