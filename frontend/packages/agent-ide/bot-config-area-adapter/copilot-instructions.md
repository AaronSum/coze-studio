# @coze-agent-ide/bot-config-area-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-config-area-adapter）中安全、高效地协作开发。

## 1. 子包定位与全局架构

- 包名：@coze-agent-ide/bot-config-area-adapter，位于 frontend/packages/agent-ide/bot-config-area-adapter。
- 角色：为「Bot 配置区」提供适配层，基于上游 @coze-agent-ide/bot-config-area 的能力，在 Agent IDE 视图中组装模型配置区域与工具菜单等 UI。
- 对外导出（src/index.tsx）：
  - BotConfigArea：完整的右上角 Bot 配置区域（模型配置 + 工具菜单）。
  - SingleAgentModelView：单 Agent 场景下的模型选择视图适配版本（带折叠按钮与模型状态标签）。
- 主要依赖：
  - 领域与状态：@coze-agent-ide/model-manager、@coze-agent-ide/space-bot、@coze-studio/bot-detail-store。
  - 业务 UI：@coze-agent-ide/bot-config-area、@coze-agent-ide/tool、@coze-studio/components、@coze-arch/bot-semi、@coze-arch/coze-design。
  - 基础设施：@coze-arch/bot-api、@coze-arch/bot-typings、@coze-arch/i18n。

## 2. 关键组件与数据流

### 2.1 BotConfigArea（src/bot-config-area.tsx）

- Props：
  - pageFrom?: BotPageFromEnum —— 当前 Bot 详情入口来源（Bot、Space 等），用于控制是否展示变现配置按钮。
  - editable?: boolean —— 目前未在组件内部直接使用，是否可编辑通常由仓库级只读逻辑控制。
  - modelListExtraHeaderSlot?: React.ReactNode —— 透传到模型列表头部的自定义插槽。
- 内部依赖：
  - useBotInfoStore(state => state.mode)：获取 Bot 当前模式（单模型 / 多模型 / 工作流）。
  - useBotDetailIsReadonly()：判断当前 Bot 是否为只读态。
  - useRiskWarningStore：读取/设置工具栏新手引导是否已关闭（toolHiddenModeNewbieGuideIsRead）。
  - PlaygroundApi.UpdateUserConfig：上报关闭新手引导事件，risk_alert_type 使用 RiskAlertType.NewBotIDEGuide。
  - CollapsibleIconButtonGroup：将多个图标按钮（模型配置、变现配置等）收纳为一组可折叠按钮。
  - ModelConfigView：封装模型配置视图（见 2.2）。
  - MonetizeConfigButton：来自 @coze-agent-ide/bot-config-area 的变现配置按钮。
  - ToolMenu：Agent 工具菜单，带新手引导气泡。
- 渲染逻辑：
  - 布局：外围是 flex-1 的右侧区域，使用 Tailwind 类名（flex items-center justify-end gap-[12px] flex-1 overflow-hidden），与 Agent IDE 头部布局保持一致。
  - 始终渲染 ModelConfigView；当 pageFrom === BotPageFromEnum.Bot 且 IS_OVERSEA 为真时额外渲染 MonetizeConfigButton。
  - ToolMenu 展示条件：
    - 非只读：!isReadonly。
    - Bot 模式为单模型或工作流：mode === BotMode.SingleMode 或 BotMode.WorkflowMode。
  - ToolMenu 的新手引导：
    - newbieGuideVisible 由 !toolHiddenModeNewbieGuideIsRead 控制。
    - onNewbieGuidePopoverClose 中：
      - 调用 useRiskWarningStore.getState().setToolHiddenModeNewbieGuideIsRead(true)。
      - 调用 PlaygroundApi.UpdateUserConfig 上报关闭行为。

### 2.2 ModelConfigView（src/model-config-view/model-config-view.tsx）

- 入参：
  - mode: BotMode —— Bot 当前模式。
  - modelListExtraHeaderSlot?: React.ReactNode —— 透传给单 Agent 模型视图。
- 行为：
  - 使用 useGetSingleAgentCurrentModel() 获取单 Agent 当前模型信息。
  - 分支：
    - 单模型模式（BotMode.SingleMode）：
      - 若 currentModel?.model_type 存在，则渲染 SingleAgentModelView，否则返回 null（即在未选择模型前不显示配置入口）。
    - 多模型或工作流模式（BotMode.MultiMode / BotMode.WorkflowMode）：
      - 渲染 DialogueConfigView（来自 @coze-agent-ide/bot-config-area）。
      - 当 mode === BotMode.WorkflowMode 时，向 DialogueConfigView 传入 tips=I18n.t('workflow_agent_dialog_set_desc')，其余模式不展示提示。
    - 其他模式：返回 null（为了类型安全保底）。

### 2.3 SingleAgentModelView 适配（src/model-config-view/single-agent-model-view/index.tsx）

- 本包对上游 SingleAgentModelView 进行 UI 适配：
  - 从 @coze-agent-ide/bot-config-area 引入 SingleAgentModelViewBase 及其 props 类型 SingleAgentModelViewProps。
  - 使用 Collapsible（@coze-studio/components/collapsible-icon-button）包装 triggerRender，使模型按钮在「折叠 / 展开」状态下有不同表现。
- 行为细节：
  - itemKey：基于 Symbol.for('SingleAgentModelView')，用于标识折叠项。
  - triggerRender(m)：根据当前模型 m 渲染 Collapsible：
    - fullContent：
      - Button（coze-design），color="secondary"，data-testid="bot.ide.bot_creator.set_model_view_button"，内容为 ModelOptionThumb + 下拉箭头 IconCozArrowDown。
      - 用于正常模型选择视图，展示完整模型信息（名称、标签等由 ModelOptionThumb 渲染）。
    - collapsedContent：
      - Button（color="secondary"）+ icon 为 Image（bot-semi），src=m?.model_icon；
      - 若 m?.model_status_details?.is_upcoming_deprecated 为真，则在按钮中额外展示 Tag（color="yellow"，文案为 I18n.t('model_list_willDeprecated')）。
      - collapsedTooltip 为 m?.name。
  - 通过 props 透传 modelListExtraHeaderSlot 等配置到 Base 组件，上游负责真正的模型列表与切换逻辑。

## 3. 开发与测试工作流

- 包管理：依赖 Rush + PNPM 工作区，开发前在仓库根目录执行：
  - rush update
- 本子包脚本（package.json）：
  - build："exit 0" —— 仅占位，真实打包由上层构建系统统一处理；本包主要提供源码与类型。
  - lint：eslint ./ --cache —— 使用 eslint.config.js 中的 @coze-arch/eslint-config preset 'web'。
  - test：vitest --run --passWithNoTests。
  - test:cov：npm run test -- --coverage。
- Vitest 配置（vitest.config.ts）：
  - 使用 @coze-arch/vitest-config.defineConfig，preset: 'web'，dirname 指向当前目录。
  - 当前未定义 alias / setupFiles，测试环境行为基本与其他 web 子包一致。
- TypeScript 配置（tsconfig.build.json）：
  - extends: @coze-arch/ts-config/tsconfig.web.json。
  - compilerOptions：
    - outDir: dist；rootDir: src；jsx: react-jsx。
    - moduleResolution: bundler，target: ES2020，lib: ["DOM", "ESNext"]。
  - references：显式依赖 arch 层（bot-api、bot-typings、i18n、配置类包）、agent-ide 相关包（bot-config-area、model-manager、space-bot、tool）以及 studio 子包：
    - 修改跨包依赖或新增 workspace 包引用时，如出现 TS project references 报错，需要同步维护此列表。

## 4. 项目约定与编码风格

- 技术栈：React 18 + TypeScript，函数式组件为主，不引入类组件。
- 样式：
  - 本包自身未定义本地 less/css 文件，布局主要依托上游组件（如 CollapsibleIconButtonGroup、Collapsible）以及 Tailwind 原子类（flex、gap-[12px] 等）。
  - 新增样式时优先通过上游组件 props / className 扩展，确有必要再增加本地样式文件，并在 package.json.sideEffects 中按 monorepo 规范声明。
- 国际化：
  - 文案统一使用 I18n.t(key)：
    - workflow_agent_dialog_set_desc：用于工作流模式下的对话配置提示文案。
    - model_list_willDeprecated：用于模型即将下线的黄色 Tag。
  - 新增文案时需保证：
    - 在相关 arch/studio i18n 包中新增 key；
    - 不在组件内硬编码中文/英文字符串。
- 只读与权限：
  - Bot 是否只读由 useBotDetailIsReadonly() 控制；
  - 组件内部以 isReadonly 决定是否展示 ToolMenu（以及后续可能增加的交互）而不改写上游 store。

## 5. 外部集成与依赖约束

- Bot 信息与模式：
  - useBotInfoStore：从 @coze-studio/bot-detail-store/bot-info 获取当前 Bot 的 mode 等信息。
  - BotMode 来自 @coze-arch/bot-api/playground_api，与后端约定保持一致。
- 空间风险提示：
  - useRiskWarningStore（@coze-agent-ide/space-bot/store）：维护 risk alert 相关本地状态，如 toolHiddenModeNewbieGuideIsRead。
  - PlaygroundApi.UpdateUserConfig：向后端同步「新 Bot IDE 引导已读」状态。
- 工具菜单：
  - ToolMenu 来自 @coze-agent-ide/tool，是 Agent IDE 的通用工具入口；本包仅控制是否展示及新手引导的显隐，不负责内部菜单项定义。
- 模型管理：
  - useGetSingleAgentCurrentModel、ModelOptionThumb 来自 @coze-agent-ide/model-manager，负责读取当前模型与渲染模型项缩略图。
  - SingleAgentModelViewBase、DialogueConfigView、MonetizeConfigButton 来自 @coze-agent-ide/bot-config-area，是上游提供的核心配置 UI，本包只做轻量包装。
- 设计系统与基础组件：
  - Button、Tag、IconCozArrowDown 来自 @coze-arch/coze-design；Image 来自 @coze-arch/bot-semi；Collapsible / CollapsibleIconButtonGroup 来自 @coze-studio/components。
  - 修改 UI 时应尽量复用这些组件，而非引入新的 UI 库。

## 6. 工程流程与协作注意事项

- 构建与产物：
  - build 脚本目前为 no-op，本包不单独产出 bundle，由上层应用或构建链统一处理；不要在本包增加独立 bundler 配置，以免与整体架构冲突。
- 变更范围控制：
  - 对外 API 只有 BotConfigArea 与 SingleAgentModelView，修改其 props 或行为时需检查所有引用点（可在 frontend 下全局搜索包名或组件名）。
  - 对 SingleAgentModelViewBase 的包装应保持「不改变原有语义，只扩展 UI」的原则，避免在适配层中改变模型选择行为本身。
- 测试与回归：
  - 目前 __tests__ 目录仅有占位 .gitkeep；为核心逻辑（如 BotConfigArea 的显示条件、SingleAgentModelView 的折叠渲染）补充 vitest + @testing-library/react 用例是推荐但非强制。
  - 调整风险提示或 ToolMenu 行为时，建议在引用该子包的 Agent IDE 页面中手动验证：
    - 不同 Bot 模式（单模型 / 多模型 / 工作流）。
    - 只读 / 可编辑状态。
    - 首次进入与关闭新手引导后的表现。

## 7. 对 AI 助手的具体建议

- 新增能力时的优先路径：
  - 若是新增模型配置入口或按钮：
    - 优先在 CollapsibleIconButtonGroup 内增加新的子组件（例如新的配置视图按钮），避免在外层 div 中随意扩展布局。
  - 若是调整单模型视图 UI：
    - 尽量在 SingleAgentModelView 适配层中扩展 triggerRender，而不直接修改上游 SingleAgentModelViewBase。
- 修改行为时需注意：
  - 不要在本包中直接依赖 window、document 等全局对象，以保持在测试环境与 SSR 场景下的安全性。
  - 对 PlaygroundApi.UpdateUserConfig、风险 store 等副作用调用保持原有语义；若需新增 risk_alert_type 或配置项，应先在后端 / arch 层定义，再在此处使用。
