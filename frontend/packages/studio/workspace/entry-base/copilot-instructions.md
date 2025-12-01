# workspace-base 子包开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/workspace/entry-base）中安全、高效地协作开发。

## 全局架构与角色定位
- 本子包是 Coze Studio 工作空间业务入口的 UI 与路由基础库，通过 package.json 的 exports 向其他应用暴露页面与工具组件：
	- `.`（默认）：导出入口 index.tsx 中聚合的业务组件与工具方法。
	- `./knowledge-upload`、`./knowledge-preview`、`./develop`、`./library`：分别对应 src/pages 下的独立页面入口，供主应用按需懒加载。
- 主应用 [frontend/apps/coze-studio/src/routes/async-components.tsx](frontend/apps/coze-studio/src/routes/async-components.tsx#L1-L200) 通过 React.lazy + 动态 import 使用本包导出的页面组件，实现工作台、知识库、数据库等路由的按需加载。
- `src/index.tsx` 扮演汇总出口角色：
	- 导出 Plugin、Tool、MocksetDetail、MocksetList、DatabaseDetailPage 等页级组件，供 Studio 的插件管理、工具配置、Mock 集管理、数据库详情等业务使用。
	- 导出 `resourceNavigate` 与 `compareObjects` 等工具函数，为上层的插件导航与对象对比提供统一实现。
	- 导出 Creator、Layout、WorkspaceEmpty 等通用 UI 组件以及 highlightFilterStyle 常量，为 Studio 工作空间相关页面提供统一的布局与视觉样式。
- 本子包自身不直接发起复杂网络请求，而是通过 workspace 级别的依赖（如 `@coze-studio/bot-plugin-store`、`@coze-data/*` 等）传入的数据 props 与上下文来渲染 UI，因此改动时需保证 props 和导航契约不被破坏。

## 目录结构与关键文件
- 根目录
	- package.json：定义导出入口、依赖与脚本，是理解模块角色的首要文件。
	- eslint.config.js / vitest.config.ts / tsconfig*.json：统一采用 `@coze-arch/*` 预设，说明此包遵循 monorepo 的统一 lint、测试与构建规范。
	- README.md：简要说明为 workspace 入口 package，并给出基础命令；实际业务细节集中在 src 目录。
- src/
	- index.tsx：本包真正的公共 API 汇总出口。
	- utils.ts：
		- `compareObjects<T>(obj1, obj2, keys)`：基于 lodash-es 的 `pick` 和 `JSON.stringify` 实现的浅字段相等比较，主要用于依赖部分字段判断是否需要刷新视图或发起请求。
		- `resourceNavigate(navBase, pluginID, navigate)`：构造插件资源导航对象，返回 `PluginNavType`，上层通过调用 `toResource`、`tool`、`mocksetList`、`mocksetDetail`、`cloudIDE` 等方法实现统一的 URL 拼接与路由跳转。
	- components/
		- creator.tsx：工作空间内通用创建入口组件（如创建 bot、plugin 等），通常结合业务 store 使用。
		- layout/list.tsx：封装列表页通用布局（Layout、Header、SubHeader、HeaderActions、HeaderTitle、SubHeaderFilters、Content）。Studio 下所有列表型页面尽量共用此布局以保证一致性。
		- workspace-empty.tsx：工作空间无数据时的空态 UI 组件。
	- constants/
		- filter-style.ts：导出 `highlightFilterStyle` 常量，用于在筛选器高亮场景下保证统一样式。
	- pages/
		- plugin/、tool/、mockset/、mockset-list/、database/：业务页实现，分别对接插件管理、工具配置、Mock 集详情/列表、数据库详情等场景。
		- develop/、library/、knowledge-preview/、knowledge-upload/：工作空间内的开发页、资源库页以及知识库预览/上传页，通过 exports 暴露给主应用的异步路由。
	- typings.d.ts：为 TS 类型增强提供本包特有类型或对外扩展声明（如 window 上的额外字段）。
- __tests__/
	- 当前仅占位（.gitkeep），测试样例统一走 vitest，后续新增的公共逻辑建议在此新增单元测试文件。

## 构建、测试与调试工作流
- 依赖安装与整体准备：
	- 在 monorepo 根目录执行 `rush update`，由 Rush 统一安装与链接所有子包依赖。
- 本子包脚本（在 workspace/entry-base 目录下）：
	- `npm run build`：当前实现为 `exit 0`，构建逻辑统一由上层 rsbuild / Rush 任务控制，本包只作为源代码库和类型提供方。
	- `npm run lint`：使用 `@coze-arch/eslint-config` 的 web 预设，对 TS/TSX 源码进行 lint，带缓存。
	- `npm run test`：通过 vitest 执行测试，`vitest.config.ts` 使用 `@coze-arch/vitest-config` 的 `preset: 'web'`。
	- `npm run test:cov`：在 `npm run test` 基础上打开 coverage 统计。
- 开发联调方式：
	- 本包不单独提供 dev server，而是通过主应用 `@coze-studio/app`（coze-studio）加载。
	- 在 frontend/apps/coze-studio 目录下可使用 workspace 级脚本（详见该 app 下 README / rushx-config），启动整体前端应用后，即可在浏览器中访问 workspace 相关路由验证本包改动。

## 项目约定与编码风格
- 统一使用 React 18 + TypeScript，UI 相关依赖（styled-components、@coze-arch/coze-design 等）由上层包 / 设计体系提供，本包只在需要时局部引用。
- 所有新文件前应保留 Apache-2.0 版权头，与现有文件保持一致。
- 导出约定：
	- 页级组件统一通过 `src/pages/**/index.tsx` 暴露，并在 `src/index.tsx` 中聚合导出。
	- 通用工具、布局、常量均在 index.tsx 中转导，供外部只通过 `@coze-studio/workspace-base` 单点引用。
- 导航与路由：
	- 与插件相关的路由跳转必须通过 `resourceNavigate` 返回的对象完成，禁止在页面中手写 plugin 相关 URL，以避免路径变更时遗漏。
	- 知识库相关页面不在 index.tsx 中直接导出，而是通过 package.json 的子路径 export（`./knowledge-preview` / `./knowledge-upload`）供主应用按需引用，以减少首屏 bundle 体积。
- 工具函数使用：
	- `compareObjects` 仅比较指定 keys 对应的字段，且使用 `JSON.stringify`，不适合包含函数、循环引用或顺序敏感集合的对象；使用时需确保传入的是简单 JSON 风格数据。

## 与外部子包的集成与依赖
- 业务依赖主要集中在以下几个方向：
	- 工作空间与账号：`@coze-foundation/account-adapter`、`@coze-foundation/layout`、`@coze-foundation/space-ui-adapter`、`@coze-foundation/space-ui-base` 等用于空间布局、导航与账号态管理。
	- 插件与 Bot：`@coze-agent-ide/*`、`@coze-studio/bot-plugin-store`、`@coze-studio/bot-utils`，提供 Bot 与插件编辑器、插件存储及上下文能力。
	- 数据与知识库：`@coze-data/database-v2*`、`@coze-data/knowledge-*`、`@coze-data/utils`，用于数据库与知识库资源的读写、加工与状态管理。
	- 通用组件与工具：`@coze-common/*`、`@coze-community/components` 等提供 UI 组件、聊天区工具、mitt 等事件总线能力。
	- 监控与日志：`@coze-arch/logger`、`@coze-arch/report-events` 用于日志与埋点；本包中如需新增埋点应复用这些封装。
- 外部包通常以 hook + context 或 service 单例的形式向本包注入数据；在修改页面组件时，应优先沿用这些注入方式，不直接在本包中新增跨域 API 调用。

## 项目流程与协作规范
- 版本与发布：
	- 版本号由 Rush / pnpm workspace 管理，本包的 version 字段主要用于标记，与实际部署版本同步由仓库级流程控制。
- 分支与提交流程：
	- 仓库整体遵循 Coze monorepo 的分支策略（通常为 main + feature 分支），在本包中修改代码时应保持提交粒度清晰，可结合 backend/frontend 目录下的 CONTRIBUTING 说明。
	- 所有变更应通过 lint 与（如有）相关测试；对公共导出 API 的变更需要特别说明并同步给使用方子包（如 entry-adapter、apps/coze-studio 等）。

## 特殊/不寻常的特性说明
- 构建脚本 `npm run build` 目前是 no-op（`exit 0`），说明本包不承担独立打包责任，只作为源码与类型的提供方；正式构建在更高一层统一完成，修改构建逻辑需到 frontend/config / rsbuild 相关子包处理。
- 知识库页面采用“只通过子路径导出而不在 index.tsx 直接 re-export”的模式，并在 index.tsx 中添加显式注释，目的是严格控制首屏 bundle 体积，避免知识库复杂依赖影响工作空间主流程加载时间。
- 导航函数 `resourceNavigate` 将所有资源跳转逻辑集中到一个工厂方法中，便于后续统一修改 URL 结构；在新增 plugin 相关路由能力时，优先扩展此函数，而非在各页面里各自拼接路径。

## 给 AI 编程助手的具体建议
- 在修改或新增页面时：
	- 优先查看 `src/pages` 下同类页面的实现风格，保持布局使用 Layout 组件、空态使用 WorkspaceEmpty、筛选样式使用 highlightFilterStyle 等一致性。
	- 不要直接改动外部依赖包的类型与实现，如需变更其行为，应通过它们暴露的 adapter/hooks 或在上游子包中调整。
- 在提供重构建议时：
	- 避免随意更改导出名或导出路径，以免破坏 apps/coze-studio 或 entry-adapter 中的 dynamic import；如必须调整，需同步更新对应路由文件。
	- 对公共工具（如 utils.ts）的签名变更要谨慎，先通过全局搜索确认调用方，并在必要时提供向后兼容过渡。

