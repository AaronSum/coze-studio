# @coze-agent-ide/space-bot Copilot 使用说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/space-bot）中安全、高效地协作开发。

## 全局架构概览

- 子包位置：frontend/packages/agent-ide/space-bot，对外作为 React 组件 + Hook + 工具函数库，通过 package.json 中的 exports 暴露入口（如 ./src/index.tsx、./src/hook、./src/util、./src/store、./src/component/*）。
- 主要职责：承载「空间下的 bot 能力」页面与功能，包括 Bot 编辑、发布、调试、Onboarding、权限及平台设置等 UI 与业务编排。
- 对外 API：
	- 组件：如 ./authorize-button、./onboarding-editor、./input-slider、./custom-platform-setting-modal、./diff-mode-task-continue 等，供 Studio / 其它子包直接引用。
	- Hook：如 ./use-create-bot、./use-create-ocean 等，用于创建 / 配置 bot 的业务流程。
	- 工具：./util 与 ./store 中的常用常量、工具函数与状态管理封装。
- 技术栈：React 18 + TypeScript，Zustand 做局部状态管理，@coze-arch/coze-design + @douyinfe/semi-* 作为 UI 组件，内部通过 Rush + PNPM 管理依赖，构建由上层 Rsbuild / Webpack 统一驱动。

### 内部结构（src/）

- src/index.tsx
	- 聚合导出所有对外类型与能力，是本包的主入口。仅做 re-export，不包含业务逻辑。
- src/context/
	- bot-editor-service/context.tsx：通过 React Context 注入 Bot 编辑器相关的 Service，负责 UI 级服务编排（模态框显隐、层级控制、共享应用记录等）。
		- 依赖 @coze-agent-ide/bot-editor-context-store 暴露的 storeSet（Zustand store），从中获取 useNLPromptModalStore、useFreeGrabModalHierarchyStore 等状态能力。
		- 使用 ahooks/useCreation 对 Service 实例做懒创建 + 生命周期管理。
		- Service 列表：
			- NLPromptModalVisibilityService：管理自然语言 Prompt 编辑模态框的显隐与位置，并通过 sendTeaEvent 上报埋点事件。
			- FreeGrabModalHierarchyService：管理自由拖拽模态框的层级（注册、移除、置顶、索引获取）。
			- EditorSharedApplyRecordService：记录编辑应用行为，供多个组件共享。
	- 其它 context 文件（若存在）通常负责桥接 workspace 中其它 store / 服务至 UI 层，使用类似模式（useCreation + Service 封装）。
- src/component/
	- 按功能分为多个子目录：
		- bot-move-modal/：Bot 移动 / 迁移相关模态及 Hook（在 index.tsx 中导出的 useBotMoveModal/useBotMoveFailedModal 来自这里）。
		- authorize-button/：授权按钮组件，对接空间 / 第三方平台授权流程。
		- onboarding-message/：Onboarding 引导消息编辑与展示，包括 onboarding-editor 子目录。
		- publish-platform-setting/：Bot 发布到各平台的配置面板，内含 custom-platform-setting-modal.tsx 供外部直接使用。
		- input-slider/、rc-slider-wrapper/：基于 rc-slider 封装的数值滑条输入组件，统一交互与样式。
		- bot-debug-panel/、bot-debug-button/：调试 Bot 的入口与面板，集成 chat-background、debug-tool-list 等跨包能力。
		- 其它例如 nav-modal、mode-select、sheet-view、table-memory 等目录，对应具体 UI 模块，通常使用共享 store/service 完成交互与数据流管理。
	- src/component/index.ts：聚合组件导出（供 "./component" 或 "./component/*" 使用）。
- src/hook/
	- index.ts：导出本包对外可用的核心 Hook。
	- use-create-bot/、use-create-ocean/：
		- 封装创建 / 配置 Bot 或 Ocean 的业务流程（表单状态、请求、校验、埋点等）。
		- 广泛依赖 @coze-arch/bot-api、@coze-arch/idl、@coze-arch/bot-http、@coze-arch/report-events 等基础能力。
	- 其它 Hook 如 use-init、use-space-role、use-plugin-permission-manage、use-subscribe-xxx 等，用于：
		- 初始化页面数据和上下文（use-init）。
		- 根据空间角色控制功能显隐（use-space-role）。
		- 订阅外部事件（如背景、Onboarding 更新）并同步到 UI（use-subscribe-background、use-subscribe-onboarding-and-update-chat-area）。
- src/store/
	- 聚合局部 Zustand store 定义及 selector，通常配合其它包暴露的全局 store 使用。
- src/service/
	- *-service.ts(x)：纯逻辑服务层，解耦 UI 与数据源，示例：
		- shared-apply-record-service：记录用户在编辑器中的「应用」行为，用于提示 / 恢复等场景。
		- nl-prompt-modal-visibility-service：封装模态框显隐接口并内聚埋点逻辑。
		- free-grab-modal-hierarchy-service：封装拖拽窗口的层级与注册管理。
- src/util/
	- index.ts、auth.ts 等：
		- STORE_CONNECTOR_ID、getPublishResult 等常量与工具函数，通常被组件与 Hook 共享。
- src/pages/
	- 聚合路由级页面（若存在），多使用上面提到的 Hook + Service + 组件完成场景编排。
- src/assets/、src/constants/：
	- 存放静态资源与常量定义（文案、配置项、键名等）。

## 开发与测试工作流

- 依赖安装（在仓库根目录）：
	- rush install / rush update：由 Rush 统一安装 / 更新依赖，必须在根目录运行。
- 本包基础脚本（在 frontend/packages/agent-ide/space-bot）：
	- lint：npm run lint → eslint.config.js 基于 @coze-arch/eslint-config，preset 为 web；使用 ESLint + TypeScript 校验整包代码。
	- 类型检查：npm run lint:type → tsc -p tsconfig.json --noEmit，使用本包 tsconfig.json（继承 config/ts-config 中的统一配置）。
	- 单测：
		- npm test → vitest --run --passWithNoTests。
		- npm run test:cov → 带覆盖率的测试。
		- Vitest 配置位于 vitest.config.ts：
			- 通过 @coze-arch/vitest-config/defineConfig 统一 preset 为 web。
			- test.setupFiles 指向 __tests__/setup.ts（例如注入全局 mock、兼容 JSDOM 环境等）。
	- build：当前 package.json 中 build 命令为 "exit 0"，实际产物打包由上层应用构建（apps/coze-studio）和 Rsbuild/webpack 统一完成。本包发布侧重「源码库」角色，非独立打包单元。
- Storybook / 本地组件调试：
	- .storybook/ 目录存在，说明本包支持 Storybook；具体启动命令通常在上层工具（如统一 dev 脚本）中配置。
	- 若需为组件补充 Story / 调试：在 .storybook 与 src/component/** 下新增 Story，保持与现有组件风格一致。

## 项目特有约定与模式

- 代码组织
	- 「Service + Store + UI」三层：
		- Store 由 @coze-agent-ide/bot-editor-context-store 或本包 src/store 提供，负责状态持久与订阅。
		- Service 封装业务逻辑与跨组件协作，例如模态框显隐、层级管理、记录共享等；Service 实例通常在 Context Provider 中通过 useCreation 创建，并下发给子组件使用。
		- UI 组件（src/component/**）尽量保持「傻组件」风格，依赖上层注入的 Service / Hook，而非直接调用底层 API。
	- 类型导出集中在 src/type.ts，并在 src/index.tsx 做统一转出，对外始终从包入口引入类型（避免直接访问内部实现文件）。
- Hook 约定
	- use- 前缀的目录代表具有完整业务语义的自包含 Hook 模块，内部可再拆分子 Hook / 工具。
	- 跨包共享能力优先使用 @coze-arch/hooks、@coze-arch/i18n 等基础库，减少本包重复实现。
	- 事件订阅类 Hook（如 use-subscribe-*）通常只负责订阅与分发，真正的状态更新委托给 store/service。
- 埋点与日志
	- sendTeaEvent 来自 @coze-arch/bot-tea，用于埋点上报；在新增涉及用户行为的 Service / 组件时，应复用该事件上报方式，而不是自己发请求。
	- 错误兜底可利用 src/component/error-boundary-with-logger.tsx，将运行时异常记录到统一日志系统（@coze-arch/logger 或相关适配层）。
- 样式与 UI
	- 使用 @coze-arch/coze-design、@douyinfe/semi-* 提供的组件为主，不自行造轮子。
	- Tailwind 配置在 tailwind.config.ts 中，局部样式场景可以使用 Tailwind utility class，避免散落的内联样式。
- 类型与配置
	- TypeScript 配置多文件拆分：tsconfig.json / tsconfig.build.json / tsconfig.check.json / tsconfig.misc.json 区分构建、检查、工具脚本等场景；新增脚本应选用合适的 tsconfig 以保证类型安全。
	- typings.d.ts 用于补充全局类型声明（如非 TS 源文件导入），修改前需确认是否会影响其它包。

## 关键依赖与集成说明

- 与其它 Agent-IDE / Studio 包的集成
	- 本包大量依赖 workspace:* 形式的内部包：
		- @coze-agent-ide/*：如 bot-creator-context、bot-editor-context-store、chat-background、debug-tool-list、model-manager、onboarding、space-bot-publish-to-base 等，分别提供 Bot 配置上下文、编辑器 Store、对话背景、调试工具列表、模型管理、Onboarding 场景、发布到基础服务等能力。
		- @coze-arch/*：如 bot-api、bot-http、bot-space-api、bot-utils、logger、report-events、tea、i18n、hooks、idl 等，构成 API 请求、数据模型、日志与埋点、国际化等基础设施层。
		- @coze-common/*：如 chat-area、assets、biz-components、editor-plugins、md-editor-adapter、prompt-kit 等，提供通用 UI 模块与编辑器相关能力。
		- @coze-data/*、@coze-devops/*、@coze-foundation/*、@coze-studio/*：分别承担数据层、调试面板、全局账号 / 企业信息、Studio 侧 Store 与组件等。
	- 集成方式：
		- 优先通过这些内部包暴露的 Hook / Context / Store 而非直接调用底层 HTTP，保证跨项目一致性。
		- 开发时如需新增依赖，应在相应子包中先增加导出，再在本包 package.json dependencies 中标记为 workspace:*。
- 与后端通信
	- 直接 HTTP 请求通常通过 @coze-arch/bot-http、@coze-arch/fetch-stream 等封装模块；
	- 数据模型来自 @coze-arch/idl / @coze-arch/bot-api，避免在本包内手写接口类型。

## 项目流程与规范

- 分支与提交流程
	- 仓库整体遵循 Rush monorepo 流程：
		- 对本包改动通常伴随 apps/coze-studio 或其它包的联动修改，需要在根目录执行 rush update / rush build 对项目整体做校验。
		- 具体分支命名、CI 规则参考仓库根目录 README.md 与团队规范（不在本文件重复）。
- 代码质量要求（结合 rushx-config.json）
	- 本包标记为 level-3：
		- codecov 默认 coverage = 0，incrementCoverage = 0，意味着当前对子包没有强制覆盖率门槛，但仍建议为复杂逻辑编写单测。
	- packageAudit 要求每个包至少含有 eslint.config.js，本包已配置并应保持不删除。

## 非常规 / 需要特别注意的点

- build 脚本 "exit 0"：
	- 表明本包暂不承担独立打包任务；真正产物来自上层应用构建。新增导出时只需保证 TS 编译通过与 Lint 正常，无需单独编译产物目录。
- Context + Service 实例模式：
	- 不要在多个组件中各自 new Service，统一在 Provider 中通过 useCreation 创建并从 Context 下发，避免状态不一致与埋点重复。
- Store 获取方式：
	- 从 @coze-agent-ide/bot-editor-context-store 解构出的 storeSet 提供多个 useXxxStore；
	- 使用时通常直接调用 useXxxStore.getState() 或作为 Hook 使用。新增逻辑应遵守现有模式，避免自行创建重复的 Zustand store。
- 内部路径导入：
	- 对外使用包 exports 提供的路径（如 '@coze-agent-ide/space-bot/authorize-button'），在本包内则使用相对路径（../../service/...）。
	- 在重构或新增文件时，注意同步更新 package.json 的 exports 与 typesVersions，保持对外 API 稳定。

在修改或新增功能前，建议先确认：是否已有相近的 Service / Hook / 组件可复用，并遵循上述层次与集成方式，以保持整个 Agent IDE 空间 Bot 能力的一致性与可维护性。
