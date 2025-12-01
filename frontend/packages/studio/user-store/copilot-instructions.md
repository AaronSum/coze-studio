# copilot instructions for @coze-studio/user-store

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/user-store）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包是「用户 & 登录相关全局 store」的轻量封装层，对上暴露统一的 userStoreService，对下完全代理 @coze-arch/foundation-sdk 中的用户相关能力。
- 源码集中在 src/index.ts，仅导出类型 UserInfo、UserAuthInfo、UserLabel，并提供 userStoreService 对象（若增删字段需同步更新测试）。
- userStoreService 当前 API 列表：
  - getIsSettled, getIsLogined
  - getUserInfo, getUserAuthInfos
  - useIsSettled, useIsLogined, useUserInfo, useUserAuthInfo, useUserLabel
  - subscribeUserAuthInfos
- 用户认证与信息数据的真实来源与状态管理逻辑在 @coze-arch/foundation-sdk 内。本包只做 re-export + 聚合，不直接持久化或管理状态，保持调用方与底层 SDK 解耦。
- 类型定义来自 @coze-arch/idl/developer_api，需保证对外导出的类型与 IDL 保持一致性，避免出现分叉的用户模型。

## 关键开发流程（构建 / 测试 / Lint / Storybook）

- 依赖安装 & 初始化：在 monorepo 根目录通过 Rush 管理依赖：
  - 安装更新依赖：rush update
- 在本包目录（frontend/packages/studio/user-store）内常用脚本定义在 package.json：
  - 测试：npm test 或 npm run test
    - 使用 vitest，配置见 vitest.config.ts，基于 @coze-arch/vitest-config，preset 为 web。
  - 覆盖率：npm run test:cov
    - 等价于 npm run test -- --coverage，输出目录 coverage（由 config/rush-project.json 中 test:cov 配置标记）。
  - Lint：npm run lint
    - 使用 @coze-arch/eslint-config 统一规则，preset: web。
  - 构建：npm run build 当前是占位实现（exit 0），真正打包通常由上层构建体系处理；本包仅产出 TS 类型/运行时代码供其他包消费。
- Storybook：
  - .storybook/main.js 配置了基于 @storybook/react-vite 的 Storybook，默认 stories/ 目录有示例 hello.mdx。
  - 需要调试 UI 时，可参考其他包的 Storybook 启动命令（本包 README 中提到 npm run dev，但当前 package.json 未定义 dev，通常由根级 rushx 脚本或模板继承提供，使用前请在 monorepo 根查看 frontend/rushx-config.json 与相关文档）。
- 类型检查：
  - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，rootDir=src，outDir=dist，启用 strictNullChecks 与 noImplicitAny，保持严格类型约束。
  - config/rush-project.json 中定义了 ts-check 操作输出 dist 目录；在 CI 或 Rush pipeline 中可能会通过 rush build / rushx ts-check 触发。

## 项目结构与约定

- 核心目录：
  - src/index.ts：唯一的生产源码文件，集中导出 userStoreService 和相关类型，是修改行为的主要入口。
  - __tests__/index.test.ts：针对 userStoreService 的基础单测，主要校验导出 API 完整性与存在性，是新增/调整 API 时必须同步维护的契约。
  - stories/hello.mdx：Storybook 示例文件，本包目前不包含真实 UI 组件，仅保留模板。
  - config/rush-project.json：与 Rush 集成的包级别操作配置（test:cov、ts-check）。
  - tsconfig*.json：
    - tsconfig.build.json：用于编译的主 TS 配置，引用多个上游配置包（bot-typings、foundation-sdk、idl、eslint-config、stylelint-config、ts-config、vitest-config）。
    - tsconfig.json：仅做 project references 聚合，exclude **/*，主要被 Rush/TS 项目引用机制使用，不直接参与编译。
    - tsconfig.misc.json：用于杂项工具（未在本说明展开，按需查看）。
- 代码风格：
  - JavaScript/TypeScript Lint 由 @coze-arch/eslint-config 管理，配置文件 eslint.config.js 使用 defineConfig，preset = web，禁止在包内随意覆盖基础规则。
  - Style 相关（虽然本包暂无样式）：存在 .stylelintrc.js 且依赖 @coze-arch/stylelint-config；如未来引入样式文件，应遵循统一 stylelint 规范。
- 导出约定：
  - 所有对外暴露的 API 应通过 src/index.ts 统一导出，避免从底层 SDK 直接在业务侧 import，确保未来可在本包内做替换或兼容变更。
  - userStoreService 为只读对象（as const），避免在运行时被修改。

## 与外部依赖的集成细节

- @coze-arch/foundation-sdk：
  - 提供全部用户状态相关的函数与 React hooks，如 getUserInfo、useUserInfo 等，本包仅进行 re-export 与聚合。
  - 当需要新增用户相关能力（例如 useUserSettings）时，应优先在 foundation-sdk 中实现，再在本包中暴露统一入口，而不是直接在本包内实现状态逻辑。
- @coze-arch/idl：
  - developer_api 中定义 UserAuthInfo、UserLabel 及相关用户类型，是前后端共享模型来源。
  - 修改用户模型时，需要先更新 IDL，再由相关生成/实现流程同步到此包依赖，避免手写类型与协议不一致。
- 运行时 peerDependencies：
  - react / react-dom：>=18.2.0，本包的 hooks（间接来自 foundation-sdk）依赖 React 环境，需要在上层应用中提供。
  - zustand：^4.4.7 与 immer：^10.0.3：用于底层状态管理和不可变数据更新，但本包不直接使用，仅透传；版本由 peerDependencies + devDependencies 锚定，与上游保持一致。
  - axios、eventemitter3：作为 peerDependencies 存在，实际网络与事件逻辑在其他层实现，本包不直接耦合。

## 开发与扩展模式

- 新增用户相关 API 的推荐流程：
  - 在 @coze-arch/idl 中确认或新增对应用户数据结构（如新增标签、权限字段等）。
  - 在 @coze-arch/foundation-sdk 中实现获取/订阅/更新逻辑，并提供 getXxx / useXxx 等接口。
  - 在本包 src/index.ts 中导入并挂接到 userStoreService，同时通过 export type 暴露相关类型（如需）。
  - 更新 __tests__/index.test.ts 中的 API 列表断言，确保新增方法被测试覆盖。
- 兼容性变更注意事项：
  - 尽量保持原有 API 名称与行为不变；如需废弃接口，建议先保留旧名为别名，并在上游文档中标记弃用，再在大版本变更中移除。
  - 由于本包主要扮演“门面层”，大部分 breaking change 实际发生在 foundation-sdk 或 IDL 层面；修改前务必审查相关依赖包的使用范围。

## 测试与质量保障

- 单元测试：
  - 当前测试仅验证 userStoreService 的存在性与导出键集合，是本包的“公共契约快照”。
  - 如调整 userStoreService 的结构（新增、重命名、删除字段），必须同步修改 __tests__/index.test.ts，以避免误报测试失败或漏测。
- 覆盖率与 CI 集成：
  - config/rush-project.json 中声明 test:cov 的 coverage 目录，用于 Rush 或上层 CI 收集覆盖率；调整命令或输出目录时需一并更新该配置。

## 项目流程与协作规范

- 版本管理与发布：
  - 本包遵循 Rush + workspace:* 的依赖管理方式，由 monorepo 顶层统一控制版本发布节奏；package.json 中 version 字段和 workspace:* 由自动化工具管理，通常不在子包内手动修改。
- 分支与代码规范：
  - 遵循仓库统一的 Git 流程（请参考仓库根目录 README / 贡献文档）；在本包内提交改动时，确保通过 lint 与测试，避免引入 breaking change。
- 文档与说明：
  - 本包 README.md 仍保留模板信息（React 组件 + Storybook），与当前“store 门面”定位存在一定出入；在修改架构时，可同步更新 README 以避免混淆，但本说明以实际代码为准。

## 特殊与易踩坑点

- build 脚本为 no-op：
  - package.json 中 build: "exit 0"，说明当前包不负责独立构建产物，而是通过 TS 引用和上层构建工具消费源码；在添加编译输出需求前，需评估与 Rush 的集成方式。
- API 仅为透传：
  - 本包不应实现真实业务逻辑（如发请求、管理 token），这些逻辑属于 foundation-sdk 或更底层模块；在审查 PR 时，可快速检查是否有引入 axios 调用或复杂逻辑，通常应拒绝或迁移。
- 类型扩展顺序：
  - 修改用户相关类型时，应优先从 IDL 和 foundation-sdk 入手，而不是直接在本包中定义/修改接口；否则会导致前后端协议不一致或多处模型分叉。
