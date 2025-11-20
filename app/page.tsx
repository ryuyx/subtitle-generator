"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";

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

// failType 错误码说明
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
  
  // 实时状态
  const [progressStage, setProgressStage] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // 加载历史记录
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
              
              // 更新进度状态
              if (data.stage) {
                setProgressStage(data.stage);
              }
              if (data.message) {
                setProgressMessage(data.message);
              }
              if (data.orderId) {
                setOrderId(data.orderId);
              }
              
              // 计算进度百分比
              if (data.attempts && data.maxAttempts) {
                const percent = Math.min((data.attempts / data.maxAttempts) * 100, 99);
                setProgressPercent(percent);
              }
              
              // 处理不同阶段
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
                // 处理错误
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
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>语音转字幕服务</h1>
        <p className={styles.description}>
          上传音频文件，自动生成多语种字幕文件
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="audio" className={styles.label}>
              选择音频文件
            </label>
            <input
              type="file"
              id="audio"
              accept="audio/*"
              onChange={handleFileChange}
              className={styles.fileInput}
              disabled={loading}
            />
            {file && (
              <p className={styles.fileName}>已选择: {file.name}</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="language" className={styles.label}>
              选择语言
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={styles.select}
              disabled={loading}
            >
              <option value="autodialect">中英 + 202种方言</option>
              <option value="autominor">37个语种</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className={styles.button}
          >
            {loading ? "转换中..." : "开始转换"}
          </button>

          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={styles.historyButton}
            disabled={loading}
          >
            {showHistory ? "隐藏历史记录" : `查看历史记录 (${history.length})`}
          </button>
        </form>

        {loading && progressMessage && (
          <div className={styles.progressPanel}>
            <div className={styles.progressInfo}>
              <p className={styles.progressMessage}>📡 {progressMessage}</p>
              {orderId && (
                <p className={styles.orderId}>订单ID: {orderId}</p>
              )}
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className={styles.progressPercent}>{Math.round(progressPercent)}%</p>
          </div>
        )}

        {showHistory && (
          <div className={styles.historyPanel}>
            <div className={styles.historyHeader}>
              <h2>历史记录</h2>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className={styles.clearButton}
                >
                  清空全部
                </button>
              )}
            </div>
            
            {history.length === 0 ? (
              <p className={styles.emptyHistory}>暂无历史记录</p>
            ) : (
              <div className={styles.historyList}>
                {history.map((record) => (
                  <div key={record.id} className={styles.historyItem}>
                    <div className={styles.historyItemInfo}>
                      <h3>{record.fileName}</h3>
                      <p>
                        <span className={styles.historyLabel}>语言:</span> {record.languageLabel}
                        {" "}
                        <span className={styles.historyLabel}>片段:</span> {record.segmentCount}
                        {" "}
                        <span className={styles.historyLabel}>时间:</span> {new Date(record.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div className={styles.historyItemActions}>
                      <button
                        onClick={() => handleViewHistory(record)}
                        className={styles.viewButton}
                      >
                        查看
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(record.id)}
                        className={styles.deleteButton}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <p>❌ {error}</p>
            {errorDetails && (
              <div className={styles.errorDetails}>
                {errorDetails.orderId && (
                  <p><strong>订单ID:</strong> {errorDetails.orderId}</p>
                )}
                {errorDetails.failType !== undefined && (
                  <p><strong>失败类型:</strong> {errorDetails.failType} - {FAIL_TYPE_MAP[errorDetails.failType] || "未知错误"}</p>
                )}
                {errorDetails.status === "timeout" && (
                  <p><strong>状态:</strong> 转写超时 (尝试 {errorDetails.attempts} 次)</p>
                )}
                {errorDetails.originalDuration && (
                  <p><strong>音频时长:</strong> {(errorDetails.originalDuration / 1000).toFixed(2)} 秒</p>
                )}
                {errorDetails.timestamp && (
                  <p><strong>失败时间:</strong> {new Date(errorDetails.timestamp).toLocaleString("zh-CN")}</p>
                )}
              </div>
            )}
          </div>
        )}

        {result && (
          <div className={styles.result}>
            <h2>转换成功！</h2>
            <textarea
              className={styles.textarea}
              value={result}
              readOnly
              rows={10}
            />
            <button onClick={handleDownload} className={styles.downloadButton}>
              下载 SRT 文件
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
