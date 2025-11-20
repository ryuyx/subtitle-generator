"use client";

import { useState, useEffect } from "react";

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
  const [isDragging, setIsDragging] = useState(false);
  
  const [progressStage, setProgressStage] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  useEffect(() => {
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

  const handleViewHistory = (record: HistoryRecord) => {
    setResult(record.srtContent);
    setShowHistory(false);
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
    <div className="min-h-screen gradient-bg-light">
      {/* 顶部导航栏 */}
      <div className="navbar glass-effect shadow-lg sticky top-0 z-50">
        <div className="flex-1">
          <a className="btn btn-ghost text-xl font-bold">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              AI 字幕生成器
            </span>
          </a>
        </div>
        <div className="flex-none">
          <div className="badge badge-primary badge-lg">智能转写</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-6 py-8">
          <div className="inline-block">
            <div className="text-6xl md:text-7xl mb-6 animate-float">🎵</div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              语音转字幕服务
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-base-content/70 max-w-2xl mx-auto">
            AI 驱动的智能语音识别，支持 200+ 语种和方言
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="badge badge-lg badge-outline">高精度识别</div>
            <div className="badge badge-lg badge-outline">多语言支持</div>
            <div className="badge badge-lg badge-outline">快速转写</div>
            <div className="badge badge-lg badge-outline">一键下载</div>
          </div>
        </div>

        {/* Form Card */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-6 md:p-8">
            <h2 className="card-title text-2xl mb-6">开始转换</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Drag and Drop File Upload */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold">选择音频文件</span>
                  <span className="label-text-alt text-xs">MP3, WAV, M4A</span>
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-all duration-300 ${
                    isDragging
                      ? "border-primary bg-primary/10 scale-105"
                      : file
                      ? "border-success bg-success/5"
                      : "border-base-300 hover:border-primary/50 hover:bg-base-200/50"
                  } ${loading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                >
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                    id="file-input"
                  />
                  <div className="text-center space-y-3">
                    {file ? (
                      <>
                        <div className="text-5xl">✅</div>
                        <div className="space-y-1">
                          <p className="font-bold text-lg text-success">{file.name}</p>
                          <p className="text-sm text-base-content/60">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <label
                          htmlFor="file-input"
                          className="btn btn-sm btn-outline btn-primary"
                        >
                          更换文件
                        </label>
                      </>
                    ) : (
                      <>
                        <div className="text-5xl">
                          {isDragging ? "📥" : "🎵"}
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-lg">
                            {isDragging ? "松开鼠标上传文件" : "拖拽文件到这里"}
                          </p>
                          <p className="text-sm text-base-content/60">
                            或点击选择文件
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 pt-2">
                          <div className="badge badge-outline">MP3</div>
                          <div className="badge badge-outline">WAV</div>
                          <div className="badge badge-outline">M4A</div>
                          <div className="badge badge-outline">其他音频格式</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Language Selection Cards */}
              <div className="form-control w-full">
                <label className="label">
                  <span className="label-text font-semibold">选择识别语言</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    onClick={() => !loading && setLanguage("autodialect")}
                    className={`card cursor-pointer transition-all duration-200 ${
                      language === "autodialect"
                        ? "bg-base-300 border-2 border-base-content/30 shadow-md"
                        : "bg-base-200 border-2 border-transparent hover:border-base-content/20 hover:shadow"
                    } ${loading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 flex-1">
                          <h3 className="font-bold text-base">
                            🌏 中英 + 方言
                          </h3>
                          <p className="text-xs text-base-content/70">
                            支持中文、英文及 202 种方言识别
                          </p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            <div className="badge badge-sm badge-ghost">普通话</div>
                            <div className="badge badge-sm badge-ghost">粤语</div>
                            <div className="badge badge-sm badge-ghost">四川话</div>
                            <div className="badge badge-sm badge-ghost">英语</div>
                          </div>
                        </div>
                        {language === "autodialect" && (
                          <div className="flex-shrink-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-base-content"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => !loading && setLanguage("autominor")}
                    className={`card cursor-pointer transition-all duration-200 ${
                      language === "autominor"
                        ? "bg-base-300 border-2 border-base-content/30 shadow-md"
                        : "bg-base-200 border-2 border-transparent hover:border-base-content/20 hover:shadow"
                    } ${loading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1.5 flex-1">
                          <h3 className="font-bold text-base">
                            🌍 多语种
                          </h3>
                          <p className="text-xs text-base-content/70">
                            支持 37 个主流语种自动识别
                          </p>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            <div className="badge badge-sm badge-ghost">English</div>
                            <div className="badge badge-sm badge-ghost">日本語</div>
                            <div className="badge badge-sm badge-ghost">한국어</div>
                            <div className="badge badge-sm badge-ghost">Français</div>
                          </div>
                        </div>
                        {language === "autominor" && (
                          <div className="flex-shrink-0">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-base-content"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divider my-2"></div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="btn btn-primary w-full btn-lg shadow-lg text-lg font-bold"
                >
                  {loading && <span className="loading loading-spinner"></span>}
                  {loading ? "转换中..." : "🚀 开始转换"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="btn btn-ghost btn-sm"
                  disabled={loading}
                >
                  历史记录 ({history.length})
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Progress Card */}
        {loading && progressMessage && (
          <div className="card bg-gradient-to-br from-info/10 to-info/5 shadow-2xl border border-info/30 smooth-transition">
            <div className="card-body">
              <div className="flex items-center gap-3 mb-4">
                <span className="loading loading-spinner loading-lg text-info"></span>
                <h3 className="card-title text-info text-xl">{progressMessage}</h3>
              </div>
              {orderId && (
                <div className="alert alert-info shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span className="font-mono text-sm">订单ID: {orderId}</span>
                </div>
              )}
              <div className="space-y-3">
                <progress 
                  className="progress progress-info w-full h-6 shadow-sm" 
                  value={progressPercent} 
                  max="100"
                ></progress>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-base-content/70 font-medium">{progressStage}</span>
                  <span className="font-bold text-2xl text-info">{Math.round(progressPercent)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Card */}
        {showHistory && (
          <div className="card bg-base-100 shadow-2xl smooth-transition">
            <div className="card-body p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  <span>📚</span>
                  <span>历史记录</span>
                </h2>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="btn btn-error btn-outline btn-sm smooth-transition hover:btn-error"
                  >
                    🗑️ 清空全部
                  </button>
                )}
              </div>
              
              {history.length === 0 ? (
                <div className="hero py-16">
                  <div className="hero-content text-center">
                    <div className="max-w-md">
                      <div className="text-7xl mb-6 opacity-20">📝</div>
                      <h3 className="text-2xl font-bold text-base-content/60 mb-3">暂无历史记录</h3>
                      <p className="text-base-content/50">转换成功后，记录会自动保存在这里</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {history.map((record, index) => (
                    <div 
                      key={record.id} 
                      className="card bg-gradient-to-br from-base-200 to-base-100 hover:shadow-xl smooth-transition hover:scale-[1.02]"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="card-body p-5">
                        <div className="flex flex-col lg:flex-row justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <h3 className="font-bold text-lg break-all flex items-center gap-2">
                              <span className="text-2xl">🎵</span>
                              {record.fileName}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="badge badge-primary badge-lg gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-4 h-4 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
                                {record.languageLabel}
                              </div>
                              <div className="badge badge-ghost badge-lg">🎬 {record.segmentCount} 片段</div>
                              <div className="badge badge-ghost">🕒 {new Date(record.createdAt).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })}</div>
                            </div>
                          </div>
                          <div className="flex gap-2 lg:flex-col lg:justify-center">
                            <button
                              onClick={() => handleViewHistory(record)}
                              className="btn btn-primary btn-sm flex-1 lg:flex-none smooth-transition hover:scale-105"
                            >
                              👁️ 查看
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(record.id)}
                              className="btn btn-error btn-outline btn-sm flex-1 lg:flex-none smooth-transition"
                            >
                              🗑️ 删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Card */}
        {error && (
          <div className="card bg-gradient-to-br from-error/10 to-error/5 shadow-2xl border border-error/30 smooth-transition">
            <div className="card-body">
              <div className="alert alert-error shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-7 w-7" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div className="space-y-2 w-full">
                  <p className="font-bold text-xl">{error}</p>
                  {errorDetails && (
                    <div className="mt-4 text-sm space-y-3">
                      <div className="divider my-2 opacity-50"></div>
                      <div className="grid gap-2">
                        {errorDetails.orderId && (
                          <div className="flex items-center gap-3 bg-error/5 p-3 rounded-lg">
                            <span className="badge badge-error badge-outline">订单ID</span>
                            <span className="font-mono flex-1">{errorDetails.orderId}</span>
                          </div>
                        )}
                        {errorDetails.failType !== undefined && (
                          <div className="flex items-start gap-3 bg-error/5 p-3 rounded-lg">
                            <span className="badge badge-error badge-outline">失败类型</span>
                            <span className="flex-1">{errorDetails.failType} - {FAIL_TYPE_MAP[errorDetails.failType] || "未知错误"}</span>
                          </div>
                        )}
                        {errorDetails.status === "timeout" && (
                          <div className="flex items-center gap-3 bg-error/5 p-3 rounded-lg">
                            <span className="badge badge-error badge-outline">状态</span>
                            <span className="flex-1">转写超时 (尝试 {errorDetails.attempts} 次)</span>
                          </div>
                        )}
                        {errorDetails.originalDuration && (
                          <div className="flex items-center gap-3 bg-error/5 p-3 rounded-lg">
                            <span className="badge badge-error badge-outline">音频时长</span>
                            <span className="flex-1">{(errorDetails.originalDuration / 1000).toFixed(2)} 秒</span>
                          </div>
                        )}
                        {errorDetails.timestamp && (
                          <div className="flex items-center gap-3 bg-error/5 p-3 rounded-lg">
                            <span className="badge badge-error badge-outline">失败时间</span>
                            <span className="flex-1">{new Date(errorDetails.timestamp).toLocaleString("zh-CN")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Card */}
        {result && (
          <div className="card bg-gradient-to-br from-success/10 to-success/5 shadow-2xl border border-success/30 smooth-transition">
            <div className="card-body p-6 md:p-8">
              <div className="alert alert-success shadow-lg mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-7 w-7" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xl font-bold">转换成功！字幕已生成</span>
              </div>
              <div className="space-y-5">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-bold text-lg flex items-center gap-2">
                      <span>📝</span>
                      <span>字幕内容预览</span>
                    </span>
                    <span className="label-text-alt badge badge-success badge-lg">
                      {result.split('\n\n').filter(s => s.trim()).length} 个字幕片段
                    </span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered textarea-lg w-full h-96 font-mono text-sm leading-relaxed shadow-inner"
                    value={result}
                    readOnly
                  />
                </div>
                <button 
                  onClick={handleDownload} 
                  className="btn btn-success w-full btn-lg gap-3 smooth-transition hover:scale-105 shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  下载 SRT 字幕文件
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-8 text-base-content/50">
          <div className="divider"></div>
          <p className="text-sm">
            Powered by AI • 支持 200+ 语种 • 高精度识别
          </p>
        </footer>
      </div>
    </div>
  );
}
