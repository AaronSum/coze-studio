# @coze-data/knowledge-ide-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-ide-adapter）中安全、高效地协作开发。

## 一、子包定位与全局架构
- 位置与包名：位于 frontend/packages/data/knowledge/knowledge-ide-adapter，对应 npm 包名 `@coze-data/knowledge-ide-adapter`，是「知识库 IDE」在不同业务场景下的适配层组件库。
- 核心职责：
  - 在上层应用（Studio Workspace、Project IDE、Workflow Playground 等）中，以简单组件/Hook 形式接入知识库 IDE。
  - 根据业务场景拼装不同的导航栏与布局（Agent IDE、Workflow、Project、Library 等），内部真正的 IDE 能力全部来自 `@coze-data/knowledge-ide-base` 与 `@coze-data/knowledge-stores`。
- 对外导出集中在 src/index.tsx：
  - 基础 IDE：`BaseKnowledgeIDE`, `BaseKnowledgeIDEProps`。
  - 基础 IDE 全屏弹窗 Hook：`useBaseKnowledgeIDEFullScreenModal`。
  - 业务 IDE：`BizAgentKnowledgeIDE`, `BizLibraryKnowledgeIDE`, `BizProjectKnowledgeIDE`, `BizWorkflowKnowledgeIDE` 以及 `Biz*KnowledgeIDEProps` 类型别名。
  - Workflow 场景弹窗 Hook：`useBizWorkflowKnowledgeIDEFullScreenModal`。
- 主要依赖：
  - `@coze-data/knowledge-ide-base`：通用 IDE 布局、文本/表格/图片 IDE 组件、业务导航栏组件、模态框封装等。
  - `@coze-data/knowledge-stores`：知识库数据 store 与 `IKnowledgeParams` 类型（biz/space 等参数）。
  - `@coze-arch/bot-api` 中的 `FormatType` 用于区分 Text/Table/Image 三种知识格式。

## 二、代码结构与职责边界
- 目录概览（src）：
  - `src/index.tsx`：唯一对外入口，仅做导出聚合，不写业务逻辑。
  - `src/typings.d.ts`：本包额外的全局/类型声明（如需扩展类型可按现有风格补充）。
  - `src/scenes/base`：基础 IDE 场景与通用能力封装。
  - `src/scenes/biz-agent-ide`：Agent IDE 业务场景适配。
  - `src/scenes/biz-library`：知识库 Library 场景适配。
  - `src/scenes/biz-project`：Project 业务场景适配。
  - `src/scenes/biz-workflow`：Workflow 业务场景适配及全屏弹窗 Hook。

### 2.1 Base 场景（src/scenes/base）
- `base/index.tsx`：
  - `BaseKnowledgeIDE(props: BaseKnowledgeIDEProps)`：根据当前数据集格式切换不同 IDE：
    - 通过 `useGetKnowledgeType()`（来自 `@coze-data/knowledge-ide-base/hooks/use-case`）获取 `dataSetDetail.format_type`。
    - `format_type === FormatType.Text` → 渲染 `BaseKnowledgeTextIDE`。
    - `format_type === FormatType.Table` → 渲染 `BaseKnowledgeTableIDE`。
    - `format_type === FormatType.Image` → 渲染 `BaseKnowledgeImgIDE`。
  - 若格式不匹配则返回 `null`，调用方应保证在打开 IDE 时已经有合法的数据集上下文。
- `base/types.ts`：
  - `BaseKnowledgeIDEProps`：
    - `navBarProps?: Partial<KnowledgeIDENavBarProps>`：透传给导航栏组件（由各业务场景注入）。
    - `layoutProps?: Partial<KnowledgeIDEBaseLayoutProps>`：透传给基础 IDE 布局（类名、NavBar 渲染函数等）。
- `base/modal/index.tsx`：
  - `useBaseKnowledgeIDEFullScreenModal(props)`：
    - 封装 `@coze-data/knowledge-ide-base/layout/base/modal` 的 `useKnowledgeIDEFullScreenModal`：
      - 额外要求 `biz: IKnowledgeParams['biz']` 与 `spaceId: string` 参数，用于 store 初始化。
      - 接收 `keepDocTitle` 与 `navBarProps` 透传到底层 Modal/导航栏。
    - 内部通过 `renderKnowledgeIDE` 回调渲染 `BaseKnowledgeIDE`，并自动将 Modal 的 `onClose` 绑定到 `navBarProps.onBack`。
  - 适用场景：需要在任意页面快捷以全屏 Modal 打开知识 IDE 时，优先使用该 Hook，而不是直接自己拼装 Modal。
- `base/text-ide` / `base/table-ide` / `base/img-ide`：
  - 这三个目录分别承载文本/表格/图片格式 IDE 的适配层，实现细节主要在 `@coze-data/knowledge-ide-base` 中；本包只负责在 Base 层进行路由与轻度样式适配。

### 2.2 业务场景适配（biz-*）
- 共性模式：
  - 每个 biz 场景都以 `BaseKnowledgeIDEProps` 为 props 类型，并在渲染时：
    - 直接复用 `BaseKnowledgeIDE` 作为主体。
    - 通过 `layoutProps.renderNavBar` 注入对应业务的导航栏组件。
  - 这样做到：
    - IDE 主体逻辑统一由 base/ide-base 管理；
    - 各业务场景只关心导航栏和少量布局样式差异。
- `biz-agent-ide/index.tsx`：
  - 使用 `BizAgentIdeKnowledgeIDENavBar`（来自 `@coze-data/knowledge-ide-base/features/nav-bar/biz-agent-ide`）。
  - 将 `statusInfo.progressMap`（来自 IDE 布局状态）透传给 NavBar，用于展示处理进度等。
- `biz-library/index.tsx`：
  - `BizLibraryKnowledgeIDE` 仅简单地返回 `<BaseKnowledgeIDE {...props} />`，说明 Library 场景完全复用 Base 布局与通用导航栏配置。
- `biz-project/index.tsx`：
  - 使用 `BizProjectKnowledgeIDENavBar`，并在 `layoutProps.className` 上附加项目场景特有样式：
    - `coz-bg-max border border-solid coz-stroke-primary`（统一的 Project IDE 配色和边框）。
- `biz-workflow/index.tsx`：
  - 使用 `BizWorkflowKnowledgeIDENavBar`，透传 `statusInfo.progressMap` 与上层传入的 `navBarProps`。
  - 主要用于 Workflow/Playground 场景中，在画布/节点配置旁边嵌入知识 IDE。
- `biz-workflow/modal/index.tsx`：
  - `useBizWorkflowKnowledgeIDEFullScreenModal` 封装了 Workflow 场景下的全屏 Modal 打开逻辑（实现类似 base/modal，但使用 Workflow 专用 nav bar 或额外参数）。
  - 外部使用方式与 `useBaseKnowledgeIDEFullScreenModal` 类似，但更贴合 workflow 业务 context。

## 三、构建、测试与本地开发流程
- 包管理与依赖：
  - 通过 Rush + PNPM workspace 管理，所有依赖版本形如 `workspace:*`，请勿在本包中手动改为固定版本。
- `package.json` scripts：
  - `build`: `exit 0` —— 本子包不自行产出 JS/CSS 构建产物，实际打包由上层应用/构建系统负责；TS 编译主要用于类型检查。
  - `lint`: `eslint ./ --cache` —— 使用 `@coze-arch/eslint-config` 的 `web` 预设（见 eslint.config.js）。
  - `test`: `vitest --run --passWithNoTests` —— 使用 `@coze-arch/vitest-config` 预设（见 vitest.config.ts）。
  - `test:cov`: 在 `test` 基础上增加 `--coverage`，输出覆盖率报告。
- TypeScript 配置：
  - [tsconfig.json](frontend/packages/data/knowledge/knowledge-ide-adapter/tsconfig.json)：
    - `exclude: ["**/*"]`，实际编译入口由 `tsconfig.build.json`/`tsconfig.misc.json` 控制，方便项目引用模式。
  - [tsconfig.build.json](frontend/packages/data/knowledge/knowledge-ide-adapter/tsconfig.build.json)：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`；
    - `rootDir: src`, `outDir: dist`，`moduleResolution: bundler`；
    - references 指向 bot-api、bot-typings、knowledge-stores、knowledge-ide-base 及前端统一 config 包，确保 TS project references 正确。
  - [tsconfig.misc.json](frontend/packages/data/knowledge/knowledge-ide-adapter/tsconfig.misc.json)：
    - 包含 `__tests__`、`stories`、`vitest.config.ts`，用于开发/测试文件的类型支持。
- Storybook：
  - `.storybook/main.js` 使用 `@storybook/react-vite` 与 `vite-plugin-svgr`，stories 源于 `stories/**/*.stories.tsx`、`stories/**/*.mdx`；
  - README 中的 `npm run dev` 对应 Storybook dev server，适合在本地调试 IDE 适配组件和 nav bar 行为。

## 四、使用方式与项目级约定
- 在业务应用中的典型使用：
  - Workspace 知识预览页：
    - 见 [frontend/packages/studio/workspace/entry-base/src/pages/knowledge-preview/index.tsx](frontend/packages/studio/workspace/entry-base/src/pages/knowledge-preview/index.tsx)，从 `@coze-data/knowledge-ide-adapter` 导入对应业务 IDE 组件并嵌入页面。
  - Project IDE / Workflow Playground：
    - 如 [frontend/packages/project-ide/biz-data/src/main.tsx](frontend/packages/project-ide/biz-data/src/main.tsx) 与 [frontend/packages/workflow/playground/src/form-extensions/components/dataset-select/index.tsx](frontend/packages/workflow/playground/src/form-extensions/components/dataset-select/index.tsx) 中，通过 `BizProjectKnowledgeIDE` 或 `useBizWorkflowKnowledgeIDEFullScreenModal` 嵌入或弹出知识库 IDE。
- 组件/Hook 设计约定：
  - Base 与 Biz 场景组件必须保持「无副作用 UI 组件」特性：
    - 不直接发起网络请求或操作全局 store；
    - 所有上下文（spaceId、biz、datasetId 等）应通过 `knowledge-ide-base` / `knowledge-stores` 提供的上下文与 Hook 获取。
  - 弹窗 Hook（`useBaseKnowledgeIDEFullScreenModal` / `useBizWorkflowKnowledgeIDEFullScreenModal`）：
    - 仅负责拼装 Modal + IDE UI，不在内部维护复杂业务状态；
    - 若需要额外行为（如关闭时回调），通过传入的 props 或 navBarProps 控制。
- 类型与 props 扩展：
  - 若需为某个业务场景增加额外 nav bar 配置或布局控制：
    - 优先在 `KnowledgeIDENavBarProps` 或 `KnowledgeIDEBaseLayoutProps` 上扩展，而不是在 adapter 里新增不对齐的 props；
    - 业务 IDE 组件的 props 应继续保持为 `BaseKnowledgeIDEProps` 的别名，避免接口发散。

## 五、与其他子包的依赖关系与集成细节
- `@coze-data/knowledge-ide-base`：
  - 提供：
    - `useGetKnowledgeType`（获取当前数据集格式与详情）。
    - 各种 `Biz*KnowledgeIDENavBar` 组件（用于不同业务场景的导航条）。
    - `KnowledgeIDEBaseLayout` 及其 props 类型，以及 `useKnowledgeIDEFullScreenModal` 等布局/弹窗能力。
  - 本包所有核心逻辑都以「调用 ide-base 的能力」为主，不在本包实现 IDE 本身。
- `@coze-data/knowledge-stores`：
  - 提供 `IKnowledgeParams` 类型与状态管理；
  - 弹窗 Hook 要求传入 `biz` 和 `spaceId`，以便底层 store 建立正确上下文。
- `@coze-arch/bot-api`：
  - 使用 `knowledge.FormatType` 来判定展示 Text/Table/Image 三种 IDE 类型，必须保持与后端/IDL 中的枚举值一致。
- 其它通用依赖（classnames、qs、react-router-dom 等）：
  - 目前在本包中使用较少/未直接用到；如需要在未来组件内使用路由、查询串等能力，应复用这些已有依赖，避免新增重复库。

## 六、工程规范与协作注意事项
- 代码风格：
  - 使用 `@coze-arch/eslint-config` 的 web 预设，禁止随意关闭全局规则；如确有需要，对单行/单文件局部 disable。
  - 文件头统一 Apache-2.0 版权声明，新增文件时保持一致。
- TS 项目引用：
  - 修改依赖关系（新增对其他内部包的引用）时，需要同步更新 `tsconfig.build.json` 的 `references`，否则 Rush `tsc --build` 可能报错。
- 测试：
  - 当前仅有占位的 `__tests__/.gitkeep`；
  - 如为关键逻辑（例如格式分发、Modal Hook 的行为）新增测试，建议使用 Vitest + React Testing Library，放在 `__tests__` 目录中，命名为 `*.test.tsx`。
- Storybook：
  - 复杂 UI 行为（如不同 biz 场景下的导航交互）推荐通过 stories 演示与回归；新增/修改组件时同步维护 `stories` 目录的示例。

## 七、对 AI 助手的特别提示
- 修改/新增对外导出时：
  - 仅在 `src/index.tsx` 中进行聚合导出，保持 API 面简洁稳定；
  - 避免从深层路径（如 `scenes/base/text-ide`）直接让下游包导出使用，以免破坏封装与后续重构空间。
- 需要扩展 IDE 行为时：
  - 优先到 `@coze-data/knowledge-ide-base` 中实现新能力，然后在本包做一层轻量适配；
  - 不要在本包直接实现完整的 IDE/编辑逻辑，本包应保持为「适配层」。
- 引入新的业务场景：
  - 按现有 `biz-*` 目录模式新增 `scenes/biz-xxx`：
    - 定义 `BizXxxKnowledgeIDEProps = BaseKnowledgeIDEProps`；
    - 在组件中复用 `BaseKnowledgeIDE` 并通过 `layoutProps.renderNavBar` 注入新的 nav bar 组件；
    - 必要时提供对应的全屏 Modal Hook（放在该 biz 目录下的 modal 子目录）。
- 调试/验证改动：
  - 除单测外，优先在实际消费方（如 Workflow Playground、Project IDE 或 Workspace 页面）中验证 IDE 能否正确打开/关闭、切换文本/表格/图片、导航栏状态是否正确展示。