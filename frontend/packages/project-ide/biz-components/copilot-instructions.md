# @coze-project-ide/biz-components 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/biz-components）中安全、高效地协作开发。

## 1. 子包定位与整体架构
- 路径与定位：本子包位于 frontend/packages/project-ide/biz-components，对应 npm 包 `@coze-project-ide/biz-components`，在 Project IDE 中主要承担“业务资源树 + 资源操作 Hooks”的封装角色，为上层业务（如 biz-plugin 等）提供统一的资源侧边栏能力。
- 核心能力分层：
  - 资源树 UI：src/resource-folder-coze/* 负责资源树组件 `ResourceFolderCoze` 及周边工具（空态、展开图标、样式、插件扩展点等）。
  - 资源状态管理：src/stores/primary-sidebar-store.ts 通过 zustand 管理左侧资源树的全局状态（资源列表、分组展开、当前选中项等），并提供 `refetch`/`fetchResource` 等刷新入口。
  - 资源操作 Hooks：src/hooks/* 暴露 `useResourceList`、`useOpenResource`、`useResourceCopyDispatch` 等通用业务 Hook，供其它子包在不同视图中复用统一的资源逻辑。
  - 工具函数与类型：src/utils.ts、src/resource-folder-coze/type.ts 等负责 DTO→VO 转换、统一类型定义等。
- 对外导出：
  - 入口文件 src/index.ts 统一导出：
    - 组件与类型：`ResourceFolderCoze`、`BizResourceType`、`BizResourceTypeEnum`、`ResourceFolderCozeProps`、`BizResourceContextMenuBtnType`、`BizResourceTree`、`CustomResourceFolderShortcutService`、`VARIABLE_RESOURCE_ID` 等。
    - Store：`usePrimarySidebarStore`，为 IDE 左侧资源栏提供统一的全局状态。
    - Hooks：`useResourceList`、`useOpenResource`、`useResourceCopyDispatch` 等（通过 `export * from './hooks'`）。
    - 与后端协议保持一致的枚举：`ProjectResourceGroupType`（直接从 @coze-arch/bot-api/plugin_develop 透传）。
    - 名称冲突校验：`validateNameConflict`（由 resource-folder-coze/utils.ts 提供）。
- 架构设计动机：
  - 将“资源树的 UI + 状态 + 操作”抽象成独立 biz 组件层，避免在每个业务包中重复实现；
  - 通过 hook 和 store 组合，保证 Project IDE 内各个 widget/业务视图能共享一套资源视图与刷新逻辑；
  - 通过插件/扩展点机制（plugins/*），允许上层按需增强资源树行为而无需修改底层组件实现。

## 2. 关键数据流与交互关系
### 2.1 资源树数据获取与刷新
- 状态容器：
  - src/stores/primary-sidebar-store.ts 使用 `zustand` + `devtools` 创建 `usePrimarySidebarStore`，state 包含：
    - `spaceId` / `projectId` / `version`：当前 IDE 上下文的空间、项目与版本信息；
    - `resourceTree: BizResourceTree[]`：资源树分组及每组资源列表；
    - `groupExpandMap: Record<ProjectResourceGroupType, boolean>`：按资源分组类型记录展开/折叠状态，默认 Workflow/Plugin/Data 三类均展开；
    - `selectedResource?: string`：当前选中的资源 id；
    - `isFetching` / `initLoaded` / `canClosePopover`：加载中状态、是否已初始化完成、是否允许关闭弹层等 UI 控制字段。
- 与后端 API 的交互：
  - 通过 `PluginDevelopApi.ProjectResourceList` 获取当前项目的资源分组及列表：
    - 入参：`project_id`、`space_id`、`project_version`（允许 version 为空表示当前版本）。
    - 返回值中的 `resource_groups` 会被映射为 `BizResourceTree[]`：
      - `groupType` 直接使用后端返回的 `group_type`（与 `ProjectResourceGroupType` 对应）。
      - `resourceList` 将后端 DTO 映射为 VO：id/name/type 等字段通过 `resTypeDTOToVO` 和字段转换统一处理。
- 刷新流程：
  - `fetchResource(spaceId, projectId, version, callback)`：
    - 设置 `isFetching=true` 并写入当前 spaceId/projectId/version；
    - 调用 API 获取资源分组，映射后更新 `resourceTree`，并将 `initLoaded` 置为 true；
    - 可选 callback 允许调用方在资源树更新时同步做额外处理（如自动展开某分组、选中某节点）。
  - `refetch(callback)`：
    - 从 store 中读取当前 spaceId/projectId/version；若缺失则直接返回（不抛错）；
    - 为规避后端最终一致性延迟，内部固定等待约 700ms 再调用 `fetchResource`；
    - 典型调用场景：资源重命名/删除/复制完成后刷新左侧树。

### 2.2 资源树 UI 与 store 的协同
- 组件入口：src/resource-folder-coze/index.tsx 和 resource-folder-coze.tsx 一起构成 `ResourceFolderCoze` 组件，对外通过 src/index.ts 暴露。
- 主要交互模式：
  - 组件从 `usePrimarySidebarStore` 读取 `resourceTree`、`groupExpandMap`、`selectedResource` 等状态，并组合 `ResourceFolderCozeProps` 渲染资源分组与节点；
  - 用户在 UI 中展开/折叠分组，触发 `updateGroupExpand(groupType, expand)`，更新 `groupExpandMap`；
  - 用户点击资源节点时，通过 `setSelectedResource(resourceId)` 更新当前选中项，并借助上层注入的 `onOpen`/`onClick` 之类回调驱动 IDE 路由；
  - 右键菜单、快捷操作等依赖 BizResourceContextMenuBtnType 与 plugins/* 内定义的插件扩展逻辑。
- 弹层关闭控制：
  - `canClosePopover` 用于控制在右键菜单/操作弹层打开时，资源树所在的 popover/sidebar 是否允许被关闭；
  - `setCanClosePopover(boolean)` 由资源树内部在菜单开关时调用，确保复杂交互时不会误关侧边栏。

### 2.3 Hooks 对上层业务的封装
- `useResourceList`：
  - 提供对资源树数据的读取能力，通常内部会使用 `usePrimarySidebarStore` 结合业务场景（如过滤某一类资源、根据选中节点返回上下文等）；
  - 典型使用方：项目内多个 widget 需要基于同一资源树进行展示或二次处理时。
- `useOpenResource`：
  - 为上层提供“如何打开一个资源”的统一逻辑，内部会结合 Project IDE framework 的导航能力（例如 `useIDENavigate`）和资源类型做差异化跳转；
  - 被类似 biz-plugin 等子包在处理资源节点点击/双击时使用，确保行为一致。
- `useResourceCopyDispatch`：
  - 封装资源复制/移动相关的调度逻辑，通常与 `@coze-arch/bot-api` 的 ResourceCopyScene 枚举配合使用；
  - 典型场景：从资源库复制到项目、在项目间复制/移动资源等，由上层业务指定 scene 与资源信息，本包只负责调度与 UI。

## 3. 构建、测试与调试流程
- package.json 脚本：
  - `build: exit 0`
    - 本包不负责独立构建，实际打包由上层 Rush + rsbuild 或 TS project references 统一处理；
    - 本地无需单独执行 `npm run build`，通常使用 Rush 顶层命令（如 `rush build`）触发整体构建。
  - `lint: eslint ./ --cache`
    - 规则来自 devDependencies 中的 `@coze-arch/eslint-config`，适配 Web/React + TS 项目风格；
    - 建议优先通过 monorepo 顶层命令（如 `rush lint`）运行，不要自行添加新的 lint 入口脚本。
  - `test: vitest --run --passWithNoTests` / `test:cov`
    - 单测框架使用 Vitest，配置文件为 vitest.config.ts（继承 `@coze-arch/vitest-config`）；
    - 当前子包下仅存在 __tests__/.gitkeep，实际测试较少，但 `test` 命令会在 CI 中被统一调用。
- TypeScript 配置：
  - tsconfig.build.json：
    - `extends: @coze-arch/ts-config/tsconfig.web.json`，统一 Web 前端 TS 基础设置；
    - `rootDir: ./src`, `outDir: ./lib-ts`，构建产物输出到 lib-ts，被上游打包流程消费；
    - `paths` 通常会配置 `@/*` 指向 src/*，本包内部已使用 `@/utils`、`@/resource-folder-coze/type` 等路径别名；
    - `references` 声明依赖其它子包的 tsconfig.build.json，以便 Rush 增量编译按依赖顺序执行。
  - tsconfig.misc.json：
    - 为 Vitest 或 Storybook 等工具提供 TS 支持；
    - 非构建入口，一般无需修改，除非新增测试/工具代码需要额外路径解析。
  - tsconfig.json：
    - 作为聚合入口参与 monorepo 级 TS project references 配置；
    - 具体 include/exclude 策略由上游统一控制，本包不单独承担编译职责。

## 4. 项目特有约定与代码风格
- 技术栈与依赖：
  - React 18 + TypeScript 5，配合 `zustand` 做轻量状态管理，`lodash-es` 提供工具函数，`classnames` 用于样式拼接；
  - UI 与交互依赖 `@coze-arch/coze-design`（组件库）以及 `@coze-arch/i18n`（文案国际化）；
  - 与后端交互统一通过 `@coze-arch/bot-api`，内部严格遵循后端协议类型与枚举（如 plugin_develop、resource_* 命名空间）。
- ESLint/Stylelint：
  - eslint.config.js 使用 `@coze-arch/eslint-config` 作为基础 preset，针对前端 Web/React 场景优化；
  - .stylelintrc.js 则引用 `@coze-arch/stylelint-config`，统一 Less/CSS 的书写规范；
  - 编码时请尽量遵循已有规则，避免本包内覆盖过多自定义规则，以保持 monorepo 一致性。
- 状态与副作用处理：
  - `usePrimarySidebarStore` 内的异步方法（`fetchResource`/`refetch`）通过 `async` + `await` 串行处理，不做复杂竞态管理；
  - 错误处理策略偏“记录但不中断 UI”：调用后端接口时若失败，通常只记录 console 或交由上层 Toast 提示，而不在 store 内抛异常；
  - UI 相关布尔状态（例如 `canClosePopover`）集中放在 zustand store 中统一管理，避免在组件间通过 props 层层传递。
- 类型与命名：
  - 资源相关类型（`BizResourceType`、`BizResourceTree` 等）集中定义在 resource-folder-coze/type.ts，并在 src/index.ts 再导出；
  - 资源分组类型与后端协议保持 1:1 对齐，直接使用 `ProjectResourceGroupType`，避免在本包中自定义枚举导致语义分裂；
  - DTO→VO 转换统一走 utils.ts 内封装函数（如 `resTypeDTOToVO`），不要在各处自行写转换逻辑。

## 5. 与外部子包/服务的集成要点
- 与 @coze-arch/bot-api 的集成：
  - plugin_develop 模块：
    - `ProjectResourceGroupType`：资源分组枚举（如 Workflow/Plugin/Data），对齐后端；
    - `PluginDevelopApi.ProjectResourceList`：项目资源列表查询接口，是资源树数据的唯一来源；
  - 资源复制/迁移相关接口：
    - 本包不直接发起复制/迁移调用，而是通过 hooks（如 `useResourceCopyDispatch`）将调度能力暴露给上层业务包（例如 biz-plugin）；
    - 使用场景包括从资源库复制到项目、在项目之间复制/移动资源等，调用方需按照后端的 ResourceCopyScene/ResType 规则传参。
- 与 @coze-project-ide/framework 的协作：
  - 本包不直接依赖 framework 的 hooks（如 useIDENavigate），而是通过 `useOpenResource` 将“打开资源”的动作抽象出来，由上层业务 hook/组件注入具体导航实现；
  - 这样可以保持 biz-components 的相对通用性，不与具体 IDE 路由耦合。
- 与上层业务包（如 biz-plugin）的协作：
  - biz-plugin 等业务包通过 `ResourceFolderCoze` + `usePrimarySidebarStore` + 各类 hooks 组合，实现自己的资源树视图；
  - 名称校验或冲突判断可以通过 `validateNameConflict` 等工具进行统一处理；
  - 右键菜单项、快捷键等通过 BizResourceContextMenuBtnType、CustomResourceFolderShortcutService 等机制扩展，业务包只需实现对应的行为回调。

## 6. 项目流程与协作规范
- Rush 与项目元信息：
  - config/rush-project.json 中标记了本包的 Rush 项目信息及 tags（如 `team-automation`、`level-3`），用于 CI、codecov 等工具识别；
  - 本包通常不会单独运行脚本，而是通过 monorepo 根目录的 Rush 命令（如 `rush lint`、`rush test`、`rush build`）参与整体流程。
- Storybook 与演示：
  - stories/ 目录下包含 demo.stories.tsx、hello.mdx 等，用于本包组件的 Storybook 演示；
  - .storybook/main.js、preview.js 维护 Storybook 配置，开发/调试 UI 时可基于这些配置启动本地 Storybook（具体命令参考顶层文档）。
- 测试与覆盖率：
  - __tests__ 下仅有 .gitkeep，说明当前包单测尚不充分；
  - 根层 rushx-config.json 中对 `level-3` 的 coverage 要求较低（通常为 0），因此新增功能时可按需补充测试，但不是强制要求。

## 7. 开发建议（面向 AI 编程助手）
- 修改或新增资源树能力时：
  - 优先在本包中通过 hooks/store 扩展，而不是直接在上层业务包中揉入资源树逻辑；
  - 保持与后端协议的强一致（使用 ProjectResourceGroupType、ResType 等官方类型），不要擅自新增本地枚举；
  - 对资源列表结构的变更（如字段扩充）请集中在 utils.ts（DTO→VO 转换）和 BizResourceTree 类型中处理，避免散落在多个组件里。
- 与其它子包协作时：
  - 当上层需要刷新资源树，请统一调用 `usePrimarySidebarStore().refetch`，不要绕过 store 直接 setState；
  - 当需要新增右键菜单项或快捷操作时，应先在 biz-components 中扩展 BizResourceContextMenuBtnType / shortcut service，再在业务包里做具体实现；
  - 若新增 API 交互（如新的资源操作），应在 `@coze-arch/bot-api` 中对齐协议后，再在本包中封装调用逻辑。
- 错误与边界处理：
  - 优先延续“记录错误但不中断 UI”策略：在 store/hook 内记录错误日志并暴露状态，由上层决定是否 toast 提示；
  - 对于严重参数缺失（缺少 spaceId/projectId 等）可选择静默返回或在控制台警告，但不建议抛出同步异常阻断整个 IDE。
