# @coze-common/chat-area-utils 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/utils）中安全、高效地协作开发。

## 1. 全局架构与模块划分
- 本子包是 chat 区域的通用工具库，定位为「纯 TS 工具集」，无 React、无日志系统、无 I18n（见 README.md 与 package.json 描述）。
- 对外统一出口为 index.ts，只暴露经过审慎挑选的工具函数与类型，内部实现全部在 src/ 下按功能拆分：
  - src/async.ts：通用异步工具（sleep、Deferred）。
  - src/collection.ts：集合相关工具（flatMapByKeyList）。
  - src/exhaustive-check.ts：穷尽检查辅助，配合 TS 的 never/Record 用于编译期保障分支完整性。
  - src/get-report-error.ts：把任意 unknown/对象包装为 Error + meta 的通用 error 归一化工具。
  - src/int64.ts：基于 big-integer 的 string 形式 int64 运算/比较工具（排序、加减、diff、范围判断等）。
  - src/json-parse.ts：JSON 解析安全封装，支持结构校验回调与类型收窄（typeSafeJsonParseEnhanced）。
  - src/perform-simple-type-check.ts：简单对象类型检查器，基于 key + 预置校验方法组合（is-string、is-number）。
  - src/rate-limit.ts：请求节流/限频器 RateLimit，封装异步调用排队逻辑。
  - src/safe-async-throw.ts：环境敏感的错误抛出封装（开发/灰度/生产有不同行为）。
  - src/type-helper.ts：类型工具（MakeValueUndefinable）。
  - src/update-only-defined.ts：仅使用非 undefined 字段更新状态（针对 Zustand 这类状态库的专用模式）。
  - src/parse-markdown/parse-markdown-to-text.ts：对 mdast AST 的判型与 markdown → 文本串/链接/图片的序列化。
- 外部类型/AST 结构依赖 mdast（通过 index.ts re-export Root/Link/Image/Text 等），使上层 chat 组件可在 UI 层共享统一的 markdown AST 类型。
- 功能划分原则：
  - 工具应保持「与上层 UI 无关」，仅依赖通用库（lodash-es、big-integer、mdast 等）。
  - 每个文件专注单一职责，入口只输出稳定 API，方便重构内部实现。

## 2. 开发与运行工作流
- 该子包依赖整个 monorepo 的 Rush 管理，常见操作在仓库根目录或 frontend 子树执行：
  - 安装依赖：在仓库根目录执行 `rush update`。
  - 进入本包：`cd frontend/packages/common/chat-area/utils`。
- 本包自身的 npm scripts（见 package.json）：
  - `npm test`：运行 Vitest 单元测试，命令为 `vitest --run --passWithNoTests`，使用 vitest.config.ts 中的 @coze-arch/vitest-config 预设（preset: 'web'）。
  - `npm run test:cov`：在 test 基础上开启覆盖率统计，配合 config/rush-project.json 中对 coverage 目录的输出设定。
  - `npm run lint`：使用 @coze-arch/eslint-config，配置位于 eslint.config.js，preset 为 'web'，沿用 monorepo 通用规则。
  - `npm run build`：当前是 `exit 0` 占位，不做实际构建；真正 TS 编译由 Rush/ts-check 流程驱动（见 tsconfig.build.json 与 config/rush-project.json 中 ts-check 配置）。
- TypeScript 配置：
  - tsconfig.build.json：
    - 继承 @coze-arch/ts-config/tsconfig.web.json，开启 strictNullChecks，rootDir=src，outDir=dist，生成 tsbuildinfo。
    - references 指向多个 arch/config 包的 tsconfig.build.json，以参与 monorepo 增量编译流水线。
  - tsconfig.misc.json：
    - 用于测试与辅助文件（index.ts、__tests__、vitest.config.ts），types 包含 vitest/globals。
  - 顶层 tsconfig.json 只做 references 聚合，不直接参与编译（exclude: ["**/*"]）。
- 单元测试组织：
  - 所有测试位于 __tests__/，按功能一一对应：async.test.ts、int64.test.ts、json-parse.test.ts、rate-limit.test.ts 等。
  - 测试大量使用 vi.useFakeTimers / vi.stubGlobal 检验时间/全局常量相关逻辑，新增工具函数时尽量保持一致做法。

## 3. 项目特有约定与代码风格
- 工具库约束：
  - 不直接依赖 React、不引入全局 logger、不做 I18n 翻译；如果需要日志/文案，由上层业务注入或处理。
  - 输入参数偏向 unknown + runtime type guard，避免在工具内部耦合业务层类型。
- 错误处理与环境常量：
  - safeAsyncThrow.ts：
    - 始终创建 Error(`[chat-area] ${msg}`)，在 IS_DEV_MODE 或 IS_BOE 为真时同步 throw，便于开发环境快速暴露问题。
    - 在其它环境（生产/构建）通过 setTimeout 异步 throw，保证不会在 "离线构建" 环节直接打断流程。
    - 测试通过 vi.stubGlobal 注入 IS_DEV_MODE/IS_BOE/IS_PROD/window 等，新增逻辑时保持该模式，避免直接从真实环境读取。
  - get-report-error.ts：
    - 对 unknown inputError 统一封装为 { error, meta } 形式：
      - Error 实例：error 直接用原对象；meta 只加上 reason。
      - 原始非对象：error 为 new Error(String(inputError))；meta 只含 reason。
      - 对象：error 为 new Error('')，meta 为对象展开 + reason；如对象本身含有 reason 字段，会被转换为 reasonOfInputError，避免覆盖传入 reason。
- 类型与结构校验：
  - perform-simple-type-check.ts：
    - 通过 pairs: [key, checkMethod][] 驱动检查，checkMethod 为 'is-string' | 'is-number'，映射到 lodash-es 的 isString/isNumber。
    - 返回值使用 sth is T 的类型谓词，使调用处在通过校验后可获得强类型 T。
    - 约定：key 必须存在且类型匹配，否则返回 false；不要在这里做深层业务逻辑，只做浅层 shape 校验。
  - exhaustive-check.ts：
    - exhaustiveCheckSimple(_: never) / exhaustiveCheckForRecord(_: Record<string, never>) 用于配合 switch / 对象映射的“穷尽性检查”。
    - 典型用法是在 default 或兜底分支调用，以触发 TS 编译期错误，而运行时代码返回 undefined。
- 集合与状态更新：
  - flatMapByKeyList：
    - 接收 Map<string, T> + key 数组，如果找不到 key，会通过 safeAsyncThrow 异步抛错，同时跳过该 key。
    - 该设计刻意保证“主流程尽可能继续执行”，同时在开发环境显式暴露数据不一致问题。
  - update-only-defined.ts：
    - 使用 lodash-es 的 omitBy + isUndefined 过滤掉所有值为 undefined 的字段后，再调用 updater。
    - 如果过滤后对象为空，则直接返回，不调用 updater，避免误触发 Zustand 等状态库的空更新。
- 命名与注释：
  - 注释中多为中英混合，说明设计背景和 trade-off（例如 RateLimit 的长注释解释为什么不直接用 debounce）。
  - 文件级注释统一携带 Apache-2.0 License 头部。

## 4. 关键模块与外部依赖整合细节
- big-integer in src/int64.ts：
  - 所有入参都以 string 表示 64 位整数，内部通过 bigInt(a/b) 转为高精度整数计算。
  - 对外公开的能力：
    - sortInt64CompareFn：供 Array.prototype.sort 使用的比较函数。
    - getMinMax(...nums: string[]): 返回 { min, max }，无参数时返回 null。
    - getIsDiffWithinRange(a, b, range: number)：比较 |a-b| 是否小于 range。
    - getInt64AbsDifference(a, b)：返回 |a-b| 的 JS number（如超出 number 安全范围，上层需自行处理）。
    - compareInt64(a)：返回 { greaterThan, lesserThan, eq } 闭包对象。
    - compute(a)：返回 { add, subtract, prev, next } 闭包对象，全部返回 string。
- lodash-es：
  - 在多个文件中用于运行时判型与对象处理：
    - get-report-error.ts：isObject。
    - perform-simple-type-check.ts：isObject/isString/isNumber。
    - update-only-defined.ts：omitBy/isUndefined。
    - parse-markdown/parse-markdown-to-text.ts：isObject/isUndefined。
  - 约定：仅使用 lodash-es 中的简单 helper，避免引入复杂链式调用，以保持 tree-shaking 友好。
- mdast / markdown 解析：
  - parse-markdown-to-text.ts 对 AST 做最小封装：
    - getTextFromAst：对 Parent 递归 children，对 Text 直接取 value，对 Link 输出 `[inner](url)`，对 Image 输出 `![alt](url)`，其它类型统一返回空串。
    - parseMarkdownHelper：输出 isParent/isLink/isImage/isText 四个 type guard，用于上层逻辑在处理 mdast 时做判型。
  - 本包不负责从 markdown 源文本解析为 AST，仅假设调用方传入 mdast 兼容节点结构。
- RateLimit in src/rate-limit.ts：
  - 构造函数接受 fn: (...args) => Promise<Ret> 与限流配置 { onLimitDelay, limit, timeWindow }。
  - 调用 invoke(...args)：
    - 先通过 getNewInvokeDelay 计算当前调用应延迟的毫秒数（基于 records 中最近 timeWindow 内调用时间戳数量是否超过 limit）。
    - 若需要延迟，则 await sleep(delay)，之后清理过期 records 并调用真正的 fn。
  - __tests__/rate-limit.test.ts 提供了完整的时序行为示例，是理解该类行为的最佳参考。

## 5. 项目流程与协作规范
- 代码结构与提交：
  - 本包是 Rush 管理下的一个常规包，Rush 相关配置放在 config/rush-project.json 与根级 rush.json 中。
  - 分支/提交策略遵循 monorepo 全局规范（查看仓库根目录的 CONTRIBUTING.md、README.md），本包无需单独定义分支策略。
- 质量保障：
  - 所有新增/修改工具建议增加对应 __tests__ 用例，遵循当前文件命名与测试风格。
  - 由于本包没有真 build 脚本，ts 编译检查依赖 monorepo 的 ts-check 流程，请在 PR 中至少保证本包的 test + lint 通过。
- 兼容性：
  - TS 配置严格（strictNullChecks: true），新增 API 时需保证类型设计与现有风格一致，不要滥用 any；如确有需要，请像 type-helper.ts 中一样用注释解释原因。
  - 环境常量（IS_DEV_MODE / IS_BOE / IS_PROD 等）在本包中只通过全局变量名引用，不负责注入；上层构建工具或运行环境需保证它们存在。

## 6. 为 AI 编程助手提供的具体建议
- 在本包中新增工具函数时：
  - 放在 src/ 下按功能新建文件，或扩展现有最接近的文件；再在 index.ts 中显式导出。
  - 如涉及外部依赖（新库），需要同时更新 package.json 依赖，并考虑是否也需要对应 @types 包。
- 在修改现有工具行为时：
  - 首先阅读对应 __tests__/*，保持已有行为（特别是极端场景）不被破坏；如需调整行为，请同步更新/新增测试明确记录预期。
  - 对涉及环境常量或异步行为（如 safeAsyncThrow、RateLimit）的改动，要配合 Vitest fake timers / stubGlobal 写出可重复的测试。
- 在跨包协作时：
  - 若需要关注 chat 区域整体行为，可在 frontend/apps 或其他使用 @coze-common/chat-area-utils 的包中搜索引用，理解这些工具在真实 UI 中的用法，再回到本包做改动。
