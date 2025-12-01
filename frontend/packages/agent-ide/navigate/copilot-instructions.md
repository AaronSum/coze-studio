# @coze-agent-ide/navigate 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/navigate）中安全、高效地协作开发。

## 1. 包定位与全局架构

- 本包是 **Agent IDE 体系中的导航辅助层**，主要职责是：
  - 封装「从 Bot 编辑页跳转到工作流编辑页」相关逻辑；
  - 抽象出可复用的 React Hook：`useNavigateWorkflowEditPage`；
  - 协调 URL 参数、Bot/Space 状态、工作流弹窗状态与页面跳转服务之间的数据流。
- 入口文件位于 [frontend/packages/agent-ide/navigate/src/index.tsx](frontend/packages/agent-ide/navigate/src/index.tsx)：
  - 只导出 `useNavigateWorkflowEditPage`，保持包本身极薄、单一职责。
- 核心逻辑集中在 [frontend/packages/agent-ide/navigate/src/hooks/navigate-tools-page.ts](frontend/packages/agent-ide/navigate/src/hooks/navigate-tools-page.ts)：
  - 对外暴露一个高阶导航函数（返回 `(workflowID, workflowModalState?) => void` 的回调）；
  - 内部依赖多个跨包 store/hook 与导航服务；
  - 依赖上层「空间 Bot 编辑页」与「工作流编辑页」的页面架构，不直接关心 UI 细节。
- 包的依赖关系（简化）：
  - `@coze-agent-ide/space-bot`：当前 Bot 编辑页上下文（当前节点、工作流状态等）。
  - `@coze-studio/bot-detail-store`：Bot 详情信息（包括 `mode`，影响弹窗行为）。
  - `@coze-arch/bot-hooks`：统一的页面跳转服务 `usePageJumpService` 及 `SceneType`、`WorkflowModalState` 类型。
  - `@coze-arch/bot-api`：`BotMode` 枚举，用于区分单 Bot 模式等。
  - `@coze-workflow/components`：`WorkFlowModalModeProps` 类型，用于控制工作流弹窗编辑模式。
  - `react-router-dom`：通过 `useParams<DynamicParams>()` 读取 URL 中的 `space_id`、`bot_id`。

## 2. 目录结构与关键文件

- [frontend/packages/agent-ide/navigate/package.json](frontend/packages/agent-ide/navigate/package.json)
  - `main: "src/index.tsx"`：以 TSX 源码作为入口，具体打包由上层工具链处理。
  - `scripts`：
    - `build`: 当前为 `exit 0`，表示本包构建通常通过 monorepo 统一流程完成；不要随意改为实际构建命令。
    - `lint`: `eslint ./ --cache`，使用 monorepo 统一 ESLint 配置。
    - `test`: `vitest --run --passWithNoTests`，允许无测试文件情况下测试通过。
    - `test:cov`: 在 `test` 基础上开启覆盖率。
  - `dependencies`：
    - 若新增导航能力，应优先复用现有 cross-package 能力（store/hooks/API），避免在本包中引入新的业务依赖；
    - 唯一第三方运行时依赖是 `classnames`，目前未在源码中使用，新增 UI 相关逻辑时可酌情利用或考虑移除多余依赖。
- [frontend/packages/agent-ide/navigate/src/index.tsx](frontend/packages/agent-ide/navigate/src/index.tsx)
  - 仅做导出：`export { useNavigateWorkflowEditPage } from './hooks/navigate-tools-page';`
  - 任何对本包的功能修改几乎都发生在 `hooks/` 下；保持入口文件简洁、无逻辑。
- [frontend/packages/agent-ide/navigate/src/hooks/navigate-tools-page.ts](frontend/packages/agent-ide/navigate/src/hooks/navigate-tools-page.ts)
  - 核心 Hook，签名：
    - `useNavigateWorkflowEditPage(param?: WorkFlowModalModeProps & { newWindow?: boolean; spaceID?: string }, scene?: SceneType)`
    - 返回值：`(workflowID: string, workflowModalState?: WorkflowModalState) => void`。
  - 内部数据流：
    - 从 `useParams<DynamicParams>()` 中读取 `space_id`、`bot_id`（URL 优先）；
    - 同时允许通过 `param.spaceID` 传入空间 ID 作为后备；
    - 使用 `useCurrentNodeId()` 获取当前 Agent / 节点 ID；
    - 使用 `useBotPageStore` 的 `setWorkflowState` 修改工作流弹窗初始状态；
    - 从 `useBotInfoStore.getState()` 读取当前 Bot `mode` 以决定是否设置弹窗状态；
    - 最终通过 `usePageJumpService().jump` 跳转到 `SceneType.BOT__VIEW__WORKFLOW`（或外部传入的 `scene`）。
- [frontend/packages/agent-ide/navigate/tsconfig.json](frontend/packages/agent-ide/navigate/tsconfig.json)
  - `composite: true` 并通过 `references` 指向 `tsconfig.build.json` / `tsconfig.misc.json`，遵循 monorepo 的 TS project references 机制。
  - `exclude: ["**/*"]` 意味着真正的编译配置在子 tsconfig 中；本文件主要参与依赖图与 IDE 支持。
- [frontend/packages/agent-ide/navigate/vitest.config.ts](frontend/packages/agent-ide/navigate/vitest.config.ts)
  - 使用 `@coze-arch/vitest-config` 的统一配置，`preset: 'web'` 说明处于 Web/React 环境。
- [frontend/packages/agent-ide/navigate/eslint.config.js](frontend/packages/agent-ide/navigate/eslint.config.js)
  - 通过 `@coze-arch/eslint-config` 的 `preset: 'web'` 统一前端 Lint 规范。
- 测试目录 [frontend/packages/agent-ide/navigate/__tests__](frontend/packages/agent-ide/navigate/__tests__)
  - 当前仅有 `.gitkeep`，尚未有实际用例；未来若增加逻辑，建议在此目录或 `src/**/__tests__` 内补充 Vitest 测试。

## 3. 核心导航逻辑与模式

- Hook 行为概览（navigate-tools-page.ts）：
  - 在调用 `useNavigateWorkflowEditPage` 时完成依赖注入（store、router、jump 服务等）。
  - 返回的回调在真正需要跳转时被调用，接收：
    - `workflowID`: 目标工作流 ID（必须）；
    - `workflowModalState?`: 页面打开时工作流弹窗的初始状态；
  - 核心逻辑：
    1. 解析 `spaceID`：优先使用 URL 中的 `space_id`，缺失时退回 `param.spaceID`；
    2. 解析 `botID`：来自 URL 中的 `bot_id`，若缺失则为空字符串；
    3. 若 `!workflowID || !spaceID`，直接 `return`（不导航、不报错）；
    4. 当 `useBotInfoStore.getState().mode === BotMode.SingleMode` 时：
       - 使用 `setWorkflowState({ showModalDefault: !!workflowModalState })` 预配置工作流弹窗是否默认打开；
    5. 调用 `jump(scene || SceneType.BOT__VIEW__WORKFLOW, { ...payload })`：
       - payload 包含 `workflowID`, `spaceID`, `botID`, `workflowModalState`, `agentID`, `flowMode`, `newWindow` 等；
       - `workflowOpenMode` 当前显式设置为 `undefined`，留给上层或未来扩展。
- 场景与参数约定：
  - `scene`：
    - 默认使用 `SceneType.BOT__VIEW__WORKFLOW`，代表从 Bot 视角进入工作流视图；
    - 若上层有特殊场景（例如不同入口、A/B 实验），可以通过参数覆盖 scene，但仍复用本 Hook 的参数组装逻辑。
  - `param.flowMode` / `param.newWindow`：
    - 由调用端控制工作流编辑模式与是否在新窗口打开；
    - Hook 只负责透传到 `jump`，不做额外逻辑判断。

## 4. 开发与调试工作流

- 依赖安装
  - 在 monorepo 根目录使用 Rush：`rush update`。
  - 本包没有独立的 `npm install` 流程，遵循前端整体 workspace 管理。
- 日常开发
  - 推荐通过上层应用（如 `@coze-agent-ide/entry` 或相关 app）联调本 Hook，而非在本包内启动独立 dev server。
  - 若需要局部类型检查或编辑体验，直接在 VS Code / IDE 中打开本目录即可。
- 代码检查
  - 在本包内执行：`npm run lint`。
  - 或在 frontend 根目录通过 Rush 方式按需执行（参考 [frontend/README.md](frontend/README.md) 中的说明）。
- 测试
  - 当前无实际用例，但可执行：`npm test` 或 `npm run test:cov` 验证配置是否正常。
  - 如为 Hook 增加复杂逻辑，建议添加 Vitest + React Testing Library 用例，利用已有 devDeps：
    - `@testing-library/react`, `@testing-library/react-hooks`, `@testing-library/jest-dom`。

## 5. 项目约定与实现风格

- Hook 设计
  - 保持 `useNavigateWorkflowEditPage` 为 **纯导航协调层**：
    - 负责整合 URL、store、传入参数，然后调用统一跳转服务；
    - 不直接承担业务校验（如权限、状态机）——此类逻辑应在上层或专门的 service 层完成。
  - 新增导航能力时，应尽量沿用同一模式：
    - 从 router 中取 URL 参数；
    - 从 store 中获取必要上下文；
    - 通过 `usePageJumpService().jump` 或类似统一接口完成跳转。
- 状态管理约定
  - 和 `@coze-agent-ide/space-bot` / `@coze-studio/bot-detail-store` 的交互：
    - 本包只调用其公开的 hook/API（如 `useBotPageStore`, `useBotInfoStore.getState()`），不应直接依赖其内部实现细节；
    - 若需要新增对 store 的操作，优先在对应包中增加 selector / action，再在这里使用。
- 参数优先级
  - **显式约定**：`URL > param` 对于 `spaceID`；
    - 修改相关逻辑时务必保持该优先级不变，避免老链接 / 书签行为被破坏；
    - 可以在注释中补充说明“兼容旧逻辑，URL 优先”。
- 安全防御
  - 若关键参数缺失（如 `spaceID` 或 `workflowID`），当前策略是 **静默返回，不做导航**；
  - 如需改变行为（如抛错、toast 提示），应在调用方或更上层处理，而非在本包内引入 UI 依赖。

## 6. 与外部组件/服务的集成细节

- `usePageJumpService`（来自 `@coze-arch/bot-hooks`）
  - 提供统一的 `jump(scene, payload)` 能力，屏蔽路由实现细节（如 `react-router`、多应用容器等）。
  - 在本包中只需保证：
    - 使用正确的 `SceneType` 常量；
    - payload 字段名与类型与 `bot-hooks` 中约定保持一致。
- `useBotPageStore`（来自 `@coze-agent-ide/space-bot/store`）
  - 用于设置 Bot 编辑页内部的工作流弹窗状态。
  - 当前只使用 `setWorkflowState({ showModalDefault: boolean })`；
  - 若未来 store API 变更，需要同步更新这里的调用方式。
- `useBotInfoStore`（来自 `@coze-studio/bot-detail-store/bot-info`）
  - 通过静态方法 `getState()` 直接读取当前 Bot 信息，而不是 hook 形式；
  - 当前仅依赖 `mode` 字段与 `BotMode.SingleMode` 枚举；
  - 修改时需注意：直接调用 `.getState()` 在 SSR 或极端场景下的可用性，由上层负责保证。
- `useCurrentNodeId`（来自 `@coze-agent-ide/space-bot/hook`）
  - 提供当前 Agent/节点 ID，用于在跳转时携带上下文；
  - 本包仅透传，不对其含义做解释。

## 7. 变更建议与风险控制

- 低风险操作（AI 可放心执行）：
  - 在不改变对外 API 的前提下，对 `useNavigateWorkflowEditPage` 内部实现进行小范围重构（例如提取局部变量、增强类型标注、补充注释）。
  - 增加单元测试覆盖已有行为，前提是严格遵守当前逻辑（尤其是参数优先级和 SingleMode 下弹窗行为）。
  - 文档与注释更新，补充使用示例或行为说明。
- 中高风险操作（除非用户明确要求，否则应避免）：
  - 修改 Hook 的导出名称、参数签名或返回类型；
  - 改变 `spaceID`、`botID`、`workflowID` 缺失时的行为（例如从静默返回改为抛错）；
  - 调整与 `SceneType`、`usePageJumpService` 的集成方式（如改为直接操作路由）；
  - 修改 `package.json` 中依赖版本或入口文件路径，可能影响整个 Agent IDE 的构建与运行。

通过以上信息，AI 编程助手应能够：
- 正确理解本包在 Agent IDE 体系中的「导航协调」角色；
- 在不破坏既有约定的前提下，安全地扩展或重构导航逻辑；
- 快速定位问题来源（URL 参数、store 状态、跳转服务）并给出针对性修改方案。