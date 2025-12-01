# @coze-arch/report-events Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/report-events）中安全、高效地协作开发。

## 全局架构与职责

- 本子包是「事件枚举与埋点工具」层，负责统一定义前端上报事件名，以及提供一个标准化的埋点事件生命周期工具。
- 事件名：
  - 入口在 src/events.ts，将多个子领域的事件 enum（如 src/interaction-event.ts、src/feature-event.ts、src/common-error.ts 等）聚合：
    - 类型层：通过联合类型 EventNames 描述合法事件名集合；
    - 运行时层：通过 REPORT_EVENTS 将各 enum 展开为一个扁平对象（便于按 key 取值、复用常量）。
  - 其他 *-event.ts 文件（如 workflow-event.ts、chat-room-event.ts、database-event.ts 等）只是按业务域拆分枚举，不包含业务逻辑。
- 埋点工具：
  - src/report-event.ts 暴露 createReportEvent，用于围绕单个 eventName 管理：start / success / error / 时序分段（addDurationPoint / getDuration）以及元数据（getMeta）。
  - createReportEvent 通过 @coze-arch/logger（globalLogger.persist.success/error）真正发出日志，上层业务不直接依赖日志实现细节。
- 对外导出：
  - 统一入口在 src/index.ts：
    - type EventNames, REPORT_EVENTS
    - type DurationPoint, type ReportEvent, createReportEvent
  - 调用方通常只从包入口导入，不直接引用内部文件。

## 关键开发与运行流程

- 安装 / 依赖：
  - 由 monorepo 统一管理，一般不单独执行 npm install；在仓库根目录使用 rush update 安装依赖。
- 构建：
  - 本包 package.json 中 build 脚本目前为占位："build": "exit 0"，编译由上层统一构建系统负责（参考 frontend/ README 与 rush 配置）。
- 测试：
  - 使用 Vitest：
    - 在本包目录执行：
      - npm test —— 等价于 vitest --run --passWithNoTests
      - npm run test:cov —— 生成覆盖率报告。
  - 当前仓库中未见显式测试文件，为新增逻辑时可在 src 同级新增 *.test.ts 并按 monorepo 通用 Vitest 配置运行。
- Lint：
  - 使用 monorepo 统一 ESLint 配置：
    - eslint.config.js 通过 @coze-arch/eslint-config.defineConfig({ preset: 'web' }) 配置；
    - 在本包目录执行 npm run lint 进行检查。

## 项目特有的约定与模式

- 事件定义模式：
  - 所有事件都使用 TypeScript enum，并启用 @typescript-eslint/naming-convention 规则豁免（文件头部有 eslint-disable 标记）。
  - enum value 一律为后端/日志系统使用的字符串 key，例如：
    - InteractionEvents.logout = 'logout'
    - CommonError.ChunkLoadError = 'chunk_load_error'
  - 新增事件时：
    - 优先找到所属业务域文件（如知识库相关用 knowledge-event.ts，工作流用 workflow-event.ts）；
    - 若不存在合适域，可新增 *-event.ts 文件，并记得在 src/events.ts 中：
      - import 对应 enum；
      - 将其添加到 EventNames 联合类型；
      - 将其展开并合并进 REPORT_EVENTS；
    - 避免在多个文件中定义含义重复或字符串值相同的事件。
- 埋点工具使用约定：
  - createReportEvent 已标记 @Deprecated（建议迁移到 @coze-arch/logger 中的 reporter.tracer），但目前仍在该包中提供以兼容旧代码：
    - 新增代码时优先考虑直接使用 logger 层提供的 tracing 能力；
    - 如果必须继续使用 createReportEvent，应：
      - 只传入 EventNames 中已存在的 eventName，避免任意字符串；
      - 在 meta 中仅放置可序列化的基础数据（number/string/boolean/简单对象），避免循环引用或巨大的对象树；
      - 调用 success / error 之后不再调用 addDurationPoint，以免时序语义混乱（虽然实现上仍可工作）。
- Duration 计算模式：
  - createReportEvent 自动在构造时调用 start()，同时对外仍暴露 start() 以便在需要时重置起点；
  - addDurationPoint(pointName) 会：
    - 将当前时间 push 到内部 durationPoints 数组；
    - getDuration() 以首个 startTime 为基准，生成：
      - duration[pointName] —— 从开始到该点的耗时；
      - duration.interval[pointName] —— 与上一个点的间隔（首个点等同于 duration[pointName]）；
  - logger.persist.success 会将 duration 整体作为 meta.duration 下发，不在本包内做任何上报协议裁剪。
- 全局类型依赖：
  - src/global.d.ts 声明对 @coze-arch/bot-typings 的引用，使得本包在 monorepo 中能共享全局类型定义；
  - 在本包内新增全局类型时，优先复用该机制，而不是在本地重复声明基础类型。

## 重要依赖与集成细节

- @coze-arch/logger：
  - 通过 import { logger as globalLogger, type Logger } from '@coze-arch/logger' 集成：
    - 若调用方传入 logger（实现 Logger 接口），则使用调用方实例；
    - 否则使用 globalLogger；
  - logger.persist.success / logger.persist.error 的调用契约：
    - success：{ eventName, meta }；
    - error：{ eventName, error, meta }，其中 error 为空时本包会用 new Error(reason) 兜底。
  - 若需要扩展 logger 能力，请在 logger 包中演进，而非在本包绕过 persist 接口直接输出。
- lodash-es.set：
  - 在 report-event.ts 中用于按 path 写入 interval.* 字段：
    - acc[pointName] = ...;
    - set(acc, ['interval', pointName], ...);
  - 若要改动 duration 结构，需要同步调整依赖此结构的上游数据消费逻辑（通常在监控/分析平台侧）。
- 业务枚举文件：
  - 诸如 src/feature-event.ts、src/interaction-event.ts、src/knowledge-event.ts、src/chat-room-event.ts 等均只包含 enum，不要在其中引入运行时代码或副作用；
  - 如需关联更复杂的配置（例如标签、埋点字段说明），请在其他包建立映射关系，而不是把配置硬编码进本枚举包。

## 开发流程与协作规范

- 代码风格：
  - 遵循 monorepo 统一 ESLint + TypeScript 规则，保持 enum 命名、字符串常量风格与现有代码一致（下划线、小写为主）。
  - 每个源文件头部保留现有 Apache-2.0 版权声明；新增文件时比照现有文件复制即可。
- 版本与发布：
  - 本包版本号由 monorepo 发布流程统一管理（见仓库根目录的 rush.json 与相关发布脚本），不要在本地单独修改 version 并发布。
- 分支与提交流程（参考 monorepo 约定）：
  - 以功能/修复为单位创建 feature 或 fix 分支，在完成后通过代码评审合入主干；
  - 保持变更粒度小：
    - 新增/修改事件枚举时，尽量只改动对应 *-event.ts 与 src/events.ts；
    - 修改埋点行为时，则集中改动 src/report-event.ts，并补充说明到 README 或该说明文档（如有兼容性风险）。

## 非常规 / 注意事项

- createReportEvent 已被标记为 Deprecated：
  - 说明当前实现主要用于兼容历史逻辑；未来可能迁移到统一 tracer；
  - 新逻辑建议只在确有需要时使用本工具，且做好替换准备。
- EventNames 类型与 REPORT_EVENTS 对象需保持严格同步：
  - 在新增/删除某个 enum 成员时，务必确保：
    - enum 本身的字符串值唯一且稳定；
    - EventNames 联合类型与 REPORT_EVENTS 聚合中都已包含该 enum；
  - 否则容易造成：
    - 运行时能上报但类型中缺失（或反之），影响类型安全或实际埋点效果。
- 避免在本包中直接依赖 React、DOM 或具体页面逻辑：
  - 虽然 devDependencies 中包含 React 等，仅为测试环境需要；
  - 本包目标是「纯 TypeScript 逻辑 + enum 定义」，保证可在任意前端/脚本环境中复用。
