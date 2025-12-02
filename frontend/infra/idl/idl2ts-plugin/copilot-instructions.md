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
