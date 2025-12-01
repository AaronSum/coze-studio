# tea-interface 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/tea-interface）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本包名称：`@coze-studio/tea-interface`，位于 Coze Studio 前端 Rush monorepo 的架构层（arch）。
- 功能定位：**定义 Tea 统计 / 埋点 SDK 的类型与事件约定**，而不是具体实现 SDK 逻辑。
- 对外只暴露 TS 类型与常量：
  - 根导出：`src/index.ts`
  - 事件导出：`src/events.ts`（同时通过 `package.json.exports["./events"]` 和 `typesVersions` 暴露）。
- 典型下游：埋点 SDK、前端应用通过本包来：
  - 统一事件名称（枚举 / 常量）。
  - 统一事件参数结构（接口 / 类型）。
  - 统一对接 Tea（内部统计系统）的语义约束。

## 2. 代码结构与架构要点
- 顶层结构
  - `src/index.ts`：聚合 / 透出核心类型与常量，是下游首选入口。
  - `src/events.ts`：
    - 定义 Tea 事件名称常量（通常为 `EVENT_NAMES` 或类似枚举）。
    - 为每个事件定义对应参数类型、上报 payload 类型。
    - 事件按照功能域分区（通过 `// #region ...` 注释划分，如团队空间、工作区、插件等），保证可读性。
  - `src/coze-pro/`：
    - 声明与 Pro / Team 相关的接口，如 `TeamInviteParams`。
    - 这些类型被 `events.ts` 引用，用于丰富相关事件参数类型。
  - `src/product/`、`src/playground/`：
    - 提供特定产品线或实验区事件/类型的拆分，以减少 `events.ts` 体积和耦合。
  - `__tests__/`：目前仅 `.gitkeep`，默认无单元测试实现；可以按 vitest 约定新增。

- 架构原则
  - **本包只负责“接口与约定”，不依赖具体 UI / 业务实现**，因此：
    - 依赖仅限于 `@coze-arch/bot-api` 等基础类型库。
    - 不应引入具体框架（React/Vue）或浏览器 API。
  - 事件与参数类型**必须向后兼容**：下游使用本包作为类型源，一旦字段或枚举被删除会导致下游编译失败或运行时兼容问题。
  - 拆分子模块（如 `coze-pro`、`product`）是为了：
    - 降低单文件尺寸。
    - 在逻辑上与特定产品域解耦（方便按域维护与代码所有权划分）。

## 3. 构建、测试与开发流程
- NPM 脚本（见 `package.json`）
  - `build`: `exit 0`
    - 当前不做实际编译；编译由上层 Rush/TS 工具链统一处理。
    - AI 助手无需新增本地自定义构建逻辑；如需补充，请遵循 monorepo 通用模式（参考其他 arch 包）。
  - `lint`: `eslint ./ --cache`
    - 使用 monorepo 提供的 `@coze-arch/eslint-config`，风格以 TypeScript + Node/库模式为主。
  - `test`: `vitest --run --passWithNoTests`
    - 测试框架通过 `@coze-arch/vitest-config` 统一配置（见 `vitest.config.ts`）。
    - 目前允许无测试文件通过（`passWithNoTests`）。
  - `test:cov`: `npm run test -- --coverage`
- TypeScript 配置
  - 根 `tsconfig.json`：
    - 使用 project references，仅包含 `tsconfig.build.json`、`tsconfig.misc.json`，并设置 `compilerOptions.composite = true`，用于 monorepo 增量编译。
    - `exclude: ["**/*"]`，真正的 include / exclude 规则由子 tsconfig 管理。
  - `tsconfig.build.json`：
    - 通常指定真实编译目标（如 `src/**/*`），并继承公共 `@coze-arch/ts-config`；AI 修改时应仿照其他 arch 包。

## 4. 事件与类型设计约定
- 事件命名
  - 所有事件名称统一集中在 `src/events.ts`（或相关子模块）中定义，并通过常量 / 字符串枚举暴露。
  - 命名通常体现：业务域 + 行为 + 位置，如：
    - `add_member_pop_up_show`（示例，具体以代码为准）。
  - 对于团队空间 / 工作区相关事件，会显式包含空间类型字段：
    - `workspace_type?: 'personal_workspace' | 'team_workspace'`。
    - `space_type: 'personal' | 'teamspace'` 等。

- 事件参数类型
  - 每个事件在 `events.ts` 中都有对应的参数接口：
    - 常见模式：`[EVENT_NAMES.some_event]: SomeEventParams;`
  - 参数类型可能引用：
    - `src/coze-pro/index.ts` 中的 `TeamInviteParams` 等业务接口。
    - `@coze-arch/bot-api` 中定义的 Bot / 会话相关类型。
  - 字段设计通常倾向：
    - 使用字符串枚举联合类型限制值空间（如 `'develop' | 'library' | 'team_settings'`）。
    - 保留可选字段，用于兼容旧端（例如 `workspace_type?`）。

- 扩展新事件时的关键规则
  - **必须**在 `events.ts` 中：
    - 按业务域选择合适的 `// #region` 区块或新建分区。
    - 增加事件常量（如有统一常量表）。
    - 增加事件到“事件 → 参数类型映射”的类型定义。
  - 如果新事件涉及团队 / 空间 / tab 语义：
    - 尽量复用已有联合类型（如 `workspace_type`、`tab_name`），不要发明近似但不同的字符串值。
  - 修改已有事件参数时：
    - 仅在绝对必要时才删除字段；优先新增可选字段。
    - 若字段语义变更明显，建议新增新事件名称而非强行兼容旧事件。

## 5. 与外部包 / 系统的集成
- `@coze-arch/bot-api`
  - 本包唯一 runtime 依赖；主要贡献与 Bot / 对话相关的类型定义。
  - AI 在新增事件时，如涉及 Bot 或会话实体，应优先查找并复用此依赖中的类型，而非在本包重复定义。

- 与 Tea / 埋点系统
  - 本包不直接进行网络请求或 Tea SDK 调用，仅通过类型 + 事件名称约定，供其它 SDK / 应用消费。
  - 外层 Tea SDK 会从 `@coze-studio/tea-interface` 引入：
    - 事件名称常量，用于统一上报 key。
    - 参数接口，用于约束埋点 payload 结构。

## 6. 项目规范与协作约定
- 代码风格
  - 使用 ESLint + monorepo 统一配置（`@coze-arch/eslint-config`）。
  - 以 TypeScript 类型安全为主：应倾向于显式接口 / 类型别名，避免大量 `any`。
  - 事件 / 类型文件较长时，优先通过逻辑分组与子目录拆分（如 `coze-pro/`、`product/`），而不是在单文件底部继续堆叠。

- 测试与验证
  - 目前子包暂未提供具体测试文件；如 AI 为新增逻辑补充测试：
    - 建议使用 Vitest，放置在 `__tests__` 或 `src/**/__tests__` 下。
    - 重点验证类型映射与导出是否正确（例如 `import type { ... } from '@coze-studio/tea-interface/events';` 是否可用）。

- 分支与发布
  - 子包受 monorepo 统一版本与发布流程管理：
    - 版本号在 `package.json` 中维护，通常通过 Rush / Change log 工具更新。
    - 不在本子包内单独编写发布脚本。

## 7. 对 AI 编程助手的具体建议
- 在本包内进行改动时：
  - **优先修改 /新增类型与常量，而非实现逻辑**；这是一个“接口”包。
  - 为新事件或字段编写简短英文注释（与 `events.ts` 现有风格保持一致），有助于后续消费者理解语义。
  - 增加新模块时，参考现有目录命名（如 `coze-pro`、`product`），按业务功能命名文件与类型。
- 在跨包修改场景（AI 同时修改 Tea SDK 实现包时）：
  - 先在本包补充 / 调整类型定义，再在实现包中引用并适配。
  - 避免在外层实现包中定义与本包语义重叠的事件或类型，以免分叉。
