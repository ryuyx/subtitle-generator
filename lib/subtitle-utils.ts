export interface SubtitleEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * 将毫秒转换为SRT时间格式 (HH:MM:SS,mmm)
 */
function millisecondsToSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(
    3,
    "0"
  )}`;
}

/**
 * 生成SRT格式字幕内容
 */
export function generateSRT(
  segments: Array<{ bg: number; ed: number; text: string }>
): string {
  if (!segments || segments.length === 0) {
    throw new Error("没有识别结果");
  }

  const entries: SubtitleEntry[] = segments.map((segment, index) => ({
    index: index + 1,
    startTime: millisecondsToSRTTime(segment.bg),
    endTime: millisecondsToSRTTime(segment.ed),
    text: segment.text,
  }));

  return entries
    .map((entry) => {
      return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}\n`;
    })
    .join("\n");
}

/**
 * 验证并解析音频文件
 */
export function validateAudioFile(file: File): boolean {
  const validTypes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
    "audio/webm",
  ];

  // 检查文件类型
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
    throw new Error("不支持的音频格式");
  }

  // 检查文件大小 (限制50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("文件大小超过50MB限制");
  }

  return true;
}
