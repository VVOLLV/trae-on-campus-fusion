# 双主题实施任务清单（交接给实施 agent）

配套规范：`docs/theme-design-spec.md`（先读规范再动手）。
仓库根目录即项目根；构建产物不要手改，一律改 `src/` 后 `npm run build`。

## 现状速览

- 模板：`src/index.template.html`（`{{}}` 占位符由 `src/render.mjs` 渲染；导航在 `.header-inner`）
- 样式：`src/colors_and_type.css`（`:root` 变量）+ `src/styles.css`（约 2008 行，含大量硬编码颜色，清单见规范 §5）
- 脚本：`src/script.js`（`defer` 外链，含 `setupDialogs/setupMenu/setupActions/setupTeam/setupMotion/setupLightbox/guardExpiredEvent`）
- 构建：`npm run build`（版本号 + 输出到 `dist/` 与 `cugb-phase2-prototype/`）
- 验证：`npm run check`（build + node:test + Playwright 双引擎浏览器测试，含 axe）

## 任务步骤

1. **变量层**：`src/colors_and_type.css` 中为现有 `--cugb-*` 增加语义别名（`--panel`、`--panel-2`、`--ink-2`、`--line`、`--hover`、`--accent-ink` 等），并追加 `[data-theme='trae']` 覆盖块（取值见规范 §3.2）。校园版默认值必须与现值一致。
2. **去硬编码**：按规范 §5 表格把 `src/styles.css` 的硬编码颜色替换为语义变量；确认校园版渲染零变化（对照 `artifacts/validation/` 既有截图）。
3. **主题层收尾**：在 `src/styles.css` 末尾追加 `[data-theme='trae']` 专属规则：`.outline` 描边字处理、圆角收紧（99px→8–10px 等）、按钮/hover/focus 换色、`--mono` 换 JetBrains Mono 栈、代码粉/蓝/紫点缀（克制）。
4. **切换按钮**：`src/index.template.html` 在 `.header-inner` 内加主题切换 `<button>`（文案「校园版 / Trae 版」双状态，`hidden` 默认隐藏由 JS 启用），移动端入口同步处理。
5. **逻辑**：`src/script.js` 增加 `setupTheme()`：读取/写入 `localStorage['trae-on-campus-theme']`、切换 `data-theme`、更新按钮文案与 `aria` 状态、同步 `<meta name="theme-color">`。
6. **防闪烁**：`src/index.template.html` 的 `<head>` 内联约 5 行脚本（读 localStorage 设 `data-theme`）。**不要新增外链 CSS/JS**（外链资源必须保持恰 3 个）。
7. **测试**：`tests/browser.mjs` 追加主题用例（切换、键盘、记忆、Trae 主题 axe/溢出、noJS 默认校园版）；如需可补 `tests/content.test.mjs`。
8. **验证**：`npm run check` 全绿；重点核对默认主题既有断言零回归。

## 关键断言提醒（不可破坏）

- `body` 背景默认主题 `rgb(247, 247, 242)`；`.connection-scene` 背景 `rgb(32, 36, 30)`
- 外链样式/脚本资源数 === 3，且带 sha256 前 12 位版本号
- 9 个 `.agenda-row`、8 个 `.team-bar`、团队面板 16:9、图标/文字无重叠
- axe（wcag2a/2aa/21aa）违规数 0
- 320–1920 各断点无横向溢出
- noJS：标题、议程、日历下载、FAQ 均可用

## 完成定义

规范 `theme-design-spec.md` §9 验收清单全部勾选，`npm run check` 输出全绿。
