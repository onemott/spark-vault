# Spark Vault - 项目灵感收集器

一个面向学生的创意灵感收集与管理工具，采用极简 IDE 风格界面，数据全部存储在浏览器 IndexedDB 中，零后端依赖。

## 功能特性

- **分类与项目管理**：树形结构组织灵感，支持分类/项目的创建、编辑、删除
- **灵感编辑器**：支持 `变量` 语法高亮的提示词编辑器，一键复制时自动填充变量
- **全局搜索**：跨所有项目搜索灵感，快速定位目标内容
- **导入/导出**：JSON 全量备份恢复，单项目 Markdown 导出
- **深色模式**：亮色/暗色/跟随系统三种主题
- **快捷键**：`Ctrl+N` 新建灵感、`Ctrl+F` 聚焦搜索

## 技术栈

- Vite 8 + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Zustand（状态管理）+ Dexie.js（IndexedDB）
- Motion（动画）+ Lucide（图标）+ Sonner（通知）

## 快速开始

```bash
npm install
npm run dev
```

访问 http://localhost:5173/ 即可使用。

## 构建

```bash
npm run build
```

## `ai-discussions/` — AI 讨论笔记

项目根目录下的 `ai-discussions/` 文件夹用于存放与 AI 讨论各领域知识时产出的文档（硬件方案、设计文档等），**不属于**应用源码，不影响项目构建与运行。内容按领域分门别类存放，详见 `ai-discussions/README.md`。
