import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface HistoryRecord {
  id: string;
  fileName: string;
  language: string;
  languageLabel: string;
  segmentCount: number;
  srtContent: string;
  createdAt: string;
}

const HISTORY_DIR = join(process.cwd(), ".history");
const HISTORY_FILE = join(HISTORY_DIR, "records.json");

/**
 * 确保历史记录目录存在
 */
async function ensureHistoryDir() {
  if (!existsSync(HISTORY_DIR)) {
    await mkdir(HISTORY_DIR, { recursive: true });
  }
}

/**
 * 读取历史记录
 */
export async function getHistory(): Promise<HistoryRecord[]> {
  try {
    await ensureHistoryDir();
    
    if (!existsSync(HISTORY_FILE)) {
      return [];
    }

    const data = await readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("读取历史记录失败:", error);
    return [];
  }
}

/**
 * 添加历史记录
 */
export async function addHistory(record: Omit<HistoryRecord, "id" | "createdAt">): Promise<HistoryRecord> {
  try {
    await ensureHistoryDir();
    
    const history = await getHistory();
    
    const newRecord: HistoryRecord = {
      ...record,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    // 将新记录添加到开头
    history.unshift(newRecord);

    // 只保留最近50条记录
    const limitedHistory = history.slice(0, 50);

    await writeFile(HISTORY_FILE, JSON.stringify(limitedHistory, null, 2), "utf-8");

    return newRecord;
  } catch (error) {
    console.error("保存历史记录失败:", error);
    throw new Error("保存历史记录失败");
  }
}

/**
 * 删除历史记录
 */
export async function deleteHistory(id: string): Promise<void> {
  try {
    const history = await getHistory();
    const filteredHistory = history.filter((record) => record.id !== id);
    await writeFile(HISTORY_FILE, JSON.stringify(filteredHistory, null, 2), "utf-8");
  } catch (error) {
    console.error("删除历史记录失败:", error);
    throw new Error("删除历史记录失败");
  }
}

/**
 * 清空所有历史记录
 */
export async function clearHistory(): Promise<void> {
  try {
    await ensureHistoryDir();
    await writeFile(HISTORY_FILE, JSON.stringify([], null, 2), "utf-8");
  } catch (error) {
    console.error("清空历史记录失败:", error);
    throw new Error("清空历史记录失败");
  }
}
