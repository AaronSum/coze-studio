# @coze-studio/bot-utils 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/bot-utils）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是一个「React 组件 + 工具函数」型子库，当前仅导出 `withSlardarIdButton` 高阶 UI 包装器，用于在任意节点旁增加一枚复制 Slardar 会话 ID 的按钮。
- 顶层入口为 [src/index.tsx](src/index.tsx)，只做命名导出：`export { withSlardarIdButton } from './with-slardar-id-button';`，保证对外 API 收敛、内部实现可重构。
- 核心实现位于 [src/with-slardar-id-button.tsx](src/with-slardar-id-button.tsx)：
  - 通过 `getSlardarInstance().config().sessionId` 读取埋点/日志系统 Slardar 的 sessionId。
  - 使用 `copy-to-clipboard` 将 sessionId 复制到剪贴板；若不存在则复制空字符串。
  - 使用 `@coze-arch/coze-design` 提供的 `Button` 和 `Toast.success` 渲染按钮并展示复制成功提示。
  - 使用 `@coze-arch/i18n.I18n.t` 读取文案键：`copy_session_id` 与 `error_id_copy_success`，避免在组件内写死文案。
- 数据流简要说明：
  - 视图层（调用方传入的 `ReactNode`） → 被包装在一层容器 `div` 中。
  - 行为层：点击按钮 → 读取 Slardar 实例配置 → 派发复制与 Toast → 不直接与后端交互，仅依赖全局 logger/i18n/UI 体系。
- 该子包不持有全局状态，也不直接管理路由，只负责在现有页面中插入易用的「复制会话 ID」操作，属于 Studio 侧调试/排障辅助工具。

## 代码结构与重要文件

- [package.json](package.json)
  - `name: "@coze-studio/bot-utils"`，版本当前为 `0.0.1`，类型为前端工具/组件包。
  - `main: "src/index.tsx"`，当前构建脚本 `build` 只是占位（`exit 0`），实际产物由上层 Rush/构建体系统一处理。
  - `scripts`：
    - `lint`: `eslint ./ --cache`。
    - `test`: `vitest --run --passWithNoTests`。
    - `test:cov`: `npm run test -- --coverage`。
- 源码与类型：
  - [src/index.tsx](src/index.tsx)：公共导出入口，新增导出请从此处集中暴露，保持 API 清晰。
  - [src/with-slardar-id-button.tsx](src/with-slardar-id-button.tsx)：当前唯一业务组件实现。
  - [src/typings.d.ts](src/typings.d.ts)（如后续扩展类型时，应集中放在此处或按功能拆分独立 `*.d.ts`）。
- 测试与配置：
  - [__tests__/with-slardar-id-button.test.tsx](__tests__/with-slardar-id-button.test.tsx)：
    - 使用 `vitest` + `@testing-library/react` 进行组件交互测试。
    - 全量 mock 外部依赖（logger、i18n、设计体系组件、剪贴板），确保测试可在 Node 环境独立运行。
    - 覆盖点包括：渲染结构、按钮 props、点击行为（调用顺序与参数）、会话 ID 为空时的降级逻辑、i18n key 是否被正确使用。
  - [vitest.config.ts](vitest.config.ts)：调用 `@coze-arch/vitest-config` 的 `defineConfig`，`preset: 'web'`，统一继承集团前端测试规范。
- 工程与工具：
  - [config/rush-project.json](config/rush-project.json)、[config/rushx-config.json](config/rushx-config.json)：将该包接入 monorepo 的 Rush 工程体系，定义别名、脚本映射等（遵守全局配置约定即可）。
  - [eslint.config.js](eslint.config.js)、[.stylelintrc.js](.stylelintrc.js)：继承 `@coze-arch/eslint-config`、`@coze-arch/stylelint-config`，统一代码风格与样式规范。
  - [.storybook/*.js](.storybook)：Storybook 配置文件，便于本包组件作为独立 story 进行交互演示与开发。

## 开发与调试工作流

- 依赖安装（全局由 Rush 管理）：
  - 在仓库根目录执行：`rush update`（见根级 README 与本包 [README.md](README.md) 中的 `init` 指令）。
- 在本包内常用命令（通过 `pnpm`/`npm` 运行）：
  - `npm run lint`：按 monorepo eslint 规则检查当前包下所有 TS/TSX/JS 文件。
  - `npm test`：运行 vitest 单测；`--passWithNoTests` 确保即使暂时没有测试也不会导致流水线立即失败。
  - `npm run test:cov`：在上述基础上生成覆盖率报告。
  - `npm run dev`：虽然 README 提到，但当前 `package.json` 中未定义此脚本；实际开发时通常通过上层应用或 Storybook 启动调试，添加 dev 脚本需遵循 monorepo 统一规范。
- 调试方式建议：
  - 若需要在真实页面环境中验证 `withSlardarIdButton` 的交互效果，应在引用该包的上层应用（如 studio 前端 app）中挂载，并确保全局 `@coze-arch/logger` 已正确初始化 Slardar 实例，同时保证 i18n 与设计体系已注入。
  - 若只需验证交互逻辑，推荐以单元测试和 Storybook story 为主，不在此包内新增复杂的手写 demo 页面。

## 项目特有约定与模式

- 组件职责与形式：
  - `withSlardarIdButton(node: ReactNode)` 返回一个 JSX 元素，而不是一个真正意义上的 HOC（即不接收组件、而是接收已构造好的节点）。
  - 调用方通常直接写 `withSlardarIdButton(<YourNode />)`，不要期望它返回可复用的 React 组件类型。
- UI 与样式风格：
  - UI 统一使用 `@coze-arch/coze-design` 的 `Button`、`Toast` 等组件，而非直接使用原生 `<button>`、`alert`。
  - 布局类名采用 Tailwind 风格的原子类字符串（例如 `flex flex-row justify-center items-center`、`ml-[8px]`），与 monorepo 其他前端包保持一致。
- 国际化约定：
  - 所有用户可见文案通过 `I18n.t(key)` 获取，禁止在组件中直接写死文案。
  - 当前逻辑依赖 i18n key：`copy_session_id` 与 `error_id_copy_success`，若新增功能需要文案，请先在全局 i18n 资源中注册相应 key，再在组件内引用。
- 日志与监控集成：
  - 会话 ID 来源于 `@coze-arch/logger` 中的 `getSlardarInstance().config().sessionId`。
  - 组件不对 logger 的初始化负责，只假设在运行时有可用的 Slardar 实例；若拿不到实例或 sessionId，则退化为复制空字符串，但仍会弹出成功提示。
- 测试风格：
  - 使用 `@testing-library/react` 做行为驱动测试：通过 `screen.getByTestId`、`fireEvent.click` 等验证 DOM 与行为，而非依赖内部实现细节。
  - 对外部依赖一律使用 `vi.mock`，避免真实网络/监控/剪贴板调用。
  - 断言不仅包括「被调用」，还包括「调用参数正确」，例如复制的字符串、Toast 的提示文本等。

## 外部依赖与集成说明

- `@coze-arch/coze-design`
  - 提供 `Button` 与 `Toast` 等 UI 基础设施。
  - 在本子包中视为稳定 API，只通过 props 配置尺寸（`size="small"`）、颜色（`color="primary"`）与 className（`ml-[8px]`）。
- `@coze-arch/i18n`
  - 暴露 `I18n` 单例，采用 `I18n.t(key)` 的调用方式。
  - 组件不关心当前语言，只依赖 key → 文案解析。
- `@coze-arch/logger`
  - 暴露 `getSlardarInstance` 以获取 Slardar 客户端实例。
  - 本组件只读取 `config().sessionId`，不负责上报或埋点。
- `copy-to-clipboard`
  - 用于将字符串复制到系统剪贴板。
  - 由于在测试环境中无法直接访问真实剪贴板，单测通过 `vi.mock('copy-to-clipboard')` 模拟其行为。

## 项目流程、分支与发布

- 代码所有权与评审：
  - 依据根仓库 [.github/CODEOWNERS](../../../../.github/CODEOWNERS) 配置，`/frontend/packages/studio/bot-utils/` 目录的默认评审人包括 Studio 相关负责人（如 @catee @soonco @Hezi-crypto）。
  - 在自动生成/修改文件（如本说明）时，应避免大范围格式化无关文件，以便评审聚焦于实际逻辑变更。
- 分支与 CI：
  - 本子包遵循仓库统一的分支策略与 CI 流水线，无单独的发布流程描述；CI 中通常会执行 Rush 脚本、lint 与 vitest。
  - 若新增导出或对外行为发生变化，应配合上层应用或公共文档进行同步说明，以免下游使用方出现编译或运行时错误。

## 特色与注意事项

- 这是一个体量很小、但依赖上游基础设施（logger/i18n/UI 体系）的「胶水型」包：
  - 重点在于组合已有能力，而非实现复杂业务逻辑。
  - 任何新增能力都应避免在此处硬编码环境假设，而应继续通过依赖注入或全局单例读取。
- 在扩展时的建议（AI 助手需要特别遵守）：
  - 若新增类似的调试/排障工具组件，应放在本包或同类 `*-utils` 包中，并复用 `@coze-arch/*` 体系的基础能力。
  - 遵守现有测试风格：为每个新增组件/函数编写 vitest + testing-library 单测，并 mock 所有外部依赖。
  - 不要在本包内引入新的全局单例或复杂状态管理库，保持其为「纯 UI/工具层」。
