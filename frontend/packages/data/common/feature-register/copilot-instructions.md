# @coze-data/feature-register 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/common/feature-register）中安全、高效地协作开发。

## 1. 全局架构与职责划分

- 子包定位：提供一个可观察、可扩展的“特性注册器”（Feature Registry）基础设施，用于按类型动态注册、加载和获取模块（通常是 React 组件或业务处理模块），并支持按上下文、标签等维度查询。
- 核心模块：
  - src/external-store.ts：基于 immer 和 React DOM 的 batched updates 实现的通用 ExternalStore 抽象，提供可订阅的状态容器。
  - src/feature-registry-manager.ts：维护一组 FeatureRegistry 实例的管理器，方便在开发环境中调试和集中管理所有 registry。
  - src/index.ts：导出 FeatureRegistry 类及相关类型，是真正的“特性注册器”实现，也是主要的公共 API 入口。
  - src/react.ts：针对实现了 IExternalStore 的任意 registry，提供 useRegistryState React Hook 以在组件中订阅状态。
- 状态流转：
  - FeatureRegistry 继承 ExternalStore，内部以 Map 存储特性配置（type → FeatureConfig），通过 _produce 包装的 immer produce 更新状态，并在状态变更时批量通知订阅者。
  - React 组件侧使用 useRegistryState 订阅 registry 状态，结合上层业务逻辑渲染 UI。
- 设计动机：
  - 将“类型到模块”的映射、按需动态加载（loader）、按上下文解析类型（featureTypeParser）等能力集中封装，避免在各业务模块中重复实现 registry/路由型逻辑。
  - 使用 ExternalStore + use-sync-external-store 适配 React 18 的并发模型，保证订阅更新的一致性和性能。

## 2. 核心类型与关键 API

### 2.1 公共类型（src/index.ts）

- FeatureConfig<Type, Module>
  - 字段：type（必填）、module（可选）、loader（异步加载）、tags（标签列表）。
  - 语义：单个特性的声明；可以只提供 loader，通过 load / getAsync 在首次访问时动态加载。
- DefaultFeatureConfig<Type, Module>
  - 在 FeatureConfig 基础上强制包含 module，用于默认特性。
- FeatureTypeParser<Type, Context>
  - (context: Context) => Type | string
  - 用于从上下文（如消息、事件、路由信息）解析出特性 type。
- FeatureRegistryConfig<Type, Module, Context>
  - name：registry 的唯一名称，用于错误日志和 key 生成。
  - defaultFeature：默认特性配置，可选。
  - features：静态注册的一组特性。
  - featureTypeParser：上下文→type 解析函数，可选。

### 2.2 FeatureRegistry 核心方法

- 构造与基础
  - new FeatureRegistry(config)：根据 FeatureRegistryConfig 初始化 registry；在开发模式下会自动注册到 featureRegistryManager 便于调试。
  - getName()：获取当前 registry 名称。
- 注册与反注册
  - register(feature: FeatureConfig) ⇒ Disposer
    - 注册单个特性，返回用于撤销注册的函数；
    - 若 type 与默认特性相同或已注册，会通过 @coze-arch/logger 输出错误/警告而不中断运行。
  - registerSome(features: FeatureConfig[]) ⇒ Disposer
    - 批量注册；返回的 Disposer 会批量撤销这些特性。
  - deregister(type)：移除指定 type 的特性（禁止移除默认特性）。
  - deregisterSome(types[]) / deregisterAll()：批量移除或清空。
  - deregisterByTag(tag)：按 tag 移除所有包含该标签的特性。
- 加载与获取
  - load(type)：如果特性存在且配置了 loader，会调用 loader 加载模块，并写回 feature.module。
  - isLoaded(type)：判定特性是否已加载（即 module 是否存在）。
  - has(type)：只判断特性是否存在（不关心是否已加载）。
  - getModule(type)：返回模块 module；不存在或未设置时记录错误并返回 undefined。
  - get(type)：返回带 type 字段的模块（FeatureModule），方便作为“带类型的组件”；已标注 Deprecated，新增代码应优先使用 getModule。
  - getAsync(type)：若未加载则先 load，再通过 get 返回 FeatureModule。
  - entries()：返回所有已加载模块的 [type, module] 数组；未加载的特性会被过滤并输出 warning。
  - getAllAsync()：对所有特性执行 getAsync，返回已成功获取的 FeatureModule 数组。
- 上下文与标签查询
  - setFeatureTypeParser(parser)：设置 featureTypeParser；内部 this 上会暴露 internalHas(type) 以便解析逻辑查询“当前是否已注册该类型”。
  - getTypeByContext(context)：调用 featureTypeParser(context) 获取 type；解析异常或未设置时回退到默认类型并记录错误。
  - getByContext(context)：基于 getTypeByContext → get。
  - getByContextAsync(context)：基于 getTypeByContext → getAsync。
  - getByTag(tag) / getByTagAsync(tag)：按标签查询特性列表并返回对应模块，未加载模块会触发 warning 并被过滤。
- 默认特性
  - setDefaultFeature(feature)：设置默认特性并注入到 featureMap 中；默认特性不能被 deregister / deregisterByTag 移除。
  - getDefault()：返回 DefaultFeatureConfig 对应的 FeatureModule（包含 type 与 module 展开字段）。
  - getDefaultType()：返回默认特性 type。

### 2.3 ExternalStore 抽象（src/external-store.ts）

- 结构：
  - 泛型 T 表示内部状态类型；子类需实现 protected _state: T。
  - 内部维护 _listeners: Set<() => void>。
- 关键方法：
  - _produce(recipe)：封装 immer.produce；只有 newState !== _state 时才触发 _dispatch。
  - _dispatch()：使用 react-dom 的 unstable_batchedUpdates 批量执行订阅回调，避免多次渲染。
  - subscribe(onStoreChange)：添加监听并返回取消订阅函数。
  - getSnapshot()：获取当前 state；配合 useSyncExternalStore 使用。

### 2.4 React 集成（src/react.ts）

- useRegistryState<T>(registry: IExternalStore<T>)：
  - 内部通过 useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot) 订阅状态；
  - 用于在 React 组件中以 Hook 方式监听 FeatureRegistryManager 或其他 ExternalStore 子类的状态。

### 2.5 FeatureRegistryManager（src/feature-registry-manager.ts）

- 管理对象：Set<FeatureRegistry<any, any, any>>，用于集中记录当前存在的所有 registry。
- 方法：
  - add(registry)：加入集合；
  - delete(registry)：从集合移除。
- 用途：
  - 主要用于开发/调试场景，例如在 DevTools 中统一查看当前所有 FeatureRegistry 的情况；非功能必需，但新增 FeatureRegistry 时构造函数会在开发模式下自动登记。

## 3. 构建、测试与开发工作流

- 包管理与初始化（在仓库根目录）：
  - 使用 Rush + pnpm 管理；初始化依赖：rush update。
- 子包级别脚本（frontend/packages/data/common/feature-register）：
  - 构建：npm run build（目前脚本为 exit 0，多作为模板存在，真正打包通常由上层工具或构建流水线处理）。
  - 测试：npm test 或 npm run test（底层使用 vitest，配置见 vitest.config.ts）。
  - 覆盖率：npm run test:cov。
  - Lint：npm run lint。
- 测试配置（vitest.config.ts）：
  - 使用 @coze-arch/vitest-config.defineConfig，preset: 'web'，dirname: __dirname；
  - 遵循统一 Web FE 测试预设（jsdom、别名配置等由上层 preset 提供）。
- Storybook（组件展示 & 手动调试）：
  - 配置文件：.storybook/main.js 与 .storybook/preview.js。
  - 使用 @storybook/react-vite + vite-plugin-svgr；支持 mdx 与 TSX stories（stories/**/*.mdx, stories/**/*.stories.tsx）。
  - 具体启动命令需参考 frontend 层级的 Storybook 统一脚本（例如 rushx storybook 或 apps 级脚本），本包自身未定义 storybook 脚本。

## 4. 代码风格与项目约定

- TypeScript 与 ESLint：
  - eslint.config.js 与 @coze-arch/eslint-config 统一规则；
  - 显式禁用 @typescript-eslint/naming-convention 等部分规则以适应现有命名（如 FeatureRegistry 的泛型及内部字段）。
- 状态管理约定：
  - 所有带订阅能力的状态容器均建议继承 ExternalStore，并通过 _produce 更新；
  - 状态类型中允许使用 Map/Set，已经在 ExternalStore 构造函数中通过 enableMapSet() 统一开启 immer 支持。
- 日志记录：
  - 统一使用 @coze-arch/logger 输出错误和警告；
  - 特性不存在、重复注册、试图操作默认特性、模块未加载等情况都会记录日志而不是直接抛异常，以保证运行时稳健性。
- 模块获取规范：
  - 新代码应优先使用 getModule / getAsync，而非已标记 Deprecated 的 get；
  - 当需要获取“带 type 字段的模块”时，可以基于 getModule 自行包装。
- 默认特性保护规则：
  - 默认特性一旦设置，将同时存在于 featureMap 中，且不能通过 deregister / deregisterByTag / deregisterSome / deregisterAll 误删（内部有显式防护和错误日志）。

## 5. 与外部依赖的集成细节

- immer：
  - 仅通过 ExternalStore._produce 使用，禁止在外部直接对 _state 做可变操作；
  - FeatureRegistry 在操作 featureMap 时使用 castDraft 确保 Map 与 immer 的 Draft 类型兼容。
- react / react-dom / use-sync-external-store：
  - ExternalStore 通过 unstable_batchedUpdates 避免多次重渲染；
  - React 组件通过 useRegistryState 订阅 IExternalStore<T>，支持 SSR/Fallback 快照。
- type-fest：
  - 在 entries() 中使用 SetRequired 增强类型推导，确保过滤掉 module 为空的特性后，后续 module 访问为非可选。
- @coze-arch 内部依赖：
  - @coze-arch/logger：统一日志入口；
  - @coze-arch/vitest-config：统一 Vitest 预设；
  - 其他如 @coze-arch/ts-config, @coze-arch/eslint-config, @coze-arch/stylelint-config 仅用于构建与规范，不影响运行时行为。

## 6. 开发流程与协作规范

- 分支策略与提交规范：
  - 具体分支/提交规范在仓库根目录（如 CONTRIBUTING.md、Git hooks）中定义，本子包遵循全局规范即可；本目录无额外自定义规则。
- 新增 FeatureRegistry 的建议步骤：
  - 定义清晰的 Type（联合枚举或字符串字面量类型），以及 Module 类型（通常为 React 组件或包含组件的对象）。
  - 在上层业务模块中实例化 FeatureRegistry，并根据业务场景选择：
    - 通过 features 静态注册所有必需特性；
    - 或仅注册 loader，在首次使用时按需加载模块。
  - 根据需要实现 featureTypeParser：
    - 合理使用内部暴露的 internalHas(type) 判断某种 type 是否已注册；
    - 确保在异常或不匹配场景下有清晰的回退策略（通常是默认特性）。
- 调试与排障：
  - 通过日志（@coze-arch/logger）快速定位“未注册特性”、“未加载模块”、“错误的默认类型”等问题；
  - 在开发环境中可以借助 featureRegistryManager 中的集合，统一查看当前存在的 FeatureRegistry 实例及其内部 state。

## 7. 非常规 / 需要特别注意的点

- IS_DEV_MODE：
  - FeatureRegistry 构造函数中使用了全局的 IS_DEV_MODE 变量以决定是否向 featureRegistryManager 注册；
  - 在修改或在新环境中复用该包时，需要确保构建链路中定义了该全局变量（通常由上层构建配置通过 define 注入）。
- Map 状态与序列化：
  - featureMap 使用 Map 存储；如需将 FeatureRegistry 状态持久化或跨进程传输，需要自行将 Map 转换为普通对象或数组。
- Deprecated API：
  - get() 已明确标记 @Deprecated；AI 助手在生成新代码时应避免使用，并在维护旧调用点时谨慎迁移（确保调用方确实依赖 type 字段）。
- 标签与批量操作：
  - deregisterByTag / getByTag / getByTagAsync 假设 tags 字段为稀疏使用；
  - 若上层大量依赖标签批量操作，应注意避免在运行时频繁添加/删除大量特性导致 Map 持续重建（仍然通过 immer 处理，但可能有性能影响）。

## 8. AI 助手在本包中工作的具体建议

- 修改或扩展 FeatureRegistry 行为时：
  - 优先通过新增方法或组合使用现有 API 实现需求，避免直接暴露或修改内部 _state；
  - 保持错误处理方式与现有逻辑一致：记录日志而非随意抛错。
- 在其他子包中使用本包时：
  - 始终通过公共入口 src/index.ts（包名 @coze-data/feature-register）导入类型和 FeatureRegistry；
  - 若需要 React 集成，使用 src/react.ts 暴露的 useRegistryState Hook 订阅任意 ExternalStore 实例。
- 自动重构与类型推导：
  - 保持泛型参数顺序一致（Type, Module, Context），避免在跨文件重构时误置顺序导致类型错误；
  - 在增加新方法时，尽量复用 FeatureConfig / DefaultFeatureConfig / FeatureModule 等既有类型，保证 API 一致性。
