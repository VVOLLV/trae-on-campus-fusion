# TRAE on Campus · 北京三校联合站

地大站第二场活动专题，2026 年 10 月 10 日 13:30–17:00（北京时间），大钟寺广场 1 号楼 3F 报告厅。保留原有米白、荧光绿、大圆角与大标题设计。

这是静态网站，无独立后端或运行时框架依赖。当前为活动预告版：八位共创者及两位分享嘉宾的身份已由活动负责人提供；报名入口、具体分享话题与实际照片尚未提供，页面如实展示待公布状态。源码同时支持当天指引、活动结束与真实回顾。

## 运行与构建

需要 Node.js 22+。在项目根目录执行：

```sh
npm ci
npm run build
npm run preview
```

默认预览地址为 `http://127.0.0.1:4199/`。项目预览服务禁用缓存，构建后的 CSS 和脚本地址带内容版本号，避免新页面误用旧样式。若原服务已经运行，构建结果会直接更新页面，刷新即可；不要为了再次预览而结束其他项目服务。也可使用不同端口：

```sh
PORT=4200 npm run preview
```

`npm run build` 同时生成 `cugb-phase2-prototype/` 的预览文件和 `dist/` 的发布文件。不要直接编辑生成的 HTML/CSS/JS；应改 `src/` 后重新构建。没有监听热更新，保存源码后需再运行构建。

## 文件组织

- `src/event.json`：已确认的活动事实、报名状态、议程、FAQ、共创团队、嘉宾与照片记录。不得放访问密码或内部运营材料。
- `src/index.template.html`：语义化页面结构。
- `src/render.mjs`、`src/content.mjs`：内容校验、状态渲染、HTML 转义与日历生成。
- `src/styles.css`、`src/colors_and_type.css`：组件样式与原有视觉变量。
- `src/script.js`：导航、渐进动画、团队选择、复制/分享、灯箱、活动过期保护。
- `src/assets/`：发布素材，包含原创图形、TRAE 官方字标和分享图。字标来源记录在 `artifacts/fusion-hands/asset-sources.md`。
- `scripts/`：构建、静态预览、分享图生成、案例研究工具。
- `tests/`：议程/日历/状态规则与真实浏览器流程测试。
- `artifacts/`：旧版基线、参考网站截图、验收截图、报告和动效录像，不进入发布包。
- `WEBSITE_PLAN.md`、`VALIDATION.md`：建设计划与验收记录。

## 更新活动内容

在 `src/event.json` 编辑后执行 `npm run build`。日期使用包含 `+08:00` 的 ISO 时间；议程各段必须连续，首尾与活动起止时间一致。日历自动转换为 UTC，正确导入后对应北京时间 13:30–17:00。

报名开放需要真实 HTTPS 入口：

```json
"registration": { "status": "open", "url": "https://真实报名域名/报名路径" }
```

未开放使用 `pending`，已截止使用 `closed`。页面、FAQ 和行动按钮会一致更新。不要用空地址、示例邮箱或自造人数替代正式信息。

已确认嘉宾记录包含 `name`、`role`、`topic` 和 `confirmed: true`；候选人继续留在内部策划案。`contact` 可填已确认的公开联系说明，`entryNote` 用于发布真实入场要求。

共创团队位于往届故事与参会指南之间。`team` 保存八位成员的 `id`、`group`、`name`、`role`；组织取 `cugb`、`blcu`、`ustb`、`trae`。尚未提供姓名的校园大使使用 `name: null`，页面按学校与身份标注，同校同身份用序号区分。确认姓名后只需更新 `name`，保持 `id` 不变。两位已确定的嘉宾另有 `speakerOrder`；在完整 `guests` 记录尚未提供时，分享者区复用其姓名、职位并明确标注话题待公布。八块色条固定单排、整体 16:9，选择色条或名单可突出同一成员；关闭脚本时完整名单仍可阅读。

日期或场地信息改变后重新生成分享图：

```sh
npm run share-image
npm run build
```

分享图工具需要 Chrome，默认使用 macOS `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`；其他环境设置 `CHROME_PATH`。分享图来自活动配置，不使用远程素材。

## 活动阶段与回顾

`phase` 可取 `upcoming`、`event-day`、`ended`、`recap`。当天指引需主动发布。构建时若活动时间已结束，则自动采用结束状态；已打开页面也会在重新进入或切回标签页时隐藏过期报名与日历入口。**时间到达不会生成回顾内容。**活动当天结束后请重新构建发布，确保无 JavaScript 访问也拿到最新静态内容。

回顾发布需同时设置 `phase: "recap"` 并填入：

- `recap.verified: true`：表示已核对实际资料。
- `recap.summary`：真实活动摘要。
- `recap.photos`：4–6 张真实照片，至少一张带 `panorama: true`。每张包含相对 `assets/` 的 `src`、`width`、`height`、`alt`、`caption`、`date` 和 `source`；图片原文件放在 `src/assets/`。
- `recap.stats`：已核验数据列表，每项包含 `label`、数值 `value` 与 `source`；没有已核验数据时用空数组，不造数。
- `recap.asOf`：统计截止日期。
- `recap.works`：可选的公开作品 `{ "title": "作品名称", "url": "HTTPS 地址" }` 列表。

首场照片使用独立 `pastPhotos` 列表，字段与上述照片相同，日期标为实际首场日期。源码不包含任何合成现场照片。测试里的四张图形只是灯箱与状态流程的测试输入，不会发布。

## 检查

```sh
npm test
npx playwright install webkit
npm run test:browser
npm run format:check
```

浏览器测试使用本机 Chrome 与 Playwright WebKit，临时服务器选择空闲端口，不依赖 4199。需要其他 Chrome 安装位置时设置 `CHROME_PATH`。WebKit 是 Safari 引擎自动化覆盖，不能等同于已在真实 iPhone 上测试。

浏览器检查覆盖 320–1920px 的九种宽度、WCAG AA 自动检查、导航键盘/焦点、团队单排比例与键盘/触屏选择、实际下载、复制成功与失败、分享回退、预告/当天/结束/回顾状态、关闭 JavaScript 和动态切换减少动态效果。测试断言未来内容时使用明确的合成数据，输出不进入发布目录。

Hero 的光照、Fusion 字面形变和三校插画联动使用原生 CSS/JavaScript，无新增运行依赖。交互范围、幅度、触控及减少动态效果约束见 [HERO_MOTION.md](HERO_MOTION.md)；浏览器套件包含对应专项检查。

## 发布

把 `dist/` 内容部署至任意静态托管服务。构建时通过环境变量设置最终公开地址：

```sh
SITE_URL=https://真实域名/ npm run build
```

支持子路径，例如 `https://真实域名/campus/`。构建自动补 canonical、绝对分享图地址和 `og:url`。未设置正式域名时保留相对资源路径，分享按钮不会向外复制 localhost。当前没有代用户创建域名、上传素材或公开发布。

建议托管启用 HTTPS、Brotli/gzip；HTML 使用重验证缓存，避免更新后仍展示旧活动状态。CSS 与脚本的版本参数由内容自动生成，托管缓存需保留查询参数。不上传项目根目录、策划案、测试和研究资料，只上传 `dist/`。若增加真实报名表单，应单独设计后端与数据处理，不把个人信息存进静态 JSON。
