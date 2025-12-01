# @coze-agent-ide/bot-config-area 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-config-area）中安全、高效地协作开发。

## 全局架构与职责边界

- 包名：@coze-agent-ide/bot-config-area，对应 Agent IDE 中「机器人配置区域」的一组业务组件，主要作为上层应用或 adapter 包的 UI 能力提供方。
- 入口文件为 src/index.ts，对外统一导出：
  - ModelConfigView / DialogueConfigView / SingleAgentModelView：模型配置视图相关组件；
  - MonetizeConfigButton / MonetizeConfigPanel：变现配置入口按钮与弹窗面板；
  - QueryCollect：用户查询收集（隐私政策配置）弹窗组件；
  - SingleAgentModelViewProps：单 Agent 模型视图的 props 类型。
- 子目录职责：
  - src/model-config-view：与机器人模型配置相关的视图组合与模式切换；
  - src/monetize-config：针对 Bot 的变现开关、额度与刷新周期配置；
  - src/query-collect：用户查询收集开关、隐私协议链接、模板生成与校验逻辑；
  - src/typings.d.ts：本包局部声明（如全局常量）补充。
- 本包本身不直接发起复杂业务流，而是围绕已有上下文 store 与后端 API（bot-detail-store、space-bot hooks、benefitApi 等）提供侧边按钮和弹窗式配置入口。

## 代码结构与数据流

- ModelConfigView（src/model-config-view/model-config-view.tsx）：
  - 根据 BotMode（SingleMode / MultiMode / WorkflowMode）在三种模型配置视图间切换：
    - SingleMode：当 useGetSingleAgentCurrentModel() 返回的 currentModel.model_type 存在时，渲染 SingleAgentModelView，否则不展示；
    - MultiMode / WorkflowMode：渲染 DialogueConfigView，并在 WorkflowMode 下传入说明文案 I18n.t('workflow_agent_dialog_set_desc') 作为 tips；
    - 其它模式返回 null。
  - 组件仅负责根据模式路由到具体视图，不处理具体表单字段与存储逻辑。
- DialogueConfigView（src/model-config-view/dialogue-config-view/index.tsx）：
  - 通过 Popover + CollapsibleIconButton 组合实现「对话配置」按钮与弹出面板：
    - 按钮 icon 使用 IconCozChatSetting，文案 workflow_agent_dialog_set；
    - data-testid 固定为 "bot.ide.bot_creator.set_model_view_button"，用于自动化测试定位。
  - 面板内容（内部组件 DialogueConfig）：
    - 从 useModelStore 读取并通过 setModelByImmer 修改模型配置，具体更新 config.ShortMemPolicy.HistoryRound；
    - 使用 ModelFormItem + InputSlider 呈现记忆轮数（history round）滑条，I18n 文案键 model_config_history_round / model_config_history_round_explain 等；
    - tips 作为可选富文本说明区域插入在标题下方。
- MonetizeConfigPanel（src/monetize-config/panel/index.tsx）：
  - 负责配置 Bot 变现开关与免费对话额度，内部数据来源：
    - useBotInfoStore 获取当前 botId；
    - useMonetizeConfigStore 读取 isOn / freeCount / refreshCycle 并提供 setXxx 更新方法；
    - useMonetizeConfigReadonly 从 space-bot hook 判断当前是否只读。
  - 使用 ahooks.useDebounceFn 包装 debouncedSaveBotConfig，在 300ms 内合并多次更新并调用 benefitApi.PublicSaveBotDraftMonetizationConfig：
    - entity_id: botId，entity_type: MonetizationEntityType.Bot；
    - is_enable / free_chat_allowance_count / refresh_period 从本地状态传入。
  - UI 组合：
    - MonetizeSwitch：控制是否开启变现；
    - MonetizeDescription：根据 isOn 展示说明文案；
    - MonetizeFreeChatCount：配置免费对话次数；
    - MonetizeCreditRefreshCycle：配置额度刷新周期，受 isOn、isReadonly、freeCount <= 0 共同控制 disabled 状态。
- MonetizeConfigButton（src/monetize-config/button/index.tsx）：
  - 以 Popover 包裹 CollapsibleIconButton：点击后展示 MonetizeConfigPanel；
  - 按钮文案按 isOn 切换 monetization_on / monetization_off，颜色在 'highlight' 与 'secondary' 间切换，icon 为 IconCozWallet；
  - itemKey 使用 Symbol.for('MonetizeConfigButton')，便于 CollapsibleIconButton 进行折叠状态管理，与其他工具按钮共享机制。
- QueryCollect（src/query-collect/index.tsx）：
  - 负责配置 Bot 是否收集用户查询及其隐私策略链接：
    - 从 useQueryCollectStore 中读取 is_collected / private_policy，并通过 setQueryCollect 更新；
    - 通过 useGetUserQueryCollectOption 获取后端配置（如 private_policy_template）与 supportText 提示；
    - useBotDetailIsReadonly 控制是否允许编辑。
  - 主要交互：
    - 顶部 CollapsibleIconButton 打开 Modal，按钮文案 bot_dev_privacy_title，icon 为 IconCozEye；
    - Modal 中第一行 card 通过 Switch 控制是否启用收集开关，文案 bot_dev_privacy_setting_*；
    - 勾选后展示 Form.Input 字段 policyLink，前缀固定显示 https://，内部仅输入 hostname/path 部分：
      - onChange 时更新 privacyUrl 并重置内存中的 privacyErrMsg；
      - 校验规则：当 checked 为 true 时，要求 isValidUrl(value) 且 privacyErrMsg 为空；
      - suffix 在非只读且非海外环境下展示 GenerateByTemplate 组件，支持基于模板一键生成链接。
  - 保存逻辑（onOk）：
    - 组装 queryCollectConf：is_collected / private_policy（若开启则补上 https:// 前缀，否则空字符串）；
    - 调用 updateQueryCollect，读取返回的 check_not_pass / check_not_pass_msg 并设置 privacyErrMsg；
    - 触发表单重新校验并在通过后写回 store，关闭弹窗。
  - 其余工具：
    - getUrlValue / isValidUrl 来自 src/query-collect/utils.ts，用于拆/校验 URL；
    - Tips / GenerateByTemplate 分别用于文案提示与模板生成交互。

## 开发与测试工作流

- 包管理与构建：
  - 依赖 Rush + workspace:* 管理，开发前在仓库根目录执行 rush update 安装依赖；
  - package.json 中 build 为 "exit 0"，实际构建由上层应用/打包系统统一处理，本子包主要提供 TS 源码和类型。
- 本包常用脚本（在 frontend/packages/agent-ide/bot-config-area）：
  - lint：npm run lint → eslint ./ --cache，规则由 @coze-arch/eslint-config（web preset）统一管理；
  - test：npm test → vitest --run --passWithNoTests，配置来自 @coze-arch/vitest-config（preset: 'web'）；
  - test:cov：npm run test:cov → 带 coverage 统计。
- TypeScript 配置：
  - 顶层 tsconfig.json 仅作为 composite 壳，实际构建由 tsconfig.build.json / tsconfig.misc.json 负责（路径参考同目录文件）；
  - 新增跨包类型依赖时，需要同时更新 tsconfig.build.json 中的 references，保证 Rush 的 tsc --build 顺序正确。

## 项目约定与编码风格

- 语言与技术栈：
  - React 18 函数组件 + TypeScript，统一使用 FC / ReactNode 类型别名；
  - 状态管理依赖 zustand（通过 useShallow 选择器减少重渲染）以及上游 bot-detail-store/space-bot 提供的 store；
  - UI 组件来自 @coze-arch/coze-design 与 @coze-studio/components（如 CollapsibleIconButton、InputSlider、Modal、Form 等）。
- 文案与国际化：
  - 文案统一使用 I18n.t('key')；本包不会直接维护 i18n 资源文件，只依赖上游 @coze-arch/i18n；
  - 新增文案时，应先在上游 i18n 包中增加 key，再在本包中引用，避免硬编码字符串。
- Store 使用：
  - 变现与模型、隐私配置均通过 bot-detail-store / model-store / monetize-store 提供的 hooks 访问；
  - 组件内部仅调用 store 提供的 setter（如 setIsOn / setFreeCount / setModelByImmer / setQueryCollect），不直接修改深层 state 对象。
- 交互与组件模式：
  - 多数入口为 CollapsibleIconButton + Popover / Modal 的组合按钮：通过 Symbol.for('...') 声明 itemKey，使 IDE 顶栏/侧栏可以统一管理折叠与布局；
  - 弹窗类组件统一使用宽度、内边距、圆角等已存在的 Tailwind + CSS 变量样式，如 w-[480px] p-[24px] 或 w-[600px] rounded-[12px]；
  - 校验与错误提示优先通过表单 rules 与 helpText 实现，而不是在 onOk 中自行弹出 message。

## 与其他子包及后端的集成

- 与 @coze-studio/bot-detail-store：
  - 使用 useBotInfoStore 获取 botId；
  - useMonetizeConfigStore 提供变现相关字段与 setter；
  - useQueryCollectStore 提供查询收集配置；
  - useModelStore 提供模型配置与 setModelByImmer；
  - useBotDetailIsReadonly 控制是否禁用编辑。
- 与 @coze-agent-ide/space-bot：
  - useMonetizeConfigReadonly 判断变现是否为只读状态；
  - useGetUserQueryCollectOption 获取用户所属空间的查询收集能力与模板链接；
  - useGenerateLink 为隐私政策模板生成实际链接（runGenerate）。
- 与 @coze-arch/bot-api / @coze-arch/idl：
  - benefitApi.PublicSaveBotDraftMonetizationConfig 用于保存变现草稿配置，参数字段与 MonetizationEntityType.Bot 保持一致；
  - BotMode（来自 playground_api）用于区分 Single/Multi/Workflow 模式。

## 协作规范与 AI 使用建议

- 修改/扩展导出：
  - 新增组件或类型时，应在 src/index.ts 补充导出，并保持命名语义清晰；
  - 如需对外暴露更细粒度的子组件（例如内部表单项），建议先在 adapter/应用侧确认是否有稳定使用场景，避免过早暴露内部实现细节。
- 扩展配置能力时：
  - 模型配置：尽量将具体字段修改逻辑放在 ModelFormItem 包裹范围内，并通过 setModelByImmer 修改 draft.config，而不是在多个组件中分散更新同一字段；
  - 变现：保持所有服务器交互由 debouncedSaveBotConfig 统一调度，避免在 UI 中直接多次调用 benefitApi；
  - 查询收集：复用 updateQueryCollect 与 privacyErrMsg 机制，确保服务端校验错误在表单层面可见。
- 测试与可观测性：
  - 使用 data-testid（如 bot.ide.bot_creator.set_model_view_button）为关键入口保留自动化测试锚点；
  - 在新增按钮 / 弹窗时，建议比照现有模式添加 data-testid，方便后续编写 E2E/集成测试。
- 不建议在本包中：
  - 引入新的全局状态容器或路由逻辑（应由上层 Agent IDE 管理）；
  - 直接拼接后端 URL 或写 fetch/axios 调用（统一通过 @coze-arch/bot-api 等封装层）。
