-- 创建转写历史记录表
CREATE TABLE IF NOT EXISTS transcription_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  language TEXT NOT NULL,
  language_label TEXT NOT NULL,
  segment_count INTEGER NOT NULL,
  srt_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_transcription_history_created_at 
  ON transcription_history(created_at DESC);

-- 启用行级安全策略 (RLS)
ALTER TABLE transcription_history ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许所有人读取和插入（根据需要调整）
CREATE POLICY "允许所有人读取历史记录" 
  ON transcription_history FOR SELECT 
  USING (true);

CREATE POLICY "允许所有人插入历史记录" 
  ON transcription_history FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "允许所有人删除历史记录" 
  ON transcription_history FOR DELETE 
  USING (true);

-- 如果需要用户认证，可以使用以下策略替代上面的策略
-- CREATE POLICY "用户只能访问自己的历史记录" 
--   ON transcription_history FOR ALL 
--   USING (auth.uid() = user_id);
