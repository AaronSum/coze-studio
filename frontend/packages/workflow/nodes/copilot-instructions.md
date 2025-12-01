# copilot-instructions.md

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/nodes）中安全、高效地协作开发。

## 包位置与元信息
- 包名: `@coze-workflow/nodes`
- 子包路径: `frontend/packages/workflow/nodes`
- 角色标签: team-automation, level-3

## 1. 全局架构（Global architecture）

- 目标: 本子包实现 workflow 节点模型、校验、工具函数与面向编辑器的服务层，作为编辑器/工作流构建器的可复用模块。
- 主要组件:
  - `src/index.ts`：统一导出模块边界，暴露 `service`、`validators`、`utils` 等。
  - `src/service/workflow-nodes-service.ts`：业务服务，使用依赖注入（`inversify`）并与 `EntityManager` / `WorkflowNodeEntity`（来自 `@flowgram-adapter/free-layout-editor`）交互，负责节点标题/ID 管理与全局节点查询等。
  - `src/validators/`：输入、输出、设置相关的校验逻辑（目录下有 `input-tree-validator.ts`、`setting-on-error-validator.ts` 等）。
  - `src/*` 其它模块：`workflow-json-format.ts`、`workflow-document-with-format.ts`、`utils/*`、`typings`、`constants` 等，构成数据格式与转换层。
- 数据流（高层）:
  - 编辑器层（free-layout-editor）持有 `WorkflowNodeEntity` 实例并将 `FlowNodeFormData` 注入到节点；本包通过 `EntityManager` 读取/修改实体数据并用 `FormNodeMeta` 等元数据字段更新节点标题、节点配置等。
  - 校验器在将节点/流程序列化为 JSON 或持久化前对元数据、输入输出树进行校验（兼容 `ajv`/`zod` 风格的校验器实现，应查看具体文件）。
- 结构理由: 包以服务 + 验证 + 工具的方式拆分关注点，便于在 UI 编辑器与后端序列化之间保持一致的节点元数据契约。

## 2. 关键开发工作流（Build / Test / Debug）

- 先决：本仓库为 monorepo，使用 Rush + workspace 机制。对本包的依赖多为 `workspace:*`。在修改前请在仓库根目录运行：

  - `rush update` （或团队约定的安装步骤）

- 包内常用脚本（在 `frontend/packages/workflow/nodes/package.json` 中）：
  - `npm run dev` —— 启动本包的开发模式（使用 `edenx dev`，通常会启动本地构建或 storybook）。
  - `npm run build:watch` —— `edenx build --watch`（增量构建）。
  - `npm run build` —— 当前为 `exit 0`（构建通常在 monorepo 层或 CI 中由统一工具处理）。
  - `npm run storybook` —— 启动 Storybook（`edenx dev storybook`）。
  - `npm run lint` —— eslint 校验（使用内部 `@coze-arch/eslint-config`）。
  - `npm run test` —— 运行 `vitest`（单元测试），可在包目录直接执行。

- 本地调试建议：
  1. 在仓库根运行 `rush update` 并确保本包的 workspace 依赖可解析。
  2. 在包目录运行 `npm run dev`（如需 Storybook 可运行 `npm run storybook`）。
  3. 运行单元/快照测试：`npm run test`（注意：测试环境依赖 monorepo 的 devDeps）。
  4. 若需要在整体应用中验证，启动前端应用或 Storybook，或在上游包中导入本包并运行集成场景。

## 3. 项目特定约定与模式

- 依赖与包管理：大量内部包使用 `workspace:*`，避免单独升级这些依赖，遵循 monorepo 的集中升级策略（使用 `rush` / `edenx upgrade`）。
- 构建：`main` 与 `types` 在 `package.json` 指向 `./src/index.ts`（源码导出），说明发布/构建由 monorepo 的通用流程处理，本地 `build` 脚本被设为 `exit 0`。
- 代码风格与配置：使用公司统一的 `@coze-arch/ts-config`、`@coze-arch/eslint-config` 与 `@coze-arch/vitest-config`，请在修改时遵守这些配置。
- 依赖注入：服务层使用 `inversify`（参见 `workflow-nodes-service.ts`），组件通过注入 `EntityManager` 等运行时对象，请勿直接 new 这些上下文对象，优先通过容器/模块注入。
- 导出策略：`src/index.ts` 作为包的边界，添加新 API 时请在此处明确定义并保证向后兼容。

## 4. 重要/特殊组件的集成细节

- `@flowgram-adapter/free-layout-editor`：提供 `EntityManager`, `FlowNodeFormData`, `WorkflowNodeEntity` 等类型与运行时实体。本包依赖编辑器的数据模型来读取/修改节点，修改时注意不破坏实体约定（ID 格式、isStart 标记等）。
- `inversify`：在服务上使用 `@injectable()` 与 `@inject()`，服务实例期望被 DI 容器管理（查看 `workflow-nodes-container-module` 等容器注册点）。
- `nanoid`：用于生成短 ID（`createUniqID`），实现中前缀为 `1` 避免后端 int64 转换导致的 0。ID 生成策略与后端约定相连，修改需确认兼容性。
- 校验器 (`src/validators`)：包含节点元数据、输入/输出树和设置相关校验逻辑。仓库中同时列出 `ajv` 与 `zod`，实际实现请参考各校验器文件以确认使用的具体方案。
- 内部设计：`nodeMeta`、`FormNodeMeta` 等结构是跨包契约，任何字段变更须同步更新使用这些字段的上游/下游包。

## 5. 流程与规范（Processes & norms）

- 分支/提交流程：遵循 monorepo 的通用贡献规范（参阅仓库根的 `CONTRIBUTING.md`）。通常通过 `rush` 流程进行依赖变更与发布管理。
- 代码审查：保持 API 向后兼容；修改导出或 runtime 行为时应有明确迁移说明与测试。
- 发布：本包通常由 monorepo 集中构建/发布，请勿单独在子包层面修改版本号或直接发布，除非得到团队授权。

## 6. 异常/显著特性（Unusual characteristics）

- `package.json` 的 `build` 被设为 `exit 0`：实际构建由 monorepo 的构建工具（`edenx` / CI / Rush 管道）负责。
- 运行时依赖 `EntityManager` 等运行时容器对象，导致单文件测试需搭建或 mock 相应容器/实体。
- 包将 `main`/`types` 指向 `src`：这意味着 consumers 可能在编译时直接透传 TypeScript 源，检查 monorepo 的打包/发布流程以确认真实发布产物格式。

## 7. 对 AI 代理的操作建议（快速上手清单）

1. 在根目录执行 `rush update`（获取并链接 workspace 依赖）。
2. 打开 `frontend/packages/workflow/nodes/package.json`、`src/index.ts`、`src/service/workflow-nodes-service.ts`、`src/validators/*` 以了解公共 API 与校验边界。
3. 本地运行测试：在包目录运行 `npm run test`。运行 `npm run lint` 做静态检查。
4. 若要在真实编辑器场景中验证变更：启动 storybook（`npm run storybook`）或在主应用中引入并运行编辑器页面。
5. 在读取/修改仓库文件前，遵守团队规则：不要读取或操作 git 待提交区（在自动化脚本中可通过 `git status --porcelain` 检查）。

## 参考文件

- `package.json` — 依赖与脚本定义。
- `src/index.ts` — 包导出边界。
- `src/service/workflow-nodes-service.ts` — 关键服务实现。
- `src/validators/` — 校验器集合。
- `vitest.config.ts`, `eslint.config.js`, `tsconfig.*` — 本包的运行/检查/编译配置。
