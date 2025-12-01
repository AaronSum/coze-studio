# foundation-sdk 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/foundation-sdk）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本包名称：`@coze-arch/foundation-sdk`，位于 monorepo 前端目录下：frontend/packages/arch/foundation-sdk。
- 角色：**基础能力 SDK 层**，在「基础设施 /架构层」与上层业务包之间提供统一的用户、空间（Space）、主题、登录状态等通用能力。
- 典型使用方：coze-studio 应用、workflow 组件、agent-ide 相关包、common/auth 等，会通过该 SDK 读取当前用户/空间信息或执行登录、登出等动作。
- 与其他包关系：
  - 相比 arch/bot-store，此包是**更推荐/统一的 SDK 出口**；其他旧包会在 README 或 JSDoc 中标记弃用并指向本包。
  - 作为 arch 层包，被各类 feature 包（workflow、agent-ide、data、common 等）以 workspace:* 方式依赖。

## 2. 目录结构与代码架构
- [src/index.ts](src/index.ts)
  - 对外主入口，聚合并导出本 SDK 所有公开 API（hooks、工具函数、类型 re-export 等）。
  - 设计目标是：**调用方只从 @coze-arch/foundation-sdk 导入，而不要直接依赖底层实现包**。
- [src/types.ts](src/types.ts) & [src/types](src/types)
  - 定义并组织本 SDK 相关的 TypeScript 类型，例如：
    - OAuth 相关：`OAuth2RedirectConfig`, `OAuth2StateType`。
    - 用户域：`UserInfo`, `UserConnectItem`, `LoginStatus`。
    - UI/主题：`ThemeType`, 导航按钮相关 `BackButtonProps`, `NavBtnProps` 等。
  - 下游包会通过从本 SDK 导入这些类型，而不是直接依赖更底层包。
- 配置文件：
  - [tsconfig.json](tsconfig.json)：仅开启 `composite` 并引用 build / misc tsconfig，适配 Rush + TypeScript 项级构建；源码实际编译配置在 tsconfig.build.json 中。
  - [eslint.config.js](eslint.config.js)：通过 `@coze-arch/eslint-config` 共享规则，preset `node`，保持整个 frontend 代码风格一致。
  - [vitest.config.ts](vitest.config.ts)：通过 `@coze-arch/vitest-config` 统一测试配置，preset `node`，dirname 由配置工具处理测试路径等细节。
- 文档：
  - [README.md](README.md)：列出公开 API 的类型/函数列表，是判断「哪些是正式对外 API」的主要依据。

> 结构设计要点：本包尽量保持“薄”的 façade 形式，只负责统一导出和少量 glue 逻辑，避免在此直接写大量复杂业务；复杂逻辑建议放在更明确职责的数据/业务包中。

## 3. 核心能力与数据流
> 具体实现细节主要由内部依赖/共享基础设施决定，这里按调用方向和数据流进行抽象说明。

- 用户与登录态
  - 典型 API：`getUserInfo`, `refreshUserInfo`, `getLoginStatus`, `getIsLogined`, `getIsSettled` 等。
  - 数据来源：通常从统一的用户信息服务或全局 store（可能由 foundation 级别的 state/请求层管理）获取。
  - 调用模式：
    - 读：组件在渲染时/交互前从 SDK 读取当前用户信息或登录状态，决定展示内容或是否跳转登录页。
    - 写：通过如 `refreshUserInfo`, `logoutOnly`, `uploadAvatar` 等触发后端接口及全局缓存更新。

- 主题与 UI 状态
  - 典型 API：`useCurrentTheme(): ThemeType`，以及与主题相关的辅助类型。
  - 流程：SDK 将底层的主题状态（例如来自全局 store 或 Context）封装为 hooks/工具函数，保证上层组件不直接耦合底层实现。

- 空间（Space）与上下文信息
  - 从整个仓库使用情况看，`useSpace` 与 `useUserInfo` 等 hook 会从本 SDK 导出，被 common/auth、workflow、agent-ide 等包消费。
  - 数据流：
    - SDK 负责从统一的 space store / context 获取当前空间标识、权限信息等；
    - 调用方（如 use-project-auth、workflow-edit 页面）只关心「当前用户/空间能否做某动作」，不关心具体存储与协议细节。

## 4. 构建、测试与本地开发流程

- 构建
  - 本包 `package.json` 中 `build` 脚本目前为 `exit 0`，真正构建通常由 monorepo 顶层/rsbuild 或统一脚本管理。
  - 在 frontend 根目录可以使用 Rush 相关命令进行构建，典型流程：
    - `rush build -t @coze-arch/foundation-sdk`：按 Rush 依赖图，构建本包及其依赖。

- Lint
  - 在本子包目录下：
    - `pnpm lint` 或通过 Rush：`rush lint -t @coze-arch/foundation-sdk`（具体命令以根目录 scripts 为准）。
  - 规则来源：`@coze-arch/eslint-config` preset=node，属于统一前端风格；避免私自引入与 monorepo 不兼容的 ESLint 规则。

- 测试
  - `pnpm test`：调用 `vitest --run --passWithNoTests`，无测试文件时不会失败，可用于 CI 快速校验。
  - `pnpm test:cov`：在上面基础上增加覆盖率统计（v8）。
  - Vitest 配置通过 [vitest.config.ts](vitest.config.ts) 的 `@coze-arch/vitest-config` 统一管理，通常无需在本包单独改动。

## 5. 包内约定与编码风格

- API 稳定性与导出策略
  - README 中列出的类型/函数视为「对外公开 API」，应尽量保持兼容；如需破坏性调整，应先增加废弃标记并提供迁移路径。
  - 当需要对外新增能力时，优先：
    - 在内部实现包中补充能力；
    - 再在本 SDK 的 `src/index.ts` 中以清晰命名导出；
    - 将新 API 补充到 README 的 API Reference 中。

- TypeScript 与模块组织
  - 使用 TypeScript 严格类型：对外 API 必须有明确类型（包括 Promise/返回值），并在 types.ts 中集中定义或 re-export。
  - 避免在调用方出现 `any`；如底层依赖类型不完整，应在本 SDK 中包装一层安全 API。

- React Hook / 工具函数
  - 统一命名约定：
    - 读取当前上下文信息的 hook 使用 `useXxx` 前缀，如 `useCurrentTheme`, `useUserInfo`, `useSpace`；
    - 纯函数工具使用动宾结构命名，如 `getLoginStatus`, `logoutOnly`。
  - Hook 不应在 SDK 内直接绑定具体 UI 组件，只暴露数据/行为；具体视图渲染应在上层包完成。

## 6. 与其他子包的协作与集成

- 与 frontend/apps/coze-studio
  - 在 [frontend/apps/coze-studio/package.json](../../apps/coze-studio/package.json) 中通过 `@coze-arch/foundation-sdk: workspace:*` 引入，用于全局用户、空间、主题状态等。
  - 在 [frontend/apps/coze-studio/rsbuild.config.ts](../../apps/coze-studio/rsbuild.config.ts) 中通过 alias 将 `@coze-arch/foundation-sdk` 与 `@coze-foundation/foundation-sdk` 对齐，保证打包路径统一。

- 与 common/auth
  - [frontend/packages/common/auth/src/space/use-space-role.ts](../../common/auth/src/space/use-space-role.ts) 与 [frontend/packages/common/auth/src/project/use-project-auth.ts](../../common/auth/src/project/use-project-auth.ts) 通过导入 `useSpace` 等能力判断当前用户在空间/项目内的权限。
  - 这些调用假设 foundation-sdk 能稳定提供：当前空间信息、用户权限/角色等，不关心底层实现。

- 与 workflow/components
  - [frontend/packages/workflow/components/src/workflow-edit/index.tsx](../../workflow/components/src/workflow-edit/index.tsx) 使用 `useUserInfo` 获取当前用户 locale 等信息，并在创建 workflow 请求中带上相关头部（参见其 copilot-instructions 中的说明）。
  - 任何对 user locale / profile 的读取或刷新，应优先通过本 SDK，而非自行调用底层接口。

- 与 arch/bot-store
  - [frontend/packages/arch/bot-store](../bot-store) 作为较早期的 store 抽象层，README 与 src/index.ts 中已提示部分 hooks 迁移到 foundation-sdk。
  - 在新增能力时，**优先在 foundation-sdk 中实现**，再根据需要选择是否在 bot-store 中透传导出（并标记为桥接/兼容层）。

## 7. 项目流程与协作规范

- 分支与提交
  - 遵循 monorepo 通用流程：在仓库根目录按团队规范创建 feature 分支，修改本包后通过 Rush 驱动依赖构建与测试。
  - 提交信息中建议明确指明影响范围，如 `feat(foundation-sdk): add useCurrentTheme hook`。

- 变更评审
  - 任何对外 API（README 中列出的类型/函数）变更，需在 MR/PR 描述中说明影响的下游包（如 common/auth、workflow/components、agent-ide/*）。
  - 如需调整接口返回结构，优先增加兼容字段或新增函数，避免直接改变现有签名。

- 部署与发布
  - 本包版本由 monorepo 统一管理（pnpm workspace + Rush），通常不会单独发布；
  - 新增/变更 API 后，需要在相关 app（如 coze-studio）中联调验证，确保 alias 配置与运行时行为一致。

## 8. 常见注意事项

- 避免直接访问底层 storage / localStorage
  - 有关空间/用户/主题状态的本地持久化，应通过统一抽象或更下层 data/foundation 包实现，再由本 SDK 封装暴露。
- 避免在 SDK 中写 UI 组件
  - 本包应保持 UI 无关，仅提供 hook 与工具；真正的 UI 放在 studio / agent-ide / components 等上层包。
- 新增能力时优先查阅其他包 copilot-instructions
  - 特别是 [frontend/packages/arch/bot-store/copilot-instructions.md](../bot-store/copilot-instructions.md) 和 [frontend/packages/workflow/components/copilot-instructions.md](../../workflow/components/copilot-instructions.md) 中关于 foundation-sdk 的使用说明，保持语义与行为一致。
