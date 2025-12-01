# Autosave 子包开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/autosave）中安全、高效地协作开发。

## 1. 全局架构与核心概念

- 本子包是一个 **与 UI 无关的 Zustand 自动保存引擎**，对外只暴露类型与 `AutosaveManager` 类，入口为 [src/index.ts](src/index.ts)。
- 核心由两层组成：
  - **AutosaveManager**（[src/core/manager.ts](src/core/manager.ts)）
    - 持有 `configList`（配置）与 `observerList`（观察者实例），绑定一个 `zustand` store。
    - 负责根据传入的 `registers` 构造观察配置，并在 `start()` 时创建对应的 `AutosaveObserver`。
    - 提供统一的管理能力：注册/重注册、开启/关闭监听、手动保存、禁止自动保存包裹执行、flush 当前或全部保存。
  - **AutosaveObserver**（[src/core/observer.ts](src/core/observer.ts)）
    - 面向单个“业务域/Scope”（以 `key` 标识）的监听器。
    - 通过 `store.subscribe(selector, listener)` 订阅 zustand store 的派生状态；`selector` 支持函数或 `reselect` 的 `createSelector` 形式（带 `deps` + `transformer`）。
    - 使用 `deep-diff` 计算前后状态的 diff，根据 `debounce` 策略（枚举值/函数/对象配置）决定是否立即保存或以 `lodash-es/debounce` 延迟保存。
    - 保存前后会通过 middleware 与生命周期回调（`eventCallBacks`）对数据做统一处理与埋点。
- 类型与配置模型集中在 [src/type/index.ts](src/type/index.ts)：
  - **DebounceTime / DebounceConfig**：统一表达自动保存延时策略，支持：
    - 直接使用枚举（Immediate/Medium/Long）。
    - 返回枚举的函数（按运行时动态决策）。
    - 对象形式，按字段或数组改动类型（新增/删除/编辑）区分 delay。
  - **AutosaveObserverConfig / HostedObserverConfig**：描述单个观察域的配置，`HostedObserverConfig` 是对 `AutosaveObserverConfig` 在 Manager 场景下的精简版本（由 Manager 自动补齐 `saveRequest`、`eventCallBacks` 等）。
  - **SaveRequest / MiddlewareHanderMap / EventCallBacks**：对保存行为及前后处理、错误处理进行抽象，业务只需实现 `SaveRequest` + 可选中间件和事件回调。
- 工具函数在 [src/utils/index.ts](src/utils/index.ts)：
  - `isFunction` / `isObject`：专门针对 `DebounceConfig` 的类型守卫，底层依赖 `lodash-es`。
  - `getPayloadByFormatter`：统一封装“是否存在 formatter/middleware”的判断与调用逻辑，所有保存 payload 生成入口都经由该函数。

## 2. 关键数据流与调用链

- 正常自动保存流程（Observer 驱动）：
  1. 外部通过 `new AutosaveManager({ store, registers, saveRequest, eventCallBacks? })` 初始化。
  2. `manager.start()` 创建每个 `AutosaveObserver`，内部会立即调用 `initSubscribe()`，用 `store.subscribe` 订阅 selector 结果。
  3. Zustand 状态变化 → selector 产出的派生状态变化 → 触发 `AutosaveObserver.subscribeCallback(nextState, prevState)`。
  4. `subscribeCallback` 使用 `deep-diff` 计算 `diff(prevState, nextState)`，若无 diff 或 `lock` 为 true 则直接返回。
  5. 计算触发 delay：`getTriggerDelayTime(prevState, diffChange)` 基于 `debounce` 策略返回等待时间：
     - `undefined/null` → `DebounceTime.Immediate`。
     - 函数 → 执行函数。
     - 对象（含 `default` 和可选字段配置/数组配置）→ 遍历每个 diff path 得到最小 delay。
  6. delay 为 0 或配置 `immediate` 时：直接执行 `parsedSaveFunc()`；否则包装为 `debouncedSaveFunc` 并调用，后续可被 `flush`/`cancel` 控制。
  7. `parsedSaveFunc`：
     - 使用 `getPayloadByFormatter(nextState, middleware?.onBeforeSave)` 生成保存前 payload。
     - 调用 `eventCallBacks?.onBeforeSave({ key, data })`。
     - 执行 `saveRequest(payload, key, diff)`。
     - 再次使用 `getPayloadByFormatter(nextState, middleware?.onAfterSave)` 获取保存后 payload。
     - 调用 `eventCallBacks?.onAfterSave({ key, data })`。
     - 若抛错则触发 `eventCallBacks?.onError({ key, error })`。
- 手动保存与特殊控制：
  - `manager.manualSave(key, params)`：
    - 找到对应 config，按 middleware 与事件回调顺序调用，但 **不会传入 diff（始终为空数组）**，适合命令式保存场景。
  - `manager.handleWithoutAutosave({ key, handler })`：
    - 找出所有同 key 的 observer，将其 `lock = true`，等待 `handler()` 执行完成后再解锁。
    - 适用于批量写入/初始化过程，防止产生无意义的自动保存。
  - `manager.saveFlush(key)` / `manager.saveFlushAll()`：
    - 直接对已构建好的 `debouncedSaveFunc` 调用 `flush()`，强制立刻执行当前延迟中的保存逻辑。
  - `manager.close()`：依次调用各 observer 的 `close()`，其内部会 flush 并取消订阅。

## 3. 测试、构建与调试工作流

- 统一依赖 Rush 管理，此包的本地开发通常先在仓库根目录执行：
  - 初始化依赖：在仓库根目录运行 `rush update`（参考 [README.md](README.md)）。
- 本子包自身的脚本（见 [package.json](package.json)）：
  - `npm run build`：当前实现为 `exit 0` 占位，不产生真实构建产物；发布流程由上层工具链负责。
  - `npm run lint`：运行 [eslint.config.js](eslint.config.js) 中预设为 `web` 的规则，对整个包进行 eslint 检查（带缓存）。
  - `npm run test`：基于 [vitest.config.ts](vitest.config.ts) 的 Vitest 单测，`--run --passWithNoTests` 确保即便无测试文件也不报错。
  - `npm run test:cov`：在 `test` 基础上追加覆盖率统计。
- 测试配置要点：
  - Vitest 配置由 `@coze-arch/vitest-config` 统一封装，只在 [vitest.config.ts](vitest.config.ts) 中指定 `dirname` 和 `preset: 'web'`，并挂载 `setupFiles: ['./setup-vitest.ts']`。
  - [setup-vitest.ts](setup-vitest.ts) 中 `vi.mock('zustand')`，确保单测不会依赖真实 Zustand 行为，而是只验证与 `subscribe`/回调相关的逻辑。
  - 其它基础库如 `lodash-es/debounce` 会在测试中使用 `vi.mock` 或替换为伪实现（详见 [__tests__/core/*.test.ts](__tests__/core)）。
- Storybook：当前存在 Storybook 配置（[.storybook/main.js](.storybook/main.js), [.storybook/preview.js](.storybook/preview.js)），但 README 中的 `npm run dev` 并未在本包定义，Storybook 相关命令大概率通过工作区级/模板级脚本触发，AI 编程助手在本子包范围内 **不要擅自补充 dev/storybook 相关脚本**，以免与 Rush 配置冲突。

## 4. 项目特有的约定与模式

- **类型优先 & 无 UI 依赖**：
  - 主入口 `main`/`types` 都指向 TypeScript 源文件（而非构建产物），说明本子包预期主要被 TypeScript 工程直接消费，构建由上层控制。
  - 代码严格使用泛型参数 `<StoreType, ScopeKey, ScopeStateType>`，不要在公共 API 中收窄类型或引入与具体业务强耦合的类型。
- **Zustand 订阅模式**：
  - 订阅通过自定义 `UseStoreType`（在 [src/type/index.ts](src/type/index.ts) 中声明）统一描述，而不是直接依赖实际的 `zustand` 类型；新增能力时应保持这一“类型 shim”风格，以保持对不同 store 实现的兼容性。
- **去副作用化 & 可测试性**：
  - 所有对外交互（保存、埋点、错误上报）通过 `saveRequest` / `middleware` / `eventCallBacks` 抽象。
  - 新增功能时优先通过增加配置/回调，而不是在 Observer/Manager 内部直接引入网络请求或 UI 依赖。
- **防抖配置语义**：
  - Debounce 的对象形式在 `getTriggerDelayTime` 内有清晰的 path 解析逻辑：
    - 对于数组 path，会返回第一个 key（如 `changePath = ['list', 0, 'title']` → `'list'`）。
    - 若 path 含 number 且 `getdebouncePath` 返回 number，则回退到默认 delay。
  - 修改防抖语义时，需要同步考虑 `getdebouncePath` 与测试用例 [`observer.test.ts`](__tests__/core/observer.test.ts) 的路径判断场景，避免破坏已有契约。
- **日志/调试输出**：
  - 当前 Observer 中大量使用 `console.log`（如 diff、delay、payload）；这些日志是为开发/单测调试准备的，若要改为正式 logger，应走上层 `@coze-arch/logger` 能力，而不是简单删掉。

## 5. 重要依赖与对外集成

- `zustand`：
  - 唯一与状态管理相关的外部依赖，所有逻辑都通过 `UseBoundStore<StoreApi<StoreType>>` 与 `subscribe` 完成，**不在本子包内创建或修改 store**。
- `deep-diff`：
  - 用于比较 `prevState` 和 `nextState`，只关心返回的 `Diff[]` 用于：
    - 判断是否有变更（undefined/空数组直接返回）。
    - 将 diff 透传给 `saveRequest`（自动保存）或忽略（手动保存）。
- `lodash-es`：
  - 使用 `debounce` 实现保存节流；在 Observer 中依赖 `has` 和 `get` 判断指定 path 在 prevState 中是否存在，以及获取 debounce 配置中的对应字段。
  - 开发/修改时优先延续 `lodash-es` 函数式风格，避免自行维护复杂对象遍历逻辑。
- `reselect`：
  - 允许在配置中通过 `{ deps, transformer }` 定义记忆化 selector，减少无效 diff 和保存调用。
- `@coze-arch/*` 系列：
  - `@coze-arch/eslint-config` / `@coze-arch/vitest-config` / `@coze-arch/ts-config` 等均为组织内部统一规范，**不要在本包内手动复制配置**，如需调整规则或测试预设，应优先在这些共享包中处理。

## 6. 过程规范与协作注意事项

- 代码风格：
  - 遵循现有 ESLint 规则与 TypeScript 严格类型约束，避免在公共 API 中使用 `any`（仅已有类型中通过 `FlexibleState<T>` 做了封装）。
  - 不在源文件顶部新增或删除版权头；保持与现有文件一致的 Apache-2.0 版权声明格式。
- 公共 API 变更：
  - `src/index.ts` 导出的内容视为对子包消费者的公开契约：`AutosaveManager`、`DebounceTime`、`EventCallBacks`、`SaveRequest`、`HostedObserverConfig`、`Diff` 类型等。
  - 变更这些导出时必须确保：
    - 不随意重命名或删除已有导出。
    - 若确需扩展，优先通过新增类型/方法而不是修改现有签名。
- 单测约定：
  - 所有新逻辑应优先放入对应的 `__tests__/core` 或 `__tests__/utils` 下，沿用当前使用 `vitest` + `vi.mock` 的风格。
  - 由于默认 mock 掉了 `zustand`，测试中如果需要依赖订阅行为，应仿照现有测试，手动模拟 `subscribe` 并断言回调调用情况。

## 7. 本子包的特别特性

- 这是一个 **可复用的自动保存基础设施组件**，既可以在当前 Studio 项目中使用，也可以在其他基于 Zustand 的项目中复用；因此所有实现都应保持 **业务无关、配置驱动**。
- 构建脚本目前为占位实现（`build: exit 0`），说明真实打包/发布完全由上层 Rush/构建系统接管；AI 编程助手在此包内不应擅自引入 bundler 或改写构建流程。
- 由于大量行为依赖注入（保存函数、middleware、事件回调），在扩展功能时请优先考虑 **通过配置扩展能力** 而不是在核心类中硬编码业务逻辑。