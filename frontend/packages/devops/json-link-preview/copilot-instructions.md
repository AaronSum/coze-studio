# json-link-preview 子包开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/devops/json-link-preview）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是一个 React 组件库子包，导出单一核心组件 `JsonLinkPreview`，用于在 JSON 内容中识别并预览链接，当前主要服务于调试面板等上层应用（例如 debug-panel 中的 `JsonLinkPreview` 引用）。
- 组件入口位于 `src/index.tsx`：
  - 接收形如 `JsonValue[]` 的结构化数据（见 `src/utils/parse.ts`），每个元素包含 `content_type` 与嵌套 `content`（text/image/file_url 等）。
  - 在构造函数中调用 `parse` 预处理 `src`，生成 `linkMap`（以 URL 为 key，value 为解析结果 Result），并根据 `props.src` 更新。
  - 使用 `@uiw/react-json-view` 将原始 JSON 渲染为可折叠树，结合 `JsonView.String` 的自定义渲染逻辑，为其中的 HTTP(S) 字符串链接添加交互体验。
- 数据与视图的主要流向：
  1. 上游向 `JsonLinkPreview` 传入 `src: unknown[]`、空间/实体等上下文（`space_id`、`bot_id`/`entityId`）。
  2. `parse` 将 JSON 数组转为 `linkMap`，聚焦 `image` 与 `file` 类型，并封装额外信息（文件名、后缀类型等）。
  3. 在 JSON 树渲染过程中，通过 `isValidHttpUrl` 识别出字符串 URL；渲染为带 tooltip 的链接，tooltip 中提供“查看详情”操作。
  4. 点击链接时：
     - 通过 `@coze-arch/bot-tea` 的 `sendTeaEvent` 上报埋点事件 `preview_link_click`（含 host、content_type、bot/space 信息）。
     - 依据 `linkMap` 中记录的 `contentType`，选择匹配的插件（目前主要是 `ImagePreview`，以及基础类 `JsonPreviewBasePlugin` 设计），决定具体预览行为。
     - 若无插件匹配，则通过 `OverlayAPI.show` 弹出全屏遮罩 + `NotSupport` 组件，提示“不支持预览”，并提供下载按钮。
- 插件机制：
  - 插件统一从 `src/plugins/index.ts` 导出，包括 `ImagePreview`、`PdfPreview` 和抽象基类 `JsonPreviewBasePlugin`。
  - `JsonLinkPreview` 内维护 `plugins: JsonPreviewBasePlugin[]`，构造时初始化为 `[new ImagePreview()]`；插件需实现：
    - `match(contentType: string): boolean` 用于匹配具体内容类型（如 image / pdf / docx 等）。
    - `priority: number` 用于在多插件命中时排序，选择优先级最高的插件。
    - `render(link: string, extraInfo?: Record<string, string>): void` 具体执行预览逻辑，通常会结合 `OverlayAPI` 或其他 UI 容器渲染。
- 公共 UI 与交互：
  - `src/common/overlay.tsx` 封装了一个简单的全屏浮层系统 `OverlayAPI`，基于 `ReactDOM.render` 在 `document.body` 下动态创建容器，并渲染带关闭按钮与可选遮罩的 Overlay。
  - `src/common/not-support/index.tsx` 定义 `NotSupport` 组件，用于当某种内容类型没有对应插件时，展示“暂不支持预览”的视觉提示，并允许用户直接下载原文件。

## 关键开发与运行工作流

- 依赖安装与 Rush 相关：
  - 项目整体采用 Rush 管理依赖，不在子包内单独安装；在仓库根目录使用 `rush update` 统一安装和链接依赖（参见根级 README 与本包 README）。
- 本子包 `package.json` 中的脚本：
  - `npm run build`：当前占位实现为 `exit 0`，实际产物构建（umd/esm）由统一构建链或其他工具负责；不要在本包内假设本地 build 会产出 dist。
  - `npm run lint`：使用 `eslint.config.js` 与 `@coze-arch/eslint-config` 进行全包 lint，带缓存。
  - `npm run test`：通过 `vitest --run --passWithNoTests` 执行单元测试；`vitest.config.ts` 基于 `@coze-arch/vitest-config` 的 `defineConfig`，preset 为 `web`，遵循统一前端测试规范。
  - `npm run test:cov`：在 `test` 基础上开启覆盖率（依赖 `@vitest/coverage-v8` 配置）。
- TS 构建与引用：
  - 顶层 `tsconfig.json` 仅开启 `composite` 并引用 `tsconfig.build.json` + `tsconfig.misc.json`，本身 `exclude: ["**/*"]`，用于 Rush 的项目引用管理。
  - `tsconfig.build.json`：
    - 基于 `@coze-arch/ts-config/tsconfig.web.json`，专注于 src 目录的构建（`rootDir: ./src`，`outDir: ./dist`）。
    - 通过 `references` 引用共享基础包（`../../arch/bot-tea`、`../../arch/i18n`、`../../arch/logger`、`../../arch/pdfjs-shadow` 等）以及配置子包（eslint/stylelint/ts-config/vitest-config）。
  - `tsconfig.misc.json`：
    - 用于测试、Storybook、Tailwind 配置等非生产构建文件（`__tests__`、`stories`、`vitest.config.ts`、`tailwind.config.ts`）。
    - 设定 `types: ["vitest/globals"]` 以便测试文件拥有全局 Vitest API 类型。
- Storybook 与本地开发：
  - 子包 README 提到 `npm run dev` 用于本地调试组件，通常在 Storybook 或 Vite + Storybook 模板中定义；具体脚本与 `.storybook` 目录在其他子包模板中保持一致，本包沿用该规范。
  - 本子包的视觉与交互风格依赖统一设计系统 `@coze-arch/coze-design`，在 Storybook 中应保持一致主题。

## 项目特有约定与代码风格

- 类型与数据结构：
  - `src/utils/parse.ts` 中定义了 `JsonValue` 与 `Result`，是本包数据流的中心类型：
    - 仅支持 `content_type in {"image", "file"}`；其他类型会被忽略，不进入 `linkMap`。
    - `file` 类型会从 `file_url` 中抽取 `suffix_type`（作为 `contentType`）和 `file_name`（作为 `extraInfo.fileName`）。
  - 上游传入 `src` 时若结构不符合 `JsonValue[]`，组件仍可工作（通过 `unknown[]` 类型约束），但 `parse` 依赖的字段缺失会导致该链接不被识别或不含额外信息。
- 链接识别规则：
  - `src/utils/url.ts` 使用 `httpUrlRegex` 严格匹配 `http`/`https` 链接：
    - 要求域名部分满足 `[-a-zA-Z0-9@:%._+~#=]{1,256}.[a-zA-Z0-9()]{1,6}`，并允许常见 path/query/fragment 字符。
    - 只有通过 `isValidHttpUrl` 校验的字符串才会被当作可点击链接渲染。
- UI 与样式：
  - 组件样式采用 Less + CSS Modules：
    - 根容器 class 定义在 `src/index.module.less` 的 `.json-link-preview` 下，并在组件中通过 `styles['json-link-preview']` 绑定到 `JsonView`。
    - 链接样式使用子选择器 `.link`，通过 `styles.link` 应用于 `<a>` 元素，包含主题色（`--coz-fg-hglt`）与下划线等特定视觉规范。
  - Tailwind 工具类广泛应用在浮层和错误界面中（如 `w-[200px]`、`backdrop-blur-md`），需保持与项目统一 Tailwind 配置兼容。
- 日志与埋点：
  - 埋点统一使用 `@coze-arch/bot-tea`：
    - 事件名集中在 `EVENT_NAMES` 枚举，如 `preview_link_click`。
    - `sendTeaEvent` 调用时需完整传入 host、content_type、bot/space 等必要上下文，以便后端统计与排查。
  - 错误日志使用 `@coze-arch/logger`：
    - 如 `NotSupport` 中下载失败时记录 `eventName: 'LoadError-page'` 与 `error` 对象。
    - 新增功能时若存在潜在易错路径，优先接入统一 logger，而非简单 `console.error`。
- 国际化：
  - 字符串均通过 `@coze-arch/i18n` 的 `I18n.t` 获取 key 对应文案，如 `analytics_query_aigc_detail`、`analytics_query_aigc_infopanel_download` 等。
  - 新增 UI 文案时，务必定义正确的 i18n key，并确保与上游文案资源同步；避免在组件内写死文案。

## 重要组件与外部依赖集成细节

- `@uiw/react-json-view`：
  - 被用来展示原始 `src` JSON；`JsonLinkPreview` 使用其 `JsonView` 与 `JsonView.String`：
    - `value={this.props.src}` 保证原始数据以树状展示。
    - 通过 `shortenTextAfterLength={300}` 控制长文本折叠，`collapsed={5}` 控制默认折叠层级。
    - 在 `JsonView.String` 的 `render` 回调中拦截字符串节点，用于注入自定义 `<a>` 与外层 `<Tooltip>`。
  - 若在此基础上扩展渲染规则（例如对特定 JSON key 高亮），须注意与现有链接识别逻辑的兼容。
- 预览插件体系：
  - `src/plugins/base.ts`（通过 `JsonPreviewBasePlugin` 导出）定义插件的公用接口与基本字段，具体插件如 `ImagePreview` / `PdfPreview` 实现内容类型匹配与渲染逻辑。
  - `JsonLinkPreview` 在点击链接时：
    - 使用 `this.plugins.filter(plugin => plugin.match(contentType))` 获取所有支持该类型的插件。
    - 若为空，则走 `NotSupport` 流程；否则按 `priority` 排序，选择优先级最高的插件执行 `render`。
  - 集成新格式（如视频、表格文件等）时，应优先新增插件而非修改核心组件逻辑；只需在构造函数中加入新插件实例，或在未来引入插件注册机制。
- Overlay 弹层系统：
  - `src/common/overlay.tsx` 将 Overlay 的创建与销毁抽象为 `OverlayAPI.show`：
    - `show({ content, withMask })` 接受一个 `content(onClose)` 回调，返回 `close` 函数。
    - content 内部通过 `onClose` 控制关闭；`Overlay` 自身提供右上角关闭按钮，统一视觉风格。
  - 任何插件若需要全屏预览能力，应优先通过 `OverlayAPI.show` 承载，而非直接操作 DOM。
- NotSupport 下载逻辑：
  - `src/common/not-support/index.tsx` 通过 `fetchResource` 与 `downloadFile`（来自 `src/utils/download.ts`）实现资源下载：
    - `fetchResource(url)` 封装实际网络请求，返回 Blob。
    - `downloadFile(blob, filename)` 根据浏览器能力创建临时链接并触发下载。
  - 该流程中所有异常均使用 `logger.error` 记录，并保留 UI 可用性（即使日志失败也不影响关闭弹层）。

## 项目流程、协作与部署相关

- 版本与发布：
  - 本包目前版本为 `0.0.1`，采用 `Apache-2.0` 许可证，遵循仓库整体开源策略。
  - 发布产物路径约定：
    - ESM: `dist/esm/index.js`
    - UMD: `dist/umd/index.js`
    - `files` 配置仅包含 `dist` 与 `README.md`，确保只发布必要构建产物。
  - 实际发布流程由上层 Rush + NPM 发布流水线驱动，本包不直接维护发布脚本。
- 代码组织与依赖：
  - 本包严格依赖 workspace 内的 arch/foundation/common/studio 等基础子包，通过 `workspace:*` 进行版本管理；
  - 引入第三方库时需注意：
    - 避免与其它子包重复引入不同版本（如 `@uiw/react-json-view`、`classnames`、`lodash-es`）；
    - 所有三方依赖需在 `dependencies` 中声明；开发工具库放在 `devDependencies`。
- Git 与协作规范：
  - 分支策略、提交流程遵循仓库根部的通用规范（详见根级 CONTRIBUTING / README），子包本身不重复定义；
  - 在该子包内修改公共接口（如 `JsonLinkPreview` props、`Result` 结构）时，需要同步检查依赖此包的上层应用（例如 debug-panel），防止破坏现有集成。

## 其他特别注意事项

- 运行环境约束：
  - 组件假设运行在浏览器环境中，依赖 `window.location` 与 `document.body`（用于 Overlay）；不适用于无 DOM 的 Node 环境或纯 SSR 首屏渲染阶段。
  - 若未来需要 SSR 支持，应在调用 Overlay 或访问 window/document 前增加环境守卫。
- TypeScript 设置：
  - `strictNullChecks: true` 但 `noImplicitAny: false`，意味着：
    - 对 `null`/`undefined` 的处理需要显式判断；
    - 允许部分隐式 any 存在，AI 助手补全类型时应优先保持与现有模式一致，避免大范围类型重构。
- 国际化 key 与埋点事件名均属于跨子包约定：
  - 不要随意改动现有 key 或事件名；若需新增，请遵循上游命名约定（多采用 `analytics_query_aigc_*` 与带语义前缀的 eventName）。
- 由于 `build` 脚本目前是占位实现，AI 助手在本包内新增脚本时，应确保不破坏 Rush 统一构建链；通常通过在根级或专用 config 包中扩展构建逻辑，而非在此处单独构建。
