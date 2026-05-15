# Finch (芬奇) Desktop

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](CHANGELOG.md)
[![Electron](https://img.shields.io/badge/Electron-42-47848F)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6)](https://www.typescriptlang.org/)

Finch (芬奇) 是一款基于 Electron + React + TypeScript 构建的桌面 AI Agent 客户端，主打**本地执行**与**云端企业治理**相结合的开发者工作流体验。

---

## 核心特性

- **多轮 AI 对话** — 深度集成 Claude Agent SDK，支持智能体多轮交互、工具调用与推理展示
- **会话管理** — 创建、浏览、恢复历史会话；会话数据持久化存储
- **工作目录** — 灵活的工作目录切换与管理，支持多项目并行
- **多模型支持** — 配置多家 AI 服务商（含中国与国际提供商），自定义模型参数与上下文长度
- **丰富的内容渲染** — Markdown 预览、Mermaid 图表、HTML 文件 webview 渲染、代码高亮
- **附件持久化** — 附件文件跨会话持久保存
- **首次启动引导** — 欢迎界面与引导问卷，帮助新用户快速上手
- **macOS 原生打包** — DMG 安装包，支持 Retina 背景图与代码签名/公证

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 42 |
| 前端框架 | React 19 + TypeScript 5.7 |
| 构建工具 | Vite 6 |
| 样式方案 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| AI SDK | @anthropic-ai/claude-agent-sdk |
| 图表渲染 | Mermaid |
| 代码高亮 | react-syntax-highlighter |

---

## 项目结构

```
finch-desktop/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── services/      # 业务逻辑层 (agentRunner, cloudClient, localStore...)
│   │   ├── data/          # 提供商配置 (providers.cn.ts / providers.intl.ts)
│   │   ├── main.ts        # 主进程入口与 IPC 处理器
│   │   └── preload.ts     # 预加载脚本（暴露 window.finch API）
│   ├── renderer/          # React 渲染进程
│   │   ├── components/    # UI 组件
│   │   │   ├── ui/        # 通用 UI 原子组件
│   │   │   ├── settings/  # 设置相关组件
│   │   │   └── icons/     # 自定义 Finch 图标
│   │   ├── store/         # Zustand 状态管理
│   │   ├── services/      # 纯前端逻辑
│   │   └── hooks/         # 自定义 React Hooks
│   └── shared/            # 主/渲染进程共享类型与工具
├── docs/                  # 架构设计文档
├── skills/                # Agent Skills
├── build/                 # 构建资源（图标、DMG 背景等）
├── scripts/               # 发布与版本脚本
└── release/               # 构建产物
```

---

## 快速开始

### 环境要求

- Node.js >= 20
- macOS（当前主要支持平台）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 启动完整 Electron 开发环境（含热重载）
npm run dev:electron

# 仅启动 Vite 渲染器预览
npm run dev
```

### 构建

```bash
# 类型检查
npm run typecheck

# 编译主进程并构建渲染器
npm run build

# 打包未压缩的 Electron 应用
npm run dist

# macOS 签名与发布
npm run dist:mac
```

---

## 运行时数据

应用运行时数据存储于用户目录下的 `~/.finch/`：

| 路径 | 用途 |
|------|------|
| `~/.finch/core/projects/<slug>/` | 各工作目录的会话 JSONL 数据 |
| `~/.finch/core/sessions/` | 会话索引文件 |
| `~/.finch/model-settings.json` | 模型持久化配置 |
| `~/.finch/models.json` | 模型列表配置 |
| `~/.finch/workspace.json` | 工作区状态 |

---

## 版本历史

### [1.1.0] — 2026-05-15

- Mermaid 图表渲染、Markdown 预览、HTML webview 渲染
- 附件持久化与会话视图改造
- 工作目录侧栏折叠与状态记忆
- 启动性能优化，消除白屏
- 外观设置重设计（字体大小、主题控件、主目录卡片）
- 安全依赖升级（修复 18 个 Dependabot 告警）

### [1.0.0] — 2026-05-14

- 首次发布：Electron + React + TypeScript 桌面应用
- Claude Agent SDK 集成，多轮对话
- 会话创建、历史记录与恢复
- 工作目录管理与多模型配置
- macOS DMG 安装包

---

## 提交规范

本项目采用 **Conventional Commits**，描述使用中文：

```
feat: 新增会话恢复支持
fix: 修复路径拦截边界条件
style: 统一图标线宽为 1.25
perf: 优化启动性能
refactor: 收敛通用组件到 ui 层
docs: 补充架构文档
chore: 升级依赖版本
```

---

## 文档

- [CLAUDE.md](CLAUDE.md) — 项目架构、编码规范与开发指南
- [AGENTS.md](AGENTS.md) — Agent 协作规范与安全提示
- [CHANGELOG.md](CHANGELOG.md) — 详细版本变更日志
- `docs/` — 架构设计文档目录

---

## License

Private — 内部项目
