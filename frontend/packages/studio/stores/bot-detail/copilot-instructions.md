# @coze-studio/bot-detail-store

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/stores/bot-detail）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是 Coze Studio 前端 monorepo 中的“Bot 详情页状态层”，不渲染 UI，只提供 Zustand store、hooks、保存管理器和工具函数，对上层应用暴露统一的 API。
- 入口 [src/index.ts](src/index.ts) 统一导出：
  - 多个 Zustand store hooks（例如 useBotDetailStoreSet、useGenerateImageStore、useMonetizeConfigStore 等）。
  - 保存相关操作（autosaveManager、botSkillSaveManager、multiAgentSaveManager 等）。
  - 只读态与状态计算工具（useBotDetailIsReadonly、getBotDetailIsReadonly、updateHeaderStatus、uniqMemoryList、verifyBracesAndToast 等）。
  - 与多 Agent、生成头像、变现配置等相关的专用工具与类型。
- Store 聚合层 [src/store/index.ts](src/store/index.ts) 定义 BotDetailStoreSet：
  - 维护 persona、query-collect、multi-agent、model、bot-skill、bot-info、collaboration、page-runtime、monetize-config、manually-switch-agent、audit-info、diff-task 等子 store 的获取与清理逻辑。
  - 暴露 useBotDetailStoreSet.getStore() 和 clear()，供页面在 bot 切换或关闭时统一重置状态。
- 保存管理层 [src/save-manager](src/save-manager) 负责将本地 store 状态与后端接口/DTO 对接：
  - auto-save 目录下实现基于 store 订阅的自动保存（如 persona、bot-skill、multi-agent、model），通过 autosaveManager 等入口对外统一管理。
  - manual-save 目录集中实现各种手动保存动作（如 saveConnectorType、saveTableMemory、saveTTSConfig、saveTimeCapsule 等）。
  - utils/ 目录下封装与保存请求、DTO 组装相关的通用逻辑（如 getBotDetailDtoInfo、updateBotRequest）。
- hooks 层 [src/hooks](src/hooks) 提供对多 store/工具的组合访问（如 useBotDetailIsReadonly、useChatBackgroundState），通常作为页面组件的直接入口。
- services 层 [src/services/get-bot-data-service.ts](src/services/get-bot-data-service.ts) 负责与上游 bot 接口对接，将后端数据转换为本 store 所需结构，是数据流入的主要入口之一。
- utils 层 [src/utils](src/utils) 划分为：
  - 与 WebSocket / 背景图生成等外部服务集成（avatar-background-socket、generate-image、integrated-fg 等）。
  - 与多 Agent 管理、存储、状态计算相关的纯函数工具（find-agent、handle-agent、storage、uniq-memory-list、replace-bot-prompt 等）。
  - 校验与交互工具（submit 中的 verifyBracesAndToast）。
- types 层 [src/types](src/types) 聚合所有与 bot 详情相关的领域类型：
  - skill.ts 中定义 BotDetailSkill、KnowledgeConfig、TimeCapsuleOptionsEnum 等核心业务类型。
  - agent.ts / model.ts / persona.ts / generate-image.ts 等文件则为对应模块提供 VO / DTO / 状态类型。

## 关键数据流

- 初始化流程：
  - init 层（如 [src/init/init-bot-detail-store.ts](src/init/init-bot-detail-store.ts)、[src/init/init-generate-image.ts](src/init/init-generate-image.ts)）负责根据 bot 基本信息和 workspace 环境调用各子 store 的初始化 action。
  - 外层页面调用 initBotDetailStore 与 initGenerateImageStore 完成首次装载。
- 状态更新：
  - 所有业务状态都通过各自的 Zustand store（位于 [src/store](src/store)）维护，使用 getState()/setState() 模式，clear/reset 等方法必须保持幂等。
  - 聚合获取：上层通常通过 useBotDetailStoreSet.getStore() 拿到所有子 store hook，然后在组件内部拆分使用。
- 持久化与后端交互：
  - 自动保存：auto-save 下的各 manager 订阅相关 store 状态，一旦检测到变更，会调用 save-manager/utils 中的请求封装，与 @coze-arch/bot-api / @coze-arch/bot-space-api 等后端 SDK 通信。
  - 手动保存：手动动作（如修改记忆表、TTS 配置、多 Agent 列表）通过 manual-save 下的单一入口函数触发，内部会读取对应 store 状态并构造请求 payload。
  - DTO 转换：getBotDetailDtoInfo 等工具函数负责将多个 store 的状态汇总成后端所需的 DTO 结构，以统一接口风格。
- 只读控制：
  - useBotDetailIsReadonly 与 getBotDetailIsReadonly 依赖 @coze-arch/bot-flags、权限信息等，以集中方式控制“详情页是否可编辑”；业务组件应只依赖这两个入口，而不要自行拼装条件。

## 开发与调试流程

- 构建：
  - 本包自身的 `npm run build` 目前是占位实现（直接 exit 0），实际产物由 monorepo 顶层 Rush / 构建系统统一处理。
  - 在本子包内主要关注 TypeScript 类型正确和单元测试通过即可。
- 测试：
  - 使用 Vitest，配置位于 [vitest.config.ts](vitest.config.ts)，通过 @coze-arch/vitest-config 预设：
    - `npm test` 或 `pnpm test`（由 monorepo 脚本统一代理）运行所有测试。
    - 覆盖率配置：all: true，include 仅包含 src/store/*，exclude 掉 transform.ts；新增 store 时请补充相应测试文件放在 [__tests__/store](__tests__/store)。
  - 测试环境通过 [__mocks__/setup-vitest.ts](__mocks__/setup-vitest.ts) 统一初始化（如全局对象、i18n、logger 等），写测试时优先复用已有 mock。
- Lint：
  - `npm run lint` 使用 @coze-arch/eslint-config，风格由 monorepo 统一配置，避免在本子包内单独调整规则。
- 本地联调：
  - 本包作为 workspace:* 依赖被 studio app 使用，一般通过顶层脚本构建前端整体后在浏览器中调试；调试时可直接修改本包源码，Rush 会通过 incremental build 同步到应用。

## 代码风格与约定

- 状态管理：
  - 所有可共享的业务状态必须放在 src/store 下的独立模块中，并通过 useXXXStore 命名导出，内部使用 Zustand 标准模式（create、set、get、subscribe）。
  - 每个 store 文件需要暴露清理方法（clear/reset 等），并在 useBotDetailStoreSet.clear() 中显式调用，保持跨页面切换时状态不会泄漏。
- 模块命名：
  - store：useXxxStore 命名，文件名使用中划线，如 [src/store/bot-info.ts](src/store/bot-info.ts)。
  - hooks：useXxx 命名，如 [src/hooks/use-bot-detail-readonly.ts](src/hooks/use-bot-detail-readonly.ts)、[src/hooks/use-chat-background-state.ts](src/hooks/use-chat-background-state.ts)。
  - save-manager：
    - auto-save/xxx.ts 用于声明 autosaveManager 派生的 manager，内部依赖于 store 订阅。
    - manual-save/xxx.ts 用于响应显式触发的保存动作，函数名一般以 save/update 开头（saveTableMemory、updateShortcutSort 等）。
  - utils：倾向于单一职责的纯函数工具，文件名体现业务含义（find-agent、handle-agent、uniq-memory-list、replace-bot-prompt 等）。
- 类型与常量：
  - 业务核心类型集中在 [src/types](src/types) 下，跨模块复用时优先从 types 导出，而不是多处重复定义。
  - Enum 命名以 PascalCase + Enum 结尾，例如 TimeCapsuleOptionsEnum；常量使用全大写或语义清晰的驼峰名，统一从入口导出。
- 只读与权限：
  - 所有关于 bot 是否可编辑/禁用控件的逻辑，都应该收敛在 useBotDetailIsReadonly 与 getBotDetailIsReadonly 两个入口，避免在组件中重新编写权限判断逻辑。

## 外部依赖与集成

- 基础依赖：
  - Zustand（zustand）作为状态容器，immer 用于不可变更新，lodash-es 用于集合类操作，dayjs 负责时间处理，deep-diff 用于复杂对象差异比较。
  - ahooks 为某些 hooks 提供增强（如异步、请求、节流等），使用时注意遵循其标准用法。
- Coze 相关内部包：
  - @coze-arch/bot-api, @coze-arch/bot-space-api, @coze-arch/idl 提供与后端 Bot、Space、IDL 协议的通信与类型定义。
  - @coze-arch/bot-utils, @coze-arch/web-context, @coze-arch/logger, @coze-arch/report-events 等为通用工具、上下文、日志与埋点库。
  - @coze-studio/autosave、@coze-studio/bot-utils、@coze-common/websocket-manager-adapter 等为上层 Studio 业务封装，如自动保存框架与 WebSocket 适配器。
  - 在本包中调用这些内部包时，请保持最小封装：尽量只在 services/save-manager/utils 等集中位置依赖外部 SDK，store 和 hooks 层保持相对纯净。
- 生成图片与背景：
  - avatarBackgroundWebSocket 与 generate-image 相关工具依赖 WebSocket 或其它远程服务生成 bot 头像背景，调用时应通过导出的工具函数/Store（useGenerateImageStore）而不是直接操作底层连接。

## 测试约定

- 单元测试组织：
  - 所有与 store 相关的测试位于 [__tests__/store](__tests__/store) 目录下，并以模块名 + `.test.ts` 结尾，例如 bot-info.test.ts、multi-agent.test.ts、use-generate-image-store.test.ts 等。
  - 新增 store 或 hooks 时：
    - 优先添加对应的测试用例，覆盖初始化、状态更新和清理逻辑。
    - 若涉及保存逻辑，需对 save-manager 中的函数至少做一次 happy-path 测试（一般通过 mock 网络或 DTO 工具实现）。
- Mock 规则：
  - 统一在 [__mocks__](__mocks__) 下维护测试用 mock（包括 setup-vitest.ts）。新增 mock 时尽量保持可复用性，避免在单个测试文件内重复伪造大量相同数据结构。

## 流程与协作规范

- 分支与提交：
  - 继承 monorepo 约定（参考根目录 README 与贡献文档），本包不单独定义分支策略；在修改本包代码时，应确保所有受影响的 workspace 子包测试通过。
- 发布与版本：
  - 包版本由 Rush / monorepo 发布流程统一管理，本地不手动改写 version 规则，只在需要时更新 package.json 中的依赖范围为 workspace:*。
- 变更范围控制：
  - 本包关注“Bot 详情状态层”，不要在此引入 UI 组件或与特定页面耦合的逻辑；所有 UI 相关改动应发生在上层 app。
  - 若新增的功能跨多个 store，请先在 types 与 utils 层建模，再在各 store 中按领域拆分，最后通过 save-manager 接入持久化。

## 项目特性与注意事项

- Monorepo 深度整合：
  - 大量依赖为 workspace:*，表示与其它包的强耦合开发；在重构本包时需要特别关注导出 API 的兼容性，避免破坏下游应用。
- Store 聚合与清理是关键：
  - useBotDetailStoreSet 是本包的核心聚合点，也是内存泄漏和状态串联的高风险区域；任何新增/删除 store，都必须同步更新 getStore 与 clear，并补充对应测试。
- 自动保存行为：
  - autosaveManager 及其它 auto-save manager 可能在用户无感知的情况下频繁发起请求；在修改保存触发条件或 diff 算法（deep-diff）时，要评估对网络与后端压力的影响，并保证不会导致循环保存。
- 只读态与权限控制：
  - 本包内多个 store 和工具依赖“是否只读”这一全局条件，此处是权限收敛点；修改时务必确保与 @coze-arch/bot-flags 等上游定义保持一致，以免造成前后端对权限理解不统一。
