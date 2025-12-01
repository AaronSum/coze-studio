# @coze-project-ide/biz-plugin 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/biz-plugin）中安全、高效地协作开发。

## 1. 子包定位与整体作用
- 本子包位于 monorepo 路径：frontend/packages/project-ide/biz-plugin，对应 npm 包 `@coze-project-ide/biz-plugin`。
- 职责：为 Project IDE 提供“插件（Plugin）资源”的业务能力，包括：
  - 插件资源在左侧资源树中的创建、重命名、删除、复制/移动等操作；
  - 插件资源与“插件详情页 / 工具详情页 / Mock 集”等视图之间的导航；
  - 注入 `BotPluginStoreProvider` 及相关上下文，为 IDE 内的插件开发体验提供统一入口。
- 该子包更多扮演“业务拼装层（biz layer）”角色，强依赖其它基础包（framework、biz-components、bot-plugin-*、bot-api 等），自身逻辑相对薄。

## 2. 目录结构与导出接口
- 关键文件/目录：
  - package.json
    - `exports`: `.` -> `src/index.tsx`，`./main` -> `src/main.tsx`，`./types` -> `src/types.ts`。
    - 依赖大量 workspace:* 内部包（如 `@coze-project-ide/framework`、`@coze-project-ide/biz-components`、`@coze-agent-ide/bot-plugin-*`、`@coze-arch/bot-api` 等）。
  - src/index.tsx
    - 对外仅导出 `usePluginResource`：`export { default as usePluginResource } from './hooks/use-plugin-resource';`。
  - src/main.tsx
    - 默认导出 `Main` 组件，是 IDE 插件视图的主入口（`@coze-project-ide/biz-plugin/main`）。
  - src/types.ts
    - 定义并导出 `ModuleType` 枚举：`TOOL / MOCKSET_LIST / MOCKSET_DETAIL / CLOUD_IDE`。
  - src/hooks/
    - use-plugin-resource.tsx：封装插件资源在资源树中的各种操作和弹窗。
    - use-resource-operation.tsx：封装插件资源在“项目 / 插件库”之间复制、移动的具体调度逻辑。
    - typings.d.ts：声明全局常量 `IS_BOE`、`IS_OVERSEA`，用于命名校验中的环境差异。
  - eslint.config.js：使用 `@coze-arch/eslint-config`，preset 为 `web`，并对部分 TS 规则进行关闭/弱化。

## 3. 全局架构与数据流
### 3.1 主渲染流程（Main 组件）
- 入口：src/main.tsx
  - 使用 Coze Project IDE framework hooks 获取上下文：
    - `useSpaceId` / `useProjectId`：当前空间与项目 ID。
    - `useCurrentWidgetContext`：获取当前 widget（标签页）实例，用于设置标题和 UI 状态。
    - `useIDEParams`：解析 IDE 内的路由 query，用于决定当前模块类型及其参数。
    - `useIDENavigate`：IDE 内部导航方法（而非浏览器原生导航）。
    - `useTitle` / `useCommitVersion`：当前 tab 标题、提交版本号等信息。
  - 使用 `usePrimarySidebarStore`：读取 `refetch`，用于刷新左侧资源树（如插件名称/列表发生变化时）。
  - 使用 `useCurrentWidgetContext` 拿到 `widget` 对象，用于：
    - `widget.setTitle(displayName)`：同步 tab 标题；
    - `widget.setUIState(status)`：更新插件开发视图的 UI 状态。

- 上下文提供：
  - `Main` 组件构造 `navBase = /plugin/${pluginID}`，并将一组 `resourceNavigate` 方法注入给 `BotPluginStoreProvider`：
    - `toResource(resource, rid, query, opts)`：普通资源导航。
    - `tool(tool_id, query, opts)`：跳转到插件工具详情页。
    - `mocksetList(tool_id, query, opts)`：跳转工具下的 Mock 集列表。
    - `mocksetDetail(tool_id, mockset_id, query, opts)`：跳转具体 Mock 集详情。
    - `cloudIDE(query, opts)`：跳转云 IDE 页面。
  - `BotPluginStoreProvider` 来自 `@coze-studio/bot-plugin-store`，负责：
    - 根据 `pluginID / spaceID / projectID / version` 初始化插件相关状态；
    - 对外暴露 `usePluginStoreInstance` 等 hooks 供下游页面使用；
    - 通过 `onUpdateDisplayName` / `onStatusChange` 与 IDE shell 通信。

- 视图选择：
  - `PluginProviderContent` 负责根据 `moduleType` 决定渲染：
    - 默认（`renderPlugin` 为 true）渲染 `PluginDetailPage`（插件详情主视图）。
    - `moduleType === TOOL` 时渲染 `ToolDetailPage` 并在调试成功回调中触发 `refetch`。
    - `moduleType === MOCKSET_LIST` 时渲染 `MockSetList`。
    - `moduleType === MOCKSET_DETAIL` 时渲染 `MockSetDetail`（需要 pluginID/spaceID/version）。
    - 最后支持通过 `renderCustomContent` 插入调用方自定义内容。
  - 为保证参数完整性，`PluginProviderContent` 对 `toolID / mocksetID` 做空值校验，不满足条件时直接 `throw Error('xxxxxxxx')`，会在上层被统一错误处理。

### 3.2 资源树操作流程（usePluginResource）
- 入口：src/hooks/use-plugin-resource.tsx
  - 依赖 `@coze-project-ide/biz-components` 中的 Resource 相关类型与 store：
    - `ResourceFolderProps` / `ResourceType` / `ResourceFolderCozeProps`。
    - `BizResourceContextMenuBtnType` / `BizResourceTypeEnum` / `BizResourceType`。
    - `useOpenResource` / `usePrimarySidebarStore` 等。
  - 依赖 `@coze-arch/bot-api`：
    - `PluginDevelopApi`：负责与后端插件开发接口通信（UpdatePluginMeta / DelPlugin 等）。
    - `ResourceCopyScene`：资源复制/迁移场景枚举。

- 返回值结构：
  - `onCustomCreate`：点击“自定义创建”插件时触发，当前实现为打开 `CreateFormPluginModal`。
  - `onChangeName`：
    - 调用 `PluginDevelopApi.UpdatePluginMeta` 修改插件名；
    - 无论成功/失败都会最终调用 `refetch()` 以刷新侧边栏；
    - 失败仅在 console 打印，不抛异常。
  - `onDelete`：
    - 从 `resources` 中筛选 type 为 `BizResourceTypeEnum.Plugin` 的第一个资源，拿到 `res_id`；
    - 调用 `PluginDevelopApi.DelPlugin` 删除；
    - 删除成功后通过 `Toast.success` 提示，并调用 `refetch()`。
  - `onAction`：处理资源右键菜单操作：
    - `ImportLibraryResource`：打开 `usePluginApisModal` 弹窗，从插件库复制资源到项目中。
    - `DuplicateResource`：复制项目内插件（`CopyProjectResource`）。
    - `MoveToLibrary`：将项目内插件移动到插件库（`MoveResourceToLibrary`）。
    - `CopyToLibrary`：将项目内插件复制到插件库（`CopyResourceToLibrary`）。
  - `createResourceConfig`：当前注释掉，说明此包主要负责现有资源操作，不决定创建入口配置细节。
  - `modals`：数组形式返回所有需要挂在页面上的弹窗节点，目前包括：
    - `CreateFormPluginModal`：新建插件；
    - `usePluginApisModal` 返回的 `pluginModal`：插件库选择及复制。
  - `validateConfig.customValidator`：统一的名称校验逻辑 `validateNameBasic`。

### 3.3 资源复制流程（useResourceOperation）
- 入口：src/hooks/use-resource-operation.tsx
  - 使用 `useResourceCopyDispatch`（来自 `@coze-project-ide/biz-components`）得到 `copyDispatch` 方法。
  - 返回一个异步函数（resourceOperation）：
    - 入参含 `scene`（`resource_resource_common.ResourceCopyScene`）和 `resource`（可选）。
    - 调用 `copyDispatch`，固定 `res_type` 为 `ResType.Plugin`，并传入 `project_id` 与资源 id/name。
    - 错误仅 console.error，不抛出。
  - 该 hook 被 `usePluginResource` 用于各类“复制/移动到插件库”等操作。

## 4. 构建、调试与测试
- 本包自身 package.json:
  - `scripts.build = "exit 0"`：
    - 说明实际打包/编译由上层工具链（Rush + rsbuild / TS 工程引用）统一处理，本包本地执行 `npm run build` 不会真正构建。
  - `scripts.lint = "eslint ./ --cache --quiet"`：
    - 建议通过 Rush 统一执行：如在 monorepo 根目录运行 `rush lint`（具体命令请参考根仓 README 或脚本），AI 不要臆造新的脚本。
- TypeScript 配置：
  - tsconfig.json
    - `exclude: ["**/*"]`，仅作为引用聚合配置，真正编译配置在 tsconfig.build.json / tsconfig.misc.json 中。
    - `references` 指向本包构建/测试配置，配合 monorepo 级 TS project references 使用。
  - tsconfig.build.json
    - `extends: @coze-arch/ts-config/tsconfig.web.json`，使用统一 Web 前端 TS 基础配置。
    - `rootDir: ./src`, `outDir: ./lib-ts`，产物输出到 `lib-ts` 目录（由上游构建流程消费）。
    - `paths: { "@/*": ["src/*"] }`，允许在本包内通过 `@/xxx` 访问 `src/` 下文件。
    - `references` 列出了依赖子包的 tsconfig.build.json，确保增量编译顺序正确。
  - tsconfig.misc.json
    - 为测试/本地工具（如 vitest.config.ts）提供 TS 设置，目前本包未见 __tests__ 目录，测试能力更多继承自 monorepo 规范。

## 5. 项目约定与代码风格
- 语言/框架：
  - React 18 + TypeScript 5；依赖 `zustand`、`lodash-es` 等常见库，但在当前子包源码中未直接使用，主要由上游依赖使用。
- 代码风格：
  - 使用 `@coze-arch/eslint-config` 的 `web` preset；本包额外关闭或调整的规则：
    - `no-restricted-syntax` 关闭。
    - `@typescript-eslint/naming-convention` 关闭（允许与后端协议、老代码保持同名）。
    - `@typescript-eslint/no-magic-numbers` 关闭（业务中存在少量数字常量，如 `PLUGIN_NAME_MAX_LEN = 30`）。
    - `@coze-arch/no-batch-import-or-export` 关闭。
    - `@typescript-eslint/no-explicit-any` 设置为 warn。
    - `@typescript-eslint/no-non-null-assertion` 关闭。
- 命名与多环境处理：
  - 名称校验 `validateNameBasic` 依据不同环境：
    - `IS_OVERSEA` / `IS_BOE` 为 true 时，仅允许 `^[\w\s]+$`（字母数字下划线+空格）。
    - 其它环境允许中文：`^[\w\s\u4e00-\u9fa5]+$`。
  - 此两个常量在 typings.d.ts 中声明为全局变量，由构建环境注入（如 webpack DefinePlugin / rsbuild 等），AI 不要在代码中重新声明/赋值。
- 错误处理：
  - 资源操作 / API 调用出错时，当前实现以 console 日志为主，少数场景配合 Toast 提示；整体风格是“记录错误但不中断 UI”，除非参数缺失等严重问题才 `throw Error('xxxxxxxx')`。

## 6. 与外部子包/服务的集成要点
- `@coze-project-ide/framework`
  - 提供 Project IDE 级别的上下文与导航能力：空间/项目/IDE 参数、widget 上下文、IDE 内导航等。
  - 在本包中必须使用这些 hooks 获取 ID、路由和导航，避免直接依赖 window.location 等。

- `@coze-project-ide/biz-components`
  - 提供资源树 UI 及资源操作相关的 store：
    - 资源树节点类型（`BizResourceTypeEnum.Plugin`）
    - 右键菜单按钮枚举 `BizResourceContextMenuBtnType`。
    - `usePrimarySidebarStore` 用于触发侧边栏刷新。
    - `useOpenResource` 用于在 IDE 中打开指定插件资源。

- `@coze-agent-ide/bot-plugin-*`
  - `@coze-agent-ide/bot-plugin/page`
    - `PluginDetailPage` / `ToolDetailPage` / `MockSetList` / `MockSetDetail` 等视图组件，本包作为容器负责传入 `projectId、pluginID、spaceID、version` 等参数。
  - `@coze-agent-ide/bot-plugin/component`
    - `CreateFormPluginModal`、`usePluginApisModal` 等组件/Hook，承载“从插件库创建/复制插件”的 UI 和行为，本包仅对其做轻量封装（如回调中调用 `resourceOperation`）。
  - `@coze-agent-ide/plugin-shared`
    - `From.ProjectIde` 等枚举值，用于告知下游当前调用来源，便于统计/行为差异控制。

- `@coze-arch/bot-api`
  - `PluginDevelopApi`：插件开发相关接口封装，包括：
    - `UpdatePluginMeta`：修改插件元数据（目前主要用来改名）。
    - `DelPlugin`：删除插件。
  - `plugin_develop.ResourceCopyScene`：资源复制/迁移的场景枚举，在本包中按业务语义分为：
    - `CopyResourceFromLibrary` / `CopyProjectResource` / `MoveResourceToLibrary` / `CopyResourceToLibrary`。
  - `resource_resource_common.ResType.Plugin`：资源类型标识，在资源复制时需固定为 Plugin。

- UI 与国际化：
  - `Toast` 来自 `@coze-arch/coze-design`，用于成功提示（例如插件删除成功）。
  - `I18n` 来自 `@coze-arch/i18n`，所有文案使用 key（如 `project_plugin_delete_success_toast`、`create_plugin_modal_nameerror_cn`）而不是写死中文/英文。

## 7. 开发流程与协作规范（AI 关注点）
- 分支与提交策略：
  - 具体规范在 monorepo 顶层文档中，本子包没有额外覆盖；生成变更时应保持提交粒度围绕单一业务改动。
- 与 Rush / 质量工具的集成：
  - 根目录 rushx-config.json 中启用了 packageAudit 和 codecov：
    - `essential-config-file` 要求本包必须存在 eslint.config.js（当前已满足），AI 不要删除或重命名。
    - 本包标签为 `team-automation` + `level-3`，在 codecov 中对 level-3 的 coverage 要求较低（0），目前本子包也尚未添加测试用例；如需要新增测试，建议与整体测试框架（vitest 等）保持一致。
- 变更时的注意事项：
  - 保持 `ModuleType` 与 URL query 中 `module` 参数一致，避免出现无法匹配导致页面不渲染的情况。
  - 在调用 `resourceOperation` / `usePluginApisModal` 等跨包能力时，不要擅自更改场景枚举或参数结构，需遵循当前实现。
  - 增加新的资源操作或右键菜单时，应：
    - 确认 `BizResourceContextMenuBtnType` 中已经有对应枚举或在上游包扩展；
    - 在 `onAction` 中补充处理分支，必要时复用 `resourceOperation` 或新增 API；
    - 同步考虑是否需要 `Toast` 或 I18n 文案。

## 8. 为 AI 编程助手的具体建议
- 新增或修改 UI 逻辑时：
  - 优先在本包中做轻量封装，避免直接修改上游基础包（如 framework / biz-components），除非确有必要且用户明确要求。
  - 注意 `Main` 与 `PluginProviderContent` 的职责边界：
    - `Main` 负责上下文获取及 Provider 注入；
    - `PluginProviderContent` 负责根据 moduleType 决定实际页面展示。
- 新增 Hook / 工具函数时：
  - 放在 src/hooks/ 目录下，并通过 src/index.tsx 或专门的 export 文件对外暴露；
  - 遵循现有模式：以 React hook 为主，命名以 `useXxx` 开头。
- 处理错误与边界情况时：
  - 严重参数缺失（如必须的 ID 缺失）可以继续沿用 `throw Error('xxxxxxxx')` 的模式，交给上层统一处理；
  - 网络/API 相关错误建议以 console + Toast 组合的方式提示，而不是直接抛出异常中断 UI。

以上内容应能支持 AI 编程助手在本子包内快速理解结构、正确调用依赖、并在不破坏既有约定的前提下安全地扩展功能。