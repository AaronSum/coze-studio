# frontend/packages/agent-ide/plugin-setting

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/plugin-setting）中安全、高效地协作开发。

## 总览与架构
- 子包作用：为 Agent IDE 中的单个「插件技能」提供「设置入口按钮 + 设置弹窗」，主要包括参数默认值设置和 MockSet（调试用 mock 集合）配置。
- 对外导出：
  - `PluginSettingEnter`：在工具列表中渲染一个带 tooltip 的设置图标按钮，并在点击后打开配置弹窗。
  - `IAgentSkillPluginSettingModalProps`：设置入口组件的入参类型（bot / dev / plugin / 绑定信息 / 业务上下文等）。
  - `SettingSlot`：允许外部扩展自定义 tab（`slotList`），在弹窗左侧导航中追加项并在右侧区域渲染对应 React 节点。
- 主要 UI 结构：[src/components/agent-skill-setting-modal/index.tsx](src/components/agent-skill-setting-modal/index.tsx)
  - 内部 hook `useAgentSkillPluginSettingModalController` 负责：
    - 用 `useState` 管理弹窗可见性 `visible`。
    - 通过 `useSpaceStore.getState().getSpaceId()` 拿到当前空间 ID，并结合传入的 `botId/devId/apiInfo` 组装 `commonParams`。
    - 使用 `ahooks/useRequest` 调用 `PluginDevelopApi.GetBotDefaultParams` 拉取该插件的默认参数配置；当 `FLAGS['bot.devops.plugin_mockset']` 为真且弹窗可见时才触发请求。
    - 基于请求结果计算 `isDisabledMockSet`，控制 MockSet 区域是否只读或不可用。
  - `PluginSettingEnter` 组件：
    - 渲染 `PartMain`（主弹窗内容），传入所有上下文信息与 `visible/doVisible`。
    - 渲染 `ToolItemActionSetting` 按钮，tooltip key 为 `plugin_bot_ide_plugin_setting_icon_tip`，点击时切换弹窗可见。
- 弹窗内容布局：[src/components/agent-skill-setting-modal/part-main.tsx](src/components/agent-skill-setting-modal/part-main.tsx)
  - 使用 `UIModal` 作为容器，左侧固定宽度导航区 + 右侧可滚动内容区。
  - 左侧 `Nav`：
    - 默认 tab 为「MockSet」或「Parameters」，依据 `FLAGS['bot.devops.plugin_mockset']` 决定。
    - 通过 `slotList` 动态追加额外导航项。
  - 右侧内容：
    - 当选中 MockSet tab 且 `visible` 为真时渲染 `PartMockSet`（Mock 集配置）。
    - 当选中 Parameters tab 且 `visible` 为真时渲染 `PartParams`（请求/响应参数默认值设置）。
    - 若 `slotList` 中存在 key 匹配当前选中项，则渲染该 slot 的 `reactNode`。

## MockSet 区域（PartMockSet）
- 入口文件：[src/components/agent-skill-setting-modal/part-mock-set.tsx](src/components/agent-skill-setting-modal/part-mock-set.tsx)
- 依赖与上游：
  - 使用 `useMockSetInSettingModalController`（来自 `@coze-agent-ide/bot-plugin-mock-set`）封装所有与 MockSet 相关的业务逻辑和接口交互，本子包只负责 UI 呈现层。
  - 使用 `MockSetEditModal` 和 `builtinSuccessCallback`（来自 `@coze-studio/mockset-edit-modal-adapter`）创建/编辑单个 Mock 集。
  - `bindSubjectInfo` 与 `bizCtx`（来自 `@coze-studio/mockset-shared`）标识当前插件/场景上下文，包含流量场景 `TrafficScene` 等信息。
  - `isRealData`（来自 `@coze-agent-ide/bot-plugin-mock-set/util`）用于判断当前 Mock 记录是否真实可用。
- 关键交互流程：
  - MockSet 开关：
    - `isEnabled` / `doEnabled` 控制是否开启 mock 能力（一般对应远端配置），UI 上用 `Switch` 呈现。
    - 当 mock 未开启时，展示提示文案 `mock_enable_switch`。
  - Mock 列表 Table：
    - 列定义使用 `@coze-arch/bot-semi/Table` 的 `ColumnProps<MockSet>`；根据内容宽度和容器高度计算滚动区域（`useSize + GAP`）。
    - 名称 / 描述列使用 `Typography.Text` 的 `ellipsis.showTooltip` 实现溢出提示。
    - “use_in_bot” 列：
      - 根据 `schemaIncompatible` 或 `mockRuleQuantity` 判定不可用状态，提供不同 tooltip 提示文案（如 `tool_updated_check_mockset_compatibility`）。
      - 只能勾选一个 `selectedMockSet`，变更时调用 `doChangeMock`。
    - “Actions” 列：提供编辑（`doHandleView`）与删除（`doSetDeleteId` + `doConfirmDelete`）操作，删除前通过 `Popconfirm` 确认。
  - 新建 MockSet：
    - 通过 `UIButton` + `IconAdd` 触发 `doSetCreateModal(true)` 打开 `MockSetEditModal`。
    - `onSuccess` 回调中会调用 `builtinSuccessCallback`，并通过 `doHandleView` 打开刚创建的记录以继续编辑。
  - 只读模式：
    - 由 `readonly` 控制开关和按钮是否可操作，多处对该值进行 UI 禁用判断。

## 参数设置区域（PartParams）
- 入口文件：[src/components/agent-skill-setting-modal/part-params-set/index.tsx](src/components/agent-skill-setting-modal/part-params-set/index.tsx)
- 依赖与上游：
  - `useParametersInSettingModalController`（来自 `@coze-agent-ide/bot-plugin-tools`）封装所有与插件参数（请求/响应）的拉取、编辑和提交逻辑。
  - `MemoryApi.GetSysVariableConf`：用于获取系统变量配置，结合 `bot-skill` store 中的 `variables` 列表，生成可插入默认值的变量引用下拉。
  - `useBotSkillStore`（`@coze-studio/bot-detail-store/bot-skill`）提供当前 bot 的变量列表等上下文信息。
  - `DefaultValueInput`（`@coze-agent-ide/bot-plugin-tools/defaultValueInput`）负责单个参数默认值的编辑与变量引用逻辑。
- UI 与数据流：
  - 顶部通过 `RadioGroup` 在「输入参数」与「输出参数」之间切换，内部用 `activeTab`（0/1）表示。
  - `useParametersInSettingModalController` 提供：
    - `requestParams` / `responseParams`：Tree 结构的参数定义，使用 `ROWKEY` 和 `childrenRecordName` 构建树形 Table。
    - `doUpdateParams()`：聚合当前 UI 状态并提交到后端。
    - `doUpdateNodeWithData`：局部更新单个参数节点的字段，如 `local_default`、`local_disable` 等。
    - `loaded` / `isUpdateLoading` 等标志位控制加载与保存按钮状态。
  - Table 列定义：
    - Name 列：
      - 展示参数名 + 描述，结合 `deep` 字段动态控制缩进和最大宽度。
    - Type 列：
      - 使用 `ParameterType` 枚举将数字/枚举值转为用户可读文本。
    - Required 列：
      - 根据 `is_required` 展示本地化文案。
    - 当 `activeTab === 0`（输入参数）：
      - 追加 `local_default` 列：通过 `DefaultValueInput` 编辑默认值，支持变量引用（`variableOption`）。
      - 追加 `local_disable` 列：用 `Switch` 控制是否启用本地默认值，必填且未设置默认值/引用时禁用并展示 tooltip 说明。
    - 当 `activeTab === 1`（输出参数）：
      - 替换默认 Required 列为 `local_disable` 列，用来控制输出字段是否启用。
  - 保存：
    - 底部右下角 `Button` 点击触发 `doSave`：
      - 调用 `doUpdateParams()`，成功后弹出 `Toast.success`（`Save_success`）。
      - 失败时上报日志 `update_bot_default_params_error`，并通过 `Toast.error` 展示错误文案和 `withSlardarIdButton` 嵌入埋点。

## 配置与测试
- package.json
  - `main`: `src/index.ts`，说明此包只导出 TypeScript 源码，由上层构建系统负责打包。
  - scripts：
    - `build`: 当前为 `exit 0`，表示本子包不在本地单独构建，通常由上层统一打包。
    - `lint`: `eslint ./ --cache`，受上层 `@coze-arch/eslint-config` 管控。
    - `test`: `vitest --run --passWithNoTests`，默认使用 Vitest 执行测试；当前 repo 中仅有 `__tests__/.gitkeep`，暂无实测用例。
    - `test:cov`: 在 `test` 基础上开启覆盖率输出。
  - 运行依赖：
    - 强依赖多个工作空间包：`@coze-agent-ide/bot-plugin-mock-set`、`@coze-agent-ide/bot-plugin-tools`、`@coze-studio/mockset-edit-modal-adapter` 等；在开发时若这些包缺失，会导致类型或运行错误，应先在整个 monorepo 里执行 `rush update`。
    - UI 依赖基于 `@coze-arch/bot-semi` / `@coze-arch/coze-design` 与 `@douyinfe/semi-icons` 的组件体系。
- 测试配置：[vitest.config.ts](vitest.config.ts)
  - 通过 `@coze-arch/vitest-config` 的 `defineConfig` 统一 Vitest 规范，`preset: 'web'` 表明此包在浏览器环境下运行测试。
  - 如新增测试文件，放在 `__tests__` 或与组件同目录，遵循工作区统一约定即可。

## 开发工作流与常用命令
- 全局初始化：在 monorepo 根目录执行：
  - `rush update` 安装依赖并生成各子包链接。
- 本子包开发：
  - 由于 `package.json` 中未定义 `dev` 脚本，实际调试通常通过顶层应用（如 Agent IDE 应用）运行整体前端，然后在浏览器中进入对应插件配置页。
  - 常用命令：
    - `cd frontend && rushx <app-name>:dev`（查看具体应用 README），本子包以依赖方式被加载。
    - 在本子包目录下执行 `npm run lint` 进行局部 ESLint 检查。
    - 在本子包目录下执行 `npm run test` 或 `npm run test:cov` 跑单测 / 覆盖率（如后续添加）。
- Storybook：
  - 子包自带 `.storybook/main.js` 与 `preview.js`，可用于组件级独立调试；实际跑法需参考 frontend 顶层 Storybook 配置（通常通过某个 `rushx storybook` 命令统一启动）。

## 项目约定与风格
- TypeScript 与 React：
  - 使用函数组件 + hooks，严格启用 `@types/react` 18.x，与宿主应用保持一致。
  - 类型定义通过工作空间包（如 `@coze-arch/bot-api`、`@coze-studio/mockset-shared`）统一输出，不在本包重复定义业务类型。
- 状态与副作用：
  - 弹窗可见性、当前 tab 等本地 UI 状态保存在本包组件中。
  - 所有与后端交互/持久化的逻辑尽量委托给上游 hook/controller（如 `useMockSetInSettingModalController`、`useParametersInSettingModalController`），本包只关注视图层与交互事件。
- Flag 与灰度：
  - 功能开关统一通过 `useFlags()` 读取，键名如 `bot.devops.plugin_mockset`；在新增功能时遵循同样的 flag 命名及使用方式，避免直接写死逻辑。
- UI 与样式：
  - 使用 `index.module.less` + `classnames` 组合管理样式，class 命名以场景为前缀（如 `agent-skill-setting-modal-frame`）。
  - 多处依赖 Tailwind 风格的 class（`w-[240px]` 等），与 coze 前端整体规范保持一致；新增样式时建议沿用同一风格而非混用其他框架。
- 国际化：
  - 所有用户可见文本通过 `I18n.t('key')` 获取，不直接硬编码文案；新增文案时遵循现有 key 命名习惯（如 `plugin_bot_ide_plugin_setting_modal_*`）。

## 与外部系统的集成要点
- Bot 与空间上下文：
  - 通过 `useSpaceStore.getState().getSpaceId()` 获取当前空间 ID，与 `botId/devId/apiInfo` 一起作为调用后端接口的基础参数。
  - 如新增接口调用，优先复用现有 API client（`PluginDevelopApi`、`MemoryApi` 等），不要在本包中直接写裸 `fetch` 或 axios。
- MockSet 与调试：
  - MockSet 开启与否、选中哪条记录，都会影响上游调试行为（由 `@coze-agent-ide/bot-plugin-mock-set` 处理）；本包仅通过 controller 提供的 API 修改状态。
  - 注意在 `TrafficScene.CozeWorkflowDebug` 场景下需要设置 `needResetPopoverContainer`，本包已经通过 `bizCtx.trafficScene` 做了特殊处理，扩展时保持这一逻辑。
- 插件参数默认值：
  - 默认值配置影响插件在运行时的参数输入/输出行为，对接的是插件开发相关后端接口；在修改字段名或结构时，需同步确认后端契约。

## 贡献与注意事项
- 修改建议：
  - 新增功能时，优先考虑是否应在上游 controller / store 层扩展，而非在视图层堆积复杂逻辑。
  - 若需要新增 tab（如新增一类插件配置），推荐：
    - 使用 `SettingSlot` 通过 `slotList` 注入，而不是直接修改 `PartMain` 内部逻辑，这样可以保持本包的可复用性。
  - `@ts-expect-error -- linter-disable-autofix` 已在若干处用于压制类型不完全匹配的问题，若未来补齐类型，优先移除这些抑制语句。
- Git 与提交流程：
  - 遵循仓库根目录的贡献指南（如 [CONTRIBUTING.md](CONTRIBUTING.md)）；本说明不覆盖具体分支策略与发布流程，开发时以仓库已有规范为准。
