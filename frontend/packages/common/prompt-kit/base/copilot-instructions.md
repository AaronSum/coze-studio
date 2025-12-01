# @coze-common/prompt-kit-base 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/prompt-kit/base）中安全、高效地协作开发。

## 全局架构概览

- 本子包是一个围绕「提示词（Prompt）」编辑与配置的前端基础库，基于 React 和 `@coze-editor/editor` 提供：
  - Prompt 富文本编辑器封装（`src/editor` 与 `src/index.tsx`）。
  - Prompt 创建配置弹窗及周边体验组件（`src/create-prompt`）。
  - 与 Prompt 编辑上下文相关的通用工具、Hook 和服务（`src/shared`）。
- 包入口 [src/index.tsx](src/index.tsx) 只做导出聚合：
  - `PromptEditorRender` / `PromptEditorProvider`：Prompt 编辑器渲染和上下文提供。
  - 类型导出 `PromptEditorRenderProps` 等，方便上层应用进行类型约束。
- `package.json` 中通过 `exports` 将子模块暴露给其它包：
  - `@coze-common/prompt-kit-base/create-prompt` → [src/create-prompt/index.tsx](src/create-prompt/index.tsx)。
  - `@coze-common/prompt-kit-base/shared` → [src/shared/index.tsx](src/shared/index.tsx)。
  - `@coze-common/prompt-kit-base/editor` → [src/editor/index.tsx](src/editor/index.tsx)。
  - 同时暴露共享样式与类型：`shared/css`、`shared/types`。
- 编辑能力基于 `@coze-editor/editor` 的 Prompt 预设：
  - [src/editor/render.tsx](src/editor/render.tsx) 使用 `Renderer` + `promptPreset` 组合挂载 CodeMirror 编辑器。
  - 使用 `ThemeExtension`、`SyntaxHighlight`、`LanguageSupport` 扩展主题、语法高亮与语言支持。
- `src/shared` 提供与 UI 无关的通用能力：
  - 编辑器状态辅助（如 [src/shared/hooks/use-editor-readonly.ts](src/shared/hooks/use-editor-readonly.ts)）。
  - 弹窗层级管理（free grab modal hierarchy）服务。
  - 编辑选择区域几何信息计算等低层工具（例如 [src/shared/utils/rect.ts](src/shared/utils/rect.ts)）。

## 目录结构与职责

- `src/index.tsx`
  - 包主入口，仅 re-export 子模块内容；新增导出时需同时考虑 `package.json.exports` 与 `typesVersions` 是否同步。
- `src/editor/`
  - [src/editor/index.tsx](src/editor/index.tsx)：
    - 对外导出 `PromptEditorRender`、`PromptEditorProvider`，以及从 `@coze-editor/editor/react` re-export 的 `useEditor`、`ActiveLinePlaceholder` 与 `EditorAPI` 类型。
    - 对使用方而言，这里是“集成 Prompt 编辑器”的主要依赖入口。
  - [src/editor/context/index.tsx](src/editor/context/index.tsx)：
    - 基于 `EditorProvider` 包装的 `PromptEditorProvider`，用于在 React 树中提供编辑器上下文。
  - [src/editor/render.tsx](src/editor/render.tsx)：
    - 真正渲染编辑器的 React 组件，封装了：
      - 与外界的受控/非受控值同步逻辑（`value`、`defaultValue`、`isControled`、`onChange`）。
      - 光标 `focus/blur` 事件透传至业务层（通过 `editor.$on('blur'|'focus')`）。
      - 与外部配置项融合（`options` 通过 lodash `merge` 与默认配置合并）。
      - 编辑器扩展链：`promptPreset` + 主题 / 高亮 / 语言支持能力。
- `src/create-prompt/`
  - [src/create-prompt/index.tsx](src/create-prompt/index.tsx)：对外暴露创建 Prompt 相关的 Hook、组件与类型：
    - `usePromptConfiguratorModal`/`PromptConfiguratorModal`：负责创建 Prompt 的弹窗逻辑与 UI。
    - `InsertInputSlotButton`：在 Prompt 中插入“输入槽位”的操作入口按钮。
    - `ImportPromptWhenEmptyPlaceholder`：在无 Prompt 时的占位提示组件。
    - 上述能力配套的 Props/Hook 类型定义（`PromptConfiguratorModalProps`、`UsePromptConfiguratorModalProps`）。
  - 其余文件（`components/`、`context/`、`types.ts` 等）为内部实现细节，一般不直接对外暴露。
- `src/shared/`
  - [src/shared/index.tsx](src/shared/index.tsx)：统一导出 shared 下的工具、服务和类型，包括：
    - 弹窗层级 store/service：`createFreeGrabModalHierarchyStore`、`FreeGrabModalHierarchyService`。
    - 编辑辅助工具：`getSelectionBoundary`、`insertToNewline`。
    - 编辑只读状态 Hook：`useReadonly`。
    - Prompt 上下文相关类型：`PromptContextInfo`。
  - `hooks/`
    - [src/shared/hooks/use-editor-readonly.ts](src/shared/hooks/use-editor-readonly.ts)：
      - 使用 `useEditor<EditorAPI>` 获取当前编辑器实例，监听 `viewUpdate` 事件以追踪 `state.readOnly` 变化。
      - 返回布尔值 `isReadOnly`，供上层组件订阅编辑器只读状态。
  - `service/free-grab-modal-hierarchy-service/`
    - [src/shared/service/free-grab-modal-hierarchy-service/store.ts](src/shared/service/free-grab-modal-hierarchy-service/store.ts)：
      - 使用 `zustand + immer + devtools` 构建可拖拽弹窗层级状态：`modalHierarchyList: string[]`。
      - 提供四个 Action：`registerModal`、`removeModal`、`getModalIndex`、`setModalToTopLayer`。
      - 使用 `IS_DEV_MODE` 控制 devtools 是否启用，name 为 `botStudio.botEditor.ModalHierarchy`（调试标识）。
    - [src/shared/service/free-grab-modal-hierarchy-service/index.ts](src/shared/service/free-grab-modal-hierarchy-service/index.ts)：
      - `FreeGrabModalHierarchyService` 将 store action 封装成可计算 zIndex 的服务：
        - 维护 `baseZIndex = 1000`，通过 modal index 计算实际 zIndex。
        - 提供 `getModalZIndex(keyOrIndex)` 供 UI 组件根据 key 或 index 获取层级。
  - `utils/`
    - [src/shared/utils/insert-to-newline.ts](src/shared/utils/insert-to-newline.ts)：
      - 向当前文档末尾插入一行文本，支持空文档与非空文档两种情况；
      - 通过 `editor.$view.dispatch` 更新内容并滚动视图；
      - 返回插入后的文档字符串，同时调用 `editor.focus()` 以确保焦点在编辑器内（存在注释说明该操作会触发某些 Chrome bug，需要按现有方式保留）。
    - [src/shared/utils/rect.ts](src/shared/utils/rect.ts)：
      - 遍历编辑器 `getMainSelectionRects()`，计算主选区的包围矩形；
      - 考虑编辑器 `scrollDOM` 的 `scrollLeft`/`scrollTop` 和容器 `dom.getBoundingClientRect()`，返回相对 viewport 的绝对坐标及 width/height；
      - 典型用途：在编辑选区附近弹出浮层（如快捷工具条 / 悬浮菜单）。
  - `types/`
    - [src/shared/types/index.ts](src/shared/types/index.ts) 与 [src/shared/types/prompt.ts](src/shared/types/prompt.ts)：聚合和定义 Prompt 相关类型（例如 Prompt 上下文信息）。
  - `css/`
    - [src/shared/css/index.css](src/shared/css/index.css)：导出 shared 相关的基础样式，调用方按需引入。

## 依赖与集成要点

- 外部核心依赖：
  - `@coze-editor/editor`：
    - React 绑定：`Renderer`、`Placeholder`、`EditorProvider`、`useEditor` 等位于 `@coze-editor/editor/react`。
    - Prompt 预设与 API 类型：`promptPreset` 和 `EditorAPI` 在 `@coze-editor/editor/preset-prompt` 中提供。
    - 编辑器实例暴露 `$view`（CodeMirror view）、`$on/$off` 事件接口，请严格按现有用法调用，避免假设其它未暴露字段。
  - `@coze-common/editor-plugins`：
    - `ThemeExtension`、`SyntaxHighlight`、`LanguageSupport` 等插件以 React 组件/扩展形式挂载到 Renderer 下。
  - `zustand` + `immer`：用于管理弹窗层级状态；新增 store 时建议遵循同样的模式（`devtools` 包裹 + `produce`）。
  - `lodash-es/merge`：用于组装编辑器 options，避免覆盖默认配置。
- 样式与资源：
  - 本包包含若干静态资源（如 svg、png 图标）和 Less/CSS，通常仅通过上层组件间接使用；修改路径时要注意 Storybook 和其它子包的引用。

## 开发工作流（构建 / 测试 / 调试）

- 包级脚本（见 [package.json](package.json)）：
  - `npm run build`：当前实现为 `exit 0`，意味着本包没有独立构建产物（按源代码消费）。
  - `npm run lint`：`eslint ./ --cache`，应用统一的 `@coze-arch/eslint-config`。
  - `npm run test`：`vitest --run --passWithNoTests`，配置由 [vitest.config.ts](vitest.config.ts) 中的 `@coze-arch/vitest-config` 统一管理，preset 为 `web`。
  - `npm run test:cov`：在上面基础上添加 coverage。
- Storybook：
  - [/.storybook/main.js](.storybook/main.js)、[/.storybook/preview.js](.storybook/preview.js) 以及 [stories/demo.stories.tsx](stories/demo.stories.tsx)、[stories/hello.mdx](stories/hello.mdx) 提供基础组件演示与开发环境；
  - 若新增交互复杂的 UI，建议补充 story 方便在隔离环境中调试。
- Rush & workspace：
  - 整体工程使用 Rush 管理 monorepo，本包在 [config/rush-project.json](config/rush-project.json) 中声明；
  - 初始化或安装依赖使用根目录的 `rush update`；
  - 在本包目录内进行 npm 脚本调用，底层通过 pnpm workspace 解析依赖。

## 项目约定与编码风格

- 代码风格与工具链：
  - 使用 TypeScript + React 18，函数式组件 + Hook 为主。
  - `eslint`、`stylelint` 和 `@coze-arch/ts-config` 通过根部配置统一规则，请尽量遵循现有写法：
    - 使用显式类型导出（`export type { ... }`）。
    - 导出顺序：类型、函数/类、默认导出一律通过命名导出聚合（避免 default export）。
  - 所有源文件带有 Apache-2.0 版权头，请在新增文件时复制该头部。
- 状态管理：
  - 对编辑器本身，尽量通过 `EditorAPI` 的事件和 `$view.dispatch` 更新，而非直接操作 DOM；
  - 对 UI 辅助状态（如弹窗层级）采用 `zustand` store + service 封装的模式：
    - store 只关心数据结构和原子操作；
    - service 则负责面向 UI 提供便捷方法（如根据 key 计算 zIndex）。
- 只读模式处理：
  - `useReadonly` 是当前唯一的编辑只读状态订阅 Hook，请复用它而非重复实现；
  - 若需要设置只读，应从上层使用 `options` 或 `readonly` 属性驱动，而不要直接修改 `editor.$view.state`。
- 受控/非受控编辑器：
  - 通过 `PromptEditorRenderProps` 的 `isControled` + `value`/`defaultValue` 区分模式：
    - 受控模式下，`useEffect` 会在外部 `value` 变化时重放一整个文档的内容写入；
    - 若实现新功能涉及大块文本替换，请优先通过受控模式或 `insertToNewline` 等工具封装，而不是直接在业务组件内部调用 `$view.dispatch`。

## 集成与扩展注意事项

- 新增导出：
  - 若在 `src/editor`、`src/create-prompt` 或 `src/shared` 内新增对外能力：
    - 需要在各自 `index.tsx/ts` 中添加导出；
    - 同时更新 [package.json](package.json) 的 `exports` 和 `typesVersions`（若是新路径）。
- 编辑器事件扩展：
  - 目前仅显式监听了 `blur`、`focus`、`viewUpdate`：
    - 如需新增事件订阅，请在对应组件中使用 `editor.$on` / `$off`，并在 `useEffect` 中妥善清理，按照现有模式编写；
    - 避免在多个组件中对同一事件做重复或冲突处理，优先复用 shared Hook 或封装新的 Hook。
- 弹窗层级系统扩展：
  - 若需要为新的“可自由拖拽弹窗”集成层级管理：
    - 使用 `createFreeGrabModalHierarchyStore()` 创建 store 实例，并通过 `FreeGrabModalHierarchyService` 包装；
    - 在组件挂载/卸载和获取焦点时分别调用 `registerModal` / `removeModal` / `onFocus`；
    - 将 `getModalZIndex` 返回的值赋给对应弹窗根容器的 `style.zIndex`。

## 测试与质量保障

- 单元测试：
  - 目前 `__tests__` 目录只存在 `.gitkeep`，尚无具体用例。
  - 如为新增的逻辑增加测试，建议使用 `vitest` + `@testing-library/react` 组合，并复用 `@coze-arch/vitest-config` 的 web preset。
- 运行测试：
  - 在本包根目录执行 `npm run test` 以快速校验；
  - 对涉及编辑器行为的逻辑（如 `insertToNewline` 或 `getSelectionBoundary`）可以通过对 `EditorAPI` 与 `Rect` 进行适当 mock 来覆盖核心路径。

## 流程规范与其他特性

- 仓库管理：
  - 整体项目采用 Rush monorepo 管理，具体分支策略和发布流程在更高层级（根 README/文档）中约定，本子包内部未定义额外流程文件。
- 部署与产物：
  - 当前版本仅以源码形式被其它子包引用，不单独打包发布；
  - 若未来引入真实构建流程（替换 `build: exit 0`），需同步调整 exports 指向构建产物路径。
- 其他特殊点：
  - 某些工具函数（如 `insertToNewline`）内部存在与浏览器 bug 相关的注释，请在重构或修改时保留这些上下文，以免误删规避手段。
