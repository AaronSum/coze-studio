# @coze-workflow/components — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/components）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是「工作流」相关的 React 业务组件集合，位于前端 monorepo 的 workflow 子域下，对外通过 src/index.ts 统一导出。
- 主要包含三类能力：
  - 工作流资源选择 / 管理弹窗（workflow-modal、workflow-edit、workflow-commit-list 等）。
  - 与工作流资源列表/菜单交互相关的 hooks（hooks/use-workflow-\*- 系列，尤其 use-workflow-resource-action）。
  - 一些可复用的 UI 业务组件（expression-editor(-next)、image-uploader、size-select、text、voice-select 等）。
- 组件强依赖上游领域 SDK：
  - @coze-workflow/base、@coze-workflow/resources-adapter：提供工作流领域 API / 类型（如 workflowApi、WorkflowMode、前端 WorkflowInfo 类型等）。
  - @coze-arch/\*：i18n、日志/埋点、设计系统(@coze-arch/coze-design)、表单/弹窗(@coze-arch/bot-semi)、全局 store(@coze-arch/bot-studio-store)、错误类型(@coze-arch/bot-error) 等。
  - @coze-common/\*：通用业务组件（如 PictureUpload）。
- Workflow 弹窗相关结构：
  - src/workflow-modal/index.tsx 暴露 WorkflowModal 组件及一组枚举/类型常量（DataSourceType、MineActiveEnum、WorkflowModalFrom 等），内部通过 useWorkflowModalParts 将 sider/filter/content 三部分拆分组合，最终渲染 UICompositionModal。
  - src/workflow-modal/workflow-modal-context.tsx 定义 WorkflowModalContext，用于跨组件共享当前空间 / 项目 / 绑定业务 / 排序 / 弹窗状态等信息；多数内部 hooks 默认依赖该 Context。
- 工作流创建/编辑：
  - src/workflow-edit/index.tsx 暴露 CreateWorkflowModal，用于创建/编辑 Workflow / Imageflow / ChatFlow 等，内部封装：表单校验（名称正则、最大长度、必填项）、图片上传、敏感词处理、API 调用（workflowApi.CreateWorkflow / UpdateWorkflowMeta）、日志与埋点。
- 工作流资源操作入口：
  - src/hooks/use-workflow-resource-action/index.tsx 暴露 useWorkflowResourceAction 及类型，聚合：
    - useWorkflowResourceClick：处理点击资源卡片进入详情。
    - useCreateWorkflowModal：处理创建/编辑弹窗及相关状态。
    - useWorkflowResourceMenuActions：生成列表项更多菜单（含权限 / 通用动作注入）及对应的弹窗数组。
  - src/index.ts 把以上 hook 再导出为包级入口（包含 useWorkflowPublishEntry、useWorkflowResourceClick 等）。

## 开发与测试工作流

- 包管理：使用 Rush + PNPM 工作区，本包遵循 workspace:\* 依赖约定，开发前需要在仓库根目录执行：
  - rush install 或 rush update。
- 常用 NPM Script（在 frontend/packages/workflow/components 目录执行）：
  - 构建：package.json 中 build 目前为占位实现（"build": "exit 0"），真正打包通常由上层构建系统（Rsbuild / app 级别）统一处理，本包主要作为源代码与类型提供方。
  - 单测：
    - npm test 或 npm run test：调用 vitest --run --passWithNoTests，测试配置由 vitest.config.ts 通过 @coze-arch/vitest-config 预设（preset: 'web'）。
    - npm run test:cov：增加 --coverage 覆盖率统计。当前根据 rushx-config.json，level-3 子包对覆盖率没有硬性要求，但仍建议保持基本用例。
  - Lint：npm run lint，使用 eslint.config.js 中的 @coze-arch/eslint-config 预设（preset: 'web'），对 **tests** 目录做忽略。
- Storybook 与开发预览：
  - README.md 提到「react component with storybook」模板，目录有 stories/，如需交互调试组件，可补充/运行项目级 storybook（配置在上层 monorepo，不在本包单独维护脚本）。

## 代码组织与约定

- 入口导出：
  - 所有对外能力应统一从 src/index.ts 导出；对外子路径导出通过 package.json 的 exports 配置维护：
    - "./workflow-modal" → src/workflow-modal/index.tsx
    - "./use-workflow-resource-action" → src/hooks/use-workflow-resource-action/index.tsx
  - 新增对外模块时，需要同步维护：src/index.ts、package.json.exports 和 typesVersions。
- 类型与上下文：
  - 工作流弹窗的共享状态通过 WorkflowModalContext（src/workflow-modal/workflow-modal-context.tsx）传递，新增依赖该上下文的 hooks/组件时，应在 Context Value 接口中补全字段，并保持向后兼容。
  - 工作流资源操作相关的入参/返回类型集中在 src/hooks/use-workflow-resource-action/type.ts 以及 src/workflow-modal/type.ts 中维护，优先复用而非在调用处重复定义。
- 样式：
  - 使用 Less 模块（\*.module.less），类名多为 kebab-case；业务上常结合 Tailwind class（如 min-w-[96px]）混用。
  - 修改 UI 时优先沿用已有命名和布局模式，避免在不同组件中引入风格不一致的类名规则。
- i18n：
  - 文案统一使用 I18n.t('key')，关键映射在 src/workflow-modal/hooks/use-i18n-text.ts 中集中管理；CreateWorkflowModal 中对不同 WorkflowMode 使用不同文案集合。
  - 新增/修改文案时，应：
    - 在 use-i18n-text 或对应模块中定义新的枚举键（ModalI18nKey、I18nKey）。
    - 确保上游 i18n 资源文件已有对应 key（需要到其他包中维护）。
- 日志与埋点：
  - 使用 reporter.info / reporter.error (from @coze-arch/logger) 记录关键行为，命名空间多使用 'workflow'，message 为 workflow*info_modal*\* 等；
  - 错误埋点常结合 CustomError 与 REPORT_EVENTS 常量使用，新增埋点时保持该风格，避免直接抛裸 Error。
- API 调用：
  - 工作流增删改查统一通过 workflowApi（@coze-workflow/base/api）调用；
  - CreateWorkflowModal 中示例：CreateWorkflow / UpdateWorkflowMeta；传参中会显式带 space_id / project_id / bind_biz_id / bind_biz_type 等字段，以及 header 'x-locale'（基于当前用户 locale）。

## 关键组件与 Hook 行为说明

- WorkflowModal（src/workflow-modal/index.tsx）：
  - 入参包括 flowMode、bindBizType、hideSider 等，内部：
    - 根据 flowMode 决定标题 i18n key（WORKFLOW_MODAL_I18N_KEY_MAP + ModalI18nKey）。
    - 根据 bindBizType 是否为 DouYinBot 控制侧边栏隐藏及特殊样式（douyin-workflow-modal）。
    - 通过 useWorkflowModalParts 拆分 sider/filter/content 三部分 UI，并交给 UICompositionModal 渲染。
  - AI 修改该组件时，要尊重三段式分区设计，不要在此文件直接扩散复杂业务逻辑，应把逻辑下沉到 hooks/use-workflow-modal-parts.tsx 或更细粒度组件中。
- WorkflowModalContext（src/workflow-modal/workflow-modal-context.tsx）：
  - 包含：spaceId、spaceType、bindBizId/Type、projectId、flowMode、modalState、排序(orderBy)、新增弹窗状态(createModalVisible)、以及 getModalState / updateModalState 方法和可选 i18nMap。
  - 依赖此 Context 的 hook/组件应处理「Context 可能为 null」的情况（如抛异常或早退），避免在非 WorkflowModal 场景误用时产生静默错误。
- CreateWorkflowModal（src/workflow-edit/index.tsx）：
  - 负责两类场景：新增 (mode='add') 与编辑 (mode='update')；
  - 表单逻辑：
    - name 字段：必填、WORKFLOW_NAME_REGEX 校验、可注入额外 nameValidators；
    - target（描述）字段：必填，最多 600 字；
    - icon_uri：通过 PictureUpload 管理，最终取 value[0].uid；
    - 当 flowMode 为 ChatFlow 且在项目内创建时，可选「同时创建会话」的 Checkbox；
    - 敏感词错误码通过 sensitiveWordsErrorCode 数组识别，触发时会禁用确认按钮并在表单下方显示 ErrorMessage。
  - 提交逻辑：
    - 编辑：调用 UpdateWorkflowMeta，带 ignore_status_transfer 标记避免触发状态变更。
    - 新增：通过 useSpaceStore 取当前 space_id，组合 bindBizId/Type、projectId 等后调用 CreateWorkflow；根据 flowMode 返回不同成功 Toast 文案。
  - AI 在此扩展字段/行为时，应同步考虑：表单 value 类型、API 请求参数、成功后 onSuccess 回调签名及埋点信息。
- useWorkflowResourceAction（src/hooks/use-workflow-resource-action/index.tsx）：
  - 对外暴露统一入口：
    - workflowResourceModals：一个包含所有需要挂载到页面的 Modal ReactNode 数组（包括创建/编辑弹窗以及菜单项触发的其他弹窗）。
    - openCreateModal：显式打开创建弹窗的方法。
    - handleWorkflowResourceClick：点击资源卡片时调用，内部统一路由到详情页。
    - renderWorkflowResourceActions：渲染资源卡片/列表项右上角「更多」菜单的渲染函数，可根据 props 注入 getCommonActions 等定制额外菜单。
  - 典型用法：在上层列表组件中调用该 hook，解构出上述返回值，将 workflowResourceModals 渲染在组件根处（保持常驻），并在卡片点击 / 菜单渲染时调用对应 handler。
  - AI 在此处新增行为时，应优先通过 useWorkflowResourceMenuActions / useWorkflowResourceClick / useCreateWorkflowModal 这三个子 hook 拓展，避免把不同关注点耦合到同一个文件中。

## 外部集成与通信

- 与上游「空间 / 用户」体系：
  - CreateWorkflowModal 使用 useUserInfo（@coze-arch/foundation-sdk）获取当前用户 locale，并在 CreateWorkflow 请求头中携带 'x-locale'，用于后端返回特定语言错误/提示。
  - 使用 useSpaceStore（@coze-arch/bot-studio-store）读取当前 spaceId，作为创建 workflow 的空间标识。
- 与文件/图片服务：
  - PictureUpload 和 FileBizType.BIZ_BOT_WORKFLOW 集成，用于上传并存储 workflow 图标；最终只在 meta 中保存 icon_uri（即文件 uid）。
- 与日志/监控系统：
  - reporter.info / reporter.error + REPORT_EVENTS；
  - CustomError 携带业务错误码，既用于埋点也用于前端逻辑控制（如敏感词）。

## 工程规范与流程

- 代码质量与层级：
  - 根据 frontend/rushx-config.json，本包标签为 level-3：
    - codecov 要求整体/增量覆盖率为 0%，但团队仍推荐在关键逻辑（如新增 API 交互、复杂表单校验）处补充 vitest + @testing-library/react 用例。
- 分支与发布：
  - 具体分支策略在仓库根层面约束（非本子包专有）；本包只作为 workspace 子模块参与整体构建与发布，无独立发布脚本。
- License 与版权：
  - 所有源文件头部统一使用 Apache-2.0 版权声明，新增文件时应保持一致（参考现有 ts/tsx 文件）。

## 对 AI 助手的特别提示

- 修改 / 新增对外 API 时，一定要同步维护：
  - src/index.ts 导出列表；
  - package.json.exports 与 typesVersions；
  - 如涉及 Context / 类型定义，还需更新对应 type.ts / workflow-modal-context.tsx。
- 尽量避免在顶层组件中加入复杂业务分支，而是：
  - 把数据获取 / 派发逻辑沉淀到 hooks（如 use-xxx.tsx）；
  - 把样式布局变化集中到 \*.module.less 中。
- 遇到不确定的领域类型/常量（如 WorkflowMode / BindBizType / REPORT_EVENTS）时，优先在上游包中查阅定义，而不是在本子包重复声明。
