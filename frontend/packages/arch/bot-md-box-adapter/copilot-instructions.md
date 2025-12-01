# @coze-arch/bot-md-box-adapter 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-md-box-adapter）中安全、高效地协作开发。

## 一、子包定位与全局架构

- 包路径与名称：frontend/packages/arch/bot-md-box-adapter，对应 npm 包名 `@coze-arch/bot-md-box-adapter`。
- 角色：在前端 monorepo 内为 Markdown 渲染组件提供统一适配层，对上游业务暴露稳定的 MdBox API，对下游依赖 @bytedance/calypso 具体实现。
- 对外入口（见 package.json.exports）：
  - `.` 与 `./full` → [src/full/index.ts](frontend/packages/arch/bot-md-box-adapter/src/full/index.ts)：完整功能版 MdBox 组件与类型导出。
  - `./lazy` → [src/lazy/index.ts](frontend/packages/arch/bot-md-box-adapter/src/lazy/index.ts)：懒加载版本 MdBoxLazy 及相关工具。
  - `./light` → [src/light/index.ts](frontend/packages/arch/bot-md-box-adapter/src/light/index.ts)：轻量版 MdBoxLight。
  - `./slots` → [src/slots/index.ts](frontend/packages/arch/bot-md-box-adapter/src/slots/index.ts)：从 Calypso 透出的 Image/Link 等插槽组件。
  - `./style` → [src/style.ts](frontend/packages/arch/bot-md-box-adapter/src/style.ts)：动态按需引入样式的工具函数 `dynamicImportMdBoxStyle`。
- 架构理念：
  - 通过统一的适配层封装 Calypso 的组件命名与类型，避免业务代码直接依赖第三方包路径和细粒度 API。
  - 将不同使用场景（完整、轻量、懒加载、插槽）拆分为独立 entry，便于按需引入和 Tree-Shaking。
  - 在 monorepo 中替代其它 Markdown 盒组件（如 disallowed_3rd_libraries 中禁止的 `@flow-web/md-box`），保证风格与行为一致。

## 二、代码结构与职责划分

- [src/full/index.ts](frontend/packages/arch/bot-md-box-adapter/src/full/index.ts)：
  - 命名导出：
    - `MdBox`：`Calypso` 的别名组件，用于渲染 Markdown 内容。
    - `MdBoxProps`：`CalypsoProps` 类型别名，作为 MdBox 组件的 props 类型。
    - `MdBoxImage`：`Image` 组件别名，可独立渲染图片。
  - 同时 re-export 大量 Calypso 相关类型与工具，例如：
    - `useSmoothText` 文本平滑渲染钩子。
    - 图片/链接事件与配置类型（`ImageEventData`、`ImageOptions`、`OnImageClickCallback`、`OnLinkClickCallback` 等）。
    - Markdown 渲染结构相关类型（如 `MdBoxParagraphProps`、`MdBoxCodeBlockProps`、`MdBoxTexProps`、`MdBoxTableProps` 等）。
    - Slots 类型（`MdBoxSlots`、`MdBoxSlotsWithRequired`、`MdBoxSlotsWrapper`）。
- [src/lazy/index.ts](frontend/packages/arch/bot-md-box-adapter/src/lazy/index.ts)：
  - 暴露懒加载版组件与工具：
    - `MdBoxLazy` / `MdBoxLazyProps`：`CalypsoLazy` 封装，用于在需要时再加载 Markdown 内容。
    - `ImageStatus`：图片加载状态枚举。
    - `parseMarkdown` / `getTextOfAst`：Markdown 解析与 AST 文本抽取工具。
    - `MdBoxLinkProps`、`LinkType`、`useSmoothText` 等与链接/文本相关的类型与 hook。
- [src/light/index.ts](frontend/packages/arch/bot-md-box-adapter/src/light/index.ts)：
  - 提供轻量渲染版本：`MdBoxLight` / `MdBoxLightProps`（来自 `CalypsoLite`），在对功能要求不高但更关注体积的场景下使用。
- [src/slots/index.ts](frontend/packages/arch/bot-md-box-adapter/src/slots/index.ts)：
  - 只导出 `Image`、`Link` 两个 Calypso 组件，便于在业务侧自定义布局时直接复用。
- [src/style.ts](frontend/packages/arch/bot-md-box-adapter/src/style.ts)：
  - 暴露 `dynamicImportMdBoxStyle`：通过动态 import `@bytedance/calypso/styles.css`，用于在需要时按需加载样式，减小首屏包体并避免多次重复引入。
- [typings.d.ts](frontend/packages/arch/bot-md-box-adapter/typings.d.ts)：
  - 统一补充本包需要的全局类型声明（如有），保持编辑器类型提示友好；新增类型扩展时应优先考虑集中维护在此文件。

## 三、构建、测试与开发流程

- 包管理与脚本：
  - 使用 Rush + workspace 管理依赖，开发前需在仓库根目录执行：`rush install` 或 `rush update`。
  - 在本子包目录下常用 npm scripts（见 [package.json](frontend/packages/arch/bot-md-box-adapter/package.json)）：
    - `npm run build`：当前为 `exit 0` 占位，本包不负责独立打包，真实构建由上层管线统一处理（例如 app 级 bundler）。
    - `npm run lint`：`eslint ./ --cache`，使用 [eslint.config.js](frontend/packages/arch/bot-md-box-adapter/eslint.config.js) 中的 `@coze-arch/eslint-config` 预设（通常为 `web`）。
    - `npm run test`：`vitest --run --passWithNoTests`，测试配置见 [vitest.config.ts](frontend/packages/arch/bot-md-box-adapter/vitest.config.ts)，通过 `@coze-arch/vitest-config` 管理。
    - `npm run test:cov`：在 test 基础上开启覆盖率统计。
- TypeScript 配置：
  - 顶层 [tsconfig.json](frontend/packages/arch/bot-md-box-adapter/tsconfig.json)：
    - `compilerOptions.composite = true`，参与 TS Project References 增量构建。
    - `exclude: ["**/*"]`，实际编译入口交由 tsconfig.build.json 与 tsconfig.misc.json 管理。
  - [tsconfig.build.json](frontend/packages/arch/bot-md-box-adapter/tsconfig.build.json)：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，`rootDir: src`，`outDir: dist`，`moduleResolution: bundler`，`jsx: react-jsx`，适配前端 bundler（如 Vite/Rspack）。
    - references 指向 `@coze-arch/bot-typings`、eslint/stylelint/ts/vitest-config 等内部工具包，保证 TS 构建顺序和类型可见性正确。
  - [tsconfig.misc.json](frontend/packages/arch/bot-md-box-adapter/tsconfig.misc.json)：
    - 覆盖测试文件、配置文件等非产出代码，保证编辑器类型提示一致，不影响产出构建。

## 四、项目特有约定与使用模式

- API 命名与别名：
  - 所有对外 API 均以 MdBox 前缀命名，以区分底层 Calypso 的原始命名，避免业务代码直接耦合第三方库类型：
    - 组件：`MdBox`、`MdBoxLazy`、`MdBoxLight`、`MdBoxImage`。
    - 类型：`MdBoxProps`、`MdBoxImageProps`、`MdBoxParagraphProps`、`MdBoxCodeBlockProps`、`MdBoxTexProps`、`MdBoxTableProps`、`MdBoxIndicatorProps`、`MdBoxLinkProps` 等。
  - 新增从 Calypso 透出的能力时，应沿用这种别名模式，保持调用方一致的命名体验。
- 使用形态：
  - 完整渲染：
    - 在聊天区、知识预览等需要完整 Markdown 能力时，通常使用：
      - `import { MdBox } from '@coze-arch/bot-md-box-adapter';`
    - 或组合 slots：
      - `import { MdBox, MdBoxImage } from '@coze-arch/bot-md-box-adapter/full';`
  - 懒加载渲染：
    - 在需要减轻首屏压力或只在展开详情时才渲染 Markdown 时，使用：
      - `import { MdBoxLazy } from '@coze-arch/bot-md-box-adapter/lazy';`
    - 可同时利用 `parseMarkdown` / `getTextOfAst` 做预处理（例如截取摘要）。
  - 轻量渲染：
    - 在对交互能力要求不高但需展示简单 Markdown 或纯文本时，使用：
      - `import { MdBoxLight } from '@coze-arch/bot-md-box-adapter/light';`
  - 插槽与样式：
    - 当业务需要更细粒度控制图片/链接渲染时，可引入：
      - `import { Image, Link } from '@coze-arch/bot-md-box-adapter/slots';`
    - 按需注入样式：
      - `import { dynamicImportMdBoxStyle } from '@coze-arch/bot-md-box-adapter/style';`
      - 在应用入口或使用前调用 `dynamicImportMdBoxStyle()`，确保 CSS 已加载（如 apps/coze-studio 的入口中所示）。
- React 依赖策略：
  - React/ReactDOM 在本包中仅作为 devDependencies，运行时通过 peerDependencies 由调用方提供（>= 18.2.0），避免重复打包 React。

## 五、与其它子包/应用的集成关系

- 与业务组件的集成：
  - Chat 区域：如 [frontend/packages/common/chat-area/chat-uikit-shared](frontend/packages/common/chat-area/chat-uikit-shared) / reasoning 插件中，使用 MdBox/MdBoxLazy 渲染智能回复中的 Markdown 内容，减少直接依赖 `@flow-web/md-box`。
  - 知识预览：如 [frontend/packages/data/knowledge/common/components](frontend/packages/data/knowledge/common/components) 中的 PreviewMd 等组件，用 MdBox 统一承载 Markdown 与富文本预览，并与 dompurify 等安全过滤策略配合使用。
  - Agent IDE 相关：如 [frontend/packages/agent-ide/model-manager](frontend/packages/agent-ide/model-manager) 下的模型表单组件，会使用 `MdBoxLazy` 作为描述字段的 Markdown 渲染器。
- 与应用入口的集成：
  - [frontend/apps/coze-studio/src/index.tsx](frontend/apps/coze-studio/src/index.tsx) 中显式导入 `dynamicImportMdBoxStyle`，在应用启动时按需拉取 Calypso 样式，避免所有子包重复 import CSS。
- 与 Typings/工具包的关系：
  - 通过 `@coze-arch/bot-typings` 引入 bot 领域的类型；本包不自定义业务结构，只作为 UI 渲染层。
  - eslint/stylelint/ts/vitest-config 仅在配置层使用，本包不直接暴露相关能力。

## 六、工程规范与注意事项

- 版权与头部注释：
  - 所有 TS 源文件统一使用 Apache-2.0 版权声明头部注释，新增文件时需保持一致格式（参考现有 src 下文件）。
- 变更范围控制：
  - 本包主要是「声明与 re-export」，任何改动都可能影响大量依赖 Markdown 渲染的功能；在修改前需：
    - 确认是否只是 Calypso API 的透传变化，还是行为语义上的修改。
    - 搜索整个 frontend 目录中对 `@coze-arch/bot-md-box-adapter` 的引用，评估影响范围。
  - 避免在本包中加入与 UI 无关的业务逻辑（如权限、网络请求），本包职责仅限 Markdown 渲染适配。
- 构建与发布：
  - `build` 为 no-op，类型检查与打包由 monorepo 顶层脚手架（Rush + bundler）统一处理；不要在本包中单独增加打包工具链（如 rollup/webpack 配置）。
  - 若需调整 TS 输出结构（例如从 src 切换到 dist 作为 main/types），应配合同一 monorepo 其他前端包统一设计，而不是单独变更本包。

## 七、对 AI 编程助手的建议

- 扩展导出能力时：
  - 优先通过在对应 `src/*/index.ts` 中增加 Calypso 能力的 re-export 完成，不在此包实现新的渲染逻辑。
  - 保持别名前缀（MdBox*）一致，避免暴露与 Calypso 原始命名混用的 API。
- 调整样式加载策略时：
  - 如需变更 CSS 引入方式（例如拆分主题、按路由加载），应在 [src/style.ts](frontend/packages/arch/bot-md-box-adapter/src/style.ts) 中封装新策略，并在消费方（如 apps/coze-studio）更新调用，而不是在业务包中直接 import Calypso 的 CSS。
- 在调试 Markdown 渲染问题时：
  - 优先查阅 @bytedance/calypso 文档与本包的 re-export 映射，确认是 Calypso 组件行为还是适配层命名/类型问题；
  - 避免在本包内对 Markdown 内容做二次解析或字符串处理，这些工作应在上层业务组件或专门的解析工具包中完成。
