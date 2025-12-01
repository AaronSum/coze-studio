# @coze-agent-ide/model-manager 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/model-manager）中安全、高效地协作开发。

## 全局架构与职责边界
- 子包定位：提供 Bot 编辑页面中的「模型管理与配置」能力，对外暴露 React 组件、hooks 与模型配置工具函数（见 src/index.ts）。
- 主要导出：ModelForm / SingleAgentModelForm / MultiAgentModelForm、model-select 组件、模型能力校验弹窗 hooks、FormilyProvider、useModelForm 等。
- 数据来源：统一依赖上层 @coze-studio/bot-detail-store 与 @coze-agent-ide/bot-editor-context-store 提供的 Zustand store，不在本包内创建全局 store。
- 表单引擎：使用 Formily（@formily/core + @formily/react）构建模型配置动态表单，字段组件映射在 src/components/model-form/type.ts 与 src/constant/model-form-component.ts。
- 运行场景：支持 SingleAgent / MultiAgent / Workflow 等 BotMode，不直接处理路由，仅关注当前编辑态下的模型列表与配置。

### 关键模块
- 入口导出：[src/index.ts](src/index.ts)
  - 统一 re-export 组件、hooks 与工具函数，是外部唯一依赖入口。
- 表单组件：
  - [src/components/model-form/index.tsx](src/components/model-form/index.tsx)：通用模型表单容器，负责：
    - 通过 useFormily 延迟加载 Formily 模块并根据状态渲染 Loading / 错误 / 表单。
    - 使用 formilyCore.createForm / createSchemaField 创建表单实例与 SchemaField。
    - 渲染顶端 ModelSelect（选择模型）以及基于 schema 的动态字段表单。
  - [src/components/single-agent-model-form/index.tsx](src/components/single-agent-model-form/index.tsx)：单 Agent 模式使用的包装组件，从 useModelStore 读取 model.config，并在表单变更时用 setModelByImmer 回写。
  - [src/components/multi-agent/model-form/index.tsx](src/components/multi-agent/model-form/index.tsx)：多 Agent 模式表单，依赖 useMultiAgentStore 与 useAgentModelCapabilityCheckAndAlert 完成模型兼容性校验与配置同步。
- 上下文：
  - [src/context/formily-context](src/context/formily-context)：负责按需加载 Formily 相关模块（formilyCore / formilyReact），并通过 useFormily 暴露 status（unInit/loading/ready/error）与 retryImportFormily。
  - [src/context/model-form-context/context.tsx](src/context/model-form-context/context.tsx)：管理「生成多样性」折叠状态和 per-model 自定义表单值缓存，避免切模型时丢失特定字段值。
- 模型获取与工具函数：
  - [src/hooks/model/use-get-model-list.ts](src/hooks/model/use-get-model-list.ts)：基于 SpaceApi.GetTypeList 拉取当前 Bot 下需要的模型列表，并写入 modelStore（onlineModelList / offlineModelMap）。
  - [src/utils/model](src/utils/model)：提供 convertFormValueToModelInfo、convertModelInfoToFlatObject、getModelClassSortList、getModelOptionList 等工具函数，用于在表单值与底层模型配置结构之间转换以及生成下拉选项。
- 能力校验：
  - [src/components/model-capability-confirm-model](src/components/model-capability-confirm-model)：封装 useModelCapabilityCheckAndConfirm / useModelCapabilityCheckModal / useAgentModelCapabilityCheckModal / useAgentModelCapabilityCheckAndAlert 等，用于在切换模型时校验是否满足记忆、工具等能力约束并弹窗提醒。

## 开发与构建工作流
- 包管理与初始化：
  - 整体由 Rush 管理，首次开发前在仓库根目录执行：rush update。
- 本子包常用命令（在 frontend/ 或仓库根目录通过 Rush 调用）：
  - 测试：rush test --to @coze-agent-ide/model-manager 或在子包内执行 npm test（运行 vitest，配置见 vitest.config.ts）。
  - 覆盖率：npm run test:cov。
  - Lint：npm run lint（使用 eslint.config.js 与 .stylelintrc.js）。
  - 构建：当前 package.json 中 build 仅为 "exit 0" 占位，本包实际依赖上层构建体系（Modern.js / Webpack / Vite），不要在此自行接入打包流程。
- Storybook / 组件调试：
  - README.md 声明支持 storybook，但具体配置位于上层前端工程；若需要新增 Story，请遵循 frontend/apps 或 packages 中已有组件库的 Story 组织方式。

## 代码风格与项目约定
- 语言与框架：
  - 使用 TypeScript + React 18 函数组件，hooks 优先；样式使用 *.module.less 并通过 className 映射。
- 状态管理：
  - 全局状态统一使用上游 @coze-studio/bot-detail-store 与 @coze-agent-ide/bot-editor-context-store 里的 Zustand store。
  - 本子包**不创建新的全局 store**，仅通过 hooks 读取 / 更新；内部共享状态使用 React Context（如 ModelFormProvider）。
- 表单约定：
  - 所有模型配置表单统一通过 Formily schema 驱动，不直接在 JSX 中硬编码字段；新增字段时优先修改 schema 与组件映射，而非散落多个组件中。
  - createForm 的依赖仅绑定 currentModelId，确保切换模型时重新初始化表单实例；如需要缓存按模型粒度的自定义值，请通过 ModelFormContext 的 customizeValueMap 管理。
- 模型列表与能力：
  - useGetModelList 依赖 BotMode / BotCreatorScene / SpaceApi，任何改动必须同时考虑 Single / Multi / Workflow 三种模式以及 Douyin 场景下的 ModelScene.Douyin。
  - 线上 / 下线模型分离管理：onlineModelList 用于可选模型，下线模型保存在 offlineModelMap；UI 层若需提示下线状态，应从该 Map 读取。
- 错误处理与上报：
  - 使用 CustomError + ReportEventNames 进行关键路径错误上报（如模型列表为空、agent 未找到等），避免 silent failure。
  - Formily 加载失败时使用 I18n 文案 + 重试按钮（retryImportFormily），不要直接抛错导致白屏。
- I18n：
  - 所有用户可见文案统一通过 @coze-arch/i18n 的 I18n.t 调用；勿在组件内硬编码中文或英文常量文案。

## 关键交互与数据流示例
- 单 Agent 表单数据流（SingleAgentModelForm）：
  - 读取当前模型配置：useModelStore(state => state)。
  - 用 useHandleModelForm 生成 getSchema / handleFormInit / handleFormUnmount，内部会：
    - 根据 currentModelId 与 modelStore 在线模型列表拼装 Formily schema。
    - 在 onValuesChange 中回调上层，传出 values。
  - onValuesChange 中通过 setModelByImmer 将 values 写回 model.config，始终携带 model 字段（当前 modelId）。
- 多 Agent 表单数据流（MultiAgentModelForm）：
  - 通过 useMultiAgentStore 查找对应 agent，并在 setMultiAgentByImmer 中按 agentId 精确更新其 model 字段；ShortMemPolicy 由全局 model.config.ShortMemPolicy 透传。
  - 切换模型前调用 useAgentModelCapabilityCheckAndAlert 做能力校验，若不通过则阻断切换。
- 模型列表获取（useGetModelList）：
  - 计算 expectedIdList：
    - SingleMode：仅 singleAgentModelId。
    - MultiMode：所有 agent.model.model 去重列表。
    - WorkflowMode：当前为空数组，可在未来扩展。
  - 调用 SpaceApi.GetTypeList，并根据 scene 是否为 DouyinBot 决定是否传入 model_scene: ModelScene.Douyin。
  - 成功后写入 useBotEditor().storeSet.useModelStore 对应状态；若 model_list 为空则抛 CustomError 以便上报。

## 测试策略
- 测试框架：Vitest（配置见 [vitest.config.ts](vitest.config.ts)），使用 @coze-arch/vitest-config 统一预设（preset: 'web'）。
- 现有测试：
  - [__tests__/convert-model-params-to-schema.test.ts](__tests__/convert-model-params-to-schema.test.ts) 等聚焦于模型参数到 schema 的转换逻辑。
  - [__tests__/get-model-class-sort-list.test.ts](__tests__/get-model-class-sort-list.test.ts) 校验模型类别排序结果。
  - 新增测试时优先覆盖：
    - 转换工具函数（src/utils/model/*）。
    - 复杂 hooks（如 useHandleModelForm、模型能力校验 hooks）。
- 运行方式：
  - 在包内执行 npm test 或通过 Rush 在仓库根目录执行 rush test --to @coze-agent-ide/model-manager。

## 与外部系统的集成
- Bot 详情相关 store：
  - @coze-studio/bot-detail-store/model：提供单 Bot 模型配置、ShortMemPolicy 等；所有对 model.config 的写操作应通过其 immer 风格 API。
  - @coze-studio/bot-detail-store/multi-agent：提供多 Agent 信息列表；更新时需通过 setMultiAgentByImmer 并保持不可变更新语义。
  - @coze-studio/bot-detail-store/bot-info：提供 BotMode（SingleMode / MultiMode / WorkflowMode）。
- 编辑器上下文：
  - @coze-agent-ide/bot-editor-context-store：通过 useBotEditor() 暴露 storeSet，其中 useModelStore 提供 onlineModelList / offlineModelMap / getModelPreset 等模型元信息。
  - @coze-agent-ide/bot-creator-context：提供 BotCreatorScene（如 DouyinBot），影响模型列表请求参数。
- 后端 API：
  - @coze-arch/bot-space-api 的 SpaceApi.GetTypeList：拉取模型类型列表，需传入 cur_model_ids 与 model: true，必要时附加 model_scene。调用失败或返回异常结构时需抛 CustomError 以保证监控可见。

## 贡献与协作建议（针对 AI 助手）
- 修改或新增组件时：
  - 遵循现有目录结构：components / hooks / context / utils 分层清晰，避免将逻辑散落在 UI 组件中。
  - 新增模型配置项时，优先扩展 schema 与组件映射，而非直接修改多个消费组件；保持 SingleAgent 与 MultiAgent 两处行为一致。
- 变更涉及模型列表或能力校验时：
  - 同步考虑 SingleMode / MultiMode / WorkflowMode & Douyin 场景，以及 online/offline 模型区分。
  - 确保仍然通过 CustomError + ReportEventNames 上报关键错误，不要吞掉异常。
- 代码风格：
  - 遵循 eslint 与 TypeScript 规则，避免一字母变量，保持与现有命名（如 handleFormInit / handleFormUnmount）一致。
