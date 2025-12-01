# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/workflow-as-agent-adapter）中安全、高效地协作开发。

## 全局架构与职责

- 本包对应 npm 名称 `@coze-agent-ide/workflow-as-agent-adapter`，位于 frontend/packages/agent-ide/workflow-as-agent-adapter，是 Agent IDE 里「将 Workflow 以工具/卡片形式接入」的适配层。
- 当前实现极精简：
  - 入口在 [frontend/packages/agent-ide/workflow-as-agent-adapter/src/index.ts](frontend/packages/agent-ide/workflow-as-agent-adapter/src/index.ts)，仅导出 `WorkflowCard` 组件。
  - `WorkflowCard` 定义在 [frontend/packages/agent-ide/workflow-as-agent-adapter/src/components/workflow-card/index.tsx](frontend/packages/agent-ide/workflow-as-agent-adapter/src/components/workflow-card/index.tsx)，是对 `@coze-agent-ide/workflow-item` 提供的 `WorkFlowItemCozeDesign` 的一层业务包装。
- 核心职责：
  - 为 Agent 编辑器中的「工作流作为工具」场景提供统一的卡片 UI 与操作插槽（目前仅集成复制按钮）。
  - 隐藏 `WorkFlowItemCozeDesign` 的部分复杂参数，让上层仅关心 `botId` / `workflow` / `onRemove` / `isReadonly` 这几个关键业务字段。

## 组件与数据流

- `WorkflowCardProps`：
  - `botId: string`：当前 bot 的 ID，**当前实现未使用**，但预计用于未来扩展（埋点、路由、上下文等），调用方应传入真实 botId，避免后续扩展时需要大规模改动调用处。
  - `workflow: WorkFlowItemType`：单个工作流实体，类型来自 `@coze-studio/bot-detail-store`，需与该包保持版本/字段对齐。
  - `onRemove: () => void`：移除该 workflow 的回调，透传给 `WorkFlowItemCozeDesign` 的 `removeWorkFlow` 属性。
  - `isReadonly: boolean`：是否为只读视图，控制底层卡片可编辑性。
- 组件内部渲染：
  - 使用 `WorkFlowItemCozeDesign`，参数：
    - `list={[workflow]}`：当前只渲染单个 workflow，封装成数组传入，沿用 workflow-item 的列表接口形式。
    - `removeWorkFlow={onRemove}`、`isReadonly={isReadonly}`、`size="large"`：直传业务属性。
    - `renderActionSlot`：通过 render prop 注入右侧操作区，仅负责渲染复制按钮：
      - `ToolItemActionCopy` 来自 `@coze-agent-ide/tool`，tooltip 文案通过 `I18n.t('Copy')` 获取；
      - 点击时调用 workflow-item 提供的 `handleCopy(name ?? '')`，其中 `name` 来源于 workflow 数据。
      - `data-testid` 固定为 `bot.editor.tool.workflow.copy-button`，用于测试与自动化选择器。
- 数据流总结：
  - 上层传入 `workflow` → `WorkFlowItemCozeDesign` 渲染主内容 → 通过提供的 `handleCopy` 与 `removeWorkFlow` 实现复制/删除 → `WorkflowCard` 只注入「复制」动作，其它操作由 workflow-item 自身处理。

## 构建、测试与开发工作流

- 包管理与构建：
  - 依赖 monorepo Rush 管理，先在仓库根目录执行 `rush update` 安装依赖。
  - 本包 `package.json` 中：
    - `build`: `exit 0` —— **当前无独立构建产物**，真实构建由上层统一工具链完成（如 rsbuild / app 级打包），不要在本包内新增私有 bundler 流程。
    - `lint`: `eslint ./ --cache`，规则来自 `@coze-arch/eslint-config`（web 预设）。
    - `test`: `vitest --run --passWithNoTests`，配置在 `vitest.config.ts`（通过 `@coze-arch/vitest-config`），`test:cov` 在其基础上增加覆盖率统计。
- TypeScript 配置：
  - [frontend/packages/agent-ide/workflow-as-agent-adapter/tsconfig.json](frontend/packages/agent-ide/workflow-as-agent-adapter/tsconfig.json) 仅作为 composite 入口，`exclude: ["**/*"]`，实际编译由 `tsconfig.build.json` 与 `tsconfig.misc.json` 驱动。
  - 上层构建时会使用 `tsconfig.build.json`（继承 `@coze-arch/ts-config`），保证与其它前端子包一致的 TS 行为。

## 依赖与集成关系

- 直接依赖：
  - `@coze-agent-ide/tool`：提供 `ToolItemActionCopy` 等工具区组件，这里用于渲染复制按钮，应保持交互与样式与其他工具卡片一致。
  - `@coze-agent-ide/workflow-item`：提供 `WorkFlowItemCozeDesign`，是真正承担「工作流卡片渲染」的组件，包含缩略信息、图标、状态等。
  - `@coze-studio/bot-detail-store`：提供 `WorkFlowItemType` 类型，调用方在构造 workflow 数据时需要与该 store 的字段对齐（如 name、id、状态等）。
  - `@coze-arch/i18n`：提供 `I18n.t`，统一 Copy 文案；如需新增动作时，应使用对应 i18n key，而不是直接写死字符串。
  - `classnames`：当前实现未使用，保留用于未来样式组合扩展。
- React 依赖：
  - 通过 peerDependencies 声明 `react` / `react-dom` >= 18.2.0，本包内部仅使用函数式组件与 `FC` 类型，无自定义 hooks。

## 项目约定与扩展建议

- 入口导出规范：
  - 对外仅从 [src/index.ts](frontend/packages/agent-ide/workflow-as-agent-adapter/src/index.ts) 导出 `WorkflowCard`，新增导出时务必一并更新该文件，避免调用方从内部路径引用。
- 属性与行为扩展：
  - 若未来需要在工作流卡片中增加更多操作（如「在工作流编辑器打开」「设为默认」「解绑」等），应优先：
    - 在 `renderActionSlot` 内扩展渲染逻辑，或
    - 在 `@coze-agent-ide/workflow-item` 提供更丰富的 action 插槽，并在此包中进行轻量组合，
    - 同时补充对应 i18n key 与测试用 `data-testid`。
  - 若 `botId` 需要参与行为（如跳转到 bot 工作流详情），建议通过新的 props/回调自上而下传递，不要在组件内部访问全局 store。
- 风格与测试：
  - 保持与 `@coze-agent-ide` 系列其它包一致的 ESLint/TS 配置，不新增本地风格例外。
  - 若为 `WorkflowCard` 增加交互逻辑（如禁用状态、loading 态），应结合 `@testing-library/react` 在本包内补充 Vitest 单测，并复用现有 `data-testid` 约定。

## 特殊/易忽视点

- 构建脚本为 no-op：
  - 本包不会单独产生 dist 目录，所有消费方通常直接从源码入口（`src/index.ts`）经由上层 bundler 编译；AI 修改构建相关配置时，应从 monorepo 顶层/应用级配置入手，而不是在此包引入新的打包工具。
- `botId` 当前未使用：
  - 虽然在 props 中声明了 botId，但实现未消费该字段；**不要**在调用方省略或传假值，以免后续扩展时需要大面积修改。
- 所有业务逻辑都在 workflow-item / tool 等依赖中：
  - 本包刻意保持「极薄适配层」，任何复杂业务（过滤、排序、权限控制）都应在上层或依赖包中实现，本包仅负责注入 workflow-as-agent 场景特有的默认 UI 组合。
