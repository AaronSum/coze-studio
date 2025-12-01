# @coze-foundation/global-store 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/global-store）中安全、高效地协作开发。

## 1. 子包定位与整体架构概览

- 子包路径：frontend/packages/foundation/global-store，对应 npm 包名 `@coze-foundation/global-store`。
- 所属层级：foundation 层基础能力，主要提供跨应用/模块共享的“全局状态存储”与访问封装，通常被上层 apps 和其他 packages 依赖，而不反向依赖它们。
- 典型角色：
  - 定义统一的全局 store 接口和类型（例如应用配置、用户态、运行时上下文等）。
  - 提供创建/获取 store 的工厂方法，隐藏具体实现（如 Redux、Zustand、Jotai、自研方案等）。
  - 封装与持久化、跨 Tab 通信、远程同步等相关的通用逻辑（如果本包中存在）。
- 架构原则：
  - **无 UI 依赖**：通常只依赖状态管理与工具库，不依赖 React 视图组件，以便在 node、服务端或脚本中也可复用。
  - **单一职责**：仅处理“全局状态与其读写接口”，与具体业务领域逻辑保持分离；业务状态通常由上层模块在此 store 基础上组合。
  - **可扩展**：对外暴露稳定 API（类型+函数），内部实现可以随时间重构，只要外部契约不破坏即可。

> 在编写或修改代码时，优先保持 `foundation` 层的稳定、去业务化和低耦合特性。

## 2. 源码结构与关键文件

> 以下结构为常见/推荐模式，请在编辑前实际打开对应目录确认当前实现；新增代码时应尽量遵循现有模式扩展。

- 入口与导出
  - [frontend/packages/foundation/global-store/package.json](frontend/packages/foundation/global-store/package.json)：声明包名、入口文件、构建配置钩子等，是理解本包使用方式的首要文件。
  - [frontend/packages/foundation/global-store/src/index.ts](frontend/packages/foundation/global-store/src/index.ts)：标准入口文件，集中导出所有对外可用的类型与 API，是“公共表面”的唯一来源。
- Store 核心实现
  - [frontend/packages/foundation/global-store/src/store.ts](frontend/packages/foundation/global-store/src/store.ts)：封装全局 store 的创建逻辑和实例持有（例如 `createGlobalStore`、`getGlobalStore` 等）。
  - [frontend/packages/foundation/global-store/src/types.ts](frontend/packages/foundation/global-store/src/types.ts)：集中声明 store 中的核心类型（如 `GlobalState`, `GlobalStore`, `GlobalStoreOptions`），上层模块应通过这些类型交互，而非依赖内部具体实现细节。
  - 如存在 `src/context/` 或 `src/adapters/` 目录，通常分别用于：
    - context：定义上下文注入（例如 React Context 封装），但尽量不在 foundation 层绑定 UI 框架。
    - adapters：为不同运行环境或状态库实现适配器（如 `zustandAdapter.ts`、`reduxAdapter.ts`）。
- 工具与辅助模块
  - [frontend/packages/foundation/global-store/src/utils](frontend/packages/foundation/global-store/src/utils)：与 store 操作密切相关的工具方法（如深合并、订阅管理、快照序列化）；不应引入与 store 无关的通用工具（通用工具应放到更通用的基础包）。
  - 若存在 `constants.ts`/`config.ts`：用于声明默认配置、key 常量、命名空间，避免硬编码字符串散落在各处。
- 测试代码
  - 通常位于 `__tests__/` 或 `*.test.ts` 文件中（例如 [frontend/packages/foundation/global-store/src/__tests__/store.test.ts](frontend/packages/foundation/global-store/src/__tests__/store.test.ts)）。
  - 用于约束：状态初始化约定、订阅/更新语义、与外部依赖（如 localStorage）的交互行为。

> 做结构变更前，务必先查看现有 src 目录，遵循当前命名与分层模式，而不是凭空引入新的结构体系。

## 3. 依赖与集成关系

- 对上层的角色
  - 被 `frontend/apps/*` 和其他 `frontend/packages/*` 作为基础依赖，为它们提供统一的全局状态读写接口。
  - 上层通常通过 `import { ... } from '@coze-foundation/global-store'` 使用本包暴露的 API，而不直接访问内部子路径（禁止 `@coze-foundation/global-store/dist/...` 之类用法）。
- 对下层/外部库的依赖
  - 具体依赖请以 [frontend/packages/foundation/global-store/package.json](frontend/packages/foundation/global-store/package.json) 为准，常见模式包括：
    - 状态库：如 `zustand`, `redux`, `jotai` 等之一。
    - 工具库：如 `lodash-es`, `immer`, `rxjs` 等（如有）。
    - 类型工具：如 `type-fest`、项目内基础类型包（如 `@coze-foundation/types`）。
  - 所有对外行为应通过本包暴露的类型/函数抽象，不对上层泄露具体第三方依赖细节，以便未来可以替换实现库。
- 与其他 foundation 包的协作
  - 若依赖同层的基础包（如 `@coze-foundation/config`, `@coze-foundation/event-bus`），应保持**无环依赖**，避免 global-store 成为所有基础包的共同依赖中心。
  - 引入其他 foundation 包前，请检查依赖图，尽量通过抽象接口或事件总线解耦，而不是直接相互引用导致环路。

## 4. 项目特有模式与约定

- Type-first / API 稳定性
  - 公共 API 一律通过 `src/index.ts` 导出，并配有清晰的 TypeScript 类型说明。
  - 类型定义与实现分离：重要接口和类型在 `types.ts` 中维护，避免散落在实现文件里影响复用与重构。
- 命名与目录
  - 全局 store 实例或工厂通常使用 `globalStore`, `createGlobalStore`, `initGlobalStore` 等有语义的名字，避免含糊的 `store`, `state` 命名。
  - 对扩展点/插件型能力，倾向于使用 `registerXxx`, `useXxx`, `withXxx` 等约定式命名。
- 副作用与环境区分
  - 不在模块顶层执行副作用性逻辑（如直接访问 `window`、`localStorage`、`process.env`），而是通过显式的 `init` 方法或惰性访问，以利于 SSR 和测试。
  - 如需依赖浏览器能力，请封装在专门的 adapter 或 util 中，并在类型与实现中清晰标注（例如 `BrowserStorageAdapter`）。
- 错误与状态约束
  - 尽量通过类型约束防止非法状态，而不是在运行时抛出大量异常。
  - 需要抛错时，使用项目内约定的错误类型或错误码（如有统一错误包，则通过该包定义/创建错误）。

## 5. 构建、测试与调试工作流

本子包通常通过 Rush + workspace 融入整体前端工程。

- 安装依赖
  - 在仓库根目录执行一次：`rush install` 或参考 [scripts/setup_fe.sh](scripts/setup_fe.sh)。
- 构建
  - 常见方式：
    - 在仓库根目录：`rush build -t @coze-foundation/global-store`（仅构建本包及其依赖）。
    - 或：`rush build`（构建所有前端包，时间较长）。
  - 若本包使用自定义构建脚本（例如在 package.json 中配置 `"build": "tsup ..."` 或 `"build": "tsc -b"`），也可以在子包目录执行：`rushx build`。
- 测试
  - 若 package.json 中配置 `"test"` 脚本：
    - 子包目录执行：`rushx test`。
    - 或在根目录使用选择性构建/测试命令（例如 `rush test -t @coze-foundation/global-store`，具体以项目实际脚本为准）。
  - 测试框架（Jest/Vitest 等）以 package.json 和测试文件内容为准；新增测试应照抄现有测试文件的模式与配置。
- 本地调试
  - 该包通常不单独运行，而是作为依赖被前端应用引用：
    - 在根目录执行 `rushx dev` 或应用层脚本（如 `apps/studio` 中的 dev 命令），然后通过实际页面交互验证全局状态行为。
  - 若需要快速验证 store 逻辑，可在测试文件或临时脚本中导入 `@coze-foundation/global-store` 做最小 reproducer。

> 在修改核心 API（类型或函数签名）后，务必执行最小构建+测试（如 `rush build -t @coze-foundation/global-store` + `rushx test`），避免破坏依赖包。

## 6. 与其他子系统的集成要点

- 与应用层（apps）
  - 应用通常通过 hooks 或 service 层再包装一层，而不直接大范围散落 store 调用；如存在 `useGlobalStore` 一类 hook，优先复用这些封装。
- 与跨模块通信机制
  - 若全局 store 需要监听 event-bus、路由变化或用户登录态变更，推荐：
    - 由上层在应用初始化时调用特定 `initXxx`/`bindXxx` 方法，将外部事件源注入到 store 内部。
    - 避免在 global-store 内部主动依赖浏览器单例对象或全局事件总线，减少耦合。
- 与持久化/缓存
  - 如有 localStorage / IndexedDB / 后端持久化：
    - 相关逻辑应集中在 adapter/持久化模块中。
    - API 应清晰区分“内存态 state”和“已持久化/待同步 state”，避免模糊的多源真相。

## 7. 开发流程与协作规范

> 以下为仓库通用惯例在本子包中的落地方式，若根仓库文档中有更明确说明，请优先遵守根文档。

- 分支与提交
  - 通常采用 feature 分支开发，再通过 Pull Request/Merge Request 合并至主干；分支命名与提交规范以仓库根文档为主。
  - 修改 global-store 时，建议在 PR 描述中显式写明：
    - 变更的公共 API（新增/删减/签名变更）。
    - 对上层应用/包可能造成的影响和需要的迁移方式。
- 代码风格
  - TypeScript 代码风格由仓库统一的 ESLint/Prettier 配置控制；不要在本子包内引入额外 lint/format 规范。
  - 避免在 foundation 层写与业务强相关的文案/枚举/常量，这些应放到上层或更合适的领域包中。
- 评审重点
  - API 稳定性：是否增加了难以回滚或向后兼容性差的接口。
  - 依赖合理性：是否引入了 heavy 依赖或导致依赖环。
  - 性能与内存：全局 store 往往长驻内存，应避免无界增长的结构（如不断累积的订阅、缓存 Map 等）。

## 8. 对 AI 编程助手的特别提示

- 在修改公共 API 时：
  - 先找出所有导出项（index.ts），再通过全局搜索确认调用方范围；避免直接删除/重命名导出符号。
  - 如确需破坏性变更，应同步更新：类型声明、实现、测试以及依赖此包的上层项目中显式的调用点。
- 在新增功能时：
  - 优先考虑是否属于“全局存储”通用能力，若更像是具体业务逻辑，请将其放到对应业务包或 apps 内，而不是塞进 global-store。
  - 选择已有目录和命名模式进行扩展，不随意新建与现有结构不一致的目录层级。
- 在排查 Bug 时：
  - 结合上层应用场景，确认是 store 本身的问题，还是调用方使用方式不当（如未在初始化前访问、错误的 key、并发写入等）。
  - 善用针对订阅/更新行为的单元测试复现问题，而不是仅通过手动操作界面验证。

---

若需要进行较大规模的重构（如替换底层状态库、改变全局状态结构），请先通读本包及其直接依赖的前端包，并在 PR / 设计文档中明确迁移策略，再进行实现。