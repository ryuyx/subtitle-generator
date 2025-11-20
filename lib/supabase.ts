import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 环境变量未配置');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// 数据库表结构类型定义
export interface HistoryRecord {
  id: string;
  file_name: string;
  language: string;
  language_label: string;
  segment_count: number;
  srt_content: string;
  created_at: string;
}
