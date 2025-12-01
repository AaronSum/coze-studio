# @coze-agent-ide/workflow-modal 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/workflow-modal）中安全、高效地协作开发。

## 1. 子包定位与整体职责

- 本包提供「Bot 工作流选择弹窗」能力，封装为可复用的 React 组件与自带可控显隐逻辑的 Hook，供 Agent IDE 及相关应用集成。
- 核心导出在 src/index.ts：
  - BotWorkflowModal：带有 Bot 业务逻辑的工作流选择弹窗组件。
  - useBotWorkFlowListModal：封装了状态与路由跳转场景的弹窗控制 Hook，返回可直接渲染的 node 和 open/close 控制函数。
- 该包并不实现工作流选择 UI 的底层通用组件，而是基于 @coze-workflow/components/workflow-modal 做 Bot 业务侧的二次封装与集成。

## 2. 代码结构与主要模块

- 入口文件
  - src/index.ts
    - 仅做导出聚合：从 components/workflow-modal/base 与 components/workflow-modal/hooks 中 re-export 对外 API。
- 业务组件
  - src/components/workflow-modal/base.tsx
    - 依赖 @coze-workflow/components/workflow-modal 暴露的 WorkflowModalBase 与相关枚举/类型（DataSourceType、WorkflowModalFrom、WorkflowModalProps 等）。
    - 结合 Bot 能力：
      - 使用 @coze-arch/bot-studio-store 的 useSpaceStore 获取当前空间 spaceId。
      - 使用 @coze-studio/bot-detail-store/bot-skill 的 useBotSkillStore 获取并更新 workflows（工作流列表）。
      - 使用 @coze-agent-ide/navigate 的 useNavigateWorkflowEditPage 进行工作流编辑页导航。
      - 使用 @coze-arch/bot-utils 的 emitEvent 发送 OpenBlockEvent（自动展开 WORKFLOW/IMAGEFLOW 能力模块）。
      - 使用 @coze-arch/i18n、@coze-arch/coze-design（Toast、Space、Typography、Button）渲染交互提示与操作按钮。
    - 关键回调约定：
      - onWorkFlowListChange：更新 Bot 技能 store 中的工作流列表，并在列表非空时发出能力模块展开事件。
      - onItemClick：
        - DataSourceType.Workflow：进入工作流编辑页，并透传当前弹窗状态（statusStr）到路由参数。
        - 其它类型：打开 workflow 模版详情页，附带 entity_id=ProductEntityType.WorkflowTemplateV2。
      - onCreateSuccess：新建工作流成功后直接跳转到编辑页。
      - onAdd / onRemove：基于 Toast + i18n 提示添加/移除成功，onAdd 在 isDup 为 true 时提供“继续编辑”按钮，打开 /work_flow?space_id=&workflow_id= 页面。
- 业务 Hook
  - src/components/workflow-modal/hooks.tsx
    - 对外导出 useBotWorkFlowListModal，用于在上层页面中注入弹窗能力。
    - 状态来源：
      - useBotInfoStore（@coze-studio/bot-detail-store/bot-info）：读取当前 botID。
      - useBotPageStore（@coze-agent-ide/space-bot/store）：读取上次 Bot ID、默认弹窗显隐状态、并可设置 workflow 相关状态。
      - usePageJumpResponse（@coze-arch/bot-hooks）：获取从工作流或抖音工作流回跳到 Bot 页面的路由场景信息。
    - getInitialVisible：根据以下信息决定初始是否展示弹窗：
      - 当前 botID 与 prevBotID 不一致时强制不展示（避免跨 Bot 残留弹窗状态）。
      - 从 “工作流发布成功回跳 Bot” 场景（WORKFLOW_PUBLISHED__BACK__BOT 等）回来的时候不自动弹出。
      - 从 “工作流编辑回跳 Bot” 场景回来时，仅在 flowMode 一致情况下才复用默认显隐状态，否则强制不展示。
    - 初始 modalState：
      - 在 defaultVisible 为 true 且存在 jumpResponse 时，从 jumpResponse.workflowModalState.statusStr 尝试 safeParse 得到 WorkflowModalState，作为 BotWorkflowModal 的 initState。
    - 显隐与状态同步：
      - useEffect 监听 visible，当弹窗被展示时，会通过 setWorkflowState 将 showModalDefault 重置为 false，避免后续重复默认弹出。
      - 返回的 node 在 visible 时渲染 BotWorkflowModal，并透传 flowMode、from、bindBizId、bindBizType、initState。
    - safeParse：对 JSON 解析进行防御封装，解析失败时返回 undefined（不抛错）。

## 3. 依赖与跨包交互

- 工作流相关
  - @coze-workflow/base：提供 WorkflowMode、BindBizType 等枚举，决定当前处理的是普通工作流还是 Imageflow 等模式。
  - @coze-workflow/components：提供底层 WorkflowModal 组件与相关类型，当前包只负责业务层数据与行为注入。
- Bot 与空间上下文
  - @coze-arch/bot-studio-store：
    - useSpaceStore：读取当前空间空间信息（例如 space.id），用于构造跳转 URL 等。
  - @coze-studio/bot-detail-store：
    - /bot-skill：提供 useBotSkillStore（读写 workflows，含 updateSkillWorkflows）。
    - /bot-info：提供 useBotInfoStore 获取 botID。
  - @coze-agent-ide/space-bot：
    - store：通过 useBotPageStore 获取页面级 workflow 显隐、记录前一个 BotID、写入 workflow 状态。
- 导航与路由
  - @coze-agent-ide/navigate：
    - useNavigateWorkflowEditPage：封装跳转到 workflow 编辑页面的逻辑，支持注入 flowMode 与额外参数（如 statusStr）。
  - @coze-arch/bot-hooks：
    - usePageJumpResponse：用于解析从其它页面回跳的场景（PageType、SceneType），影响弹窗是否默认弹出。
- UI 与国际化
  - @coze-arch/coze-design：Toast、Space、Typography、Button 等基础组件。
  - @coze-arch/i18n：I18n.t 用于获取多语言文案 key（如 workflow_add_list_added_success）。
- 事件总线
  - @coze-arch/bot-utils：
    - emitEvent + OpenBlockEvent：当工作流列表发生修改且不为空时，自动发出能力模块展开事件，区分 WorkflowBlock 与 ImageflowBlock。

在修改或新增逻辑时，应优先沿用上述已有 store、导航、事件、UI/i18n 模块，而不要在本包中重新实现重复能力。

## 4. 构建、测试与本地开发

- 包级命令（在 frontend/packages/agent-ide/workflow-modal 目录内）：
  - 安装依赖由 monorepo 管理，不在子包单独执行 pnpm install；在仓库根目录执行 rush install / rush update。
  - 构建：
    - package.json 中的 build 当前为占位实现（"build": "exit 0"），构建产出通常由上层 Rsbuild/Rush pipeline 统一处理。
  - Lint：
    - npm run lint → 执行 eslint ./ --cache，配置继承 @coze-arch/eslint-config，使用 eslint.config.js 和 tsconfig.json。
  - Test：
    - npm test / npm run test → vitest --run --passWithNoTests。
    - npm run test:cov → 带覆盖率执行测试。
- Vitest 配置
  - vitest.config.ts
    - 使用 @coze-arch/vitest-config.defineConfig，dirname 指向当前目录，preset 为 web，与前端其他包保持一致。
- 其他工具链
  - .stylelintrc.js：继承 @coze-arch/stylelint-config，用于样式规范（本包当前主要是 TSX，无样式文件时可以忽略）。
  - tsconfig.*.json：
    - tsconfig.json：开发与类型检查配置，extends 自 monorepo 统一 TS 配置。
    - tsconfig.build.json / tsconfig.misc.json：用于构建和杂项脚本的 TS 编译配置（当前 build 脚本为占位）。

## 5. 开发约定与模式

- 状态管理
  - 统一使用 Zustand store（useSpaceStore、useBotSkillStore、useBotPageStore 等）管理跨页面/跨组件状态，而不是在本包新建 React Context 或局部 store。
  - 对外只暴露 UI/Hook，不直接暴露内部使用的 store 或事件细节。
- 路由跳转
  - 与工作流相关的所有跳转应通过已存在的 useNavigateWorkflowEditPage 或 window.open 约定的路径和 query 进行，确保行为与其它模块一致：
    - 编辑已有工作流：使用 useNavigateWorkflowEditPage，并携带 statusStr。
    - 从模版创建：window.open(`/template/workflow/${id}?entity_id=${ProductEntityType.WorkflowTemplateV2}`)。
    - 继续编辑重复添加的 workflow：window.open(`/work_flow?space_id=${spaceId}&workflow_id=${workflow_id}`)。
- 弹窗显隐与回跳场景
  - 是否默认展示弹窗由 getInitialVisible 控制，依赖 botID、prevBotID、SceneType 和 flowMode 等信息；
  - 修改相关逻辑时必须考虑：
    - 跨 Bot 切换不应沿用旧 Bot 的弹窗状态；
    - 发布成功或特定回跳场景下不应自动再次弹出；
    - 不同 flowMode 间互不干扰。
- 错误处理
  - JSON 解析等潜在异常通过 safeParse 封装，返回 undefined 即可，不在本包抛出错误或打日志；需要更严格监控时应在上游统一处理。
- UI 与文案
  - 所有用户可见文案（成功提示、按钮文案等）必须通过 I18n.t 获取，对应 key 已存在于上游 i18n 资源中。
  - 使用 @coze-arch/coze-design 提供的组件构建提示内容，不直接使用原生 alert/confirm。

## 6. 与仓库整体流程的关系

- Monorepo 管理
  - 本包受 Rush 管理，依赖版本多为 workspace:*，在根目录通过 rush update 统一升级依赖。
  - 变更本包 API 或行为时，应同步检查依赖该包的 apps 或其它 packages（尤其是 Agent IDE 相关包）的调用方式。
- 测试与 Storybook
  - README.md 提示本包支持 Storybook；相关配置位于 .storybook 目录，可在需要时扩展故事用例，确保 BotWorkflowModal 与 useBotWorkFlowListModal 的典型交互场景可视化验证。
- 分支与发布
  - 仓库整体遵循 Coze Studio 前端约定：
    - 通过 Rush + Rsbuild 统一构建与发布；
    - 包版本、依赖、变更记录由上层流程控制，本包内部不单独管理发布脚本。

## 7. 在本包中进行修改/扩展时的建议

- 若需新增能力：
  - 优先扩展 WorkflowModalProps 的回调或透传字段，而不是在本包重新实现工作流选择逻辑。
  - 对新的行为（例如新增的回跳场景、BindBizType、WorkflowMode）应在 getInitialVisible 和导航逻辑中显式处理。
- 若需调整与其它模块交互：
  - 优先在对应 store（bot-detail-store、space-bot/store 等）或导航工具包（navigate、bot-hooks）中演进，减少在本包硬编码跨域逻辑。
- 在 PR 级别变更前，建议至少：
  - 运行 npm run lint 与 npm test 确保现有约定未被破坏；
  - 在关联的上层应用中手动验证弹窗显隐逻辑、工作流新增/删除/编辑跳转是否符合预期。