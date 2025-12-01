# @coze-agent-ide/space-bot-publish-to-base 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/publish-to-base）中安全、高效地协作开发。

## 1. 全局架构与角色定位
- 本包是 Coze Studio Agent IDE 中「飞书基础连接器发布配置」的前端 UI 与配置适配层，封装在 React 组件和 Zustand store 中。
- 对外主要导出两个能力：
  - FeishuBaseModal：用于拉取 / 编辑 / 校验 / 保存飞书基础连接器配置的弹窗组件。
  - ExceptionDisplay 系列：统一的异常 / 空数据占位组件（LoadFailedDisplay、NoDataDisplay）。
- 配置数据结构来自后端协议包 @coze-arch/bot-api，当前包在其基础上做 FE 侧增强（追加 _id、转换 choice 结构、宽松的 output_type 等）。
- 与 Coze Studio 其他模块的关系：
  - 通过 connectorApi.GetFeishuBaseConfig / DeveloperApi.BindConnector 与后端交互。
  - 通过 @coze-arch/bot-studio-store 的 useSpaceStore 获取当前 spaceId。
  - 通过 @coze-arch/i18n 进行多语言展示，不直接写死文案。
  - 与 workflow / chat 等模块没有直接依赖，仅作为「发布到基础平台」的一块配置子模块。

## 2. 源码结构概览
- src/index.ts
  - 仅做导出聚合：FeishuBaseModal、ExceptionDisplay/LoadFailedDisplay/NoDataDisplay。
- src/feishu-base-modal/
  - index.tsx：核心业务组件，包含：
    - FeishuBaseModal：负责弹窗生命周期、远程获取配置、初始化 store、渲染表单。
    - 内部 ConfigForm 组件：负责表单布局、字段区块拆分、提交逻辑。
    - convertBaseConfig / getSubmitPayload 等双向转换逻辑，用于在「后端原始结构」与「前端增强结构」之间来回映射。
- src/store/
  - index.ts：基于 Zustand + Immer 的配置 store：
    - state：{ config: FeishuBaseConfigFe | null }
    - action：setConfig / updateConfigByImmer / clear
- src/context/store-context.tsx
  - StoreContext：React context，用于在组件树中注入 ConfigStore。
  - useConfigStoreRaw / useConfigStoreGuarded / useConfigAsserted：带断言的 hooks，保证在需要 config 的地方一定能拿到合法数据，否则抛错。
- src/types.ts
  - 一组对 @coze-arch/bot-api/connector_api 类型的 FE 侧适配：
    - OutputSubComponentItemFe、BaseOutputStructLineType：给结构化输出项增加 _id、放宽 output_type 类型到 number | undefined。
    - FeishuBaseConfigFe：将 FeishuBaseConfig 的 input_config / output_sub_component 替换为前端友好版本。
    - InputComponentFe / InputConfigFe：将 choice 改为带 id/name 的对象数组，并为每条 input_config 增加 _id。
    - SaveConfigPayload：提交给后端时仅需要的字段子集。
- src/constants.ts
  - Markdown tooltip 尺寸、错误行高、输入文案最大长度等 UI/校验常量。
- src/md-tooltip/
  - index.tsx：MdTooltip 组件，使用 ReactMarkdown + Tooltip 实现 Markdown 气泡说明，宽度受 constants 限制。
- src/expection-display/
  - index.tsx：统一异常展示组件，依赖 @douyinfe/semi-illustrations 和 I18n 文案 key。
- src/validate/
  - index.ts：对整份 FeishuBaseConfigFe 进行同步校验的核心逻辑。
  - utils.ts & field-interaction/*（未完全展开时请先阅读）：封装输出结构字段的工具函数和交互相关逻辑。
- src/big-checkbox/
  - 大号复选框相关组件（用于结构化字段标记 group_by_key / primary_key 等），实际 UI 逻辑在内部子文件中。

## 3. 关键数据流与交互流程
- 打开弹窗
  - 外部通过 ref 调用 FeishuBaseModal 的 openModal：
    - setShowModal(true) 打开 Modal。
    - 调用 useRequest 的 run() 向后端 connectorApi.GetFeishuBaseConfig 拉取当前 bot 的配置。
  - 首次渲染时若 storeRef.current 为空，则调用 createConfigStore() 创建独立的 Zustand store 实例，并用 StoreContext.Provider 注入。
  - useSubscribeAndUpdateConfig(storeRef.current) 建立与其它模块或表单控件之间的联动（例如字段勾选、联动校验等）。
- 配置数据转换
  - 从后端 -> 前端：convertBaseConfig
    - 为 output_sub_component.item_list 每一行增加 _id，并保持其它字段不变。
    - 为每条 input_config 增加 _id，并将 input_component.choice 由 string[] 转换为 { name, id }[]。
  - 从前端 -> 后端：getSubmitPayload
    - deep clone 当前 config，构造 SaveConfigPayload：
      - input_config：去掉 _id，并将 choice 恢复为 string[]（reverseInputComponent）。
      - output_sub_component.item_list：去掉 _id，并确保 output_type 为空时回退到 OUTPUT_TYPE_TEXT（reverseOutputSubComponent）。
- 表单渲染与校验
  - ConfigForm 使用 useConfigAsserted 获取 config，确保在未加载完数据前不渲染表单主体。
  - 将配置拆分为多个步骤：
    - Step 1：基础信息与输出类型（BaseOutputFieldsTable）。
    - Step 2：输入字段配置（BaseInputFieldsTable）。
    - Step 3（可选）：跳转到「补充信息页面」并回填完成状态（JumpButton + Tag）。
  - 提交流程：
    - 通过 useImperativeHandle 暴露 configFormSubmit 给上层 Modal 按钮调用。
    - 触发表单级联校验：useRequireVerifyCenter().triggerAllVerify()，并依赖 validateFullConfig 对 config 做最终检查。
    - 若校验失败，使用 Toast.error 显示 I18n 文案；否则调用 submitConfig（DeveloperApi.BindConnector）。
- 校验规则（validate/index.ts）
  - validateFullConfig：输出校验 + 输入校验，两者都通过才返回 true。
  - 输出配置：
    - 若不是结构化输出（getIsStructOutput 返回 false），仅要求 output_type 是 number。
    - 若是结构化输出：
      - validateOutputStructPattern：至少有一个字段，且每一行都有 key 且 output_type 为 number。
      - validateOutputStructGroupByKey / validateOutputStructPrimaryKey：
        - group_by_key / primary_key 字段均要求恰好 1 个；
        - 如果数量不对，返回 I18n.t('publish_base_configFields_requiredWarn')；
        - 验证不通过时 error 可能为空字符串，UI 端可根据需要决定是否展示。
  - 输入配置：
    - 至少有一条 input_config。
    - validateInputFieldsCommonPattern：每条都有 title 和 input_component，且未被标记为 invalid。
    - validateSingleInputFieldControl：
      - Text 类型：max_char 为 1~INPUT_CONFIG_TEXT_MAX_CHAR 的整数。
      - Select 类型：choice 非空，且每个选项 name.trim() 非空。
      - 其它类型：要求 supported_type 非空。

## 4. 开发 / 构建 / 测试工作流
- 包内 scripts（package.json）：
  - build："exit 0" —— 当前包自身不做单独打包，真实构建由上层 rsbuild 配置统一处理；不要在这里补写复杂构建脚本。
  - lint："eslint ./ --cache" —— 使用 monorepo 统一 eslint.config.js 及 @coze-arch/eslint-config。
  - test："vitest --run --passWithNoTests" —— 直接运行 Vitest，用 @coze-arch/vitest-config 统一配置。
  - test:cov：带 coverage 的测试。
- 推荐工作流：
  - 在 monorepo 根目录执行：
    - rush install / rush update
  - 进入子包调试：
    - cd frontend/packages/agent-ide/publish-to-base
    - npm run lint
    - npm test
  - 集成联调通常在 apps/coze-studio 里运行 dev / build（参见 frontend/README.md）。

## 5. 项目约定与风格
- 语言与 i18n
  - 业务文案全部通过 I18n.t(key) 获取，不直接写死中文或英文。
  - 异常文案统一使用已存在的 key（如 plugin_exception、debug_asyn_task_notask 等），新增时需确保在 i18n 资源中补充。
- 类型与结构适配
  - 所有面向 UI 的配置类型都使用 *Fe 后缀（例如 FeishuBaseConfigFe、InputComponentFe、OutputSubComponentFe），表示「前端增强版本」。
  - 对后端原始类型的扩展统一通过 Omit + 组合新字段实现，避免直接复制定义；提交时务必用 getSubmitPayload 做反向映射。
- 状态管理
  - 所有与飞书基础配置相关的全局状态统一放在 ConfigStore（Zustand）中，通过 context 注入；不要在局部组件再维护一份独立 config 副本。
  - 修改 config 一律通过 updateConfigByImmer(mutateFn) 来做不可变更新，mutateFn 接收当前 config 的可变 draft（由 Immer 提供）。
- 上下文使用
  - 在需要访问 config 的地方优先使用 useConfigAsserted：
    - 能保证一定存在配置；若不存在，直接抛错，有利于在开发阶段尽早暴露问题。
  - 不在 context 中塞入过多内容，目前仅存放 store 实例，保持轻量和可测试性。
- UI 与样式
  - 统一使用 @coze-arch/coze-design 组件和类名约定（如 coz-fg-primary / coz-fg-secondary 等），避免直接写原生 HTML 元素样式。
  - 复杂布局 / 组件样式通过 *.module.less 管理，组件中以 import styles from './index.module.less' 方式引用。
  - Markdown tooltip 使用 MdTooltip，禁止在其它地方重复实现 Markdown + Tooltip 组合逻辑。

## 6. 外部依赖与集成要点
- 后端 API
  - connectorApi.GetFeishuBaseConfig：
    - 请求参数：{ bot_id }。
    - 返回结构中若 config 为空，则当前 UI 认为「无配置」，仅展示占位，不初始化表单。
  - DeveloperApi.BindConnector：
    - 从 useSpaceStore.getState().getSpaceId() 取 space_id，配合 botId / connectorId 提交配置。
    - config 字段为 JSON 字符串，内容即 getSubmitPayload(config) 的结果。
- 其他 Coze 依赖
  - @coze-arch/bot-studio-store：空间信息、全局状态（仅使用 spaceId）。
  - @coze-arch/bot-api/connector_api：定义 FeishuBaseConfig / InputComponent / InputConfig / OutputSubComponent 等协议类型。
  - @coze-arch/bot-api/developer_api：定义 PublishConnectorInfo 类型及 BindConnector 能力。
  - @coze-arch/i18n：多语言。
  - @coze-arch/coze-design：UI 基础组件 + 图标。
- 第三方依赖
  - ahooks/useRequest：统一请求生命周期管理（loading/error/mutate/cancel 等）。
  - nanoid：生成前端用 _id。
  - lodash-es：cloneDeep / omit 等常用工具。
  - ReactMarkdown：渲染后端下发的 Markdown 描述说明。
  - zustand + immer：store 实现与不可变更新。

## 7. 测试与调试建议
- 测试框架
  - 使用 Vitest + @coze-arch/vitest-config（preset: 'web'），详见 vitest.config.ts。
  - React 组件测试通常配合 @testing-library/react / @testing-library/react-hooks 编写。
- 重点测试点
  - convertBaseConfig / getSubmitPayload / reverseInputComponent / reverseOutputSubComponent 的「对称性」，防止字段遗漏或类型漂移。
  - validateFullConfig 及其子校验函数，对边界情况（无字段、多 group_by_key、多 primary_key、非法 max_char、空 choice 等）的处理。
  - FeishuBaseModal 在以下场景的行为：
    - 无配置（config 为空）时不渲染表单主体，仅展示空内容占位。
    - 后端请求失败时展示 LoadFailedDisplay。
    - 完成 to_complete_info 的跳转与 tag 状态变化逻辑。

## 8. 协作与修改注意事项
- 保持协议兼容
  - 所有对 FeishuBaseConfig / InputConfig / OutputSubComponent 等类型的变更，必须确认：
    - 既兼容后端现有接口（connector_api / developer_api）；
    - 又兼容当前 UI 表单组件（BaseInputFieldsTable / BaseOutputFieldsTable / big-checkbox 等）。
- 避免在本包内引入新的全局状态或路由逻辑
  - 本包仅负责「配置弹窗」与相关工具，不负责导航、整体布局等；若需要扩展全局行为，请在上层 app 或其它 package 中实现。
- 遵循现有错误处理方式
  - 网络请求失败使用 Toast + 异常占位（LoadFailedDisplay）。
  - 表单校验失败使用 Toast.error 结合字段级错误展示（依赖 validate 与 require-verify-center）。

以上约定基于当前仓库实际实现整理，如有新文件 / 新模式引入，请同步更新本说明。