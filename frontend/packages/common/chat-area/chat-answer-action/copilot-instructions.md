# @coze-common/chat-answer-action 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/chat-answer-action）中安全、高效地协作开发。

## 一、子包定位与全局架构

- 角色与职责
  - 本子包提供「聊天消息底部操作栏（Answer Action Bar）」能力，是 Chat 区域的 UI/交互子模块之一，负责消息下方的点赞、差评、重新生成、更多操作、删除、复制、引用、Bot 触发配置等按钮及其业务逻辑。
  - 该包归类在 common/chat-area 下，面向多个上层应用复用，不直接依赖具体页面，而是通过 React 组件、hooks 和上下文对外暴露能力。
- 对外入口
  - 统一入口为 [src/index.ts](src/index.ts)，对外导出组件、hooks、上下文和少量 store 类型。
  - 任何新增对外 API（组件、hook、上下文、类型）都应在此集中导出，以保持子包边界清晰。
- 核心组成
  - 组件层：ActionBarContainer、ActionBarHoverContainer、ThumbsUp/FrownUpon（正负反馈）、RegenerateMessage、MoreOperations、DeleteMessage、CopyTextMessage、QuoteMessage 等，均从 [src/index.ts](src/index.ts) 聚合导出。
  - 上下文与状态：AnswerActionProvider、useAnswerActionStore、ReportMessageFeedbackFnProvider/useReportMessageFeedbackFn 等，负责为操作栏提供跨组件共享状态与回调。
  - hooks：useReportMessageFeedback、useReportMessageFeedbackHelpers、useTooltipTrigger、useUpdateHomeTriggerConfig、useDispatchMouseLeave 等，为具体交互行为（反馈上报、tooltip 触发、配置更新、hover 行为）提供复用逻辑。
  - 工具方法：位于 [src/utils](src/utils) 下的 get-show-regenerate.ts、get-show-feedback.ts、get-is-last-group.ts、get-is-pushed-message.ts 等，用于根据消息元信息判断各类按钮的展示与否。
- 与上层聊天系统的关系
  - 本子包通过依赖 @coze-common/chat-area、@coze-common/chat-core、@coze-common/chat-area-utils 等获取 Message/MessageMeta 类型和上下文信息，自己不负责消息列表渲染，只负责「某条消息下方该出现哪些操作按钮、如何交互」。
  - 行为如点赞/差评/重新生成等，通常会触发上层 store 或 API（在 hooks/上下文中封装），本包本身只负责触发与基础 UI 表达。

## 二、目录结构与关键模块

- 根目录
  - [package.json](package.json)：声明 name 为 @coze-common/chat-answer-action，配置脚本（build/lint/test）、依赖与 peerDependencies。注意：build 当前为占位脚本（exit 0），真正打包由上层应用构建体系统一完成。
  - [README.md](README.md)：简单说明功能（“Chat 消息底部的操作按钮功能”）和基本命令，是对外文档入口，新增重要对外 API 时应同步更新。
  - tsconfig*.json：
    - tsconfig.json：基础 TS 配置，继承 @coze-arch/ts-config 预设。
    - tsconfig.build.json / tsconfig.dev.json / tsconfig.misc.json：分别用于构建、开发与工具场景，保持与 monorepo 其他包一致。
  - [vitest.config.ts](vitest.config.ts)：基于 @coze-arch/vitest-config 定义测试配置，preset 为 web，并开启对除 index.ts 外所有文件的覆盖率统计。
  - .storybook/：如 main.js、preview.js 等，用于本子包的 Storybook 场景开发与文档展示（具体故事文件按需新增）。
- src 目录
  - [src/index.ts](src/index.ts)：
    - 统一 re-export 组件、hooks、上下文和部分类型：
      - 组件：ActionBarContainer、ActionBarHoverContainer、ThumbsUp/ThumbsUpUI、FrownUpon/FrownUponPanel 系列、RegenerateMessage、MoreOperations、DeleteMessage、CopyTextMessage、QuoteMessage、AnswerActionDivider、BotTriggerConfigButtonGroup 等。
      - hooks：useReportMessageFeedback、useReportMessageFeedbackHelpers、useTooltipTrigger、useUpdateHomeTriggerConfig、useDispatchMouseLeave。
      - 上下文：AnswerActionProvider、useAnswerActionStore、ReportMessageFeedbackFnProvider、useReportMessageFeedbackFn。
      - store 类型：BotParticipantInfoWithId（来自 store/favorite-bot-trigger-config）。
      - 埋点事件常量：ReportEventNames（来自 report-events）。
  - src/components/
    - 存放各类操作按钮及容器组件：
      - action-bar-container / action-bar-hover-container：承载一条消息下方的操作区域布局，协调具体按钮的展示与 hover 行为。
      - thumbs-up / frown-upon：封装正向/负向反馈按钮与 UI，负向反馈通常还会包含额外面板（FrownUponPanel/FrownUponPanelUI）。
      - regenerate-message：重新生成消息按钮；具体展示逻辑依赖 utils/get-show-regenerate.ts。
      - more-operations：更多操作入口（通常为三点按钮），内含或触发 delete/copy/quote 等次级操作。
      - delete-message / copy-text-message / quote-message：对应删除消息、复制内容、引用消息等具体操作按钮。
      - divider、bot-trigger-config-button-group：操作栏中的分隔符及 Bot 触发配置相关的按钮组。
  - src/context/
    - main：导出 AnswerActionProvider，作为整个 Answer Action 区域的 React 上下文入口，用于注入统一的配置、回调（如反馈上报函数）及共享状态。
    - store：导出 useAnswerActionStore，底层通常使用 zustand + immer 维护操作栏相关状态（如 hover/展开状态、当前选中配置等）。
    - report-message-feedback：导出 ReportMessageFeedbackFnProvider 与 useReportMessageFeedbackFn，用于在应用根/父级注入反馈上报函数，并在子组件内透明消费。
  - src/hooks/
    - useReportMessageFeedback & useReportMessageFeedbackHelpers：封装消息反馈（点赞/差评）上报逻辑，对上层暴露统一的调用接口，内部可能调用埋点/后端 API。
    - useTooltipTrigger：统一 hover/tooltip 的触发与延迟行为，避免各个按钮重复实现 tooltip 控制。
    - useUpdateHomeTriggerConfig：用于更新主页上的 Bot 触发配置，配合 BotTriggerConfigButtonGroup 使用。
    - useDispatchMouseLeave：在特定场景下主动派发 mouseleave，用于修正某些 hover 状态残留问题。
  - src/store/
    - favorite-bot-trigger-config：定义 BotParticipantInfoWithId 等类型及相关 store，管理 Bot 触发配置收藏状态，与 BotTriggerConfigButtonGroup 交互。
  - src/utils/
    - [get-show-regenerate.ts](src/utils/get-show-regenerate.ts)：
      - 入参：message（仅取 type/source）、meta（仅取 isFromLatestGroup/sectionId）、latestSectionId。
      - 逻辑：若为「推送消息」（getIsPushedMessage 返回 true）则不展示；否则仅在「最后一组消息」上展示。
    - [get-show-feedback.ts](src/utils/get-show-feedback.ts)：
      - 入参：message（type/source）、meta（isFromLatestGroup/sectionId/isGroupLastAnswerMessage）、latestSectionId。
      - 逻辑：排除推送消息，仅在「最后一组消息的最终回答」上展示反馈按钮。
    - get-is-pushed-message.ts / get-is-last-group.ts：对 Message/MessageMeta 的判定工具，抽离复用逻辑，避免在组件内散落复杂条件。
  - [src/typings.d.ts](src/typings.d.ts)：补充本包需要的全局类型或模块声明，按照现有模式维护即可。
- 测试目录
  - __tests__/：当前包含 get-show-regenerate、get-show-feedback、get-is-last-group、get-is-pushed-message 等工具函数的单元测试，用于验证按钮展示逻辑在不同消息/分组场景下的正确性。

## 三、开发工作流与命令

- 在仓库根目录
  - 依赖安装/更新：
    - 初始化：`rush install`
    - 更新：`rush update`
  - 前端整体开发可参考 [frontend/README.md](../../../../README.md) 及各应用目录说明。
- 在本子包目录（frontend/packages/common/chat-area/chat-answer-action）
  - Lint：`npm run lint`
    - 使用 eslint.config.js 中的配置，基于 @coze-arch/eslint-config web 预设，配合缓存提升性能。
  - 测试：
    - 单次运行：`npm test` 或 `npm run test`
    - 带覆盖率：`npm run test:cov`
    - 测试框架为 Vitest，配置见 [vitest.config.ts](vitest.config.ts)，preset 为 web，默认对除 index.ts 外所有文件统计覆盖率。
  - 构建：`npm run build`
    - 当前实现只是 `exit 0` 占位，用于满足 Rush/CI 要求；真正的打包产物由上层应用整体构建（例如 Vite/Rsbuild）产出，本包只作为源码依赖参与打包。
- Storybook / 组件开发
  - .storybook/main.js / preview.js 已配置基础 Storybook 环境。
  - 如需新增或调试组件交互，推荐为关键组件（如 ActionBarContainer、ThumbsUp/FrownUponPanel、MoreOperations）补充 Story，以方便可视化验证状态组合与 UI 行为。

## 四、项目约定与编码规范

- TypeScript 与类型
  - 全面使用 TypeScript，继承统一 ts-config 预设；新增公共类型应从对应文件导出并在 [src/index.ts](src/index.ts) 统一聚合（若对外使用）。
  - 避免在组件中直接使用 `any`；在消息相关逻辑中，优先使用 @coze-common/chat-area 与 @coze-common/chat-core 中已有 Message/MessageMeta 类型，并使用 `Pick<>` 精确约束所需字段（现有 utils 已采用该模式）。
- 组件与 hooks 设计
  - 组件职责
    - 单个组件聚焦单一操作：点赞、差评、重生、删除、复制、引用等各自独立，容器组件负责排布与组合，不要在容器中插入大量业务判断。
    - 容器组件（ActionBarContainer/ActionBarHoverContainer）负责：布局、hover/显隐控制、从上下文或 store 获取配置，而不是直接操作消息数据源。
  - hooks 约定
    - 与消息反馈、tooltip、配置更新等相关的复杂逻辑优先下沉到 hook，组件只调用 hook 返回的状态与回调，降低组件复杂度。
    - hooks 如 useReportMessageFeedback 通常会依赖上下文或外部依赖（如埋点、API 调用）；扩展时应保持原有调用签名兼容，必要时通过新增参数对象字段而非修改现有位置参数实现扩展。
- 上下文与 store
  - AnswerActionProvider 必须包裹操作栏相关组件，否则 hooks（如 useAnswerActionStore、useReportMessageFeedbackFn）会异常；引入新组件时，应避免在无 Provider 的环境直接调用这些 hook。
  - store 内部通常使用 zustand + immer；对于需要扩展的状态，优先通过增加字段与 action，而非在组件侧维护临时状态，保持状态统一来源。
- 工具函数与展示逻辑
  - 所有与「是否展示某个按钮」相关的判断逻辑（例如是否最新一组消息、是否推送消息、是否最后一句回答）应集中在 utils 中，搭配单元测试验证，不要在组件中内联长条件表达式。
  - 修改 get-show-*.ts 等工具逻辑时，务必同步更新对应测试文件，覆盖正常与边界场景（如 meta 字段缺失、sectionId 不匹配、推送消息等）。
- 代码风格
  - 遵循 @coze-arch/eslint-config 的 web 规则，不在本包中大规模覆盖默认规则。
  - 组件文件使用 .tsx，工具/类型使用 .ts；命名采用 kebab-case 文件名 + PascalCase 组件名的组合。

## 五、与其他子包及外部依赖的集成

- 与聊天核心能力
  - @coze-common/chat-area：提供消息列表、Message/MessageMeta 类型及部分上下文信息，是 get-show-regenerate/get-show-feedback 等工具的类型来源。
  - @coze-common/chat-core / @coze-common/chat-area-utils：通常提供消息流处理、分组元信息计算等能力；本包通过「元信息 + 判断工具」组合来决定按钮显隐。
- 与 UI 组件与设计体系
  - @coze-common/chat-uikit / @coze-common/chat-uikit-shared：提供 Chat 相关 UI 基础组件和共享样式，本子包的 UI 表达应尽量基于这些组件，而不是自行引入额外 UI 库。
  - @coze-arch/bot-semi、@douyinfe/semi-icons：作为 Semi UI 的封装与图标资源，在操作栏中用于图标按钮显示，扩展组件时优先选择现有图标与样式体系。
- 与工具与状态管理
  - immer：用于在 store 内做不可变更新，避免直接修改 state 引用。
  - zustand：本包通过上下文/自定义 hooks 暴露 store 的读取与更新，避免在组件中直接持有 zustand store 实例。
- 与埋点与上报
  - ReportEventNames：集中定义操作栏相关埋点事件常量，组件或 hooks 在上报时应统一使用该常量，避免硬编码字符串。
  - useReportMessageFeedback / useReportMessageFeedbackFn：统一封装反馈上报流程，当需要新增事件或参数时优先在这些层扩展，而不是在组件中重复发埋点。
  - 与全局埋点系统（例如 @coze-arch/report-events 或类似包）集成应保持兼容：不要在本包中更改事件名语义或维度含义。
- 与 Bot 触发配置
  - BotParticipantInfoWithId 与 useUpdateHomeTriggerConfig、BotTriggerConfigButtonGroup 共同支持「收藏/配置 Bot 触发按钮」相关的交互。
  - 若需要扩展 Bot 配置行为（例如增加新的入口或配置属性），推荐在 store/favorite-bot-trigger-config 与 hooks/use-update-home-trigger-config 中集中实现，再由组件消费。

## 六、测试策略与注意事项

- 测试框架与配置
  - 使用 Vitest 作为单元测试框架，配置通过 [vitest.config.ts](vitest.config.ts) 中的 defineConfig 引入，preset 为 web，适配浏览器环境组件与 hooks 测试。
  - 覆盖率配置：对除 index.ts 外所有文件开启覆盖率统计（`coverage.all = true` 且 `exclude: ['index.ts']`），新增核心逻辑文件时应补充测试以保持整体覆盖率。
- 现有测试内容
  - __tests__/get-show-regenerate.test.ts：覆盖不同消息类型、分组场景下是否展示「重新生成」按钮的逻辑。
  - __tests__/get-show-feedback.test.ts：覆盖仅对「最后一组的最终回答」展示反馈按钮的逻辑。
  - __tests__/get-is-last-group.test.ts、__tests__/get-is-pushed-message.test.ts：针对底层判断工具进行单元测试，确保基础条件变化不影响上层行为预期。
- 扩展测试的建议
  - 对新增的 utils 或复杂 hooks（如 useReportMessageFeedback、useUpdateHomeTriggerConfig）编写单元测试，优先验证：
    - 参数组合下的分支行为（如不同 MessageMeta、不同配置状态）。
    - 与外部依赖（埋点、API）交互时的调用次数与参数。
  - 组件测试可借助 @testing-library/react，关注：
    - 在不同消息/分组/状态下按钮是否出现或禁用。
    - 点击行为是否触发正确的 hook 回调或埋点调用。

## 七、仓库流程与注意事项

- 分支与提交
  - 遵循仓库统一分支流程（参考根目录 CONTRIBUTING.md），在提交信息中标明子包名，例如：`feat(chat-answer-action): add quote button hover delay`。
  - 涉及对外 API 变更（新增导出、修改导出类型、行为变化）时，在 PR 描述中说明影响范围，以便维护者评估版本变更类型。
- 与构建/发布的关系
  - 本包不单独构建发布到 npm，版本管理与发布由 Rush 及顶层流程统一维护。
  - 不要在本包内部引入独立 bundler 配置（如额外的 Vite/Rsbuild 配置文件）；若确有构建需求，应在 frontend 层统一配置。
- 变更影响面评估
  - 本包位于聊天体验关键路径上，任意 UI/逻辑变更都可能影响大量页面：
    - 修改工具逻辑（如 get-show-*）前，应通过测试覆盖主要场景（普通对话、多轮分组、推送消息、草稿等）。
    - 修改上下文/store 结构时，务必保持现有 API 兼容，或采用「新增字段/方法 + 保留旧实现」的渐进方式，并在文档与注释中标记迁移建议。
