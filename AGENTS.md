# AGENTS.md — Finch 对外发布空间规则

本空间是 Finch 项目面向用户的统一发布出口，包含官网、开源包、官方技能、发版元数据。

## 空间角色

`finch_release` 是 Finch 发布物集合仓库，与源码仓库 `../finch` 分工明确：

| 仓库 | 职责 |
|------|------|
| `../finch` (main) | 源码开发、日常构建、daily commits |
| `finch_release` (master) | 官网、发布包、官方技能、发版元数据、Release 管理 —— 本空间 |

此仓库与源代码仓库共用同一个 GitHub remote：`puterjam/finch`，但使用不同分支。

## 目录结构

```
finch_release/
├── AGENTS.md               ← 本文件，空间规则（替代原 CLAUDE.md）
├── docs/                   ← Finch 官网（中英文），通过 CloudBase 静态托管部署
├── packages/               ← 对外发布的 npm 包
│   ├── plugin-api/         ← @finch/plugin-api — 插件类型定义
│   ├── plugins/            ← @finch.app/plugins — 插件安装 CLI
│   ├── skills/             ← @finch.app/skills — 技能安装 CLI
│   └── git-branch/         ← @finch/plugin-git-branch — 官方插件，独立迭代维护
├── skills/                 ← 官方技能
│   ├── finch-plugin-creator/  ← 插件开发指导技能，定期从源码同步
│   ├── cloudbase/             ← CloudBase 部署技能（已安装）
│   └── frontend-design/       ← 前端设计技能（已安装）
├── latest-mac.yml          ← Electron 自动更新配置
├── CHANGELOG.md            ← 版本更新日志
├── builder-effective-config.yaml  ← electron-builder 有效配置
├── test-proxy.mjs          ← 本地 Release 下载测试代理
├── .mcp.json               ← CloudBase MCP 配置
├── skills-lock.json        ← 已安装技能锁文件
└── README.md               ← Finch 介绍
```

## 各模块维护规则

### docs/ — 官网

- 中英文双站（`docs/` + `docs/en/`），通过 CloudBase 静态托管部署
- 访问地址: https://finch-d2gx2j6h43e6b2239-1251008045.tcloudbaseapp.com/
- **更新后须部署：**

  通过 CloudBase MCP：
  ```
  manageHosting(action="upload", localPath="./docs", cloudPath="/", ignore=[".DS_Store", "**/.DS_Store"])
  ```

  或 CLI 部署：
  ```bash
  tcb hosting deploy docs / -e finch-d2gx2j6h43e6b2239
  ```

### packages/ — npm 包

发布在 npm Registry 上的包：

| 包名 | 路径 | 维护方式 |
|------|------|----------|
| `@finch/plugin-api` | `packages/plugin-api/` | 从 `../finch/packages/plugin-api/` 同步，随版本更新 |
| `@finch.app/plugins` | `packages/plugins/` | 从 `../finch/packages/plugins/` 同步，独立对外发布 |
| `@finch.app/skills` | `packages/skills/` | 从 `../finch/packages/skills/` 同步，独立对外发布 |
| `@finch/plugin-git-branch` | `packages/git-branch/` | **从源码迁移至此，独立维护迭代**，不再与源码同步 |

### skills/ — 官方技能

- **finch-plugin-creator**：从 `../finch/skills/finch-plugin-creator/` 定期同步
- 其他技能（docx、pdf、pptx、theme-factory、xlsx、frontend-design、skill-creator 等）仅需要更新时同步
- 已安装的技能在 `skills-lock.json` 中记录

### 发版管理

#### 同步发版元数据

新版构建完成后，从源码仓库同步文件：

```bash
cp ../finch/release/latest-mac.yml .
cp ../finch/release/builder-effective-config.yaml .
cp ../finch/CHANGELOG.md .
```

然后提交推送：

```bash
git add -A
git commit -m "chore: sync vX.Y.Z release metadata"
git push origin master
```

> **注意**：`latest-mac.yml` 中的 `url` 字段必须指向 GitHub Release 的 DMG 下载地址。Finch 应用启动时会检查此文件，发现新版本则提示用户下载。

#### 创建 GitHub Release

DMG 文件（200MB+）**不提交到 git**，而是作为 GitHub Release 资产上传：

```bash
cd ../finch
gh release create vX.Y.Z \
  --repo puterjam/finch \
  --title "Finch X.Y.Z" \
  --notes-file CHANGELOG.md \
  release/Finch-X.Y.Z-arm64.dmg \
  release/Finch-X.Y.Z-arm64.dmg.blockmap
```

从 CHANGELOG 提取当前版本的 Release Notes：

```bash
awk '/^## \[X.Y.Z\]/{start=1} start{print} /^---$/{if(start) exit}' CHANGELOG.md > /tmp/release-notes.md
```

### 文件参考

| 文件 | 来源 | 用途 |
|------|------|------|
| `latest-mac.yml` | `../finch/release/latest-mac.yml` | Electron 自动更新配置，`url` 字段指向 GitHub Release 资产 |
| `CHANGELOG.md` | `../finch/CHANGELOG.md` | 版本更新日志，用作 Release Notes |
| `builder-effective-config.yaml` | `../finch/release/builder-effective-config.yaml` | electron-builder 有效配置 |
| `test-proxy.mjs` | —（本空间维护） | 本地测试 GitHub Release 下载代理 |
| `.mcp.json` | —（本空间维护） | CloudBase MCP 服务器配置 |

### 分支验证

此仓库与源码仓库共用同一 remote，但使用不同分支：

```bash
# 查看远程分支
git ls-remote --heads origin
# master — 本空间（发版发布分支）
# main   — 源码仓库分支（../finch）
```

## 操作边界

- **允许自动操作**：读文件、搜索、创建/编辑文档/技能、从 `../finch` 同步文件
- **需要确认的操作**：`tcb hosting deploy`、创建 GitHub Release、推送 git commit、修改 `latest-mac.yml`
- **禁止的操作**：直接删除官方技能目录、未经验证修改 `skills-lock.json`
