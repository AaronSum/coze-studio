# AI 协作开发指南（@coze-foundation/space-store-adapter）

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/space-store-adapter）中安全、高效地协作开发。

## 全局架构概览

- 本包是 Coze Studio 前端 monorepo 中的「基础设施 / foundation」子模块，职责是为「空间（Space）」相关业务提供集中管理的 Zustand store 及相关工具函数。
- 入口文件为 src/index.ts，仅导出 useSpaceStore，用于供上层应用或适配层统一访问空间状态。
- 核心实现集中在 src/space/：
  - src/space/index.ts：基于 zustand + devtools 创建 useSpaceStore，封装空间列表、当前空间、最近使用空间等状态及相关增删改查和远程拉取逻辑。
  - src/space/utils.ts：实现通用 polling 轮询逻辑及与空间列表补齐相关的上报逻辑 reportSpaceListPollingRes。
  - src/space/const.ts：定义 ReportEventNames 枚举，统一埋点事件名。
- useSpaceStore 通过调用 @coze-arch/bot-api 提供的 PlaygroundApi / DeveloperApi 完成远端空间列表获取与写操作（创建 / 退出 / 删除 / 转移），并通过 @coze-arch/bot-error、@coze-arch/report-events 与 @coze-arch/logger 进行错误封装和事件埋点。
- 包本身并不包含 UI；它作为「store 适配层」，被上层 Studio / Agent IDE 等应用引入，用于读写共享的空间数据。

## 状态模型与数据流

- 核心状态类型 SpaceStoreState 定义在 src/space/index.ts，包括：
  - space / spaceList / recentlyUsedSpaceList：当前空间、所有空间列表以及最近使用空间列表。
  - spaces：兼容旧结构的聚合对象，包含 bot_space_list、has_personal_space、team_space_num、max_team_space_num（部分字段标注为 @deprecated，仅为兼容老代码）。
  - loading：false 或 Promise<SpaceInfo | undefined>，用于保证 fetchSpaces 在并发场景下复用已有请求。
  - inited：是否已做过首轮空间加载。
  - createdTeamSpaceNum / maxTeamSpaceNum：团队空间配额信息。
- 主要动作（SpaceStoreAction）：
  - reset：将整个 store 重置为 defaultState，使用 zustand 的 set(defaultState, false, 'reset')。
  - getSpaceId / getPersonalSpaceID / checkSpaceID：提供对当前空间 ID、个人空间 ID、空间 ID 有效性的读接口，其中 getSpaceId 在缺少 id 时会抛出 CustomError 并打点 REPORT_EVENTS.parmasValidation。
  - setSpace：按 ID 在 spaces.bot_space_list 中查找目标空间后设置 space，否则抛出错误；若传入空 ID，则只清空 space.id。
  - createSpace / deleteSpace / exitSpace / updateSpace / transferSpace：与 PlaygroundApi 对应接口交互；目前 index.ts 中 createSpace 实现了 SaveSpaceV2 正常 / 异常行为，其余方法在 store 中是 Promise.resolve 的桩实现，真实行为通常在调用端或后续迭代中完善。
  - fetchSpaces：核心数据流入口，通过 PlaygroundApi.GetSpaceListV2 获取远端空间列表，必要时自动创建个人空间并轮询补齐。
- fetchSpaces 的特殊流转：
  - 通过 loading 字段实现「同一时刻仅复用一份请求」：force=false 且已有进行中的 Promise 时会直接返回已有 Promise；force=true 时必然发起新请求。
  - 若接口返回 data.has_personal_space 为 false，则会：
    1. 通过 createSpace 创建个人空间；
    2. 使用 polling(request, isValid) 轮询 GetSpaceListV2 直到 bot_space_list 非空或超过最大重试次数；
    3. 使用 reportSpaceListPollingRes 汇报轮询结果（成功 / 失败、轮次）。
  - 最终根据服务端返回，构造 spaceInfo 和 recentlyUsedSpaceList，并回填到 state，同时同步 createdTeamSpaceNum / maxTeamSpaceNum / spaces 等字段。

## 关键依赖与适配层

- 状态管理：
  - 使用 zustand + devtools（import { create } from 'zustand' / devtools 中间件），并通过 devtools 的 name: 'botStudio.spaceStore' 在开发模式下便于调试。
  - devtools.enabled 依赖全局变量 IS_DEV_MODE（在测试中通过 setup-vitest.ts 设为 false）。
- 远端 API：
  - @coze-arch/bot-api
    - PlaygroundApi.GetSpaceListV2 / SaveSpaceV2 / DeleteSpaceV2 / ExitSpaceV2 / TransferSpaceV2
    - 类型依赖 SaveSpaceRet / SaveSpaceV2Request / TransferSpaceV2Request / ExitSpaceV2Request / SpaceInfo / BotSpace / SpaceType 等。
  - @coze-arch/bot-error
    - CustomError：用于构造带业务语义的异常（事件名 + 消息），便于统一上报。
  - @coze-arch/report-events
    - REPORT_EVENTS：用于 getSpaceId 中的参数错误埋点。
  - @coze-arch/logger
    - reporter.errorEvent：用于 reportSpaceListPollingRes 中上报轮询结果，事件名来自 ReportEventNames。
- 上层 enterprise-store-adapter：
  - tsconfig.build.json 中声明了对 ../enterprise-store-adapter 的引用，表明本包是更大「企业空间 / 空间基座」体系的一环；在代码里当前仅通过 spaceStore 自身接口与之协同，未直接 import 该包。

## 构建、测试与本地开发

- Node / 包管理环境继承自整个 monorepo：
  - Node >= 21、PNPM 8.15.8、Rush 5.147.1（参见 frontend/README.md）。
- 在 monorepo 根目录安装依赖：
  - rush install 或 rush update。
- 进入当前子包目录 frontend/packages/foundation/space-store-adapter 后：
  - 构建：
    - package.json 中 scripts.build 为 "exit 0"，即当前包没有独立构建逻辑，通常依赖上层应用或整体构建流水线；AI 助手不应在此包内添加复杂 build 步骤，保持与 monorepo 一致的构建策略。
  - 测试：
    - 单测命令：npm test（等价于 vitest --run --passWithNoTests）。
    - 覆盖率：npm run test:cov。
    - Vitest 配置在 vitest.config.ts，通过 @coze-arch/vitest-config.defineConfig 统一 preset: 'web'，并启用 coverage.all=true，exclude: ['src/index.ts']，以及 setupFiles: ['./setup-vitest.ts']。
    - setup-vitest.ts：
      - vi.stubGlobal('IS_DEV_MODE', false); 确保 devtools 在测试中禁用。
      - vi.mock('zustand'); 用 mock 替代真实 zustand 实现，降低测试耦合。
  - Lint：
    - npm run lint，使用 @coze-arch/eslint-config（preset: 'web'）。

## 测试模式与 Mock 约定

- 所有与远端服务 / 全局环境强绑定的能力都在测试中通过 vi.mock / vi.stubGlobal 处理：
  - __tests__/space.test.ts 中：
    - 全量 mock 了 @coze-arch/bot-flags / @coze-arch/bot-error / @coze-arch/logger。
    - 针对 @coze-arch/bot-api 中 PlaygroundApi / DeveloperApi 的方法，按照不同调用顺序预先 mockResolvedValueOnce / mockRejectedValueOnce，模拟多种返回路径（成功、失败、部分成功）。
  - 通过这些 mock，测试重点放在：
    - useSpaceStore 的状态流转（默认 state、reset、setSpace、fetchSpaces 等）。
    - polling + reportSpaceListPollingRes 的行为（个人空间缺失时自动创建与轮询补齐）。
- 新增能力时，建议沿用当前模式：
  - 若新增方法依赖外部 API，应在 __tests__/space.test.ts 中通过 vi.mock 追加对应函数的行为，而不是在生产代码中引入测试专用分支。
  - 尽量通过操作 useSpaceStore.getState()/setState 来驱动状态变更，而不是直接依赖内部实现细节。

## TypeScript 与配置结构

- 构建配置：
  - tsconfig.build.json：
    - 扩展 @coze-arch/ts-config/tsconfig.web.json，指定 rootDir: ./src / outDir: ./dist / tsBuildInfoFile 等。
    - include: ['src']。
    - references 指向一系列上游包（bot-api / bot-error / bot-flags / bot-typings / logger / report-events / 若干 config 包以及 enterprise-store-adapter），以支持增量构建和类型共享。
  - tsconfig.misc.json：
    - 用于测试 / storybook / 配置脚本文件，types: ['vitest/globals']。
  - 根 tsconfig.json：
    - 仅声明了 references 到 build 与 misc，并 exclude: ['**/*']，交由具体 tsconfig.*.json 控制编译范围。
- 代码风格：
  - 使用 ESLint 规则集 @coze-arch/eslint-config，preset: 'web'。
  - 源码中存在针对函数尺寸和文件长度等定制规则（例如 @coze-arch/max-line-per-function、max-lines-per-function），在局部通过 // eslint-disable 明确豁免；在新增长函数时，优先考虑拆分，否则需显式 disable 并与现有模式保持一致。

## 项目约定与使用指引

- Store 设计约定：
  - SpaceStoreState.defaultState 中的所有字段在 reset 时会完全还原；新增字段时必须更新 defaultState，以避免 reset 遗漏。
  - loading 字段类型固定为 false | Promise<SpaceInfo | undefined>，fetchSpaces 内的并发控制逻辑强依赖该约定；请勿随意改为 boolean 或其他类型。
  - spaces 字段部分标记为 @deprecated，但仍被 getPersonalSpaceID / checkSpaceID / setSpace 以及上层调用使用；重构时要先在上层完成迁移，再考虑移除。
- 错误与上报约定：
  - 对于可预期的业务错误（如缺少 space_id、创建空间失败等），统一使用 Error 或 CustomError 携带明确前缀文案（如 'create error:'），以便日志排查和测试断言。
  - polling 相关上报通过 reportSpaceListPollingRes 完成，事件名统一使用 ReportEventNames 枚举；新增埋点事件时应先在 const.ts 中扩展枚举。
- 环境约定：
  - devtools 的启用依赖全局 IS_DEV_MODE；除测试 stub 外，不在本包内设置该变量，交由宿主应用环境控制。
  - 由于 setup-vitest.ts 中 mock 了 zustand，在测试中使用 useSpaceStore 时只关心 API 形状和行为，不依赖 devtools 或实际持久化能力。

## 与上游 / 下游的集成特点

- 上游：
  - 依赖 @coze-arch/bot-api 提供的强类型接口，确保空间相关请求与后端契约一致；任何字段变更应优先在 bot-api 包中更新类型再回流至本包。
  - 通过 @coze-arch/logger 与 @coze-arch/report-events 完成统一监控埋点，本包不直接与具体日志落地实现耦合。
- 下游：
  - 上层应用通过 import { useSpaceStore } from '@coze-foundation/space-store-adapter' 获取 store。
  - 典型使用方式：
    - 在 React 组件中使用 useSpaceStore(state => state.xxx) 读取空间列表和当前空间。
    - 在初始化流程中调用 useSpaceStore.getState().fetchSpaces() 拉取空间数据。
    - 在路由 / URL 解析层从 query / path 解析出 space_id，再调用 setSpace 完成当前空间切换。

## 项目流程与协作规范

- 版本与发布：
  - version 当前为 0.0.1，遵循 monorepo 统一的发布流程（由 Rush / CI 负责），本包不单独管理发布脚本。
- 代码所有权：
  - CODEOWNERS 中声明了本包的负责人（参见 .github/CODEOWNERS 中的 frontend/packages/foundation/space-store-adapter 条目），AI 助手在执行大规模重构前应优先保守修改，并预留清晰的变更点以便人工审阅。
- 提交与分支：
  - 整体遵循 monorepo 的约定（在本包内未单独定义），一般通过 feature 分支 + PR 方式合入；AI 助手在生成提交信息或分支名时，应使用简洁、语义清晰的英文短语，并避免改动无关文件。
