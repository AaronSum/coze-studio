# Copilot 使用说明（@coze-arch/idl2ts-plugin）

本说明用于指导 AI 编程助手在本子包（frontend/infra/idl/idl2ts-plugin）中安全、高效地协作开发。

## 全局架构与角色定位
- 本包是 Coze Studio monorepo 中的一个 **Node/TypeScript 工具类子包**，为 IDL -> TS 生态提供通用的 **插件化 Hook/Program 运行时**，供上层 `idl2ts-generator` 等工具使用。
- 核心源码集中在 `src/` 目录，仅包含三个文件：
  - `src/hooks.ts`：定义阶段枚举 `Phases`、阶段数组 `phases`，以及构造阶段化 hook key 的工具函数 `joinPhases/on/before/after`。
  - `src/program.ts`：实现插件系统核心类 `Program` 与插件接口 `IPlugin`，以及上下文类型 `Args/Ctxs`；提供插件注册、按优先级执行、多阶段（BEFORE/ON/AFTER）触发等能力。
  - `src/index.ts`：简单聚合导出 `hooks.ts` 与 `program.ts`，是包入口（`main: src/index.ts`）。
- 架构上，本包更像一个 **轻量级、阶段化的钩子执行引擎**：
  - 插件通过实现 `IPlugin` 并在 `apply(program)` 中调用 `program.register(...)` 注册钩子。
  - 业务侧维护一个 `Program` 实例，通过 `Program.create([...plugins])` 装配插件列表。
  - 调用 `program.trigger(eventName, ctx)` 时，会按照 `BEFORE -> ON -> AFTER` 三个阶段顺序，对同一事件依次执行所有已注册的 handler，并通过 `priority` 做同阶段内排序。

## 关键类型与数据流
- `Phases` 与 `phases`
  - `Phases` 是字符串枚举：`BEFORE | ON | AFTER`；`phases` 则是其值数组，用于遍历阶段顺序。
- Hook key 约定（见 `src/hooks.ts`）：
  - 所有内部存储与检索用的 key 形式均为：`__<PHASE>__::${hookName}`。
  - `joinPhases(phase, hook)` 负责拼接，`on/before/after` 是其语义化封装：
    - `on('add')` -> `__ON__::add`
    - `before('acc')` -> `__BEFORE__::acc`
    - `after('acc')` -> `__AFTER__::acc`
- `Program` 类核心结构（见 `src/program.ts`）：
  - `hooks: string[]`：已知 **原始 hook 名（不带阶段前缀）** 列表，用于 `trigger` 时校验。
  - `phases: Phases[]`：本地阶段顺序数组，当前固定为 `[BEFORE, ON, AFTER]`。
  - `handlers: { [event: string]: { handler, priority }[] }`：按 **完整事件 key**（形如 `__ON__::add`）存储回调与优先级。
  - 通过 `loadPlugins(plugins: IPlugin[])` 统一装载插件，内部仅仅调用 `plugin.apply(this)`。
- `register` 数据流：
  - 参数 `event` 必须是 `__ON__::xxx` / `__BEFORE__::xxx` / `__AFTER__::xxx` 形态的字符串；
  - 首次注册某个事件时，会用正则 `/__(ON|BEFORE|AFTER)__::(\S+)/` 解析出 hook 名 `res[2]`，并在 `this.hooks` 中追加；若解析失败会抛错：`unknown hook must be one of ...`；
  - 对同一 `event`，`handlers[event]` 中会累积多个 `{ handler, priority }`；
  - 注册时 `priority` 缺省为 `1`，数值越小优先级越高。
- `trigger` 数据流：
  - 调用方式：`program.trigger('add', { count: 0 })`；
  - 会先在 `this.hooks` 里检查是否存在该 `event` 名（不带阶段前缀），否则直接抛错；
  - 然后按 `this.phases` 顺序，通过 `joinPhases(phase, event)` 拼出各阶段完整 key，并依次调用 `applyEvent`；
  - 最终返回经过所有阶段与所有 handler 处理后的 `args` 对象（同一个引用被不断修改并回传）。

## 测试、构建与常用命令
- 本包使用 Rush + workspace 管理依赖：
  - 安装依赖：在 monorepo 根目录执行 `rush update`。
- `package.json` 中定义的脚本：
  - `npm run build`：当前配置为 `exit 0`，即 **不做实际打包构建**；编译一般由 Rush 统一驱动，或通过上层任务执行。
  - `npm run lint`：调用 `eslint ./ --cache`，配置来自根共享包 `@coze-arch/eslint-config`，本包在 `eslint.config.js` 中进一步关闭部分规则（如命名规范、文件名大小写、`any` 等）。
  - `npm run test`：`vitest --run --passWithNoTests`，测试配置来自 `vitest.config.ts` 中的 `@coze-arch/vitest-config`；
  - `npm run test:cov`：在 `npm run test` 基础上追加 `--coverage`。
- 本包已有一个核心测试文件 `__tests__/plugin.test.ts`，覆盖了：
  - 插件加载与 `Program.create([...plugins])`；
  - `priority` 的排序行为（`priority` 值越小越早执行，但由于多个 handler 会依序覆盖 ctx，最终结果是后执行者的值生效）；
  - 阶段执行顺序 `before -> on -> after` 的串联效果；
  - `loadPlugins` 的二次加载场景；
  - 未注册 hook 时 `trigger` 抛错行为。
- AI 助手在新增/修改逻辑后，应优先：
  - 为新行为增加/更新 Vitest 单元测试到 `__tests__` 目录；
  - 使用 `npm run test` 在子包目录内运行快速校验。

## 项目特有约定与模式
- 插件/Hook 命名与 key 协议：
  - **事件名使用业务向的短字符串**（如 `add`、`reduce`、`acc`），统一由 `on/before/after` 工具函数转换成内部 key，禁止手写 `__ON__::xxx` 常量以避免格式不一致；
  - 所有事件必须先通过某一阶段注册后才能被触发，否则 `trigger` 会抛出“unknown hook must be one of ...”错误——这是刻意的运行时防御逻辑。
- 优先级语义：
  - `register(event, handler, priority)` 的 `priority` 越小优先级越高；
  - 但从 `plugin.test.ts` 中可以看出，多个 handler 被顺序执行，**后执行者的返回值会覆盖之前 handler 对 ctx 的修改**，因此在设计插件时应清晰区分“先默认填充、后覆盖”的职责；
  - 若需要“严格先后且互不覆盖”的语义，可以在 ctx 中使用不同字段或保持幂等修改。
- Phases 的扩展性：
  - 当前阶段固定为 `BEFORE/ON/AFTER`，但 `phases` 是一个数组属性，理论上后续可以在 `Program` 内扩展；
  - 若 AI 需要调整阶段顺序或新增阶段，应同步更新：`Phases` 枚举、`phases` 数组与 `joinPhases` 的使用，同时注意对现有测试的影响。
- 类型约定：
  - `Program<C extends Ctxs = any>` 允许传入一个 **键为事件名、值为该事件上下文类型** 的映射：
    - 如测试中定义：`interface Hook extends Ctxs { add: Ctx; reduce: Ctx; acc: { text: string } }`；
    - 则 `Program<Hook>` 的 `register` 与 `trigger` 在 TS 层面都能拿到更精确的 ctx 类型；
  - 当前实现中对泛型与 `any` 的使用比较宽松（例如 `Program<C extends Ctxs = any>`、`IPlugin<T extends Args = any>`），并通过 ESLint 规则关闭避免噪音；AI 修改时保持这一取舍，不要贸然收紧类型导致与已有调用不兼容。

## 与外部配置/依赖的集成
- ESLint：
  - `eslint.config.js` 通过 `@coze-arch/eslint-config` 的 `defineConfig` 统一加载 monorepo 级别配置，并指定 `preset: 'node'`；
  - 本包额外关闭了一些规则（命名、文件名大小写、`no-explicit-any`、单函数行数等），说明本包对简洁实现与实验性类型较宽容，AI 不必强行重构为“完全无 any”。
- TypeScript 配置：
  - `tsconfig.build.json` 继承自 `@coze-arch/ts-config/tsconfig.node.json`，目标环境为 `CommonJS + ES2020`，`rootDir: src`、`outDir: dist`；
  - 根 `tsconfig.json` 采用复合项目设定（`composite: true`），并通过 `references` 关联到 build/misc 配置，确保与 Rush 的增量编译流程兼容；
  - AI 在添加新 TS 文件时，应放在 `src/` 下，并保证不引入浏览器特有 API（preset 为 node）。
- Vitest：
  - `vitest.config.ts` 使用 `@coze-arch/vitest-config` 的 `defineConfig({ dirname: __dirname, preset: 'node' })`；
  - 测试默认以 Node 环境运行，如需对某些 case 使用特殊环境，应在测试文件中显式配置（遵循上游 vitest-config 能力）。

## 开发流程与协作规范
- 分支与提交规范在 monorepo 顶层（如 `CONTRIBUTING.md`、Rush 配置）中统一管理，本包遵循整体策略：
  - 建议在修改前确认是否有相关上游包（如 `idl2ts-generator`）的调用约束；
  - 新增/修改导出 API 时，保持 `src/index.ts` 为唯一出口，避免在外部通过相对路径访问内部文件。
- 典型本地开发步骤（对子包视角）：
  - 在 repo 根目录执行 `rush update` 安装依赖；
  - 进入本包目录 `frontend/infra/idl/idl2ts-plugin`：
    - 运行 `npm run lint` 确保风格一致；
    - 运行 `npm run test` 或在 monorepo 级别运行统一测试任务；
  - 仅在需要排查 Hook 执行顺序或复杂插件组合时，建议新增单元测试而不是写临时脚本。

## 对 AI 编程助手的具体建议
- 在本包中进行改动时，优先关注以下文件：
  - 核心逻辑：`src/hooks.ts`、`src/program.ts`；
  - 公共导出：`src/index.ts`；
  - 现有行为验证：`__tests__/plugin.test.ts`；
  - 工程配置：`package.json`、`eslint.config.js`、`tsconfig*.json`、`vitest.config.ts`。
- 修改/扩展建议：
  - 如需新增 Hook 阶段或改变执行顺序，一定要同步更新测试，并确认向后兼容性（特别是事件 key 约定和 `this.hooks` 的校验逻辑）。
  - 如需扩展 `Program` 功能（例如增加异步 handler 支持、错误捕获策略、取消机制等），务必在保持现有同步 API 不变的前提下向后兼容，或通过新增方法/配置暴露新行为，而不是修改现有方法签名。
  - 若为上层 IDL 工具添加新插件示例，可以在 `__tests__` 中参照现有 `AddPlugin/ReducePlugin` 的写法构造更贴近业务的 case，以文档化该运行时的用法。
