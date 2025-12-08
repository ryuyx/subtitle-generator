"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { FiMoon, FiSun, FiMonitor, FiTrash2, FiEye, FiDownload, FiCopy, FiFileText, FiX, FiCheck, FiClock, FiCalendar, FiSearch } from "react-icons/fi";

interface HistoryRecord {
  id: string;
  fileName: string;
  language: string;
  languageLabel: string;
  segmentCount: number;
  srtContent: string;
  createdAt: string;
}

interface ErrorDetails {
  error: string;
  orderId?: string;
  failType?: number;
  status?: string | number;
  timestamp?: string;
  originalDuration?: number;
  attempts?: number;
}

const FAIL_TYPE_MAP: Record<number, string> = {
  0: "音频正常执行",
  1: "音频上传失败",
  2: "音频转码失败",
  3: "音频识别失败",
  4: "音频时长超限（最大5小时）",
  5: "音频校验失败（时长参数不符）",
  6: "静音文件",
  7: "翻译失败",
  8: "账号无翻译权限",
  9: "转写质检失败",
  10: "转写质检未匹配出关键词",
  11: "未开启质检或翻译能力",
  12: "音频语种分析失败",
  99: "其他错误"
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("autodialect");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  const [progressStage, setProgressStage] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error("加载历史记录失败:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('audio/')) {
        setFile(file);
        setError(null);
        setResult(null);
      } else {
        setError("请选择音频文件");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError("请选择音频文件");
      return;
    }

    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setResult(null);
    setProgressStage("");
    setProgressMessage("");
    setOrderId("");
    setProgressPercent(0);

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("language", language);

    try {
      const response = await fetch("/api/transcribe-stream", {
        method: "POST",
        body: formData,
      });

      if (!response.body) {
        throw new Error("无法获取响应流");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.stage) {
                setProgressStage(data.stage);
              }
              if (data.message) {
                setProgressMessage(data.message);
              }
              if (data.orderId) {
                setOrderId(data.orderId);
              }
              
              if (data.attempts && data.maxAttempts) {
                const percent = Math.min((data.attempts / data.maxAttempts) * 100, 99);
                setProgressPercent(percent);
              }
              
              if (data.stage === "uploading") {
                setProgressPercent(10);
              } else if (data.stage === "uploaded") {
                setProgressPercent(20);
              } else if (data.stage === "parsing") {
                setProgressPercent(95);
              } else if (data.stage === "completed" || data.stage === "success") {
                setProgressPercent(100);
                if (data.srtContent) {
                  setResult(data.srtContent);
                  await loadHistory();
                }
              } else if (data.stage === "error" || data.stage === "failed") {
                if (data.orderId) {
                  setErrorDetails(data);
                  setError(data.error || "转换失败");
                } else {
                  setError(data.error || "转换失败");
                }
              }
            } catch (e) {
              console.error("解析进度数据失败:", e);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "发生错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;

    const blob = new Blob([result], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitle_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadRecord = (record: HistoryRecord) => {
    const blob = new Blob([record.srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.fileName.replace(/\.[^/.]+$/, "")}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  const handleViewHistory = (record: HistoryRecord) => {
    setSelectedRecord(record);
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm("确定要删除这条记录吗？")) return;
    
    try {
      const response = await fetch(`/api/history?id=${id}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        await loadHistory();
      }
    } catch (err) {
      console.error("删除失败:", err);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("确定要清空所有历史记录吗？")) return;
    
    try {
      const response = await fetch("/api/history?all=true", {
        method: "DELETE",
      });
      
      if (response.ok) {
        await loadHistory();
      }
    } catch (err) {
      console.error("清空失败:", err);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-sans">
      {/* Navbar */}
      <div className="navbar bg-base-100/80 backdrop-blur-md border-b border-base-200 sticky top-0 z-50 px-4 md:px-8">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-bold gap-2 normal-case">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-primary">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            <span>SubtitleAI</span>
          </a>
        </div>
        <div className="flex-none hidden md:flex gap-2 items-center">
          {mounted && (
            <div className="dropdown dropdown-end mr-2">
              <label tabIndex={0} className="btn btn-ghost btn-circle btn-sm">
                {theme === 'dark' ? <FiMoon className="w-5 h-5" /> : 
                 theme === 'light' ? <FiSun className="w-5 h-5" /> : 
                 <FiMonitor className="w-5 h-5" />}
              </label>
              <ul tabIndex={0} className="menu dropdown-content mt-3 p-2 shadow bg-base-100 rounded-box w-52 z-50">
                <li><a onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''}><FiSun /> 明亮模式</a></li>
                <li><a onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''}><FiMoon /> 暗黑模式</a></li>
                <li><a onClick={() => setTheme('system')} className={theme === 'system' ? 'active' : ''}><FiMonitor /> 跟随系统</a></li>
              </ul>
            </div>
          )}
          <button className="btn btn-ghost btn-sm">产品功能</button>
          <button className="btn btn-ghost btn-sm">价格方案</button>
          <div className="divider divider-horizontal mx-1"></div>
          <button className="btn btn-ghost btn-sm">登录</button>
          <button className="btn btn-primary btn-sm">免费注册</button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-12 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-8 py-12">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            专业的 <span className="text-primary">AI 语音转字幕</span> 服务
          </h1>
          <p className="text-xl text-base-content/70 max-w-2xl mx-auto leading-relaxed">
            利用最先进的语音识别技术，快速将您的音视频转换为高精度的字幕文件。
            <br className="hidden md:block" />
            支持全球 200+ 种语言与方言，准确率高达 98%。
          </p>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto pt-8 text-left">
            <div className="p-6 rounded-2xl bg-base-200/50 border border-base-200 hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">极速转写</h3>
              <p className="text-sm text-base-content/70">1小时音频仅需5分钟即可完成转写，大幅提升工作效率。</p>
            </div>
            <div className="p-6 rounded-2xl bg-base-200/50 border border-base-200 hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-4 text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">多语种支持</h3>
              <p className="text-sm text-base-content/70">支持中文方言、英语、日语等全球几十种主流语言的自动识别。</p>
            </div>
            <div className="p-6 rounded-2xl bg-base-200/50 border border-base-200 hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4 text-accent">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-2">高准确率</h3>
              <p className="text-sm text-base-content/70">基于深度学习模型，在复杂环境下也能保持极高的识别准确率。</p>
            </div>
          </div>
        </div>

        {/* Main Converter Card */}
        <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
          <div className="bg-base-200/30 px-8 py-4 border-b border-base-200 flex justify-between items-center">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <span className="w-2 h-6 bg-primary rounded-full"></span>
              创建新任务
            </h2>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="btn btn-outline btn-primary btn-sm gap-2"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              历史记录 ({history.length})
            </button>
          </div>
          
          <div className="card-body p-6 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* File Upload */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold text-base">上传音频文件</span>
                  <span className="label-text-alt text-base-content/60">支持 MP3, WAV, M4A (最大 5MB)</span>
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-10 transition-all duration-300 text-center group ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : file
                      ? "border-success bg-success/5"
                      : "border-base-300 hover:border-primary/50 hover:bg-base-200/50"
                  } ${loading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                >
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={loading}
                    id="file-input"
                  />
                  
                  {file ? (
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-lg">{file.name}</p>
                        <p className="text-sm text-base-content/60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline btn-success relative z-20">更换文件</button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-full bg-base-200 text-base-content/40 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-lg">点击或拖拽文件到此处</p>
                        <p className="text-sm text-base-content/60 mt-1">支持常见音频格式</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Language Selection */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold text-base">识别语言</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => !loading && setLanguage("autodialect")}
                    className={`relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      language === "autodialect"
                        ? "border-primary bg-primary/5"
                        : "border-base-200 hover:border-base-300"
                    } ${loading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${language === "autodialect" ? "border-primary" : "border-base-300"}`}>
                      {language === "autodialect" && <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">中英 + 方言</h3>
                      <p className="text-xs text-base-content/60 mt-1">支持中文、英文及 200+ 种方言</p>
                    </div>
                  </div>

                  <div
                    onClick={() => !loading && setLanguage("autominor")}
                    className={`relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      language === "autominor"
                        ? "border-primary bg-primary/5"
                        : "border-base-200 hover:border-base-300"
                    } ${loading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${language === "autominor" ? "border-primary" : "border-base-300"}`}>
                      {language === "autominor" && <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">多语种混合</h3>
                      <p className="text-xs text-base-content/60 mt-1">支持日语、韩语、法语等 37 种语言</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="btn btn-primary w-full btn-lg text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  {loading ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      正在处理...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      开始转换
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Progress Section */}
        {loading && progressMessage && (
          <div className="card bg-base-100 shadow-lg border border-base-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="card-body">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">{progressMessage}</h3>
                <span className="text-primary font-mono font-bold">{Math.round(progressPercent)}%</span>
              </div>
              <progress className="progress progress-primary w-full h-3" value={progressPercent} max="100"></progress>
              <div className="flex justify-between text-xs text-base-content/60 mt-2">
                <span>阶段: {progressStage}</span>
                {orderId && <span className="font-mono">ID: {orderId}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Error Section */}
        {error && (
          <div className="alert alert-error shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <h3 className="font-bold">转换失败</h3>
              <div className="text-sm">{error}</div>
              {errorDetails && (
                <div className="text-xs mt-1 opacity-80">
                  {errorDetails.failType && <span>类型: {FAIL_TYPE_MAP[errorDetails.failType]} </span>}
                  {errorDetails.orderId && <span>(ID: {errorDetails.orderId})</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div className="card bg-base-100 shadow-xl border border-base-200 scroll-mt-20" id="result-section">
            <div className="card-body p-0">
              <div className="bg-success/10 p-6 border-b border-success/20 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-success text-success-content flex items-center justify-center shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-xl text-success-content/90">转换成功</h3>
                  <p className="text-success-content/70 text-sm">字幕文件已生成，您可以预览或下载</p>
                </div>
              </div>
              
              <div className="p-6 md:p-8 space-y-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-bold">字幕预览</span>
                    <span className="badge badge-ghost">{result.split('\n\n').filter(s => s.trim()).length} 个片段</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full h-96 font-mono text-sm leading-relaxed bg-base-50"
                    value={result}
                    readOnly
                  />
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={handleDownload} 
                    className="btn btn-success gap-2 shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    下载 SRT 文件
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Section (Table View) */}
        {showHistory && (
          <div className="card bg-base-100 shadow-xl border border-base-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="card-body p-0">
              <div className="p-6 border-b border-base-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-bold text-xl flex items-center gap-2">
                    <FiClock className="w-5 h-5 text-primary" />
                    历史记录
                  </h2>
                  <span className="badge badge-ghost">{history.length}</span>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input 
                      type="text" 
                      placeholder="搜索文件名..." 
                      className="input input-bordered input-sm w-full pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {history.length > 0 && (
                    <button
                      onClick={handleClearHistory}
                      className="btn btn-error btn-outline btn-sm gap-2"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      清空
                    </button>
                  )}
                </div>
              </div>
              
              {history.length === 0 ? (
                <div className="p-16 text-center text-base-content/50 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center">
                    <FiClock className="w-8 h-8 opacity-50" />
                  </div>
                  <p>暂无历史记录</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="bg-base-200/50">
                        <th className="pl-6">文件名</th>
                        <th>语言</th>
                        <th>片段数</th>
                        <th>时间</th>
                        <th className="text-right pr-6">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history
                        .filter(record => record.fileName.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map((record) => (
                        <tr key={record.id} className="hover:bg-base-200/30 transition-colors group">
                          <td className="pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                <FiFileText className="w-5 h-5" />
                              </div>
                              <div className="font-medium max-w-xs truncate" title={record.fileName}>
                                {record.fileName}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="badge badge-sm badge-ghost gap-1">
                              {record.languageLabel}
                            </div>
                          </td>
                          <td>
                            <span className="font-mono text-sm">{record.segmentCount}</span>
                          </td>
                          <td>
                            <div className="flex flex-col text-xs text-base-content/70">
                              <span className="flex items-center gap-1">
                                <FiCalendar className="w-3 h-3" />
                                {new Date(record.createdAt).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1 mt-0.5">
                                <FiClock className="w-3 h-3" />
                                {new Date(record.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </td>
                          <td className="text-right pr-6">
                            <div className="flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleViewHistory(record)}
                                className="btn btn-ghost btn-square btn-sm text-primary tooltip tooltip-left"
                                data-tip="查看详情"
                              >
                                <FiEye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDownloadRecord(record)}
                                className="btn btn-ghost btn-square btn-sm text-success tooltip tooltip-left"
                                data-tip="下载字幕"
                              >
                                <FiDownload className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteHistory(record.id)}
                                className="btn btn-ghost btn-square btn-sm text-error tooltip tooltip-left"
                                data-tip="删除记录"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Detail Modal */}
        {selectedRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-base-200 flex justify-between items-center bg-base-200/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <FiFileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg truncate max-w-md">{selectedRecord.fileName}</h3>
                    <div className="flex items-center gap-3 text-sm text-base-content/60">
                      <span className="flex items-center gap-1">
                        <FiClock className="w-3 h-3" />
                        {new Date(selectedRecord.createdAt).toLocaleString()}
                      </span>
                      <span>•</span>
                      <span>{selectedRecord.segmentCount} 个片段</span>
                      <span>•</span>
                      <span className="badge badge-sm badge-ghost">{selectedRecord.languageLabel}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="btn btn-ghost btn-circle"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-base-50">
                <div className="bg-base-100 rounded-xl border border-base-200 shadow-sm">
                  <div className="flex justify-between items-center p-3 border-b border-base-200 bg-base-50/50">
                    <span className="text-xs font-bold text-base-content/50 uppercase tracking-wider px-2">SRT Content</span>
                    <button 
                      onClick={() => handleCopy(selectedRecord.srtContent)}
                      className="btn btn-ghost btn-xs gap-1"
                    >
                      <FiCopy className="w-3 h-3" />
                      复制内容
                    </button>
                  </div>
                  <textarea
                    className="w-full h-[50vh] p-4 font-mono text-sm leading-relaxed bg-transparent resize-none focus:outline-none"
                    value={selectedRecord.srtContent}
                    readOnly
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-base-200 bg-base-100 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="btn btn-ghost"
                >
                  关闭
                </button>
                <button 
                  onClick={() => handleDownloadRecord(selectedRecord)}
                  className="btn btn-primary gap-2"
                >
                  <FiDownload className="w-4 h-4" />
                  下载 SRT 文件
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-base-200 text-base-content py-12 mt-12">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              SubtitleAI
            </h3>
            <p className="text-sm text-base-content/70">
              专业的音视频字幕生成工具，致力于为创作者提供高效、准确的字幕解决方案。
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">产品</h4>
            <ul className="space-y-2 text-sm text-base-content/70">
              <li><a href="#" className="hover:text-primary">功能特性</a></li>
              <li><a href="#" className="hover:text-primary">价格方案</a></li>
              <li><a href="#" className="hover:text-primary">API 文档</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">支持</h4>
            <ul className="space-y-2 text-sm text-base-content/70">
              <li><a href="#" className="hover:text-primary">帮助中心</a></li>
              <li><a href="#" className="hover:text-primary">联系我们</a></li>
              <li><a href="#" className="hover:text-primary">服务条款</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">关注我</h4>
            <div className="flex gap-4">
              <a href="https://github.com/ryuyx/subtitle-generator" className="btn btn-square btn-sm btn-ghost">
                <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="text-center mt-12 pt-8 border-t border-base-300 text-sm text-base-content/50">
          <p>&copy; 2025 SubtitleAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
