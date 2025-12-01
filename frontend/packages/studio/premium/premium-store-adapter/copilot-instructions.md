# @coze-studio/premium-store-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/premium/premium-store-adapter）中安全、高效地协作开发。

## 1. 全局架构与角色定位

- 包角色：作为「Premium 订阅能力」的 store 适配层，对外暴露统一的 Premium 相关 hook、store 与类型，内部主要基于 `zustand` 和工作区的 IDL/后端 API。
- 入口文件：`src/index.ts` 仅做导出聚合：
  - `usePremiumStore`、`PremiumPlanLevel`、`PremiumChannel`：来自 `src/stores/premium.ts`，是 Premium 的核心状态与枚举定义。
  - `useBenefitBasic`：来自 `src/hooks/use-benefit-basic`（不在当前片段中展示），用于抽取用户基础权益的简单判定逻辑。
  - `usePremiumType`：来自 `src/hooks/use-premium-type.ts`，目前为占位实现，返回静态默认值，后续会扩展为基于 store/接口的 Premium 类型推导。
  - `usePremiumQuota`：来自 `src/hooks/use-premium-quota.ts`，目前为占位实现，返回静态配额数据结构。
  - `formatPremiumType`：来自 `src/utils/premium-type.ts`，用于格式化 Premium 类型显示文案或结构。
  - 类型导出：`UserLevel` 来自 `@coze-arch/idl/benefit`，`PremiumPlan`、`PremiumSubs`、`MemberVersionRights` 来自本包 `src/types`，保证调用方只依赖本包即可获取所有 Premium 相关类型。
- 业务边界：
  - 不直接处理复杂 UI 或路由跳转，只聚焦在 Premium 订阅数据的存储、基础派生与类型对齐。
  - 具体 UI（如付费弹窗、升级提示）由上层 `premium-components-adapter` 或其他 Studio 包实现，本包仅提供状态与行为接口。
  - 对外 API 形态以 Hook 与 `zustand` store 为主，保持无框架耦合（除了 React hooks 依赖）。

## 2. 源码结构与数据流

- 目录结构要点：
  - `src/index.ts`：公共导出入口，仅做 re-export，不写业务逻辑。
  - `src/stores/premium.ts`：
    - 使用 `zustand` + `devtools` 创建 `usePremiumStore`。
    - 定义 `PremiumPlanLevel`（目前只区分 `Free` 与 `PremiumPlus`）与 `PremiumChannel`（Coze/Telegram/Discord）枚举。
    - `PremiumStoreState` 聚合 Premium 相关的核心状态：
      - `polling`：是否启用自动轮询订阅数据（供左侧菜单、Bot 详情等场景使用）。
      - `plans`、`subs`、`currentPlan`、`hasTrial`：订阅套餐与当前订阅信息。
      - `connections`：第三方账号绑定信息（如 Telegram / Discord）。
      - `benefit`：`SubscriptionDetailV2` 用户权益数据，默认 `user_level` 为 `UserLevel.Free`。
      - `plansCN`：国内（中国区）订阅套餐列表，类型为 `MemberVersionRights[]`。
      - `volcanoInfo`：与火山/VeCD 等三方授权相关的信息（`authInstanceId`、`authUserId` 等）。
    - `PremiumStoreAction` 定义与后端交互/本地变更相关的操作，包括：
      - `reset`、`setPolling`、`setPremiumPlansCN`、`setUserBenefit`、`setVolcanoInfo`。
      - 订阅生命周期相关：`fetchPremiumPlans`、`fetchPremiumPlan`、`renewCurrentPlan`、`cancelCurrentPlan`。
      - 绑定信息相关：`fetchConnections`、`disconnectUser`。
    - 当前实现中，大部分 Action 为占位：
      - `reset` / `setPolling` / `renewCurrentPlan` / `cancelCurrentPlan` / `fetchConnections` / `disconnectUser` / `setUserBenefit` / `setVolcanoInfo` 仅打印 `console.log('unImplement ...')`。
      - `fetchPremiumPlans` 与 `fetchPremiumPlan` 使用 `get()` 返回现有 state 并 `await 0` 占位异步流程，便于未来平滑对接真实 API。
    - `defaultState` 提供了完整的初始状态，确保在未接入后端时调用方行为稳定。
  - `src/hooks/use-premium-type.ts`：
    - 目前作为“只读派生占位 Hook”，返回：
      - `isFree`、`isPremiumPlus`、`hasLowLevelActive`、`hasHighLevelActive` 四个布尔标记。
      - `sub`、`activeSub` 两个 `SubscriptionDetail` 对象。
    - 真实实现中，预期会基于 `usePremiumStore` 的数据与 `UserLevel`/订阅信息进行计算；在接入前请勿直接在调用方依赖这些字段的业务含义，只能依赖其结构存在。
  - `src/hooks/use-premium-quota.ts`：
    - 提供一个统一的配额数据结构：`remain`、`total`、`used` 以及 `extraRemain`、`extraTotal`、`extraUsed`（加购部分）。
    - 当前为静态 0 值，占位用；未来接入后端时应沿用这一字段结构，避免破坏调用方。
  - `src/hooks/use-benefit-basic.ts` / `src/utils/premium-type.ts` / `src/types/index.ts` 等文件虽未在当前片段展示，但从导出可以推断：
    - `useBenefitBasic` 抽取用户权益的常用判定（如判断是否有 Premium 权限）。
    - `formatPremiumType` 负责将 Premium 类型/等级映射到 UI 友好的展示形式（文案或结构）。
    - `types` 封装了与 `@coze-arch/idl` / `@coze-arch/bot-typings` 对齐的数据结构，作为本包的类型单一出口。
- 典型数据流（未来完整形态）：
  1. 上层业务通过 `usePremiumStore` 配置 `polling` 并触发 `fetchPremiumPlans`/`fetchPremiumPlan`。
  2. Store 内部调用 `@coze-arch/bot-api` 的 Premium 相关接口，将结果写入 `plans`/`subs`/`currentPlan`/`benefit` 等。
  3. UI 组件通过 `usePremiumType`、`usePremiumQuota`、`useBenefitBasic` 等 Hook 获取派生状态，渲染付费入口、权益说明和配额提示。
  4. 用户在 Premium 管理/续费页面中触发 `renewCurrentPlan`、`cancelCurrentPlan`、`fetchConnections` 等行为，统一经过 store 处理。

## 3. 开发与构建工作流

### 3.1 包级命令

- 依赖安装（在 monorepo 根目录执行）：
  - `rush update`：统一安装/对齐所有前端子包依赖。
- 本包 `package.json` 脚本：
  - `npm run build`：当前实现为 `exit 0`，仅占位；真实打包流程由上层 Rush/Vite 配置统一处理，本包通常不需要单独构建产物。
  - `npm run lint`：使用 `eslint.config.js` 与工作区共享配置，对整个包进行 ESLint 检查。
  - `npm run test`：`vitest --run --passWithNoTests`，测试入口由 `vitest.config.ts` 提供，使用 `@coze-arch/vitest-config` 的 `web` preset。
  - `npm run test:cov`：在 `test` 基础上开启覆盖率（`@vitest/coverage-v8`）。

### 3.2 测试与调试

- 单测：
  - 测试框架为 Vitest，环境配置/transform 由 `@coze-arch/vitest-config` 接管，适用于 React/TSX。
  - `__tests__/data.ts` 提供了 Premium 相关的测试数据结构，可在编写用例时直接复用，保证与真实后端字段对齐。
  - 目前尚未有复杂测试用例，新逻辑建议在 `__tests__` 下新增 `*.test.ts`，重点覆盖：
    - `usePremiumStore` 的状态衍生与 Action 行为（在真实实现后）。
    - `usePremiumType`/`usePremiumQuota`/`useBenefitBasic` 的派生逻辑。
- 调试建议：
  - 由于 `usePremiumStore` 使用了 `zustand/middleware/devtools`，在 `IS_DEV_MODE` 为 true 的环境下可通过 Redux DevTools 观察 state 变化（`name: 'botStudio.premiumStore'`）。
  - 当前大部分 Action 为 `console.log('unImplement ...')` 占位，调试时可通过控制台确认调用路径是否正确，在接入后端时逐步替换为真实逻辑。

### 3.3 类型与编译配置

- `tsconfig.json`：基础 TS 配置，一般继承工作区 `@coze-arch/ts-config`，支持 React/TSX 与路径别名。
- `tsconfig.build.json`：构建专用配置，供上层构建流水线使用。
- `tsconfig.misc.json`：杂项/脚本用 TS 配置，避免与主编译配置互相污染。
- `vitest.config.ts` / `vitest.setup.ts`：
  - 使用工作区 Vitest 预设，统一 Jest DOM、React Testing Library 等测试工具的初始化。

## 4. 项目约定与模式

### 4.1 状态管理与 Hook 约定

- 状态统一通过 `zustand` 管理，所有 Premium 相关状态集中在 `usePremiumStore` 中，避免在各处散落独立 `useState` 或重复请求。
- Hook 设计：
  - `usePremiumStore`：通用状态入口，适合需要读/写 Premium 状态的复杂场景。
  - 只读派生 Hook（如 `usePremiumType`、`usePremiumQuota`、`useBenefitBasic`）：对 store 数据进行组合/抽象，调用方无需关心底层 state 细节。
  - 建议新增 Hook 时保持这一分层：
    - store 层只关心「原始数据」和「对后端的操作」。
    - Hook 层封装判定逻辑与 UI 需要的聚合数据。

### 4.2 与 IDL/后端的对齐

- 类型来源：
  - 用户等级等核心基础类型直接来自 `@coze-arch/idl/benefit`（如 `UserLevel`），确保前后端含义一致。
  - Premium 计划、订阅详情、权益等类型在 `src/types` 做了二次封装，再通过 `src/index.ts` 统一导出，调用方避免直接依赖 IDL 细节。
- 在接入新后端字段时：
  - 优先修改 `src/types` 与 `src/stores/premium.ts`，保证类型扩展后向兼容。
  - Hook 的返回结构尽量保持不变（新增字段而非重命名/删除），降低对上层组件的破坏性。

### 4.3 日志与开发模式

- 当前占位 Action 一律使用 `console.log('unImplement ...')` 形式提示未实现；
  - 接入真实逻辑时，推荐保留错误分支/异常情况的日志输出，但去掉 `unImplement` 文案，改为更具体的错误信息。
- `devtools` 中的 `name: 'botStudio.premiumStore'` 为固定命名，方便在大型项目中快速定位此 store。

## 5. 集成与外部依赖细节

- 核心依赖：
  - `zustand`：轻量级状态管理库，用于实现 `usePremiumStore`。
  - `@coze-arch/idl`：提供后端 IDL 定义，当前直接使用其中的 `UserLevel` 枚举，其余类型通过本包 `src/types` 间接引入。
  - `@coze-arch/bot-api` / `@coze-arch/bot-typings`：未来在实现 `fetchPremiumPlans`、`fetchPremiumPlan` 等 Action 时会使用的后端 SDK 与类型定义（目前仅在 devDependencies 中，尚未实际调用）。
- 与其他 Studio 包的关系：
  - `@coze-studio/premium-components-adapter`：负责 Premium UI 组件（如付费墙、管理弹窗），通常通过本包导出的 Hook/类型获取数据。
  - `@coze-studio/user-store` 等基础 store 包：用于提供用户登陆态/空间信息，本包主要聚焦在 Premium 维度，不直接依赖这些 store，但在调用方会组合使用。

## 6. 项目流程与协作规范

- 代码规范：
  - ESLint/Stylelint 配置由工作区共享包（`@coze-arch/eslint-config`、`@coze-arch/stylelint-config`）统一管理，本包 `eslint.config.js` 仅做轻量覆盖。
  - 新增 TS/TSX 文件时，需在文件头部添加统一的 Apache-2.0 版权声明（对齐现有文件如 `src/index.ts`）。
- 包管理与发布：
  - 通过 Rush monorepo 管理版本与依赖（见 `config/rush-project.json`）。
  - 依赖使用 `workspace:*` 形式指向工作区内部包，不要随意改为固定版本，除非有跨包协同升级计划。
  - 本包通常不直接 `npm publish`，由上层 CI/CD 统一构建与发布。
- 分支与提交流程：
  - 具体规则在仓库根部（如 `README`、`CONTRIBUTING`）定义，此处仅强调：
    - 不要随意改动 `src/index.ts` 的导出结构，避免影响其他包的编译与类型检查。
    - 在将占位逻辑替换为真实实现前，优先为关键 Hook/store 补齐单测。

## 7. 项目当前特殊性与注意事项

- 占位实现居多：
  - `usePremiumStore` 的大部分 Action、`usePremiumType`、`usePremiumQuota` 目前都只是结构占位，尚未与真实后端打通。
  - 在调用方新增依赖这些能力时，请优先确认「是否仅依赖结构」还是「依赖真实业务含义」：
    - 如果只是 UI 结构/类型校验，可以安全使用当前实现。
    - 如果需要真实的订阅/配额逻辑，必须同步补齐 store/Hook 的真实实现与测试用例。
- 开发顺序建议：
  1. 在 `src/types` 中对齐后端 IDL，补全字段。
  2. 在 `src/stores/premium.ts` 中实现对应的 Action，完成状态流转。
  3. 在 `src/hooks` 层通过组合 store / 类型，暴露给上层统一、稳定的 Hook 接口。
  4. 在 `__tests__` 中补充针对 store 与 Hook 的行为测试，确保高阶组件/页面可以放心依赖。
- 调用方兼容性：
  - 新增字段优先采用「向后兼容」策略，避免重命名/删除已有字段。
  - 如确需破坏性修改（例如调整 Premium 等级枚举），需要在上层 `premium-components-adapter` / `user-store` 等包中同步修改，并遵循仓库整体的变更流程。