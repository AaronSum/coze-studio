# @coze-common/auth-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/auth-adapter）中安全、高效地协作开发。

## 1. 全局架构与角色

- 本包是 Coze Studio 前端 monorepo 中的一个「权限适配层」子包，主要目录结构：
  - src/index.ts：包入口，仅负责导出 Hook。
  - src/space/use-init-space-role.ts：空间维度权限初始化 Hook。
  - src/project/use-init-project-role.ts：项目维度权限初始化 Hook。
  - __tests__/**：对应 Hook 的单元测试。
  - config/rushx-config.json：与 monorepo 工具链集成的配置。
- 本包自身不持久化任何权限数据，也不直接发起网络请求，而是作为 React Hook 封装层，与下游权限 Store 解耦：
  - 通过 @coze-common/auth 提供的 useSpaceAuthStore、useProjectAuthStore 读写权限状态。
  - 通过 @coze-arch/idl 暴露的枚举类型（如 SpaceRoleType）保证与后端 IDL 一致。
- 状态管理使用 zustand，并统一通过 useShallow 进行 selector 优化，避免不必要的组件重渲染。
- 当前开源版本不实现真正的权限鉴权逻辑，而是**将空间/项目角色硬编码为 Owner**，并立即标记为 ready：
  - 这样可以保证上层 UI「认为权限已就绪且具备最高权限」，不用改动业务代码就能在开源版本运行。
  - 未来如果接入真实权限系统，只需要在本包内部替换初始化逻辑即可，其他包通过公共 Hook 接口保持不变。

## 2. 核心 Hook 行为与数据流

### 2.1 useInitSpaceRole

- 位置：src/space/use-init-space-role.ts
- 依赖：
  - react：useEffect
  - zustand/react/shallow：useShallow
  - @coze-arch/idl/developer_api：SpaceRoleType
  - @coze-common/auth：useSpaceAuthStore
- 行为：
  - 通过 useSpaceAuthStore + useShallow 取得 setIsReady、setRoles、isReady（从 isReady[spaceId] 取布尔值）。
  - 在 useEffect 中：
    - setRoles(spaceId, [SpaceRoleType.Owner])
    - setIsReady(spaceId, true)
  - 返回值：当前 spaceId 对应的 isReady（布尔），用于上层判断「权限是否初始化完成」。
- 依赖项：useEffect 依赖数组为 [spaceId]，意味着：
  - spaceId 变化时会重新执行初始化逻辑；
  - 这在路由切换空间时可以自动更新权限状态。

### 2.2 useInitProjectRole

- 位置：src/project/use-init-project-role.ts
- 依赖：
  - react：useEffect
  - zustand/react/shallow：useShallow
  - @coze-common/auth：useProjectAuthStore, ProjectRoleType
- 行为：
  - 通过 useProjectAuthStore + useShallow 取得 setIsReady、setRoles、isReady（从 isReady[projectId] 取布尔值）。
  - 在 useEffect 中：
    - setRoles(projectId, [ProjectRoleType.Owner])
    - setIsReady(projectId, true)
  - 返回值：当前 projectId 对应的 isReady（布尔）。
- 依赖项：useEffect 依赖数组为 [projectId]：
  - spaceId 对本 Hook 逻辑暂不重要，仅用于与上层 API 对齐；
  - 切换 projectId 时会重新初始化对应项目权限。

### 2.3 包入口导出

- 位置：src/index.ts
- 导出内容：
  - useInitSpaceRole
  - useInitProjectRole
- 约定：
  - 外部调用方仅依赖这些公共 Hook，不直接 import 具体实现路径，以便未来内部重构。

## 3. 测试与开发工作流

### 3.1 本包 scripts

- 定义见 package.json：
  - build："exit 0"（当前无实际构建过程，避免阻塞流水线）。
  - lint："eslint ./ --cache"。
  - test："vitest --run --passWithNoTests"。
  - test:cov："npm run test -- --coverage"。
- 在 monorepo 顶层通常通过 rushx 调用：
  - rushx test -p @coze-common/auth-adapter
  - rushx lint -p @coze-common/auth-adapter
  - 单包本地调试时，也可以在子包目录使用 pnpm / npm 直接执行对应 script（取决于仓库统一用法）。

### 3.2 Vitest 配置

- 位置：vitest.config.ts
- 使用 @coze-arch/vitest-config 封装：
  - defineConfig({ dirname: __dirname, preset: 'web' })
  - 测试环境按 Web/React 预设进行（含 jsdom 等），不需要在本包重复配置。

### 3.3 单元测试结构与约定

- 目录：__tests__/space/use-init-space-role.test.ts
  - 使用 @testing-library/react-hooks 渲染 Hook。
  - 通过 vi.mock(' @coze-common/auth') 注入 useSpaceAuthStore 的伪实现，将 store 的 setIsReady、setRoles、isReady 全部注入。
  - 验证：
    - setRoles(spaceId, [SpaceRoleType.Owner]) 被调用；
    - setIsReady(spaceId, true) 被调用；
    - Hook 返回值等于 isReady[spaceId]。
  - 覆盖多个 spaceId 的场景，通过 rerender 改变传入的 id。
- 目录：__tests__/project/use-init-project-role.test.ts
  - 类似地 mock useProjectAuthStore 与 ProjectRoleType。
  - 验证多 projectId 切换时，对应项目的 setRoles/setIsReady 均被正确调用。
- AI 在新增 Hook 或调整逻辑时，应**同步补齐或更新对应测试文件**，保持上述 mock + renderHook + rerender 的测试模式。

## 4. 代码风格与项目约定

- 语言与框架：
  - TypeScript + React 18。
  - 使用函数式组件生态与自定义 Hook，避免在本包中引入 class 组件。
- 状态管理：
  - 统一通过 @coze-common/auth 提供的 zustand Store 进行权限状态读写，本包**不直接创建新的 zustand store**。
  - 使用 useShallow 包裹 selector，以减少不必要的订阅更新。
- 权限语义：
  - 当前版本统一设置为 Owner 角色，且立即 ready；这是**开源版本的特定行为**。
  - 如果未来引入更细粒度权限或从后端拉取角色，应在本包内部 Hook 中完成，而不修改上游业务代码对 Hook 的使用方式。
- 依赖管理：
  - 所有 workspace 内依赖（如 @coze-common/auth, @coze-arch/idl）通过 workspace:* 版本号管理，遵循 monorepo 统一策略。
- Lint：
  - ESLint 配置在 eslint.config.js，通过 @coze-arch/eslint-config 的 preset: 'node'。
  - 请保持与现有语法风格一致（import 顺序、分号、箭头函数等由共享配置控制）。

## 5. 与外部包的集成关系

- @coze-common/auth：
  - 提供 useSpaceAuthStore、useProjectAuthStore 以及 ProjectRoleType 等枚举/方法。
  - 本包仅通过它进行权限状态读写，**不直接访问任何后端 API**。
- @coze-arch/idl：
  - developer_api 中的 SpaceRoleType 来自 IDL 生成代码，与服务端接口类型对齐。
  - 本包只使用其枚举值，不新增自定义字符串常量，以免与其他模块不一致。
- React 组件层：
  - 典型使用方式（示意）：
    - 在某个空间/项目级别的页面容器组件中调用 useInitSpaceRole / useInitProjectRole。
    - 根据返回的 isReady 决定是否渲染子树或展示 Loading。
  - AI 在新增 Hook 时，应保持「只负责初始化 + 返回 ready 状态」这一职责边界，避免在 Hook 内直接渲染 UI。

## 6. 流程与协作规范（本子包范围）

- 分支与提交：
  - 遵循仓库统一策略（参考仓库根目录文档），本文件不重复定义；在本子包内开发时：
    - 尽量保持改动局部化，只修改与权限初始化逻辑相关的文件。
    - 新增导出需同步更新 README.md 中的 API Reference。
- 开发顺序建议：
  1. 在 src/** 中新增或修改 Hook，实现所需的权限初始化逻辑。
  2. 在 __tests__/** 中为新逻辑编写或更新对应单测，采用已有 mock + renderHook 模式。
  3. 运行 lint 与 test，确保通过：
     - rushx lint -p @coze-common/auth-adapter
     - rushx test -p @coze-common/auth-adapter
  4. 如有对外 API 变更，更新 README.md 的 Usage / API Reference。

## 7. 非常规 / 需要特别注意的点

- 权限逻辑「被刻意简化」：
  - 文件顶部注释已说明：开源版本暂不提供真实权限控制，仅导出若干预留接口。
  - 因此不要在其他模块假设这里已经包含完整的权限校验逻辑，本包只保证「初始化 + Owner 角色 + ready」。
- Hook 的依赖数组设计：
  - useInitSpaceRole 仅依赖 spaceId；useInitProjectRole 仅依赖 projectId；
  - 如果后续增加对其他参数的依赖（如用户信息），必须谨慎更新依赖数组，以免造成重复初始化或漏初始化。
- 构建脚本目前是 no-op：
  - build 脚本为 "exit 0"，说明打包由上层统一构建流程处理，本包不单独产出构建产物。
  - AI 不要在本子包中单独引入复杂的打包逻辑，除非同步更新整个 monorepo 的构建策略。
- 测试中对外部模块的 vi.mock：
  - 测试对 @coze-common/auth 的 mock 是**精确到使用的函数和枚举**，新增使用时需要同步更新 mock，否则测试会失败。

在修改或扩展本包时，请优先保持现有抽象边界：本包负责「将权限 Store 初始化为某种默认视图」，不承担 UI、路由或网络层职责。