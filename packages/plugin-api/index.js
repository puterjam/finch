/**
 * @finch/plugin-api — Finch 插件开发者契约（纯类型，零运行时依赖）
 *
 * 这是插件作者唯一需要了解的模块。插件导出一个默认的 `activate(finch)` 函数，
 * 通过传入的 `finch` 对象声明能力：
 *
 * ```ts
 * import type { FinchPluginAPI } from "@finch/plugin-api";
 *
 * export default function activate(finch: FinchPluginAPI) {
 *   finch.tools.register({ ... });
 *   finch.composerActions.register("my-action", { ... });
 * }
 * ```
 *
 * 完整指南见 docs/plugin-authoring.md。
 *
 * ──────────────────────────────────────────────────────────────────
 *  命名空间总览
 *   finch.plugin          插件自身元信息
 *   finch.tools           向 Agent 贡献工具（Agent Tools）
 *   finch.composerActions 向 Composer 工具栏贡献按钮（UI 扩展）
 *   finch.storage         插件私有 KV 存储
 *   finch.secrets         只读密钥访问
 *   finch.logger          带插件 id 前缀的日志
 * ──────────────────────────────────────────────────────────────────
 */
export {};
