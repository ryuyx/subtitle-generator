# 语音转字幕服务

基于 Next.js 和讯飞语音识别的多语种字幕生成服务。

## 功能特性

- 支持多种音频格式（MP3, WAV, M4A, OGG, WebM等）
- 支持多语种识别（中文、英语、日语、韩语、俄语、法语、西班牙语）
- 自动生成 SRT 格式字幕
- 实时语音转文字

## 技术栈

- Next.js 14 + React + TypeScript
- Supabase (数据库)
- 讯飞开放平台 WebSocket API

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
IFLYTEK_APP_ID=your_app_id_here
IFLYTEK_API_SECRET=your_api_secret_here
IFLYTEK_API_KEY=your_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> 获取讯飞API凭证：访问 [讯飞开放平台](https://www.xfyun.cn/)，创建应用并选择"大模型多语种语音识别"服务

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量
4. 部署

## 项目结构

```
subtitle-generator/
├── app/
│   ├── api/
│   │   ├── history/           # 历史记录API
│   │   ├── transcribe/        # 语音识别API
│   │   └── transcribe-stream/ # 流式识别API
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── iflytek.ts            # 讯飞API封装
│   ├── subtitle-utils.ts     # 字幕工具
│   ├── supabase.ts           # Supabase客户端
│   └── history.ts            # 历史记录管理
└── supabase-schema.sql       # 数据库结构
```