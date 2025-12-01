# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/workspace/project-publish）中安全、高效地协作开发。

## 总体架构与职责边界
- 本子包是 Coze Studio 工作空间下的「项目发布」前端模块，对外导出 ProjectPublish 页面组件、PublishButton 以及若干业务 hooks（见 src/index.tsx），供上层路由与其他包组合使用。
- UI 层基于 React 18 和 @coze-arch/coze-design 组件库构建，状态层使用 Zustand（见 src/store.ts），通过 hooks/selectors 将数据注入页面和子组件。
- 业务被拆分为多个功能区域：
  - 发布主流程页面：src/publish-main/，负责装配表单、标题栏、连接器配置、发布记录等模块，是该包的核心入口实现。
  - 发布按钮：src/publish-button/，封装在工作空间、IDE 等场景中触发 ProjectPublish 的交互入口。
  - 业务 Hooks：src/hooks/，封装与业务环境相关的交互（如连接器锚点、MCP 配置弹窗、发布状态订阅等）。
  - 服务层：src/service/，封装本地持久化和复杂业务逻辑，例如 connector-anchor.ts 负责“发布锚点”的本地存储与恢复。
  - 公共工具与类型：src/utils/、src/typings.d.ts，用于放置本包内部通用工具函数和类型定义。
- 数据流整体模式：路由参数（project_id、space_id 等）由 react-router-dom 提供，初始化时通过 initPublishStore 写入 Zustand store，页面组件从 store 读取状态并触发异步操作，部分中间状态（如草稿、锚点）通过 localStorage 持久化以增强用户体验。

## 关键文件与目录结构
- package.json：定义了该包的依赖、构建与测试脚本，是理解技术栈的入口。
- src/index.tsx：对外导出 ProjectPublish、PublishButton 和业务 hooks，是外部使用时的唯一入口。
- src/publish-main/index.tsx：ProjectPublish 组件实现，负责：
  - 读取路由参数 project_id、space_id。
  - 调用 initPublishStore 初始化发布状态，并在卸载时 resetProjectPublishInfo 清理。
  - 通过 exportDraft + localStorage 保存草稿（beforeunload 监听）。
  - 根据 store 中 showPublishResult 切换“配置表单视图”和“发布记录视图”。
- src/service/connector-anchor.ts：
  - 使用 zod 校验本地存储结构，immer 管理不可变更新，typeSafeJSONParse 处理 JSON 解析异常。
  - 通过 PublishAnchorService 读写 localStorage 中的锚点信息，key 为 coz_project_publish_anchor，按 userId 分桶，并校验 projectId 一致性后才返回结果。
- src/hooks/：
  - use-biz-connector-anchor.ts：基于 publishAnchorService 封装业务级锚点读写逻辑（例如页面跳转后回落到特定连接器）。
  - use-mcp-config-modal.tsx：统一管理 MCP 配置相关弹窗的显隐与交互（依赖上游 UI / 状态）。
  - use-publish-status.tsx：对外暴露发布状态查询、轮询或订阅接口，并与 ProjectPublishStatusProps 类型一并导出。
- src/store.ts：Zustand store 定义（状态 shape、action 集合），承载发布流程的全局状态，包括页面 loading、表单数据、发布结果等。
- src/publish-main/components/：针对 ProjectPublish 页面拆分的 UI 布局组件（如 PublishContainer 等），统一处理布局与皮肤。
- src/publish-main/publish-basic-info.tsx / publish-connectors.tsx / publish-record.tsx / publish-title-bar.tsx：按业务分块实现基本信息配置、连接器配置、发布记录展示和顶部导航等。
- 配置文件：
  - tsconfig.json / tsconfig.build.json / tsconfig.misc.json：约定 TS 编译目标和路径别名（与上层 monorepo ts-config 共享）。
  - eslint.config.js / .stylelintrc.js：统一代码风格与样式规范，需遵循 @coze-arch/eslint-config 与 @coze-arch/stylelint-config 的约定。
  - vitest.config.ts：单测框架为 Vitest，部分配置继承自 @coze-arch/vitest-config。

## 依赖与外部集成
- 内部 workspace 依赖：
  - @coze-arch/* 系列：
    - coze-design：统一 UI 组件与设计语言（如 Form、Spin）。
    - i18n：多语言文本管理，通常通过 hooks/组件在 UI 中使用。
    - logger：提供 useErrorHandler 等 hooks，用于捕获和上报业务异常。
    - idl / bot-api / foundation-sdk 等：封装与后端 bot/项目相关的接口和类型，不在本包中直接拼接 URL。
  - @coze-agent-ide/*：与 Agent IDE 场景相关的通用能力，如 agent-ide-commons、space-bot，通常用于获取上下文信息、路由与权限等。
  - @coze-studio/*：
    - publish-manage-hooks：与发布记录、发布任务管理相关的通用 hooks 或服务（例如分页查询发布记录、重试发布等）。
    - premium-components-adapter / components：高阶业务组件与适配层，ProjectPublish 页面会组合这些组件进行展示。
  - @coze-common/*：
    - auth：身份与权限信息读取，通常在 hooks 或服务层使用。
    - md-editor-adapter：如描述字段使用富文本/Markdown 时的编辑器封装。
- 第三方依赖：
  - Zustand：状态管理，使用 useProjectPublishStore + useShallow 选择子状态，避免多余渲染。
  - zod + immer：数据结构校验与不可变更新，广泛用于本地存储结构和配置数据处理，新增字段时须同时更新 schema 和类型。
  - axios：发起 HTTP 请求，一般通过上游 SDK/封装使用，而不是在组件中直接构造 URL。
  - react-router-dom：获取当前路由参数（project_id / space_id），在未挂载路由上下文时不要直接使用 ProjectPublish。
  - ahooks / lodash-es / zustand/react/shallow：用于提升可用性与性能，不宜在关键路径中滥用深度 clone 或重型操作。

## 开发与运行工作流
- 本子包遵循 Rush monorepo 工作流：
  - 安装依赖：在仓库根目录执行 rush update（见 README 和根级配置）。
  - 本包本身 package.json 未提供 dev 命令，通常由上层 app（如 frontend/apps/coze-studio）拉起整体 dev 服务器，本包作为依赖被热加载。
  - 构建：package.json 中的 build 当前为占位（exit 0），实际产品构建由上层 rsbuild / rsbuild-config 统一处理；如需为该子包单独构建，可参考其它包使用 @rsbuild/core 或 webpack 的方式新增对应脚本。
- Lint：
  - 在子包目录执行 npm run lint，使用 eslint.config.js 及 @coze-arch/eslint-config；新增文件/导出时需保证无 lint 报错。
- 测试：
  - 单测命令：npm test 或 npm run test，底层使用 Vitest；默认 --passWithNoTests，允许包内暂时无测试文件。
  - 覆盖率：npm run test:cov，使用 @vitest/coverage-v8 输出覆盖率报告。
- Storybook：
  - .storybook/ 存在表明该包支持 Storybook 组件调试，具体命令通常在根级或统一脚本中定义；编写新 UI 组件时建议为核心交互补充 Storybook stories。

## 代码风格与模式约定
- 组件与文件命名：
  - 页面级组件使用 PascalCase，如 ProjectPublish、PublishBasicInfo。
  - hooks 放在 src/hooks 下，统一 useXxx 命名并导出必要类型。
  - 服务类/工具放在 src/service 与 src/utils 下，避免组件中直接操作 localStorage 或 window API。
- 状态管理：
  - 使用 Zustand store 管理跨组件共享状态，组件通过 useProjectPublishStore(selector) 订阅子树；不要在多个地方维护重复的发布状态。
  - 初始化逻辑集中在 initPublishStore，卸载清理集中在 resetProjectPublishInfo，新增字段时必须同步更新这两处逻辑。
- 本地持久化：
  - 统一通过 service 层实现，如 PublishAnchorService 和 publish-draft 工具，均使用 zod 校验数据结构，并通过 typeSafeJSONParse 安全解析。
  - 如需新增本地缓存项，应：定义 schema → 更新类型 → 在构造函数中 load → 提供 set/get/remove 方法 → 注意与多用户/多项目隔离策略（推荐以 userId + projectId 作为 key 维度）。
- 错误处理：
  - 统一使用 useErrorHandler（来自 @coze-arch/logger）捕获异步初始化或保存草稿时的异常，避免直接 console.error。
  - 对于网络或后端错误，优先借助上游 SDK 的错误封装与 Toast/通知机制，不在本包内重复实现。
- 样式与布局：
  - 使用 index.module.less 与约定的原子类（如 coz-bg-primary）混合布局；新增样式时尽量保持与现有命名风格一致，避免滥用全局选择器。
  - 通用布局（宽度 800px、上下 padding 等）集中在 ProjectPublish 里，子组件不要重复设置 page 级 padding。

## 分支、发布与依赖管理
- 本仓库通过 rush.json 管理所有子包版本和依赖，@coze-studio/project-publish 的版本号在 package.json 中维护，但实际发布/上线流程通常由上层 CI/CD 统一控制。
- 开发时：
  - 建议遵守团队 git 分支规范（如 feature/xxx、bugfix/xxx 等），并在 MR 中保持改动聚焦于单一业务（例如仅改动 ProjectPublish 流程或仅调整 PublishButton 行为）。
  - 若需要调整 workspace:* 依赖的版本或新增内部依赖，应同时更新对应包的 package.json，并在根目录执行 rush update 保障 lockfile 一致。
- 部署：
  - ProjectPublish 不直接控制部署目标，而是随着使用它的上层 app（如 coze-studio）一起被构建和发布；因此在改动公共导出时（src/index.tsx），需考虑向后兼容性并与使用方确认。

## 使用本说明进行协作的建议
- 在新增功能或修改行为前：
  - 先确认变更属于哪一层（组件 / store / service / hooks），遵循现有分层放置文件。
  - 查找是否已有类似模式可复用（如本地缓存、锚点、发布记录查询），优先扩展现有服务，而非在组件中直接写 ad-hoc 逻辑。
- 在为 AI 编程助手下达指令时：
  - 明确目标是“扩展 ProjectPublish 页面”、“调整发布按钮的启用条件”或“新增某种本地缓存”等，并指出需要操作的路径（例如 src/publish-main/publish-basic-info.tsx）。
  - 如果涉及对外 API 或跨包交互，请一并说明相关依赖包名称（例如 @coze-studio/publish-manage-hooks）及预期调用方式，以减少误判。
