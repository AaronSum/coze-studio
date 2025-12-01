# @coze-foundation/space-store Copilot 使用说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/space-store）中安全、高效地协作开发。

## 总体架构与角色定位

- 本包是 Coze Studio 前端单仓中的「基础设施层」子包之一，主要职责是**空间（space）相关状态访问与聚合**，而非直接持久化或业务渲染。
- 代码体量较小，主要承担三类职责：
  - 对上：通过若干 React Hooks (`useSpaceStore`、`useSpace*` 系列、`useSpaceApp`) 为应用层提供空间/应用相关数据访问接口。
  - 对下：依赖 `@coze-foundation/space-store-adapter`、`@coze-foundation/enterprise-store-adapter` 等适配器包，将统一的「空间 store 协议」接入到不同运行环境或实现方案中。
  - 侧向依赖：通过 `@coze-arch/bot-*`、`@coze-arch/logger`、`@coze-arch/report-events` 等 arch 层包，复用统一的 Bot 协议、错误封装、埋点与日志能力。
- 入口文件为 [src/index.ts](src/index.ts)：
  - 直接 re-export 适配器包导出的 `useSpaceStore`。
  - 从 [src/space/hooks.ts](src/space/hooks.ts) 暴露 `useSpace`、`useSpaceList`、`useRefreshSpaces`。
  - 从 [src/hooks/use-space-app.ts](src/hooks/use-space-app.ts) 暴露 `useSpaceApp`。
- **架构原则：** 本包更偏向「Facade/门面+适配器」角色，将复杂实现留在 adapter 与上游 arch 包中；在本包内实现/维护与空间相关的轻量 UI/业务无关逻辑和组合 Hook，使上层页面/应用逻辑简单可测。

## 目录结构与关键文件

- [src/index.ts](src/index.ts)
  - 唯一公开入口，明确本包的对外 API 面。
  - 如需新增导出 Hook/工具函数，一般应在此统一 re-export，并确保命名遵循现有前缀（`useSpace*`）。
- [src/space/](src/space)
  - [hooks.ts](src/space/hooks.ts)：封装空间实体相关的核心 Hook：
    - `useSpace`：根据当前上下文或入参获取单个 space。
    - `useSpaceList`：获取空间列表，并与全局 store 保持同步。
    - `useRefreshSpaces`：触发刷新空间列表或强制同步的操作。
  - 内部通常会基于 `zustand` store（由 space-store-adapter 提供）以及 `immer` 做不可变数据更新，但具体实现位于 adapter/下游包，本子包只组合调用。
- [src/hooks/](src/hooks)
  - [use-space-app.ts](src/hooks/use-space-app.ts)：
    - 封装「空间 + 应用」组合场景，例如在某个空间中查找当前应用、或根据路由/上下文解析当前 app。
    - 常见依赖：`react-router-dom`（从路由参数/查询串中解析 spaceId/appId）、`@coze-foundation/space-store-adapter` 的基础 store API。
- [setup-vitest.ts](setup-vitest.ts)
  - Vitest 全局测试环境初始化，例如：
    - 引入 `@testing-library/jest-dom` 匹配器。
    - 设置全局 mock 或 polyfill（如必要）。
- [vitest.config.ts](vitest.config.ts)
  - 使用 `@coze-arch/vitest-config` 的统一预设：
    - `preset: 'web'`，默认浏览器环境。
    - `coverage.all: true` 且 `exclude: ['src/index.ts']`，鼓励对子模块逻辑做覆盖率测试。
    - `setupFiles: ['./setup-vitest.ts']` 注入测试前置逻辑。
- [tsconfig.build.json](tsconfig.build.json)
  - 基于 `@coze-arch/ts-config/tsconfig.web.json`：统一前端编译规范。
  - `rootDir: ./src`，`outDir: ./dist`，请保证源码皆位于 `src` 下。
  - `strictNullChecks`, `noImplicitAny` 开启，默认要求类型较严格。
  - references 指向多枚 arch/config 级 tsconfig，确保依赖包先行编译。
- [eslint.config.js](eslint.config.js)
  - 通过 `@coze-arch/eslint-config` 复用 monorepo 的 lint 规则，`preset: 'web'`。
- [README.md](README.md)
  - 简要说明导出的 Hook 名称与使用方式。修改/新增功能时建议同步更新。

## 开发与运行工作流

> 注意：本包 `package.json` 中 `build` 脚本当前为 `exit 0`，实际构建通常由上层 Rush/tsc 编译 pipeline 统一触发。

- 本地依赖安装与整体更新（在 monorepo 根目录执行）：
  - `rush update`：安装/更新全部前端依赖。
- 针对此子包的常用脚本（在本包目录下执行）：
  - `npm test` 或 `pnpm test`：
    - 等价于 `vitest --run --passWithNoTests`。
    - 单文件调试可用 `vitest path/to/test.spec.ts` 按需执行（依赖全局 vitest 或通过 `npx vitest`）。
  - `npm run test:cov`：
    - 在 `test` 基础上开启覆盖率收集，配置位于 [vitest.config.ts](vitest.config.ts)。
  - `npm run lint`：
    - 使用 monorepo 统一 ESLint 预设；如需新增规则，应在对应 arch/config 包中统一配置，而非在此处直接增删全局规则。
- 构建/打包：
  - 单包 `npm run build` 目前为 no-op，由 rush/tsc 统一编译。
  - 当需要验证类型/编译是否通过时，可在 monorepo 根执行统一构建（例如 `rush build -t @coze-foundation/space-store`，具体命令参见根仓 README 或 rush 配置）。

## 项目内的约定与模式

- **Hook 命名约定**
  - 与空间实体直接相关的 Hook 使用 `useSpace*` 前缀，例如：`useSpace`、`useSpaceList`、`useSpaceApp`、`useRefreshSpaces`。
  - 若新增 Hook 属于 workspace/space 领域，请延续该前缀以便调用方快速识别领域含义。
- **Store/Adapter 分层约定**
  - 与实际数据源交互（网络请求、缓存策略、底层状态容器）的逻辑应放在 `@coze-foundation/space-store-adapter` 或其他 adapter 包中。
  - 本包只负责：
    - 组合调用 adapter 暴露的 API。
    - 按需封装成适合页面/组件调用的 Hook。
  - 当你需要接入新的空间数据来源或运行环境变化时，应优先在 adapter 层扩展，不在本包内写与环境耦合的逻辑。
- **类型与安全性**
  - `tsconfig.build.json` 开启了 `strictNullChecks` 与 `noImplicitAny`，编写 Hook 与辅助函数时需显式处理 `null/undefined` 和边界条件。
  - 空间/应用 ID、名称、状态等类型建议从 `@coze-arch/bot-typings` 或相关 arch 包中复用，避免在本包内复制类型定义。
- **测试模式**
  - 测试文件放在 [__tests__](__tests__) 或各源码目录下的 `__tests__` 子目录中，如：
    - [src/hooks/__tests__](src/hooks/__tests__)
    - [src/space/__tests__](src/space/__tests__)
  - 使用 Vitest 搭配 `@testing-library/react`/`@testing-library/react-hooks`：
    - 针对 Hook：通过自定义 render 函数注入必要的 Provider/Router/mock store。
    - 针对与路由相关的逻辑：依赖 `react-router-dom` 的 `MemoryRouter` 等进行单元验证。
- **样式与 UI**
  - 本包主要职责是数据与逻辑，通常不直接输出 UI 组件，样式相关依赖仅通过下游消费；如必须增加 UI 相关逻辑，建议保持「无样式/只逻辑」或极少量 className 拼接（使用 `classnames`）。

## 重要依赖与集成细节

- `@coze-foundation/space-store-adapter`
  - 提供底层空间 store 的创建与访问 API，例如创建 `zustand` store、定义空间实体状态结构等。
  - 在本包中使用场景：通过导出的 `useSpaceStore`、或在 `space/hooks.ts` 中基于其 store selector 定义更细粒度 Hook。
- `@coze-foundation/enterprise-store-adapter`
  - 用于与企业级 store 或跨应用共享状态对接，空间 store 可能作为其子模块存在。
  - 修改 enterprise 相关逻辑时，先确认 owner 包中的接口约定，避免在本包内直接操作全局 enterprise store。
- `zustand`
  - 虽然在本包中通常不会直接 `create` store，但 selector/状态 shape 设计应与 adapter 保持一致。
  - 若在 Hook 中使用 selector，请保证其为**纯函数**并尽量稳定（避免闭包中引用易变对象）。
- `immer`
  - adapter/store 层通常使用 `immer` 做不可变更新，本包如果需要基于 store 状态做复杂衍生计算，尽量保持只读操作，不在此层进行 `produce` 写操作。
- `react-router-dom`
  - `useSpaceApp` 以及其他需要感知路由上下文的 Hook 会用到：
    - 例如 `useParams`、`useLocation` 解析 spaceId/appId。
  - 编写或修改此类 Hook 时，应保证：
    - 不直接依赖具体路径字符串常量（优先通过上层配置/常量导入）。
    - 在测试中 stub 路由参数，避免对真实浏览器环境产生依赖。
- `@coze-arch/logger` / `@coze-arch/report-events`
  - 用于记录错误或上报关键操作事件，如空间切换、刷新失败等。
  - 约定：
    - 错误信息应包含 spaceId/appId 等关键上下文字段。
    - 事件命名遵循 arch 层已有枚举/常量，避免在本包硬编码新 event name。

## 协作流程与代码规范

- 分支与提交（遵循 monorepo 统一规范，以下为在本包中需特别注意的点）：
  - 功能开发建议以包为粒度拆分变更；如果改动同时涉及 adapter/arch 层，建议在 MR/commit 描述中清晰标注影响范围。
  - 修改 `tsconfig.build.json` 或引用路径时，注意该改动可能影响多包的增量构建与 `rush build` 结果。
- 代码风格：
  - 遵循 `@coze-arch/eslint-config` 与 `@coze-arch/stylelint-config`，不要在本包内单独新增 Prettier/Eslint 配置文件。
  - Hook 内应尽量保持**单一职责**，例如：
    - `useSpaceApp` 聚焦于组合空间与应用上下文，不在其中加入网络请求或副作用-heavy 的逻辑。
  - 需要添加新公共 API 时：
    - 在 [src/index.ts](src/index.ts) 中集中导出。
    - 在 [README.md](README.md) 的 API Reference 区域补充说明。

## 特殊注意事项与坑点

- `build` 脚本为 no-op：
  - 在仅执行 `npm run build` 的环境下，本包不会输出 dist 目录；依赖于 monorepo 统一构建流程的环境（CI、本地 `rush build`）才能生成构建产物。
- 覆盖率配置：
  - `coverage.all: true` 且排除了 `src/index.ts`，这意味着：
    - 任意新建的逻辑文件（非纯 re-export）会立刻计入覆盖率统计。
    - 若 CI 对 coverage 有要求，请为新增 Hook/工具函数编写对应测试。
- `tsconfig.json` 顶层 `exclude: ['**/*']`：
  - 这是为了仅通过 `tsconfig.build.json` 与 `tsconfig.misc.json` 控制具体编译/校验范围。
  - 在编辑器中若发现类型检查范围异常，请确认 IDE 使用的是哪份 tsconfig。
- 依赖版本约束：
  - `immer@^10.0.3` 是脚本自动补齐的依赖（见 package.json 注释），请勿手动删除或改动版本号，以免影响自动化脚本。

## 面向 AI 编程助手的具体建议

- 在修改/新增 Hook 时，优先查阅：
  - 依赖的 adapter 包（`@coze-foundation/space-store-adapter`、`@coze-foundation/enterprise-store-adapter`）的 API 与类型定义。
  - 相关 arch 层包的 typings（`@coze-arch/bot-typings` 等）。
- 为调用方编写示例或文档时：
  - 更新 [README.md](README.md) 中的 `Usage` 与 `API Reference`。
  - 说明该 Hook 依赖何种上游上下文（如 Router、Provider 或全局 store 初始化）。
- 避免在本包中引入：
  - 与具体产品形态强耦合的文案/路由常量。
  - 直接操作浏览器全局（如 `window`, `localStorage`）；如确有需要，考虑下沉到 adapter 层并通过抽象接口调用。
