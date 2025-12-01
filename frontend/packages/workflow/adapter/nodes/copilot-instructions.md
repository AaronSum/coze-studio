# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/adapter/nodes）中安全、高效地协作开发。

## 总览与架构角色

@coze-workflow/nodes-adapter 是工作流画布节点系统的「适配层」包，主要职责是：
- 将 workflow 节点体系（@coze-workflow/nodes、@coze-workflow/components）中的通用 UI / 逻辑封装成可复用 React 组件；
- 为上层业务（如 @coze-workflow/playground、@coze-project-ide/*、@coze-studio/app）提供一个更稳定的节点 UI 入口；
- 自身只暴露极薄的一层导出（src/index.tsx -> DemoComponent），更多是一个可复制的模板工程，当前实际业务代码很少。

本包与整体工作流体系的关系大致如下：
- 工作流运行 & 配置：由 @coze-workflow/base、@coze-workflow/nodes、@coze-workflow/render 等负责；
- 业务应用集成：@coze-workflow/playground / playground-adapter 等将工作流 UI 嵌入到 Coze Studio；
- 本包：为节点相关 UI/组件提供一个 adapter 包位点，以后可以在不破坏主包的前提下，分层演进节点表现层。

当前仓库代码量很小（仅 Demo 级别），但在 Rush workspace 中已经作为独立一级包参与依赖图，应按正式包对待。

## 代码结构

目录结构（简化）：
- src/
	- index.tsx：包主入口，目前只从 ./demo 重新导出 DemoComponent；
- stories/
	- demo.stories.tsx, hello.mdx：Storybook 示例，用于组件开发/演示；
- __tests__/：当前仅 .gitkeep，占位目录，测试由 vitest 配置支撑；
- config/：保留工程级配置（打包、工具链），多数继承自上游 @coze-arch/* 包；
- .storybook/：Storybook 配置目录（目前只在 README 中提到，实际文件可能按模板补齐）。

该包本质上是一个「React + Storybook 组件包模板」，实际业务组件可以直接放到 src 下任意子目录，再通过 src/index.tsx 导出公共 API。

## 依赖与集成要点

package.json 关键点：
- 运行时依赖：
	- classnames：用于处理 CSS class 拼接，是唯一直接依赖；
- 开发&工程依赖（全部为 workspace:* 或 dev-only）：
	- @coze-arch/bot-typings：提供 Bot / Workflow 统一类型定义，应优先复用其中类型；
	- @coze-arch/eslint-config, @coze-arch/stylelint-config, @coze-arch/ts-config, @coze-arch/vitest-config：统一的前端工程规范与工具配置；
	- react, react-dom：仅作为 devDependency + peerDependency，本包在运行时由宿主 app 提供 React。

与其他 workflow 包的关系（来自 rush workspace 拓扑）：
- 本包被 @coze-workflow/playground 直接依赖，用于工作流调试/运行时的节点 UI；
- 本包与 @coze-workflow/base / @coze-workflow/components / @coze-workflow/nodes 等共享同一批 @coze-arch/* 基础设施；
- 若在这里扩展/修改节点 UI，需要考虑 playground、中台 Studio 各处复用情况，避免破坏向后兼容。

## 构建、测试与开发流程

### 本包常用命令（在子包目录执行）

- 安装/更新依赖（在仓库根目录）：
	- rush install / rush update
- Lint：
	- npm run lint
	- 使用 @coze-arch/eslint-config，preset 为 web，规则集中管理在 frontend/config/eslint-config；
- 测试：
	- npm run test：调用 vitest --run --passWithNoTests
	- npm run test:cov：在 test 基础上启用 @vitest/coverage-v8；
	- 覆盖率门槛：根据 rushx-config.json，对于 level-3 包，基础 coverage 要求为 0，但增量覆盖也为 0，实践中仍建议在改动逻辑时补测试；
- 构建：
	- npm run build：当前实现为 exit 0，仅占位；真实打包通常由上游 builder 或统一打包流程负责；
- Storybook 开发（参考 README）：
	- npm run dev：本地 storybook/组件开发，具体脚本在统一模板或上层命令中配置。

### TypeScript 配置

- tsconfig.json：
	- 作为 project reference root，exclude: ["**/*"], 仅维护多 tsconfig 之间引用关系；
	- references -> tsconfig.build.json, tsconfig.misc.json；
- tsconfig.build.json：
	- 继承 @coze-arch/ts-config/tsconfig.web.json；
	- outDir: dist, rootDir: src, module: ESNext, target: ES2020, moduleResolution: bundler；
	- include: ["src"], 排除 dist/node_modules；
- tsconfig.misc.json：
	- 用于测试、stories 等非生产入口；
	- include: ["__tests__", "vitest.config.ts", "stories"]。

在新增文件时：
- 业务组件放在 src 下即可自动参与构建；
- 测试文件放入 __tests__ 或与源码同目录且被 vitest 配置捕获；
- Storybook stories 放到 stories/，并使用 .stories.tsx 命名规范。

## 代码与模式约定

### 组件设计

- React 版本：18.x，使用函数组件 + hooks 风格；
- 类型：必须使用 TypeScript，类型来源优先：
	- @coze-arch/bot-typings 中已定义的 Workflow / Node / Context 等类型；
	- 如果本包需要新增类型，建议放在 src/typings.d.ts 或独立类型文件中，并注意与上游 @coze-workflow/base / nodes 对齐；
- CSS / 样式：
	- 通常通过 classnames 组合 className；
	- 具体样式方案由上层 UI 库和 Tailwind / Semi 统一管理，本包不应引入额外样式系统。

### Adapter 角色与边界

- 本包应避免：
	- 直接发起网络请求或依赖具体后端接口；
	- 自己维护 workflow 状态机或运行时，只负责 UI 渲染和输入/事件透传；
- 本包可以：
	- 将通用 Node 组件（如参数面板、状态展示、错误提示）抽象成独立 React 组件；
	- 提供与 @coze-workflow/nodes 数据结构对齐的 props 接口，并在内部做轻量适配/转换；
	- 封装与 @coze-arch/bot-typings 中的类型之间的映射逻辑，但应保持无副作用、无全局状态。

### Lint / Style 规范

- eslint.config.js：
	- 使用 @coze-arch/eslint-config.defineConfig({ packageRoot: __dirname, preset: 'web' })；
	- 自定义规则（rules 字段）默认为空，项目级 rules 应统一在配置仓；
- stylelint：
	- 由 @coze-arch/stylelint-config 提供，当前包内不需要单独配置文件；
- 代码风格：跟随 monorepo 统一规范（例如 import 顺序、semi, quote 风格），避免在本包内覆盖规则。

## 与上游/下游的协作注意事项

- 上游：
	- 当需要使用 workflow 基础能力（如节点 schema、执行结果等），优先从 @coze-workflow/base / @coze-workflow/nodes / @coze-workflow/components 中查找现有实现；
	- 如果需要修改这些基础包 API，应先在对应包内完成变更，并在本包中做适配，而不是在这里硬编码内部实现细节；
- 下游：
	- @coze-workflow/playground 将本包作为节点 UI 提供者；任何破坏性的导出变更（如移除原有导出、修改公共组件 props）都要评估 playground 及 @coze-project-ide/*、@coze-studio/app 的影响；
	- 新增导出组件时，保持语义清晰、命名稳定，建议集中从 src/index.tsx 统一导出。

## 项目流程与协作

- 分支&提交：遵循仓库全局规范（参考根目录 CONTRIBUTING.md），通常：
	- 功能/修复在 feature 分支完成，再发起 PR；
	- 通过 Rush 统一管理版本与变更，避免单包手动改版本；
- CI / 质量门槛：
	- monorepo 层面会执行 lint、test 等命令，并检查 codecov；
	- 虽然 level-3 的覆盖率门槛较低，但在修改核心 UI / 适配逻辑时，应补充 vitest + @testing-library 的测试用例。

## 在本包中安全协作的具体建议

- 扩展组件时：
	- 保持 props 只表达 UI 需求，将业务/数据流留给上游 workflow / data 层；
	- 尽量通过类型定义（TS interface/type）表达与 @coze-arch/bot-typings 的映射关系；
- 重构时：
	- 优先在 stories 中补齐用例，以便通过 Storybook 手动验证；
	- 再在 __tests__ 中补充关键交互/渲染逻辑的单测；
- 变更导出：
	- 所有公共导出从 src/index.tsx 统一维护，删除/重命名导出前需检查下游依赖图（可通过 Rush 工具或全局搜索）。

以上约定均基于当前仓库实际结构和配置，如上游包结构发生调整，请同步更新本说明。