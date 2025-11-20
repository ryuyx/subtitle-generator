# 语音转字幕服务

一个基于 Next.js 和讯飞语音识别的多语种字幕生成服务。

## 功能特性

- 🎵 支持多种音频格式（MP3, WAV, M4A, OGG, WebM等）
- 🌍 支持多语种识别（中文、英语、日语、韩语、俄语、法语、西班牙语）
- 📝 自动生成标准 SRT 格式字幕
- ⚡ 实时语音转文字
- 🎨 现代化用户界面
- ☁️ 支持 Vercel 一键部署

## 技术栈

- **前端**: Next.js 14 + React + TypeScript
- **后端**: Next.js API Routes
- **语音识别**: 讯飞开放平台 WebSocket API
- **部署**: Vercel

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd subtitle-generator
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env.local` 文件，填入你的讯飞API凭证：

```env
IFLYTEK_APP_ID=your_app_id_here
IFLYTEK_API_SECRET=your_api_secret_here
IFLYTEK_API_KEY=your_api_key_here
```

> 💡 如何获取讯飞API凭证？
> 1. 访问 [讯飞开放平台](https://www.xfyun.cn/)
> 2. 注册并登录账号
> 3. 创建应用，选择"大模型多语种语音识别"服务
> 4. 在控制台获取 APPID、APISecret 和 APIKey

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 5. 构建生产版本

```bash
npm run build
npm start
```

## 部署到 Vercel

### 方式一：通过 GitHub 集成（推荐）

1. 将代码推送到 GitHub 仓库
2. 访问 [Vercel](https://vercel.com) 并登录
3. 点击 "New Project" 导入你的 GitHub 仓库
4. 配置环境变量：
   - `IFLYTEK_APP_ID`: 你的讯飞 APP ID
   - `IFLYTEK_API_SECRET`: 你的讯飞 API Secret
   - `IFLYTEK_API_KEY`: 你的讯飞 API Key
5. 点击 "Deploy" 开始部署

### 方式二：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录 Vercel
vercel login

# 部署项目
vercel

# 添加环境变量
vercel env add IFLYTEK_APP_ID
vercel env add IFLYTEK_API_SECRET
vercel env add IFLYTEK_API_KEY

# 重新部署使环境变量生效
vercel --prod
```

### 环境变量配置说明

在 Vercel 项目设置中配置以下环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `IFLYTEK_APP_ID` | 讯飞开放平台应用ID | `·····` |
| `IFLYTEK_API_SECRET` | 讯飞API密钥 | `·····...` |
| `IFLYTEK_API_KEY` | 讯飞API Key | `·····...` |

> ⚠️ **重要提示**：
> - 环境变量在 Vercel 控制台的 Settings > Environment Variables 中配置
> - 配置后需要重新部署才能生效
> - 不要将真实的 API 凭证提交到 Git 仓库中

### 部署后验证

1. 访问 Vercel 提供的部署 URL
2. 上传一个测试音频文件
3. 检查是否能正常生成字幕

## 使用说明

1. **选择音频文件**：点击文件选择按钮，上传音频文件（支持最大50MB）
2. **选择语言**：从下拉菜单中选择音频的语言
3. **开始转换**：点击"开始转换"按钮
4. **下载字幕**：转换完成后，可以预览并下载SRT字幕文件


## 项目结构

```
subtitle-generator/
├── app/
│   ├── api/
│   │   └── transcribe/
│   │       └── route.ts        # 语音识别API路由
│   ├── layout.tsx               # 全局布局
│   ├── page.tsx                 # 主页面
│   ├── page.module.css          # 页面样式
│   └── globals.css              # 全局样式
├── lib/
│   ├── iflytek.ts              # 讯飞API封装
│   └── subtitle-utils.ts       # 字幕工具函数
├── public/                     # 静态资源
├── .env.local                  # 环境变量（需自行创建）
├── .gitignore
├── next.config.js              # Next.js配置
├── package.json
├── tsconfig.json               # TypeScript配置
├── vercel.json                 # Vercel配置
└── README.md
```