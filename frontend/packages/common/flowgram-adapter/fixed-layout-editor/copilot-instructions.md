# copilot-instructions.md

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/flowgram-adapter/fixed-layout-editor）中安全、高效地协作开发。

## 1. 全局架构

- 本子包仅封装 `@flowgram.ai/fixed-layout-editor`（0.1.28）和其 CSS，并显式 re-export 所需类型与运行时 API；无自身业务逻辑。
- 目录结构说明：
  - `src/index.ts`：顶部 `import 'reflect-metadata'`，再从第三方库明确列出类型、hooks、类、Layer 等导出。
  - `src/css-load.ts`：独立样式入口，直接 `import '@flowgram.ai/fixed-layout-editor/index.css'`，使用者需单独引入。
  - `config/rush-project.json`：Rush monorepo 的项目配置，确定此包属于 frontend workspace。
  - `tsconfig.*` 与 `vitest.config.ts`：分别负责复合项目引用、构建/测试配置与 web preset。

## 2. 关键开发流程

- 构建：`package.json` 中 `build` 脚本直接 `exit 0`（只透传），因此 Rush 构建阶段仅验证 tsconfig，真实 bundle 由主项目处理。
- 测试：
  ```bash
  rushx test          # Vitest 执行，子包内部暂无测试用例但命令仍需运行
  rushx test:cov      # 传递 --coverage，在 coverage/ 中输出结果
  ```
- 代码质量：`rushx lint` 会调用 ESLint，默认启用缓存，使用共享配置 `@coze-arch/eslint-config`。
- 依赖升级：修改 `package.json` 中 `@flowgram.ai/fixed-layout-editor` 版本后执行 `rush update`，必要时同步在 `src/index.ts` 中新增/移除导出。

## 3. 项目专有约定与模式

- **显式导出列表**：避免 `export *`，所有需要暴露的 API（`EditorProps`、`FlowDocument`、`Layer`、`useService` 等）必须手工添加，便于控制公共契约。
- **业务职责边界清晰**：该包只做 API 透传，额外逻辑（数据处理、业务封装）应在调用方或 workspace 其他子包完成。
- **CSS 单独入口**：样式不随 JS 自动加载，必须 `import '@flowgram-adapter/fixed-layout-editor/css-load'` ，保持 UI 样式按需加载的灵活性。
- **TypeScript 复合项目**：`tsconfig.json` 仅包含 references（build + misc），实际编译配置分散在 `tsconfig.build.json` / `tsconfig.misc.json`，符合 Rush 的复合项目需求。

## 4. 重要组件集成与外部依赖

- 核心导出依赖：
  | 名称 | 说明 |
  | --- | --- |
  | `FlowDocument`, `EntityManager`, `ConfigEntity` 等 | 主编辑器实体与管理类 |
  | `usePlayground`, `useService`, `usePlaygroundTools` | hooks，帮助使用者访问运行时状态与服务 |
  | `FlowNodesContentLayer`、`FlowScrollBarLayer` 等 | 渲染层，帮助完成节点绘制和交互 |-| `createPlaygroundPlugin`, `definePluginCreator` 等 | 插件系统声明式注册 |
- 重要依赖：
  - `@flowgram.ai/fixed-layout-editor@0.1.28`：唯一业务依赖，包含所有功能与样式。
  - `reflect-metadata`：运行时元数据支持，必须在 `src/index.ts` 入口导入。
- peer 依赖：`react` / `react-dom` >=18.2.0，由使用方提供，避免重复打包。

## 5. 项目流程与协作规范

- 作为 Rush monorepo 一部分，所有命令均建议在仓库根目录通过 `rushx <script>` 执行，保持依赖一致性。
- 变更流程：
  1. 在 feature/bugfix 分支上调整 `package.json` 或 `src/index.ts`。
  2. 运行 `rushx lint` + `rushx test` 验证。  
  3. 通过 PR 进入 `main`（或主干分支），依赖 `rush update` 保持 lockfile 同步。
- 發布：依赖 Rush 脚本，版本号由 monorepo 根目录统一管理，无单独发布流程。

## 6. 其他特殊说明

- 该包与 `@flowgram-adapter/free-layout-editor` 同为适配层，接口表面相似但分属固定/自由布局，避免混用同一版本的导出。
- 所有新导出必须同步在 `src/index.ts` 的导出列表中，防止 downstream 无法识别新增 API。
- 由于 `build` 脚本无实际操作，文件变更主要集中在 `package.json`、`src/index.ts` 以及版本号，因此需要额外在 PR 描述中说明升级/变更影响。
