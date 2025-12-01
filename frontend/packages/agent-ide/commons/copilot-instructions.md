# agent-ide-commons 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/commons）中安全、高效地协作开发。

## 全局架构与角色定位

- 本子包提供 Agent IDE 场景下的通用能力，当前主要包括：
  - Diff 结果渲染组件：`src/components/diff-node-render`，用于展示配置 / 文本等的差异。
  - 发布协议条款服务组件：`src/components/term-service`，封装与发布条款相关的交互逻辑。
  - Diff 相关埋点 hooks：`src/hooks/use-send-diff-event`，统一对外暴露 Diff 埋点发送入口。
  - 通用工具方法：`src/utils`，如埋点发送、时间格式化等。
  - Diff 表格缩进常量：`src/constants`，用于保证 Diff 视图缩进逻辑在各处一致。
- 对外唯一入口为 `src/index.ts`，集中 re-export 公共 API；新增导出能力时必须从该文件暴露，保持对外接口稳定。
- 子包大量依赖上游 workspace 包（如 `@coze-arch/bot-api`、`@coze-arch/bot-studio-store`、`@coze-arch/i18n` 等）来获取业务数据、状态和国际化文案，本包本身不直接发起网络请求，而是基于这些依赖提供的能力做 UI 渲染与事件上报。
- 数据流通常为「上层应用/Store → 传入 props 或调用 hooks → 使用工具函数/常量处理 → 组件展示 & 埋点上报」，本包尽量保持无副作用和无全局状态，便于复用与测试。

## 源码结构概览

- `src/index.ts`
  - 唯一公共导出入口，当前导出：`DiffNodeRender`、`PublishTermService`、`useSendDiffEvent`、`sendTeaEventInBot`、`transTimestampText`、`DIFF_TABLE_INDENT_BASE`、`DIFF_TABLE_INDENT_LENGTH`。
  - 新增模块时，请在此进行命名导出，避免默认导出。
- `src/components/diff-node-render/`
  - 负责渲染差异内容，通常接收上层传入的 diff 数据结构（来自 `@coze-arch/bot-api` / 其他数据包）。
  - 使用 `src/constants` 中的缩进常量控制行缩进层级，保持 UI 一致性。
  - 可能依赖 `classnames`、`dayjs` 等第三方库做样式组合和时间处理。
- `src/components/term-service/`
  - 对发布条款、使用协议等相关的交互进行封装，例如弹窗、确认按钮、状态同步等。
  - 与 `@coze-arch/i18n` 协作，使用项目统一的 i18n 文案管理方式。
- `src/hooks/use-send-diff-event.ts`
  - 自定义 React Hook，用于在 Diff 相关操作触发时向埋点系统上报事件。
  - 内部会调用 `src/utils` 中的埋点工具函数，并依赖 `@coze-arch/bot-tea` / 相关埋点 SDK。
- `src/utils/index.ts`
  - 对外导出 `sendTeaEventInBot`、`transTimestampText` 等工具：
    - `sendTeaEventInBot`：封装埋点上报逻辑，统一埋点事件名、公共参数（如 botId、spaceId、userId）等。
    - `transTimestampText`：负责时间格式转换，保证 Agent IDE 中时间展示格式一致。
- `src/constants/index.ts`
  - 定义 Diff 相关的布局常量，目前至少包括 `DIFF_TABLE_INDENT_BASE` 与 `DIFF_TABLE_INDENT_LENGTH`。
  - 新增常量时请避免与业务强绑定，保持「通用 UI 语义」。
- `typings.d.ts`
  - 存放本包内局部使用的类型补充声明（如全局模块声明等），减少对外部 tsconfig 的侵入。

## 构建、测试与调试流程

- 包管理
  - 项目整体使用 Rush + PNPM monorepo 管理；本子包通过 `workspace:*` 引用其他内部包。
  - 在仓库根目录执行依赖安装：`rush install` 或 `rush update`。
- 构建
  - 本包 `package.json` 中的 `build` 脚本当前为占位实现：`"build": "exit 0"`，实际产物构建由上层 Rsbuild 统一处理。
  - 如需在本包添加独立构建流程（例如 Storybook 或按需打包），需同步更新 `build` 脚本并保证与 monorepo 构建规范兼容。
- 测试
  - 使用 Vitest 作为单元测试框架，集中配置在 `vitest.config.ts` 与上游 `@coze-arch/vitest-config`。
  - 常用命令：
    - `npm test` / `npm run test`：`vitest --run --passWithNoTests`，适合 CI 场景。
    - `npm run test:cov`：在上面基础上开启覆盖率统计。
  - 测试文件存放在 `__tests__/` 目录中，遵循 Vitest 默认测试文件命名约定。
- Lint & Style
  - ESLint：使用 `eslint.config.js` 配合上游 `@coze-arch/eslint-config`，执行 `npm run lint`。
  - Stylelint：使用根目录 `.stylelintrc.js` 与上游 `@coze-arch/stylelint-config`，多用于 CSS / Less / Tailwind 类样式文件。
  - TypeScript：`tsconfig.json` 仅负责组合引用 `tsconfig.build.json`、`tsconfig.misc.json`；具体编译选项由上层统一管理。
- Storybook
  - 根目录下存在 `.storybook/` 配置，本包可通过 Storybook 查看和调试组件。
  - 具体启动命令通常在上层 app 或 workspace 统一管理，如需在本包单独运行 Storybook，请参考同层其他包的使用方式。

## 项目特有的约定与模式

- 命名与导出
  - 统一使用命名导出，不使用默认导出，便于 Tree-Shaking 与 IDE 自动补全。
  - 对外 API 必须通过 `src/index.ts` 暴露，避免直接从内部路径引用，降低重构成本。
- 组件设计
  - 组件视为「薄 UI 层」，业务状态和数据结构由上游 Store 或 hooks 提供，本包组件尽量保持无本地复杂状态。
  - Diff 展示组件（`DiffNodeRender`）依赖传入的结构化 diff 数据，不在内部自行计算 diff。
  - 发布条款组件（`PublishTermService`）封装了交互流程，但不直接处理网络请求，只通过回调 / store 更新与外界沟通。
- Hooks 使用
  - `useSendDiffEvent` 只负责组织埋点数据并调用埋点工具，不直接持有 UI 状态。
  - 在使用 Hook 时，建议在外层组件中控制调用时机（如在事件回调中触发），避免在渲染期间产生副作用。
- 工具与时间处理
  - 所有与时间展示相关的逻辑统一使用 `transTimestampText`，禁止在组件中直接使用 `dayjs().format(...)` 等格式化，以避免格式不一致。
- 常量管理
  - 与布局 / 视觉有关但会被多处复用的常量放入 `src/constants/index.ts`，不要在组件内部硬编码重复 Magic Number。

## 外部依赖与集成细节

- `@coze-arch/bot-api`
  - 提供与 Agent / Bot 相关的 API 类型定义和调用封装，本包通常只使用类型与 DTO 定义，不直接发请求。
- `@coze-arch/bot-studio-store` 与 `@coze-studio/bot-detail-store`
  - 存放 Bot 相关的前端状态（如当前编辑的 Bot、配置详情等），本包通过 props 或 hooks 间接依赖这些 store，不在内部 new store。
- `@coze-arch/bot-tea`
  - 事件埋点 SDK，配合 `sendTeaEventInBot` 使用，负责统一上报 Diff、配置修改、发布流程等关键操作的埋点。
- `@coze-arch/i18n`
  - 国际化支持，组件与 hooks 中不应硬编码文案，统一从 i18n 包或上层传入文案 key。
- `@coze-arch/coze-design` / `@coze-arch/bot-semi`
  - 内部 UI 组件库，Diff 视图、弹窗、按钮等应使用这些组件而非直接 HTML，保持整体风格一致。
- `react-router-dom`
  - 仅在需要对路由信息做判断时会从中获取路径或参数，本包不负责路由注册。
- `dayjs`
  - 用于时间计算与格式化，请通过 `transTimestampText` 之类的工具方法间接使用。

## 团队流程与协作规范

- 代码组织
  - 新增组件 / hooks / 工具时，请优先放入现有目录（`components`、`hooks`、`utils`、`constants`），保持结构扁平清晰。
  - 若出现跨多个上层应用均需要的通用能力，再考虑抽象到更上游的 `@coze-arch` 或 `@coze-common` 包，而不是在多个包中复制逻辑。
- 提交流程
  - 提交前建议本地执行：`npm run lint && npm test`，确保基础质量。
  - 保持导出接口的向后兼容性；如需破坏性修改，应在提交说明与上层调用方中明确同步。
- 分支与发布
  - 整体遵循仓库统一的 Rush / CI 流程；具体发布节奏、分支策略通常在仓库根部文档中约定，本包不单独维护发布脚本。

## 开发注意事项与易踩坑

- 避免跨包「深引用」
  - 不要从其他包的内部路径（如 `@coze-arch/bot-api/dist/...`）直接导入，只使用它们在各自 `index.ts` 导出的 API。
- 注意埋点字段规范
  - 使用 `sendTeaEventInBot` 时，遵循已有事件字段命名与枚举值约定，避免在本包随意新增不兼容字段；如确需新增，请与埋点负责人对齐。
- 保持无副作用导入
  - `src/index.ts` 和各子模块应避免在文件加载阶段产生副作用（如立即执行埋点、异步请求等），以免影响 Tree-Shaking 和 SSR。
- TypeScript 严格模式
  - 遵守 workspace tsconfig 中的严格检查要求，尤其是在对外导出类型时，尽量显式声明接口和返回值类型，避免 `any`。
