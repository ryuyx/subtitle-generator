import { supabase } from "./supabase";

export interface HistoryRecord {
  id: string;
  fileName: string;
  language: string;
  languageLabel: string;
  segmentCount: number;
  srtContent: string;
  createdAt: string;
}

/**
 * 读取历史记录
 */
export async function getHistory(): Promise<HistoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('transcription_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error("读取历史记录失败:", error);
      return [];
    }

    // 转换数据库字段到应用字段
    return (data || []).map(record => ({
      id: record.id,
      fileName: record.file_name,
      language: record.language,
      languageLabel: record.language_label,
      segmentCount: record.segment_count,
      srtContent: record.srt_content,
      createdAt: record.created_at,
    }));
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
    const { data, error } = await supabase
      .from('transcription_history')
      .insert({
        file_name: record.fileName,
        language: record.language,
        language_label: record.languageLabel,
        segment_count: record.segmentCount,
        srt_content: record.srtContent,
      })
      .select()
      .single();

    if (error) {
      console.error("保存历史记录失败:", error);
      throw new Error("保存历史记录失败");
    }

    // 转换数据库字段到应用字段
    return {
      id: data.id,
      fileName: data.file_name,
      language: data.language,
      languageLabel: data.language_label,
      segmentCount: data.segment_count,
      srtContent: data.srt_content,
      createdAt: data.created_at,
    };
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
    const { error } = await supabase
      .from('transcription_history')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("删除历史记录失败:", error);
      throw new Error("删除历史记录失败");
    }
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
    const { error } = await supabase
      .from('transcription_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录

    if (error) {
      console.error("清空历史记录失败:", error);
      throw new Error("清空历史记录失败");
    }
  } catch (error) {
    console.error("清空历史记录失败:", error);
    throw new Error("清空历史记录失败");
  }
}
