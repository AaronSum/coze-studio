# AI 协作开发说明 - @coze-studio/components

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/components）中安全、高效地协作开发。

## 一、子包定位与整体架构

- 本包名称：`@coze-studio/components`，位于 Rush+PNPM 管理的前端 monorepo 中，用于沉淀 Studio 业务层的 React 组件。
- 上层结构：frontend/ 为前端根目录，apps/ 存放应用（如 coze-studio），packages/ 存放各能力层包，本子包属于 studio 系列的 UI 组件库，可被多个应用复用。
- 构建/测试工具：共享前端仓的统一配置体系 —— TypeScript + Vitest + ESLint + Stylelint，测试配置通过 `@coze-arch/vitest-config` 预设，Lint 通过 `@coze-arch/eslint-config` 预设。
- 输出形式：通过 package.json 中的 `exports` 与 `src/index.ts` 统一导出业务组件与类型，供其他包以 ESM 方式引入；部分子路径（如 `./markdown-editor`、`./sortable-list-hooks`）提供细粒度入口。
- 架构特点：
	- 本包主要是“无状态 UI / 轻逻辑”组件，复杂状态通常依赖外部 store（如 `@coze-arch/bot-studio-store`、Zustand 等）在上层控制，这里只负责交互与展示。
	- DnD、Markdown 编辑等重依赖在入口仅导出 **type**，通过延迟加载和 Provider 避免首屏不必要体积。

## 二、目录结构与职责

核心目录（相对路径均以 frontend/packages/studio/components 为根）：

- src/index.ts
	- 统一的组件导出入口，仅导出必要的组件和类型。
	- 特别注意：sortable-list 相关只在此处导出 **类型**（`TItemRender`, `ITemRenderProps`, `ConnectDnd`, `OnMove`），避免在消费端首次引入时强依赖 `react-dnd`。
- src/sortable-list/
	- index.tsx：通用可排序列表组件 `SortableList`，封装了 DnD 拖拽排序逻辑，通过 `useDnDSortableItem` hook 驱动。
	- hooks.ts：定义 `ConnectDnd`, `OnMove`, `UseDndSortableParams`, `useDnDSortableItem` 等 DnD 相关类型与逻辑供上层复用。
- src/dnd-provider/index.tsx
	- `DndProvider` 组件：封装 `react-dnd` 的 Provider，并通过内部 `DnDContext` 检测是否已在上层 Provider 中，避免重复挂载 HTML5Backend。
- src/markdown-editor/
	- index.tsx：完全受控的 Markdown 文本编辑组件 `MarkdownEditor`。
	- hooks/use-markdown-editor.ts：处理输入变更、拖拽上传、工具栏操作等逻辑，组件本身保持瘦视图层。
	- components/ 下的 `UploadProgressMask`, `ActionBar` 等纯 UI 部件，样式通过 Less 模块 `index.module.less` 管理。
- 其他典型业务组件目录：
	- avatar-name/：头像 + 用户名展示（含可选标签图标），支持测试覆盖。
	- select-space-modal/：空间选择弹窗。
	- project-duplicate-modal/：项目复制弹窗及配套 hooks API（如 `useProjectTemplateCopyModal`、`appendCopySuffix`）。
	- plugin-limit-info/：插件使用额度/限制提示，导出 `usePluginLimitModal`, `transPricingRules` 等逻辑工具。
	- ui-breadcrumb/, ui-search/, loading-button/, sticky/, tea-exposure/ 等：统一风格的 UI 原子/复合组件，多依赖 `@coze-arch/coze-design` 与内部风格规范。

测试与配置：

- __tests__/
	- avatar-name.test.tsx：使用 `@testing-library/react` 和 Vitest 进行组件行为测试，演示了基本渲染与 DOM 断言模式。
	- select-space-modal.test.tsx：测试模态类组件的基础交互。
- vitest.config.ts
	- 基于 `@coze-arch/vitest-config` 预设的测试配置，环境是 `happy-dom`，并通过 `setupFiles` 与 `server.deps.inline` 统一处理全局初始化和依赖。
- eslint.config.js / .stylelintrc.js
	- 使用 `@coze-arch/eslint-config` + `@coze-arch/stylelint-config`，preset 为 `web`，尽量不要在本包中增加与团队规范冲突的自定义规则。

## 三、依赖与协作边界

关键依赖（仅列出对本包行为影响较大的部分）：

- UI & 设计体系
	- `@coze-arch/coze-design`：统一 UI 组件与样式基础，遵从设计规范；在本包中一般通过具体组件子依赖引用。
	- `@blueprintjs/core`、`@douyinfe/semi-icons`：特定组件使用的成熟 UI 库/图标库。
- 状态与工具
	- `zustand`、`immer`、`lodash-es`、`dayjs`、`ahooks`：多数为辅助状态管理/数据处理工具。
	- `@coze-arch/bot-hooks`, `@coze-arch/web-context`, `@coze-arch/i18n`, `@coze-arch/logger`, `@coze-arch/report-events` 等：用于与 Studio 其他层交互（API 调用、上下文读取、埋点等），本包组件通常通过 props 方式与这些工具间接协作，而非在组件内部直接做复杂业务逻辑。
- 交互特性
	- `react-dnd` + `react-dnd-html5-backend`：处理拖拽排序（如 `SortableList`）；统一经由 `DndProvider` 封装，避免多 Provider 嵌套问题。
	- `react-markdown`：在 Markdown 相关组件中使用（如需渲染 Markdown 视图时）。
- 测试 & 开发
	- `@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/react-hooks`：测试用，不应在生产代码中引入。

协作边界约定：

- 组件 **尽量由上层注入业务数据与回调**，不要在组件内部直接访问跨包 store 或全局单例，除非已有成熟模式（参考同目录组件）。
- 可排序、拖拽、上传等“重交互”逻辑应抽象为 hooks + 轻视图组合；遵循 `use-xxx` 命名，并放置到组件子目录的 hooks/ 中。
- 需要对上层暴露行为时，优先通过 **hooks + 受控组件** 组合，而非暴露过多的命令式 ref API。

## 四、开发工作流（本子包）

在 frontend/ 根目录已通过 Rush 管理依赖；在本子包内部，主要使用以下命令（工作目录：frontend/packages/studio/components）：

- 安装/更新依赖（在仓库根目录）
	- `rush install` 或 `rush update`：统一安装和更新所有包依赖，本包依赖通过 package.json 中 `workspace:*` 解决。
- 本包脚本（package.json 中）：
	- `npm run build`：目前被设置为 `exit 0`，即占位命令；真正的打包流程在更上层（如 Rsbuild/Rush 发布流程）中处理。本包不单独产出独立构建产物，仅作为其他应用/包的依赖参与整体构建。
	- `npm run lint`：运行 ESLint（`eslint ./ --cache`）。应在提交前运行，特别是 AI 生成代码后。
	- `npm run test`：使用 Vitest 执行单测，配置由 vitest.config.ts 统一管理。
	- `npm run test:cov`：当前为 `exit 0` 占位，如需要覆盖率需要先调整脚本/配置。
- Storybook
	- README 提到本模板支持 Storybook，但当前仓库未在本子包内看到典型的 storybook 配置文件；如新增故事，请保持与团队现有 Storybook 结构一致（通常在 apps 或单独的 storybook 项中集中管理）。

调试建议：

- 推荐通过上层应用（如 apps/coze-studio）引入本包组件进行端到端调试，以确保样式与上下文一致。
- 单组件调试可以使用 `npm run test -- --watch` 配合 Testing Library 快速迭代，或在未来补充 Storybook/Playground 支持。

## 五、项目约定与编码规范

- TypeScript 与类型导出
	- 组件需提供清晰的 props 接口，并在必要时通过 `export type XxxProps` 暴露，方便上游包消费与推断。
	- 注意 package.json 中 `typesVersions` 的子路径映射，对 `coze-brand`、`markdown-editor`、`sortable-list-hooks` 等导出路径的类型声明保持同步。
- 命名规范
	- 组件目录与主组件名称保持一致（如 avatar-name/ 对应 AvatarName）。
	- 受控组件通常使用 `value` + `onChange` 约定；只读属性/配置使用 klar 名称（如 `disabled`, `placeholder` 等）。
	- Hook 使用 `useXxx` 命名，避免在 index.ts 直接导出匿名 hook。
- 样式规范
	- 样式多使用 Less Module（`*.module.less`），类名在 TSX 中通过 `styles['xxx']` 或 `styles.xxx` 引用，禁止硬编码全局类名，除非是设计系统/布局框架约定的公共类。
	- 若需要修改样式规则，应优先在组件局部样式文件中修改，不要绕过 Stylelint 规则。
- 性能与首屏
	- 避免在 `src/index.ts` 直接导出会引入重依赖的实现组件（如包含大型第三方库或 context 绑定），此时可以只导出类型或 factory 函数，由上层按需动态加载。
	- 拖拽、Markdown Preview 等功能建议在路由或模块级别按需加载。
- 国际化与埋点
	- 文案通常通过上层传入，或通过 `@coze-arch/i18n` 获取；在本包中新增硬编码文案前，请检查是否已有 i18n 方案。
	- 埋点（`@coze-arch/report-events`/`TeaExposure`）需要严格遵守现有事件命名和上报策略，可参考 src/tea-exposure/ 下实现方式。

## 六、关键组件与集成细节

- SortableList（src/sortable-list/index.tsx）
	- 使用范型 `<TData extends object>` 支持任意数据类型，通过 `list` + `onChange` 实现完全受控排序。
	- `itemRender` 是上层注入的渲染函数，接收 `data` 与 DnD 状态/连接函数（`connect`, `isHovered`, `isDragging`）。
	- 内部会在 `onMove` 中计算新列表顺序，若源/目标索引未变化则不会触发 `onChange`，以减少不必要渲染。
	- 与 DndProvider 强绑定：外层自动包裹在本包的 `DndProvider` 中，上层通常不需要额外提供 react-dnd Provider。
- DndProvider（src/dnd-provider/index.tsx）
	- 内部 `DnDContext` 记录当前是否存在外层 Provider，如果已经包裹则不再挂载 `HTML5Backend`，防止重复 context。
	- 若你在上层应用中已经有统一的 DnD Provider，可通过在更外层注入 `DnDContext` 的方式来避免嵌套冲突，或复用当前模式。
- MarkdownEditor（src/markdown-editor/index.tsx）
	- 设计为纯受控组件：必备 `value` 与 `onChange`，其他行为（如上传、自定义上传逻辑）通过 `customUpload`, `getUserId` 等 props 注入。
	- 文本区、工具栏和上传遮罩完全解耦，通过 `useMarkdownEditor` hook 统一驱动状态。
	- 自定义上传逻辑（`CustomUploadParams`, `CustomUploadRes`）允许上层接入不同的文件服务/策略。
- AvatarName（src/avatar-name/）
	- 测试（__tests__/avatar-name.test.tsx）验证了头像图片数量和 `@username` 展示格式；新增功能应保持接口与行为兼容，或同步更新测试。
- PluginLimitInfo / TeaExposure 等埋点类组件
	- 这些组件/工具主要承担“提示 + 埋点”的职责，调用链可能连接到 `@coze-arch/report-events`、`@coze-arch/logger`，在调整时需关注埋点字段和事件名的一致性。

## 七、流程与协作规范

- 代码提交前：
	- 至少在本包范围运行 `npm run lint` 与 `npm run test`。
	- 若修改影响到导出接口（`src/index.ts` 或 package.json `exports`/`typesVersions`），需特别审查被 apps / 其他 packages 引用的路径是否仍然有效。
- 分支与发布：
	- 整体由仓库根的 Rush/CI 流程管理，本包不单独发布；新增依赖或破坏性变更需遵循仓库统一的变更说明机制（changelog / changefile，视 Rush 设置而定）。
	- 不要在本包中手动修改构建脚本版本，统一通过前端仓根目录维护。

## 八、对 AI 编程助手的特别提示

- 在新增组件时：
	- 参考已有目录结构（独立文件夹 + index.tsx + hooks/ + components/ + 样式模块），并在 src/index.ts 决定是否导出以及导出粒度（组件/类型）。
	- 优先复用现有设计系统组件与工具，而非重复造轮子。
- 在修改现有组件时：
	- 保持 props 兼容性，必要时通过新增可选 props 扩展，而不是变更现有含义。
	- 若必须做 breaking change，请在注释中标明原因，并提醒人工维护者在上层应用中同步调整。
- 在自动补全依赖时：
	- 遵循 package.json 里的注释约束，例如 `immer@^10.0.3 为脚本自动补齐，请勿改动`，不要擅自升级或删改这些依赖版本。
	- 新增依赖应保持与仓库整体技术栈一致（优先使用已在其他包中使用过的库），并通过 Rush 的流程统一安装。

