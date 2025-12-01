# @coze-common/chat-hooks 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/hooks）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 本包 npm 名称为 @coze-common/chat-hooks，位于前端单仓 common/chat-area 体系下，职责是提供「与聊天场景相关的纯逻辑 React Hooks 工具」。
- 源码主入口为 [src/index.ts](src/index.ts)，统一导出当前全部公共 Hook：
	- useImperativeLayoutEffect：对 React layout effect 行为做封装，便于在复杂布局场景下以更友好的方式进行 imperative 更新；
	- useSearch：封装搜索相关状态/防抖/结果派发等逻辑，供聊天搜索等上层 UI 复用；
	- useEventCallback：提供稳定引用的事件回调封装，避免闭包陷阱和不必要的重渲染。
- 本包被视作「工具库」，不直接关联 UI 组件和具体业务页面，而是被 chat-area 系列包以及更上层的 Studio/Agent IDE 等应用消费。

## 2. 目录结构与代码组织

核心结构（省略依赖缓存/构建产物）：

- 根目录
	- [package.json](package.json)：
		- main 指向 src/index.ts，代表以源码形式参与 workspace 构建；
		- scripts：build 为 no-op（exit 0），lint/test 由统一工具链接管；
		- devDependencies/peerDependencies 要求 React 18、lodash-es 等，表明本包是 React Hooks 库，运行时由上层应用提供。
	- [README.md](README.md)：对外 README，简要列出当前公开导出的 Hook 名称和用法说明。
	- [eslint.config.js](eslint.config.js)：使用 @coze-arch/eslint-config，preset 为 web，保证与整个前端仓统一的 ESLint 规范。
	- [vitest.config.ts](vitest.config.ts)：通过 @coze-arch/vitest-config.defineConfig，preset 为 web，统一测试运行环境。
	- tsconfig*.json：由 @coze-arch/ts-config 提供基础配置，结合 Rush/PNPM 的工程引用机制参与整体类型检查与构建。
- src 目录
	- [src/index.ts](src/index.ts)：本包唯一公共入口，只做具名 re-export，不包含业务实现逻辑；
	- [src/hooks](src/hooks)：存放具体 Hook 实现文件：
		- use-imperative-layout-effect.ts
		- use-search.ts
		- use-event-callback.ts
	- [src/typings.d.ts](src/typings.d.ts)：通过三斜线引用 @coze-arch/bot-typings，在本包范围内补充聊天/机器人相关全局类型。
- 测试目录
	- [__tests__](__tests__)：与每个 Hook 一一对应的测试文件：
		- use-imperative-layout-effect.test.ts
		- use-search.test.ts
		- use-event-callback.test.ts

结构设计要点：实现文件集中在 src/hooks 下，统一从 src/index.ts 导出；类型补充集中在 typings.d.ts；测试文件平行放在 __tests__ 目录，命名与被测 Hook 一致，便于查找与维护。

## 3. 开发、构建与测试工作流

### 3.1 环境与依赖

- 整体前端工程采用 Rush + PNPM 管理，Node 版本、PNPM 版本等见 [frontend/README.md](../../../../README.md)。
- 安装依赖的推荐方式：在仓库根目录执行 `rush update`，不要在子包内单独使用 `npm install`/
	`pnpm install`。

### 3.2 本子包常用脚本

在目录 frontend/packages/common/chat-area/hooks 下运行：

- `npm run lint`
	- 使用 @coze-arch/eslint-config（preset:web）对本包进行 ESLint 检查；
	- 如需调整规则，应优先在统一配置包中修改，而不是在本地禁用核心规则。
- `npm run lint:type`
	- 通过 tsc -p tsconfig.json --noEmit 执行类型检查，依赖 @coze-arch/ts-config 的工程配置；
	- 新增导出/泛型时要保证该命令无错误，再提交代码。
- `npm run test`
	- 使用 Vitest 运行单测；默认 `--passWithNoTests`，但当前包已存在针对三个 Hook 的测试文件；
	- 修改 Hook 行为时务必更新对应测试用例，保持行为契约明确。
- `npm run test:cov`
	- 在 test 基础上统计覆盖率，通过 @vitest/coverage-v8 实现；
	- 用于评估新逻辑是否被充分覆盖。
- `npm run build`
	- 当前实现为 `exit 0`；构建责任由上层工具（如 Rsbuild/统一打包配置）负责；
	- AI 不应在此包引入额外打包脚本或生成物目录，如需修改构建行为，应在 frontend/config 或 infra 层统一调整。

## 4. 项目约定与常见模式

### 4.1 Hook 设计约定

- 所有对外公开的 Hook 必须：
	- 在 [src/hooks](src/hooks) 下实现；
	- 在 [src/index.ts](src/index.ts) 中具名导出；
	- 在 [README.md](README.md) 的 "Exports" 列表中更新说明；
	- 拥有对应的测试文件（位于 __tests__，命名为 <hook-name>.test.ts）。
- Hook 实现应保持：
	- 纯逻辑 / 纯副作用模式，不直接持久化全局状态；
	- 只依赖 React、lodash-es 以及 @coze-arch/bot-typings 提供的类型，不直接访问 DOM 或 window，除非通过安全封装；
	- 参数与返回值使用显式 TypeScript 类型，避免 any。

### 4.2 代码风格与工具链

- ESLint：统一使用 @coze-arch/eslint-config，preset:web；不要在源码中大量使用 `// eslint-disable`，如遇与统一规则冲突，应优先优化实现而非屏蔽规则。
- TypeScript：
	- 继承 @coze-arch/ts-config；
	- 新增类型/接口应放在就近的实现文件或 typings.d.ts 中，避免在多个文件中重复声明相似类型。
- 测试：
	- 使用 Vitest + @testing-library/react-hooks（以及 jest-dom/react 生态）进行行为测试；
	- 测试重点是观察 Hook 对外暴露的状态与回调，而非内部实现细节。

## 5. 与外部依赖及其他子包的集成

- React 18：
	- 本包以 React 18 为基础，仅导出 Hook，不创建组件树或直接操作根节点；
	- 上层应用需在 React 渲染树中调用这些 Hook（遵守 Hook 规则）。
- lodash-es：
	- 作为 peerDependency 和 devDependency 存在，用于在搜索、事件绑定等逻辑中提供防抖/节流/集合操作等能力；
	- 新增对 lodash-es 的依赖时，优先按函数级引入（如 `import debounce from 'lodash-es/debounce'`），避免大包导入。
- @coze-arch/bot-typings：
	- 通过 typings.d.ts 引入，提供 Coze 机器人/聊天领域的补充类型，例如对话消息、会话上下文等；
	- 当 Hook 参数/返回值涉及这些领域对象时，应直接复用该包定义的类型，而不是在本地复制类型结构。
- 其他 chat-area / common 包：
	- 本包定位为「底层 hooks 工具」，通常被聊天 UI、消息列表、搜索面板等上层包引用；
	- 修改公共 Hook 的签名或语义前，应在仓库内全局搜索调用点，确认不会破坏其他子包的行为。

## 6. 协作与提交流程

- 分支策略与提交规范遵循整个 tinker-studio 仓库的统一流程（在根目录文档和 CI 配置中体现），本包不单独定义分支策略。
- 在对外 API 产生破坏性变更时，推荐流程：
	1. 更新 Hook 实现与类型签名；
	2. 同步更新 __tests__ 中的断言，确保行为变化被准确覆盖；
	3. 在本包和调用方包中跑通 `npm run lint`、`npm run lint:type`、`npm run test`；
	4. 在 README 的 Exports 区域补充或修正文档描述。

## 7. 面向 AI 编程助手的操作建议

- 在本子包进行开发或重构时，推荐遵循：
	- 所有新增 Hook 统一放在 src/hooks 下实现，并从 src/index.ts 导出；
	- 为重要逻辑补充/更新对应测试文件，保持 __tests__ 与 hooks 文件一一对应；
	- 任何修改完成后，至少在本包范围内运行 lint、类型检查与单测；
	- 避免引入与 monorepo 不一致的工具链（例如单独的 webpack/vite 配置），只使用仓库既有的 @coze-arch 系列配置包。
- 若需要跨包协作（如为聊天 UI 包新增特性并依赖本 Hook 包）：
	- 先在本包内定义清晰、通用的 Hook API；
	- 再在上层包中消费这些 Hook，保持职责划分：本包负责纯逻辑，上层负责渲染与具体交互。

