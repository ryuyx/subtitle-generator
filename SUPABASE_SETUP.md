# Supabase 集成说明

## 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com/)
2. 创建新项目
3. 在 SQL Editor 中执行 `supabase-schema.sql` 文件创建数据表

## 2. 获取 Supabase 凭证

在 Supabase 项目的 Settings > API 中找到：
- Project URL
- anon public key

## 3. 配置环境变量

### 本地开发
创建 `.env.local` 文件：
```env
IFLYTEK_APP_ID=your_app_id
IFLYTEK_API_SECRET=your_api_secret
IFLYTEK_API_KEY=your_api_key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Vercel 部署
在 Vercel 项目设置中添加环境变量：
1. 进入项目 Settings > Environment Variables
2. 添加以下变量：
   - `IFLYTEK_APP_ID`
   - `IFLYTEK_API_SECRET`
   - `IFLYTEK_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. 部署到 Vercel

```bash
git add .
git commit -m "集成 Supabase 存储"
git push
```

## 主要改动

1. ✅ 使用 Supabase 替代文件系统存储历史记录
2. ✅ 移除临时文件写入操作
3. ✅ 配置 API 超时时间为 60 秒
4. ✅ 完全兼容 Vercel Serverless 环境

## 数据库表结构

```sql
transcription_history
- id: UUID (主键)
- file_name: TEXT
- language: TEXT
- language_label: TEXT
- segment_count: INTEGER
- srt_content: TEXT
- created_at: TIMESTAMPTZ
```
