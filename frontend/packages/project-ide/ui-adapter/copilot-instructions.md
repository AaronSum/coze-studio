# @coze-project-ide/ui-adapter Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/ui-adapter）中安全、高效地协作开发。

## 全局架构与定位
- 本包是 Coze Studio/ProjectIDE 前端单体仓中的一个 UI 适配层，位于 frontend/packages/project-ide/ui-adapter，用于桥接 IDE 业务接口（@coze-project-ide/base-interface）与上层应用 UI。
- 技术栈：TypeScript + React 18，使用 Vitest 进行单测，ESLint 做静态检查，tsconfig 采用 monorepo 共享配置 (@coze-arch/ts-config)。
- 对外导出的能力包括：
  - 全局状态/上下文：IDEGlobalProvider、useIDEGlobalContext、useIDEGlobalStore；
  - 业务 Hook：useCommitVersion；
  - 业务 UI 组件：ModeTab、LeftContentButtons、SecondarySidebar、UIBuilder 等。
- 该包不包含路由或应用壳，主要作为 "可复用 UI+状态模块" 被其他应用包（如 @coze-project-ide/main、@coze-studio/app 等）引用。

## 目录结构概览
- src/index.ts：包的统一导出入口，集中 re-export hooks、context/store、组件，新增导出也应在此补充。
- src/global.d.ts：本包级别的全局类型声明文件（如扩展 Window、JSX 元素等），修改需注意不污染全局命名空间。
- src/hooks/
  - src/hooks/index.ts：集中导出所有 Hook。
  - src/hooks/use-commit-version.ts：提交版本相关的业务 Hook，封装 ProjectIDE 版本/发布相关交互逻辑（依赖 @coze-project-ide/base-interface 暴露的接口或类型）。
- src/components/
  - src/components/index.ts：集中导出所有组件。
  - src/components/mode-tab/：模式切换 Tab 组件（如在 IDE 中切换不同工作模式/视图）。
  - src/components/left-content-buttons/：左侧内容区按钮区域，通常承载常用操作入口。
  - src/components/secondary-sidebar/：次级侧边栏组件，承载上下文相关工具/面板。
  - src/components/ui-builder/：通用 UI 构建器/容器，用于根据配置/Schema 渲染特定布局或控件。

> 若需要确认具体 props/行为，请直接打开对应目录下的实现文件（通常为 *.tsx + 样式文件）。

## 构建、测试与调试流程
- 构建：
  - 本包 package.json 中的 build 为占位实现（"build": "exit 0"），实际产物通常由上层 Rush/RSBuild 工具统一构建，不建议在此包中单独实现复杂构建逻辑。
- 测试：
  - 在仓库根目录：
    - 使用 Rush：rushx test --to @coze-project-ide/ui-adapter（实际命令依赖根级 rushx 配置，可参考 frontend/README.md 或 rushx-config）。
  - 在本包目录下：
    - 使用 pnpm/npm：pnpm test 或 npm test（执行 vitest --run --passWithNoTests）。
  - 覆盖率：pnpm test:cov / npm run test:cov，将通过 @vitest/coverage-v8 生成覆盖率报告。
- Lint：
  - 在本包目录下执行：pnpm lint 或 npm run lint，对应 eslint ./ --cache，配置继承 @coze-arch/eslint-config。
- 调试建议：
  - 推荐通过引用此包的上层应用（例如 frontend/apps/coze-studio）进行端到端调试；对单一组件/Hook，可在本包中使用 Vitest + React Testing Library（若已在 monorepo 内统一配置）做单元测试。

## 类型与接口集成
- 上游依赖：@coze-project-ide/base-interface
  - 所有与 ProjectIDE 领域模型、接口返回值或事件总线相关的类型应尽量引用 base-interface 中已定义的类型，而不是在本包重新定义。
  - 若需要新增/变更接口，请先在 base-interface 中扩展，再在本包进行适配。
- React 与 TS：
  - React 版本固定为 ~18.2.0，添加新组件时请使用函数式组件 + Hooks 方案，不引入类组件。
  - 类型严格性依赖根级 tsconfig 与本包 tsconfig.build.json/tsconfig.misc.json；新增文件时应遵循已有文件的 tsconfig 约束（例如禁止 any、启用 strictNullChecks 等，以当前配置为准）。
- 全局声明：
  - 对 global.d.ts 的修改会影响所有导入本包的下游项目；新增全局类型前，应确认确实需要全局可见，而非局部/模块内声明即可。

## UI 组件与状态管理模式
- 组件导出规范：
  - 所有可复用组件需要在 src/components/index.ts 中显式导出，再由 src/index.ts 统一 re-export，确保消费方只需从包根导入。
  - 组件命名一般采用大驼峰（ModeTab、UIBuilder），目录名使用 kebab-case 与组件名对应（mode-tab、ui-builder）。
- 全局状态与 Provider：
  - IDEGlobalProvider 提供 ProjectIDE 相关的核心上下文（当前工程、选中节点、调试状态等，具体以实现为准）。
  - useIDEGlobalContext/useIDEGlobalStore 是访问/操作上述上下文的推荐入口，避免直接从第三方状态库实例读取。
  - 新增全局状态字段时，优先改造 Provider/Store 层，在 Hook 或组件中通过自定义 Hook 访问，避免在任意组件中散落直接操作。
- 组合与适配：
  - 本包不直接关心底层请求实现，而是通过上游 service/adapter 提供的接口或 props 回调进行交互；组件/Hook 主要负责：
    - 将领域对象转换为 UI 可渲染结构；
    - 管理交互状态（选中、折叠、切换 tab、执行命令等）；
    - 将用户操作通过回调/事件抛给上游。

## 开发规范与约定
- 代码风格：
  - 使用 monorepo 统一 ESLint 规则（@coze-arch/eslint-config），提交前应确保通过 lint。
  - 禁止在本包中引入与全局风格冲突的 ESLint/TS 配置；如需例外规则，请在本地 eslint.config.js 中以最小粒度覆盖。
- 依赖管理：
  - 核心运行时依赖仅限 React 与 workspace:* 内部包；如需引入新三方库，必须确认是否已在 monorepo 标准库中使用，避免体积与维护成本过高。
  - 避免在本包中直接访问浏览器存储、全局单例等，优先通过上游 adapter 或共享工具包（例如 foundation/*、common/* 等）实现。
- 文件组织：
  - 一个组件目录建议包含：index.tsx（或同名组件文件）、类型定义（types.ts）、样式文件；公共逻辑可抽到 hooks 或 utils 中。
  - 若组件/Hook 与其他 ProjectIDE 子包存在强耦合，请在 README 或注释中说明依赖关系，避免误用。

## 与仓库其他部分的集成
- Rush/monorepo：
  - 本包通过 rush.json 注册，依赖关系由 workspace:* 管理；新增依赖后需在仓库根执行 rush update，避免锁文件不一致。
  - 变更此包 API（导出组件、Hook 的签名）时，需要同步检查使用方包（例如 @coze-project-ide/main、@coze-studio/workspace-*、@coze-agent-ide/* 等）是否需要调整。
- 测试/配置共享：
  - vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig，并设置 preset: 'node'；如需在浏览器环境测试组件，请遵循 monorepo 约定调整 preset 或在上游应用中做集成测试。
  - tsconfig.json 仅作为 references 聚合入口，实际编译选项在 tsconfig.build.json/tsconfig.misc.json 中定义；新增配置时应保证不会破坏其他包的增量构建。

## 分支、提交与发布（从整体仓库继承）
- 分支策略：
  - 本包遵循 monorepo 统一分支策略（通常为主分支 + 功能分支）。在本包修改通常通过创建 feature 分支，提交后合并到主分支；具体命名约定可参考仓库根级 CONTRIBUTING 或内部开发规范。
- 提交与代码评审：
  - 建议在修改时保持变更原子化：UI 结构变更、状态管理调整、接口签名调整尽量拆分提交，方便 Code Review。
  - 若改动影响跨包接口（例如 base-interface），请在提交说明中显式指出影响面，并更新相关 README 或类型定义注释。
- 发布：
  - 包版本与发布由 monorepo 工具链统一管理（rush + 构建/发布流水线）。请勿在本包中手动修改 version 用于发布，以免与自动流程冲突。

## 特殊/易踩坑点
- build 脚本为占位实现：本包不会单独产出构建产物，任何与打包相关的问题应先确认是否由上游应用或构建系统配置引起。
- 全局类型污染风险：修改 global.d.ts 时务必审慎，避免给所有消费方引入不兼容的类型变更。
- 上游接口耦合：许多 UI 行为依赖 @coze-project-ide/base-interface；在不知道其约束前不要随意调整数据结构或字段名，否则容易在运行时导致不可见的集成问题。

## 面向 AI 助手的具体操作建议
- 在本包中新建组件/Hook 时：
  - 首先查看 src/components/index.ts 或 src/hooks/index.ts，遵循现有导出模式与目录命名；
  - 如果涉及 ProjectIDE 业务对象，优先在 @coze-project-ide/base-interface 中查找或补充类型定义；
  - 为易复用的 UI 或逻辑添加最小但可运行的 Vitest 单元测试（若当前目录已有测试样例可参考）。
- 修改现有导出时：
  - 确保 src/index.ts、子目录 index.ts 的导出保持一致；
  - 在 monorepo 内搜索导出符号的使用位置，避免破坏下游包；
  - 如需删除导出，应先为下游包提供替代实现，并在变更说明中注明。
