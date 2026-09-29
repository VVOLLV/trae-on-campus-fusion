# TRAE on Campus 双主题设计系统规范

> 交接文档：供实施 agent 直接按本文档改代码。实现完成后本文件可作为设计规范长期留存。
> 适用范围：本仓库 `src/` 源码与构建产物（`dist/`、`cugb-phase2-prototype/`）。

## 1. 背景与目标

网站当前只有一套主题：米白底 + 荧光绿的「校园风」。需求是为网站增加**双主题**能力：

1. **主题一（默认）· 校园版**：保持现状，视觉完全不变。
2. **主题二 · Trae 版**：向 TRAE 主视觉（TraeCode 设计系统，深色 IDE 风格）对齐的深色皮肤。

核心原则：**只换皮肤，不换骨架**。布局、字号、间距、信息层级、交互行为一律不变；只替换颜色、圆角、描边质感与少量字体点缀。

## 2. 主题机制

- 在 `<html>`（或 `<body>`）上使用 `data-theme` 属性切换：
  - `data-theme="campus"`（默认，等价于不写该属性）
  - `data-theme="trae"`
- 全部主题差异通过 **CSS 变量映射层** 实现：`colors_and_type.css` 中定义 `[data-theme='trae']` 变量覆盖，`styles.css` 中的硬编码颜色逐步改为变量或在主题层中被覆盖。
- **无 JS 行为**：禁用 JavaScript 时页面必须保持当前校园版外观，功能完整（现有 `tests/browser.mjs` 的 noJS 用例不可破坏）。
- **记忆选择**：用户选择写入 `localStorage`（建议 key：`trae-on-campus-theme`），再次访问时恢复。
- **防闪烁**：在 `<head>` 内联一段极小的初始化脚本（读取 localStorage 并同步设置 `data-theme`）。注意工程约束（见 §8）：样式/脚本外链资源数必须保持恰为 3 个，内联脚本不计入该约束，但不要引入第 4 个外链 CSS/JS。

## 3. 设计 Token

### 3.1 校园版（默认，保持现状）

现有 `src/colors_and_type.css` 的变量即为唯一真源，不改数值：

| Token | 值 |
| --- | --- |
| `--cugb-background` | `#f7f7f2` |
| `--cugb-foreground` | `#181818` |
| `--cugb-primary` | `#b8f24a` |
| `--cugb-muted` | `#e9e9e2` |
| `--cugb-muted-foreground` | `#686861` |
| `--cugb-border` | `#d9d9d2` |
| `--radius-sm / -md / -lg` | `8px / 14px / 24px` |

### 3.2 Trae 版（新增 `[data-theme='trae']` 覆盖）

对齐 TraeCode 设计系统（只读参考），深色 IDE 质感：

| Token | 值 | 说明 |
| --- | --- | --- |
| 背景 | `#1A1B1D` | 页面主背景 |
| 面板/卡片 | `#202226` ~ `#25272B` | 分区面板，比背景略亮 |
| 主文字 | `#F2F3F5` | 正文与标题 |
| 次级文字 | `#A8ABB2` | 弱化文本（对比度 ≥ 4.5:1 于背景） |
| 描边/分隔线 | `#34373C` | 边框、分割线 |
| 品牌绿（primary） | `#32F08C` | 主强调色、按钮、高亮 |
| 绿底文字 | `#0C0C0D` | 品牌绿底上的文字色（保证对比度） |
| 代码粉 | `#F48CCA` | 语法色点缀 |
| 代码蓝 | `#80BBFF` | 语法色点缀 |
| 代码紫 | `#B38CFF` | 语法色点缀 |
| 圆角（紧凑） | `8–10px` | 替换校园版 14–24px 大圆角 |
| 等宽字体 | `'JetBrains Mono', 'SFMono-Regular', Consolas, monospace` | 时间、数字、代码点缀 |
| 正文字体 | 保持现有系统字体栈不变 | 只换等宽点缀字体 |

对比度要求：所有文字与背景组合、按钮文字与按钮底色，均需通过 WCAG 2.1 AA（正文 ≥ 4.5:1，大字 ≥ 3:1）。两套主题都要验证。

## 4. Trae 主题的视觉调整点

1. **描边字（`.outline`）**：深色底上黑描边不可见。Trae 主题下改为：
   - 描边与填充使用品牌绿 `#32F08C` 实心字，或
   - 透明填充 + `2px` 品牌绿描边（二选一，以可读性与对比度为准；推荐实心品牌绿）。
2. **深色面板**：`.connection-scene`、`.numbers-panel`、`.team-visual` 等在校园版是深色面板，Trae 主题下改为 `#25272B` 或接近 IDE 面板的深灰，面板内文字用主/次级文字色。
3. **亮底卡片**：`.manifesto-card`、`.join-card`、`.agenda-row.featured` 等荧光绿/浅绿卡片：
   - 方案 A（推荐）：底色换深面板色 + 品牌绿文字/描边强调；
   - 方案 B：保留品牌绿底，文字用 `#0C0C0D`。两种都需过对比度检查。
4. **按钮**：圆角由 `99px` 胶囊改为 `8–10px`；主按钮品牌绿底 + `#0C0C0D` 文字；描边按钮用品牌绿描边。
5. **hover / focus**：focus-visible 描边改品牌绿；hover 色系相应换成深色系 hover（如 `#2F3237`）。
6. **字体点缀**：时间（`.agenda-time`）、统计数字（`.stats-grid dd`）、序号（`.team-member-number` 等）继续用等宽字体；Trae 主题下可将 `.campus-code`、`.team-selection-number` 等点缀文字用代码粉/蓝/紫少量强调（克制使用，不改变信息层级）。
7. **Hero 质感**：可为 Trae 主题增加极轻微的深色渐变或网格质感背景（如 IDE 编辑区），但不得引入新外链资源；优先纯 CSS 实现。

## 5. 硬编码颜色清单（`src/styles.css`）

以下颜色散落在 `styles.css`，Trae 主题需逐项处理（改为变量或在主题层覆盖）。校园版渲染结果必须保持逐像素不变。

| 行号（约） | 选择器 | 当前值 | Trae 主题处理 |
| --- | --- | --- | --- |
| 65 | `:focus-visible` | `#477000` 描边 | 品牌绿 `#32F08C` |
| 212 | `.scroll-progress span` | `#6b9c1b` | 品牌绿 |
| 231/240 | `.site-header` | `rgba(247,247,242,…)` | `rgba(26,27,29,…)` 同透明度 |
| 303 | `.header-status .status-dot` | `#58762b` | 品牌绿 |
| 438/439 | `.connection-scene` | `#20241e` / `#c9d1c1` | `#25272B` / 主文字色 |
| 447 | `.connection-scene::before` 光晕 | `#50633438` | 品牌绿低透明光晕 |
| 454/500/940/955/979 | 面板内浅色文字 | `#b8c0b0` `#e5e8dd` `#c9d1c1` | 次级/主文字色 |
| 476 | `.fusion-watermark` | `#c4d8a309` | 品牌绿极低透明 |
| 512–534 | 手部插画 `--sleeve/--cuff` | 校园色 | 可保留或轻微去饱和 |
| 562/599/600 | 徽标阴影/光晕 | `#0003` `#b8f24a14` | 品牌绿光晕 `#32F08C` 低透明 |
| 664 | `.manifesto-footer` 边框 | `#18181838` | 浅色半透明或描边色 |
| 684/701/722 | `.numbers-*` 文字 | `#b9b9b0` | 次级文字色 |
| 693 | `.stats-grid` 分隔线 | `#ffffff35` | 浅色半透明 |
| 795 | `.agenda-row.featured` | `#e8efda` | 深面板 + 品牌绿强调 |
| 840 | `.pending-symbol` 虚线 | `#b4b4a9` | 描边色 |
| 867–873 | `--team-color-*` | 校园色 | 保留或轻微去饱和 |
| 886/887 | `.team-visual` | `#20241e` / `#f2efdf` | 深面板 / 主文字色 |
| 908 | `.team-bar` 文字 | `#20241e` | 保持深色（色条为亮底） |
| 923/930 | `.team-bar` 阴影/焦点 | `#f2efdf29` `#20241e` | 面板描边色 |
| 965 | `.team-selection` 分隔线 | `#596151` | 描边色 |
| 1027/1038 | 成员选中/hover 底 | `#e5eadc` `#ecefe6` | `#2F327` 系 hover 深色 |
| 1100/1110/1119 | `.history-*` 卡片 | `#ecece5` `#dfe6d4` `#6a745f` | 深面板两档 + 次级文字 |
| 1189/1205 | `.archive-note` / `.venue-art` | `#e9eddf` `#e9e9e2` | 深面板 |
| 1221–1251 | 楼体插画各部件 | `#d0d4c6` `#78816d` `#e0e3d7` `#f5f5ee` `#c9f47d` | 换成深色系（描边/面/窗），`floor-3` 用品牌绿 |
| 1370/1388 | `.join-card` 内文字 | `#3e4b2d` | 按 §4.3 方案 A/B 处理 |
| 1414/664 | 亮卡分割线 | `#18181838` | 同 §4.3 |
| 1443 | `dialog::backdrop` | `#111a` | 可保留 |
| 1545–1555 | hover 系列 | `#18181813` `#353b2c` `#1818180b` `#46611d` | 深色 hover / 品牌绿文字 |
| 1495 | `.copy-dialog textarea` | `white` | 深输入框底 `#25272B` + 描边色 |

建议实现方式：为上述值引入语义变量（如 `--panel`、`--panel-2`、`--ink-2`、`--line`、`--accent-ink`、`--hover` 等），校园版变量值 = 现值（视觉零变化），Trae 版在 `[data-theme='trae']` 中覆盖。

## 6. 主题切换按钮规格

- **位置**：桌面端导航右侧（`.header-inner` 内、`.header-status` 旁）；移动端显示在汉堡菜单可见区域内或菜单头部。
- **文案**：明确可读的双状态文案，如「校园版 / Trae 版」，当前状态高亮；或按钮文案随当前主题显示「切换到 Trae 版 / 切换到校园版」。禁止只用太阳/月亮图标不加说明。
- **语义**：`<button type="button">`，建议 `aria-label="切换主题（当前：校园版）"` 并随状态更新；或使用 `aria-pressed` 表达双状态。键盘 Enter/Space 可激活（原生 button 天然支持，勿用 div）。
- **状态同步**：切换后更新 `data-theme`、localStorage、按钮文案/aria 状态；`<meta name="theme-color">` 同步更新（校园版 `#f7f7f2`，Trae 版 `#1A1B1D`）。
- **无 JS**：按钮可隐藏（`hidden` + JS 解除，参考现有 `[data-copy-address]` 模式）或禁用，页面保持校园版。

## 7. 无障碍要求

- 两套主题均需通过 axe-core（tags：`wcag2a`、`wcag2aa`、`wcag21aa`）**零违规**，在 390 与 1440 两档验证（现有测试即此配置，需扩展到两主题）。
- 重点检查：品牌绿按钮上的文字用 `#0C0C0D`；深色主题次级文字 `#A8ABB2` 于 `#1A1B1D` 上 ≥ 4.5:1；`.outline` 描边字在深色底的可读性；focus 指示在两主题下均清晰可见。
- 主题切换不得导致横向溢出（各断点 `scrollWidth ≤ innerWidth`）。

## 8. 工程约束（不可破坏）

- **构建**：改 `src/` 后运行 `npm run build`（`scripts/build.mjs` 会为 CSS/JS 加 `?v=` sha256 版本号，并同步输出到 `cugb-phase2-prototype/` 与 `dist/`）。
- **外链资源数恰为 3**（`tests/browser.mjs` 断言 `link[rel="stylesheet"], script[src]` 数量 === 3）：主题层写进现有两个 CSS 文件内，**不要新增外链 CSS/JS 文件**；防闪烁脚本用 `<head>` 内联方式。
- **默认主题零回归**：`body` 背景必须保持 `rgb(247, 247, 242)`、`.connection-scene` 背景保持 `rgb(32, 36, 30)`（浏览器测试硬断言）；9 个 `.agenda-row`、8 个 `.team-bar`、团队 16:9 等布局断言全部不变。
- **验证命令**：`npm run check`（= build + `node --test tests/content.test.mjs` + `node tests/browser.mjs`）必须全绿。
- **测试补充**（在 `tests/browser.mjs` 追加）：
  1. 点击切换按钮后 `data-theme`、按钮状态、body 背景变化正确；
  2. 键盘（Enter/Space）可切换；
  3. 刷新后主题被记住（localStorage 生效）；
  4. Trae 主题下在 390/1440 跑 axe 零违规、无横向溢出；
  5. noJS 上下文下页面仍为校园版且按钮不造成布局破坏。

## 9. 验收清单

- [ ] 默认（无 JS、无 localStorage）呈现与当前完全一致的校园版
- [ ] 导航右侧出现明确文案的主题切换按钮，键盘可用
- [ ] 切换到 Trae 版：深色背景、品牌绿强调、紧凑圆角、等宽字体点缀、描边字改为品牌绿实心/绿描边
- [ ] 选择被 localStorage 记忆，刷新后保持；`theme-color` 同步
- [ ] 两主题 × (390, 1440) axe 零违规，对比度过 WCAG 2.1 AA
- [ ] 所有断点无横向溢出
- [ ] `npm run check` 全绿（含默认主题的全部既有断言）
- [ ] `styles.css` 中列出的硬编码颜色全部变量化或被主题层覆盖，校园版渲染结果无变化
