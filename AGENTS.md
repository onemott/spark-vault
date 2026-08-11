# AGENTS.md — Spark Vault（开发协作说明）

> 供 AI 编码助手 / 开发者阅读的项目上下文。遇到问题先读这里。

## 项目是什么

**Spark Vault** 是一个「项目灵感收集器」单页应用（SPA）。用户可以创建分类 → 分类下创建项目 → 项目下记录灵感（idea），支持标签、收藏、回收站、快照备份/回滚。

技术栈：**Vite 8 + React 19 + TypeScript + Tailwind v4 + shadcn/ui（@base-ui/react）+ Dexie（IndexedDB）+ zustand + sonner + motion**。

## 常用命令

```bash
npm run dev       # 启动开发服务器（默认 http://localhost:5173/）
npm run build     # 类型检查 tsc -b，然后 vite build
npm run lint      # eslint 检查
npm run preview   # 预览构建产物
```

Windows 下可用根目录的 `启动.bat` 一键启停：双击启动；已在运行时自动打开浏览器；端口被占用时给出提示。

## ⚠️ 数据存储（重点，务必先理解）

**所有用户数据存储在浏览器 IndexedDB（Dexie 库名 `SparkVault`），不在项目文件里。**

- 表：`categories`、`projects`、`ideas`、`snapshots`（见 `src/lib/db.ts`）。
- 数据绑在**本地浏览器**。修改代码、重新部署、git 操作**不会**影响数据，也不会被 git 提交（数据不在仓库中）。
- 数据会在以下情况丢失：清浏览器「清除站点数据」、换浏览器/设备、浏览器主动清理存储。
- `db.ts` 已调用 `navigator.storage.persist()` 申请持久化以降低被清理风险，但**不保证**。

### 备份机制（内置）
- 全库导出/导入 JSON：`src/lib/importExport.ts` 的 `exportAllData` / `importAllData`。
- 快照：`snapshots` 表最多保留 3 份（FIFO），支持回滚（`rollbackFromSnapshot`）。
- 单项目导出 Markdown：`exportProjectMarkdown`。
- 导入/回滚前都会自动创建快照，便于反悔。

### 数据库 schema（当前版本 2，`CURRENT_SCHEMA_VERSION`）
- `categories`：`++id, name, sortOrder, deletedAt`
- `projects`：`++id, categoryId, name, createdAt, deletedAt`
- `ideas`：`++id, projectId, title, createdAt, updatedAt, *tags, isFavorite, deletedAt`
- `snapshots`：`++id, createdAt, data`（data 为全库 JSON 字符串）

> `idea.projectId` 可为 `null`（表示「未分配」，用哨兵值 `UNASSIGNED_PROJECT_ID = -1` 在 UI 中表示，见 `useIdeas.ts`）。侧栏有「未分配」入口集中展示 `projectId === null` 的灵感。`title` 可选（空时用提示词截断）；`tags` 可选（空时用 `extractTagsFromPrompt` 从提示词自动生成，见 `utils.ts`）。

> 改动 schema 时**必须**新增 `db.version(N+1)` 并写 `upgrade` 迁移，同时更新 `CURRENT_SCHEMA_VERSION` 和 `migrateBackupData`（备份迁移）。已有真实用户数据，禁止破坏性变更。

### 回收站自动清理
`db.ts` 启动时 `cleanupTrash()`：删除超过 30 天的 `deletedAt` 数据（分层清理 category→project→idea）。

## 目录结构

```
src/
  App.tsx                   # 根组件，路由/布局装配
  main.tsx                  # 入口
  index.css                 # Tailwind v4 样式
  types/index.ts            # 领域类型：Category/Project/Idea/Snapshot
  lib/
    db.ts                   # Dexie 数据库定义 + schema + 迁移 + 清理
    store.ts                # zustand 全局状态
    importExport.ts         # 导入导出/快照/回滚/迁移
    utils.ts                # 工具函数
  hooks/
    useIdeas.ts             # 灵感数据 hook
    useKeyboardShortcuts.ts # 快捷键
  components/
    layout/                 # AppLayout, ErrorBoundary
    sidebar/                # Sidebar
    ideas/                  # IdeasPanel, VariableDialog, CopyButton
    editor/                 # EditorPanel
    trash/                  # TrashPanel
    ui/                     # shadcn/ui 基础组件
ai-discussions/              # AI 讨论笔记（非项目源码，见下文说明）
  README.md                 # 用途与分类规则
  电机驱动与控制/            # 按领域分子文件夹
```

## `ai-discussions/` 目录说明

此目录存放项目所有者与 AI 讨论各领域知识时产出的文档（HTML、Markdown 等），**不属于** Spark Vault 应用源码，不影响构建与运行。内容按领域分门别类存放，详见 `ai-discussions/README.md`。新增内容时请放入对应领域子文件夹，领域不存在则新建。

## 常见注意事项

- 字段有 `isFavorite`、`deletedAt` 等可选值，读取/渲染前注意判空与默认值（历史数据可能缺失）。
- 日期字段存在 IndexedDB 为 `Date`，经 JSON 序列化（备份/快照）后变字符串，导入时用 `restoreDataTypes` 还原。
- 全局状态走 `src/lib/store.ts`（zustand），数据读写走 dexie-react-hooks + `useIdeas.ts`。
- 变更 DB 结构时同步更新 `types/index.ts`、`db.ts`、`importExport.ts` 的迁移逻辑三处，保持一致。
