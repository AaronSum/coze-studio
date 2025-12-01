# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/workspace/project-entity-adapter）中安全、高效地协作开发。

## 全局架构与角色定位

- 本子包是 Coze Studio 前端单体仓中的一个工作区适配层，包名为 `@coze-studio/project-entity-adapter`，主要职责是为「项目实体（intelligence / project）」提供创建、更新、复制、删除等 CRUD 相关的 React Hook 适配能力。
- 核心业务能力全部下沉到依赖包 `@coze-studio/project-entity-base`，本包仅做轻量包装与导出，保证上层应用只依赖统一的 adapter API，而不直接感知底层实现细节。
- 与后端接口的数据结构通过 `@coze-arch/idl` 提供的 TypeScript 类型（例如 `DraftProjectCopyRequest`），本包不直接关心网络请求，仅依赖类型与 base hooks。
- 项目使用 Rush + pnpm 管理，TypeScript 使用 `@coze-arch/ts-config` 的通用 web preset，测试使用 `@coze-arch/vitest-config` 的 web 预设，lint 使用 `@coze-arch/eslint-config` 统一规范。
- 整体架构可以理解为：
  - IDL（API 类型定义）层：`@coze-arch/idl` 提供接口请求/响应类型。
  - Base 业务层：`@coze-studio/project-entity-base` 实现与接口交互、表单、弹窗逻辑。
  - Adapter 层（本包）：根据 Studio Workspace 的使用场景，提供语义化的 Hook 导出和类型 re-export。

## 源码结构与主要模块

- [src/index.ts](src/index.ts)
  - 顶层仅此一个入口文件，对外暴露整个包的 API；新增功能时请优先考虑在此集中导出，保持 adapter 稳定入口。
  - 直接从 `@coze-studio/project-entity-base` re-export 若干类型与 `useDeleteIntelligence`；这保证上层调用只需要引入本包，而不需要感知 base 包路径。
  - 引入 IDL 类型 `DraftProjectCopyRequest` 自 `@coze-arch/idl/intelligence_api`，用于约束复制项目场景下的请求结构。
  - 基于 base 包导出的 `useCreateProjectModalBase / useUpdateProjectModalBase / useCopyProjectModalBase`，提供三个对外 Hook：
    - `useCreateProjectModal(params: CreateProjectHookProps)`
      - 返回 `{ modalContextHolder: ReactNode; createProject: () => void }`。
      - 上层在组件树中渲染 `modalContextHolder`，在需要时调用 `createProject()` 触发创建弹窗。
    - `useUpdateProjectModal({ onSuccess? })`
      - 返回 `{ modalContextHolder: ReactNode; openModal: ({ initialValue }) => void }`。
      - `initialValue` 类型为 `ProjectFormValues`，表示编辑弹窗的初始表单数据。
    - `useCopyProjectModal({ onSuccess? })`
      - 返回 `{ modalContextHolder: ReactNode; openModal: ({ initialValue }) => void }`。
      - `initialValue` 使用 `ModifyUploadValueType<RequireCopyProjectRequest<DraftProjectCopyRequest>>`，对应复制项目时的上传/表单数据结构。
  - 这些 Hook 均是简单的参数透传：
    - 适配层不改变 base Hook 的行为，只保证类型与返回结构在本包导出时保持稳定。
    - 任何逻辑变更应优先在 `@coze-studio/project-entity-base` 内进行，本包只做必要的 re-export 或签名微调。

- [__tests__](__tests__)
  - 当前仅有 `.gitkeep`，暂无测试实现；若增加测试文件，请遵循 vitest + `@coze-arch/vitest-config` 的约定（见下文测试小节）。

- [config / eslint.config.js](eslint.config.js)
  - 通过 `@coze-arch/eslint-config` 的 `defineConfig` 使用 `preset: 'web'`。
  - `packageRoot: __dirname` 避免在 monorepo 中出现路径解析问题。
  - 若需调整规则，请在 `rules` 字段下增量配置，避免覆盖团队通用规范。

- TypeScript 配置：
  - [tsconfig.build.json](tsconfig.build.json)
    - `extends: @coze-arch/ts-config/tsconfig.web.json`，统一 web 环境编译选项。
    - `rootDir: ./src`、`outDir: ./dist`，仅编译业务源码到 dist。
    - 通过 `references` 显式依赖其他内部包的构建结果（如 `@coze-arch/idl`、`project-entity-base` 等），确保增量构建与编辑器跳转；新增依赖时，如需参与 TS project references，应在此补充路径。
  - [tsconfig.misc.json](tsconfig.misc.json)
    - 用于测试、故事、配置等“杂项”代码（`__tests__`、`stories`、`vitest.config.ts`、`tailwind.config.ts` 等）。
    - `types: ['vitest/globals']` 使测试文件中能够直接使用全局的 `describe` / `it` / `expect` 等。
  - [tsconfig.json](tsconfig.json)
    - 顶层 references-only 配置，将编译职责拆分为 build & misc 两块，`exclude: ['**/*']` 防止重复编译。

- 测试配置：
  - [vitest.config.ts](vitest.config.ts)
    - 使用 `@coze-arch/vitest-config` 的 `defineConfig({ dirname: __dirname, preset: 'web' })`。
    - 测试运行行为（环境、alias、快照目录等）由公共 preset 控制；如需定制，请在本文件中向 `defineConfig` 传入额外字段。

- 文档：
  - [README.md](README.md)
    - 描述本包为 React 组件模板，内置 eslint、ts、esm/umd 打包与 storybook；实际当前打包脚本未启用（见下文）。

## 构建、运行与测试流程

- 包级脚本定义于 [package.json](package.json)：
  - `build: "exit 0"`
    - 目前构建脚本占位，不执行实际打包；在 Rush monorepo 中，真实构建可能由上层工具或统一脚本驱动（例如 builder/rsbuild 等）。
    - 若需要在本包增加实际构建流程，推荐：
      - 复用 monorepo 中已有的构建工具（如 rsbuild、rollup、tsup 等），并与团队现有配置保持一致。
  - `dev: "exit 0"`
    - 同样为占位命令，本包目前不直接提供独立 dev server。
    - 业务场景通常由上层 app（如 `@coze-studio/app`）通过 workspace 依赖引入本包并统一启动。
  - `lint: "eslint ./ --cache"`
    - 使用本包根目录的 `eslint.config.js` 和 monorepo 统一的 eslint preset。
    - 推荐在改动前后运行，保证规则符合团队规范。
  - `test: "vitest --run --passWithNoTests"`
    - 基于 [vitest.config.ts](vitest.config.ts) 运行单测。
    - `--passWithNoTests` 允许在没有测试文件的情况下测试通过，方便增量开发。
  - `test:cov: "npm run test -- --coverage"`
    - 在上述测试基础上开启覆盖率统计。

- 在 Rush monorepo 中的常用工作流（全局维度）：
  - 初始化依赖：在仓库根目录执行 `rush update`。
  - 前端构建/启动通常由 [frontend/README.md](../../../README.md) 以及仓库根部脚本（例如 scripts、rushx 命令）约束；本包作为 workspace 子包，一般不单独运行，而是被上层 app 使用。

## 项目特有约定与模式

- Adapter 设计模式：
  - 本包将所有核心逻辑委托给 `@coze-studio/project-entity-base`，自身只充当：
    - 类型聚合与重导出（re-export）。
    - Hook 封装（保持统一的 API 入口和返回结构）。
  - 开发时应优先在 base 包实现/修改逻辑，然后在 adapter 中：
    - 补充新的导出类型；
    - 若上层需要新的 Hook 名或签名，先在 base 提供对应基础能力，再在本包做简单包装。

- 类型透传与稳定 API：
  - `ProjectFormValues`、`UpdateProjectSuccessCallbackParam`、`CreateProjectHookProps` 等类型全部引用自 base 包；adapter 不自行重新定义，以减少重复和类型漂移风险。
  - 使用 IDL 类型（如 `DraftProjectCopyRequest`）时优先通过 base 包提供的泛型 `RequireCopyProjectRequest<T>`、`ModifyUploadValueType<T>` 等工具类型组合，保持与后端协议一致。
  - 新增 API 时应遵循同样的“类型来源单一”原则：
    - 与接口相关的类型定义放在 `@coze-arch/idl`；
    - 与 UI/业务逻辑相关的类型放在 base 包；
    - adapter 仅组合与导出。

- React Hook 使用约定：
  - 所有 `useXxxModal` Hook 都返回：
    - `modalContextHolder: ReactNode`：需在组件树中就近渲染，用于挂载弹窗。
    - 操作函数：`createProject` 或 `openModal`，用于实际触发 modal。
  - 在上层页面中，一般模式为：
    - 在组件顶层调用 Hook 获取 `{ modalContextHolder, ... }`。
    - 在 JSX 中渲染 `{modalContextHolder}`。
    - 在按钮/菜单点击事件中调用 `createProject()` 或 `openModal({ initialValue })`。

- TS 项目引用（project references）：
  - 本子包通过 [tsconfig.build.json](tsconfig.build.json) 声明对其他内部包的引用，这对编辑器跳转、增量构建和 Rush 的构建流水线都很重要。
  - 新引入一个 workspace 包依赖时：
    - 在 `package.json` 增加 `dependencies` 或 `devDependencies`；
    - 若该依赖需要参与 TS build graph（例如被源码直接 `import`），也需要在 `tsconfig.build.json` 的 `references` 中添加对应 `tsconfig.build.json` 路径。

- Lint/测试统一预设：
  - eslint/vitest/tsconfig 均使用 `@coze-arch/*` 家族的共享配置，避免在本包中自建一套规则。
  - 如确有必要覆盖，请尽量通过“增量配置”而不是完全替换 preset，保持与其他子包风格一致。

## 依赖与外部集成

- 运行时依赖（`dependencies`）：
  - `@coze-arch/idl`：
    - 提供后端接口的 TypeScript 类型定义，当前使用 `DraftProjectCopyRequest`（来源 `intelligence_api`）。
    - 若需要扩展其他与项目实体相关的接口类型，应优先在 `@coze-arch/idl` 对应模块中添加。
  - `@coze-studio/project-entity-base`：
    - 本包关键依赖，包含创建、更新、复制、删除项目相关的业务逻辑 Hook 和类型。
    - `useCreateProjectModalBase` / `useUpdateProjectModalBase` / `useCopyProjectModalBase` 等均从此导入。

- 开发依赖（`devDependencies`）中的重要组件：
  - `@coze-arch/eslint-config` / `@coze-arch/stylelint-config` / `@coze-arch/ts-config` / `@coze-arch/vitest-config`：
    - 统一全仓库的 lint、编译、测试规范。
    - 修改这些行为时应优先协同架构/基础团队，而非在本包内单独“另起炉灶”。
  - `react` / `react-dom`：
    - 本包作为 React Hook/组件适配层，运行时通过 `peerDependencies` 声明对 React 的要求版本（>=18.2.0），自身 dev 依赖则锁定 `~18.2.0` 以保证开发环境一致性。
  - `vitest` / `@vitest/coverage-v8` / `@testing-library/*`：
    - 推荐使用 Testing Library 编写行为驱动的单元测试，避免依赖内部实现细节。

## 开发流程与协作规范

- 分支与提交（参考仓库上层规范）：
  - 仓库整体通常采用 feature 分支 + PR 流程，具体命名规范与 MR 规则请参考项目根级别文档（如 CONTRIBUTING.md、团队内部规范）。
  - 在本包内改动时，建议：
    - 若变更仅影响 adapter 而不改变对外 API，可在提交说明中明确 "chore(adapter): ..." 或 "refactor(adapter): ..."。
    - 若新增/修改对外导出的 Hook 或类型，请在提交信息和 PR 描述中注明具体 API 名称，方便 code review。

- 测试与覆盖率要求：
  - 根据 [frontend/rushx-config.json](../../../rushx-config.json) 中的 `codecov.level-3` 配置：
    - level-3 包（包括本包）当前对整体覆盖率无硬性要求（coverage/incrementCoverage 均为 0）。
    - 但仍推荐为关键逻辑增加单测，特别是对外暴露的 Hook 行为（例如参数透传、回调触发时机）。

- 变更影响评估：
  - 由于本包主要扮演“统一入口”的角色，任何对导出签名的修改都有可能影响大量上层调用点：
    - 优先保持向后兼容；必要时通过新增导出而非直接修改原有导出。
    - 如需破坏性变更，应先在上层应用中完成迁移，再在本包中删除旧 API，并在 PR 中说明影响范围。

## 不寻常 / 需要特别注意的点

- `build` / `dev` 脚本目前为 no-op：
  - README 提到的“esm/umd bundle、storybook”等功能在当前 package.json 中并未真正实现，说明本包更多扮演逻辑适配层，而非独立可运行的组件库。
  - 若需要新增真实的打包/文档/Storybook 能力，请先查看其他已落地的组件包（例如 `frontend/packages/components/*`）的实现，复用相同的 builder 与目录约定。

- 逻辑高度依赖外部 base 包：
  - 当前 src 中几乎不包含业务实现，本包对行为的影响非常有限。
  - 任何看似“简单”的修改（比如调整类型、改 Hook 参数）实际上可能绕过 base 层的约束，因此在改动前建议：
    - 同时打开 `@coze-studio/project-entity-base` 对应源码，确保理解真实业务逻辑；
    - 评估是否更适合在 base 层修改，而不是在 adapter 层做 patch。

- IDL 类型来源单一：
  - 所有面向后端的请求/响应结构都应来源于 `@coze-arch/idl`，不要在本包中手写“看起来差不多”的 interface，以免与真实接口 drift。

以上内容应能让 AI 编程助手在本子包中快速熟悉上下文，安全地进行 Hook 与类型相关的改动。如需进行跨包协作（例如修改 base 或 IDL），建议再结合对应子包的 copilot-instructions.md 一并阅读。