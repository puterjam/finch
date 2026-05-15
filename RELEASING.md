# Finch Release 发布规则

## 项目定位

`finch_release` 是 **Finch 桌面应用的发布公共仓储**，与源码仓库 `../finch` 分离管理。

| 仓库 | 用途 |
|------|------|
| `../finch` | 源码开发、构建、日常开发提交 |
| `finch_release`（本仓库） | 发布产物托管、更新配置、版本发行说明 |

## 数据来源

本仓库的所有数据均从 `../finch` 同步获取，**不直接在此仓库进行源码开发**。

### 同步内容

每次发版前，从 `../finch` 同步以下文件：

| 文件 | 来源路径 | 说明 |
|------|----------|------|
| `latest-mac.yml` | `../finch/release/latest-mac.yml` | Electron 自动更新配置 |
| `builder-effective-config.yaml` | `../finch/release/builder-effective-config.yaml` | electron-builder 生效配置 |
| `CHANGELOG.md` | `../finch/CHANGELOG.md` | 版本变更日志 |

### 不同步的内容

- **DMG 安装包**（`Finch-*.dmg`）：体积过大（200MB+），不进入 git 仓库，直接上传至 GitHub Release Assets
- **源码文件**：所有源码修改在 `../finch` 完成

## 发布流程

1. 在 `../finch` 完成版本构建，确认 `release/` 目录下 DMG 已生成
2. 将 `../finch/release/latest-mac.yml`、`CHANGELOG.md` 等同步到本仓库
3. 提交并推送本仓库的 `master` 分支
4. 使用 GitHub CLI 创建 Release，上传 DMG 作为 Asset：

```bash
cd ../finch
gh release create vX.Y.Z \
  --repo puterjam/finch \
  --title "Finch X.Y.Z" \
  --notes-file CHANGELOG.md \
  release/Finch-X.Y.Z-arm64.dmg \
  release/Finch-X.Y.Z-arm64.dmg.blockmap
```

## 分支说明

- `master`：本仓库主分支，维护发布配置和文档
- `../finch` 的 `main`：源码主分支

## 自动更新原理

Finch 应用启动时会检查本仓库 GitHub Release 中的 `latest-mac.yml`，若检测到新版本则引导用户下载对应的 DMG Asset。因此 `latest-mac.yml` 中的 `url` 字段必须指向正确的 GitHub Release Asset 下载地址。
