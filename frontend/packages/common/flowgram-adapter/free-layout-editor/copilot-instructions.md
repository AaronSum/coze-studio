# @flowgram-adapter/free-layout-editor 开发指南（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/flowgram-adapter/free-layout-editor）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 本包对应 npm 包 `@flowgram-adapter/free-layout-editor`，位于 monorepo 前端层级的 `common` 目录下，是 **flowgram free-layout 低代码画布体系的适配层**。
- 核心职责：
  - 统一聚合 `@flowgram.ai/*` 生态中的核心能力（画布、节点、连线、表单、变量系统、历史记录、自动布局、渲染层等），并通过单一入口导出，方便业务包（如 `workflow/playground`）只依赖本包即可获得完整能力。
  - 提供少量自定义扩展能力：
    - [src/workflow-json-format.ts](src/workflow-json-format.ts)：定义工作流 JSON 级别的初始化与提交转换钩子接口 `WorkflowJSONFormatContribution`，并以 `Symbol` 形式导出，用于依赖注入/服务发现。
    - [src/use-entity.ts](src/use-entity.ts)：对底层 `EntityManager` 的访问封装，现已标记为 `@deprecated`，建议业务使用 `useConfigEntity` 等更新 API。
    - [src/css-load.ts](src/css-load.ts)：集中加载 `@flowgram.ai/free-layout-editor/index.css`，供上层应用进行样式注入。
  - 通过 [src/index.ts](src/index.ts) 对外暴露大部分能力（详见 README 的 Exports 列表），本包本身 **几乎不实现业务逻辑，只做 re-export + 少量扩展接口**。
- 使用场景：
  - 例如 [frontend/packages/workflow/playground](frontend/packages/workflow/playground) 通过 `@flowgram-adapter/free-layout-editor` 获取：
    - 画布运行时（`usePlayground`, `PlaygroundReactProvider` 等）。
    - 自动布局（`AutoLayoutService`, `createFreeAutoLayoutPlugin`）。
    - 历史记录操作（`FreeOperationType`, `HistoryService`）。
    - 节点、连线、变量、表单等类型与服务。

## 2. 代码结构与主要模块

- 目录结构（仅子包级）：
  - [package.json](package.json)：定义依赖、构建脚本、导出入口。
  - [README.md](README.md)：对包功能、导出项有整体说明，可作为导出 API 的快速索引。
  - [config/rush-project.json](config/rush-project.json)：Rush 项目配置，控制该子包在 monorepo 中的构建依赖关系。
  - [tsconfig.json](tsconfig.json)、[tsconfig.build.json](tsconfig.build.json)、[tsconfig.misc.json](tsconfig.misc.json)：TypeScript 编译和 IDE 配置，注意引用的是 monorepo 级别 `@coze-arch/ts-config`。
  - [eslint.config.js](eslint.config.js)、[.stylelintrc.js](.stylelintrc.js)：使用 `@coze-arch/eslint-config` 与 `@coze-arch/stylelint-config` 的集中配置。
  - [vitest.config.ts](vitest.config.ts)：引入 `@coze-arch/vitest-config`，preset 为 `web`，用于前端包测试。
  - src 目录：
    - [src/index.ts](src/index.ts) —— **唯一主入口**，大量从以下外部包 re-export：
      - `@flowgram.ai/free-layout-core`：工作流文档模型、节点/连线实体、拖拽、选择、悬浮、文档容器等。
      - `@flowgram.ai/free-layout-editor`：Playground 运行时、表单模型、React Hooks、编辑器状态等。
      - `@flowgram.ai/core`：Playground 核心基础设施（Entity 管理、插件系统、Logger、SelectionService 等）。
      - `@flowgram.ai/document`：节点文档定义（FlowNode、FlowDocument 等）。
      - `@flowgram.ai/form-core` 与 `@flowgram.ai/form`：表单元数据、校验、节点错误处理、装饰器/Setter 能力等。
      - `@flowgram.ai/renderer`：渲染层，包含 FlowRenderer 相关实体与 Layer。
      - 多个 `@flowgram.ai/*-plugin`：历史、节点面板、连线、容器、自动布局、栈式布局、快照、变量等插件。
      - `@flowgram.ai/variable-plugin`、`@flowgram.ai/node-variable-plugin`、`@flowgram.ai/node-core-plugin`：变量及节点核心插件能力。
    - [src/workflow-json-format.ts](src/workflow-json-format.ts)：定义 `WorkflowJSONFormatContribution` 接口和同名 Symbol。
    - [src/use-entity.ts](src/use-entity.ts)：提供 `useEntity` Hook，对 `EntityManager` 的实体读写与变更订阅。
    - [src/css-load.ts](src/css-load.ts)：简单样式引导文件。
    - [src/deprecated.ts](src/deprecated.ts)：（若存在）集中放置兼容性导出，可视为技术债区域。

## 3. 外部依赖与服务集成

- 核心运行时依赖（均为非 devDependencies）：
  - `@flowgram.ai/free-layout-editor`：free-layout 编辑器的 React 运行时，提供 `usePlayground`, `EntityManager`, `SelectionService`, `PlaygroundReactProvider` 等高层 API。
  - `@flowgram.ai/free-layout-core`、`@flowgram.ai/document`：工作流文档、节点与连线模型定义，统一的 `WorkflowDocument` 与 `WorkflowNodeEntity` 类型。
  - `@flowgram.ai/form*` 系列与 `@flowgram.ai/variable*` 系列：
    - 表单模型、节点表单数据、错误信息、Validator；
    - 变量作用域与 AST 表达式系统（`ScopeProvider`, `VariableEngine`, `ASTNodeJSON` 等）。
  - `@flowgram.ai/*-plugin` 系列：
    - 自动布局（`AutoLayoutService`, `createFreeAutoLayoutPlugin`）。
    - 历史记录（`createFreeHistoryPlugin`, `HistoryService`, `FreeOperationType`）。
    - 连线渲染（`createFreeLinesPlugin` 等）。
    - 节点面板、栈布局、容器布局、快照等。
  - `reflect-metadata`：为 Inversify/DI 风格的依赖注入提供 metadata 支持，注意：
    - `src/index.ts` 顶部 `import 'reflect-metadata';` 是副作用导入，**不得移除或提前 Tree-shaking**，否则依赖注入链会断裂。
- 在上层业务中的使用（示例，仅供理解）：
  - [frontend/packages/workflow/playground/src/shortcuts/contributions/layout/index.ts](frontend/packages/workflow/playground/src/shortcuts/contributions/layout/index.ts) 中：
    - 使用 `AutoLayoutService`, `FreeOperationType`, `HistoryService`, `TransformData`、`WorkflowDocument` 等来自本包的 re-export 能力。
  - [frontend/packages/workflow/playground/src/components/toolbar/hooks/use-auto-layout.ts](frontend/packages/workflow/playground/src/components/toolbar/hooks/use-auto-layout.ts)：
    - 通过 `usePlaygroundTools`, `useService(WorkflowLayoutShortcutsContribution)` 实现画布自动布局行为。

## 4. 全局/子包级开发流程

- 构建与测试脚本（本子包局部）：见 [package.json](package.json)`scripts`：
  - `rush build -t @flowgram-adapter/free-layout-editor`：在 monorepo 根目录执行，按 Rush 依赖图增量构建到本包（实际 `build` 脚本当前为 `exit 0`，主要用于依赖检查与类型校验）。
  - `rushx lint` 或 `pnpm lint`（在本包目录）：调用 `eslint ./ --cache`，规则集来自 `@coze-arch/eslint-config`。AI 助手新增文件时应确保符合 ESLint 规则，不随意关闭规则。
  - `rushx test` / `pnpm test`：运行 `vitest --run --passWithNoTests`，Vitest 配置来自 [vitest.config.ts](vitest.config.ts)。当前包通常缺少单元测试，新代码若有非平凡逻辑，应优先在依赖本包的上层包中编写测试。
  - `rushx test:cov`：执行 `npm run test -- --coverage`，产出覆盖率报告（如有配置）。
- 运行/调试：
  - 本包自身不包含独立运行入口，一般通过 `workflow/playground` 或其他上层应用启动：
    - 在 frontend 根目录可参考 [frontend/README.md](frontend/README.md) 所描述的开发命令（例如 `rushx dev`、具体见各 app 或 scripts）。
    - 任何对本包导出 API 的更改都需要在这些上层应用中实际运行验证。

## 5. 设计约定与编码风格

- **适配层定位**：
  - 默认不在本包内写复杂业务逻辑，它的作用类似 “面向业务的 SDK 门面”：
    - 不改变底层 `@flowgram.ai/*` 行为，只做 re-export 或极薄的扩展接口。
    - 若需要新增复杂功能，优先考虑：
      1. 在 `@flowgram.ai/*` 仓库中新增；或
      2. 在工作流领域包（如 `frontend/packages/workflow/*`）实现；
      3. 在本包中仅增加少量 glue code/类型定义，让上层引用方便。
- **导出策略**：
  - 新增导出时：
    - 统一在 [src/index.ts](src/index.ts) 中集中管理，按照来源包分组导出，保持与 README 的 Exports 列表同步（只需简要更新文档，不要求逐项罗列）。
    - 尽量以原包名 + 原符号导出，避免在本包中进行重命名，以降低二义性。
- **依赖注入与 Symbol**：
  - `WorkflowJSONFormatContribution` 使用 `Symbol('WorkflowJSONFormatContribution')` 作为 DI 标识符，这是全局单例 token：
    - 依赖方一般通过容器 `get(WorkflowJSONFormatContribution)` 或对应辅助函数获得实现。
    - AI 助手为上层实现新的 JSON format service 时，应严格遵守接口约定：
      - `formatOnInit` / `formatOnSubmit` 针对整个 `WorkflowJSON`。
      - `formatNodeOnInit` / `formatNodeOnSubmit` 针对单个 `WorkflowNodeJSON`，并传入 `WorkflowDocument` 与 `WorkflowNodeEntity` 上下文。
    - 保持函数纯度：不要在这里做 UI 副作用，而只做数据转换。
- **Hook 使用约定**：
  - [src/use-entity.ts](src/use-entity.ts) 中的 `useEntity` 已显式 `@deprecated`：
    - 注释中推荐使用 `useConfigEntity`（从 `@flowgram.ai/core` re-export），AI 助手在编写新代码时，应避免继续依赖 `useEntity`，仅在维护旧代码或兼容层时使用。
    - 如必须使用：
      - 知道其内部是通过 `EntityManager.getEntity` 获取实体并订阅 `onEntityChange` 来触发刷新。
      - 注意 `autoCreate` 默认 `true`，意味着不存在时会创建实体。
- **样式与 CSS**：
  - 所有画布/编辑器的基础样式都来源于 `@flowgram.ai/free-layout-editor/index.css`，本包只通过 [src/css-load.ts](src/css-load.ts) re-export 引入：
    - 在需要全局注入样式的应用中，可 `import '@flowgram-adapter/free-layout-editor/css-load';` 一次性加载。
    - 不要在本包中手动追加样式文件；画布视觉样式的改动应回到 `@flowgram.ai` 体系实现。
- **命名与 TypeScript 配置**：
  - 遵守 monorepo 统一的 TS/ESLint 规则，典型特征包括：
    - `type` 前缀、驼峰命名、禁用某些 `any`、推荐 union/enums 等。
    - 禁止使用 `@typescript-eslint/naming-convention` 下禁止的命名，若确有特殊 Symbol（如 `WorkflowJSONFormatContribution`）需要关闭规则，应局部 eslint-disable，而非全局放宽。

## 6. 在本包上开发新能力时的建议

- **新增导出/类型**：
  - 尽量保证本包保持 “薄”：
    - 若只是为方便上层 import，将 `@flowgram.ai/*` 中已有 API 再导出即可。
    - 新增接口/类型（如 `WorkflowJSONFormatContribution`）应：
      - 与工作流编辑器的全局行为强相关；
      - 以接口 + Symbol 的形式定义，方便上层实现/注入；
      - 避免过强绑定具体业务（如某个特定产品的字段）。
- **修改现有接口**：
  - `WorkflowJSONFormatContribution` 或类似扩展点如需修改：
    - 首先搜索整个 monorepo 中的使用点，尤其是在 `workflow`、`agent-ide` 等目录。
    - 确保向后兼容，必要时通过新增可选字段来扩展，而不是破坏现有签名。
- **调试技巧**：
  - 若某个导出在上层应用中行为异常：
    - 对比 `@flowgram.ai/*` 对应版本是否有变动，检查 [package.json](package.json)`dependencies` 中版本号（当前统一为 `0.1.28`）。
    - 使用 TypeScript 跳转到声明文件确认导出是否正确、是否存在 re-export 错误（如类型遗漏、值与类型混淆等）。

## 7. 项目流程与协作规范（针对本子包）

- 分支与提交：
  - 遵守 monorepo 顶层规范（见根目录 `CONTRIBUTING.md`、`CLAUDE.md` 中对前端分支/PR 的要求）。
  - 对于仅涉及本包的小改动（如 re-export 增加、类型补充）：
    - PR 描述中建议明确写明 “仅影响 `@flowgram-adapter/free-layout-editor` 导出行为”。
- 变更验证：
  - 必要的最小验证流程：
    1. `rush build -t @flowgram-adapter/free-layout-editor` 确认该包及其依赖能通过构建和类型检查。
    2. 在典型上层应用（如 workflow playground）运行 dev server，手动回归常见操作：节点创建、连线、自动布局、撤销/重做等。
- 文档维护：
  - 修改导出项或扩展点时：
    - 适度更新 [README.md](README.md) 中的 Exports 说明，保证使用者仍能通过 README 粗略了解可用能力。
    - 同时考虑是否需要在上层包的 README 或示例中增加使用范例。

## 8. 本包的特殊/非典型特性

- `build` 脚本暂时为 `exit 0`：
  - 说明本包本身不参与前端产物打包（没有独立 dist），构建主要依赖 TypeScript + 上层应用 bundler。
  - AI 助手在添加脚本时不要轻易改为真实打包（如 tsup/rsbuild），以免与 monorepo 现有流程冲突。
- 大量 re-export：
  - 本包几乎没有本地实现逻辑，这会让代码阅读时显得 “空”：
    - 多数问题的根因在 `@flowgram.ai/*` 仓库，而不是这里。
    - 但由于上层业务统一从本包 import，API 设计/命名的可读性和稳定性依然非常重要。
- 使用 `reflect-metadata` 副作用导入：
  - 这是 DI 体系正确工作的前提之一，任何尝试去除/改写该导入都可能导致运行时服务获取失败。

---

AI 助手在本子包中进行修改时，应优先遵循以上约定，将本包视为 **“flowgram free-layout 能力的门面/适配层”**，保持其轻量、稳定和面向上层业务的友好导出。