# @coze-arch/web-context 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/web-context）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是 Coze Studio 前端的「全局上下文层」，为其他应用/包提供统一的：
  - 全局变量读写：通过 Map + Proxy 实现的轻量 KV 存储，避免直接操作 window。
  - 事件总线：基于 eventemitter3 的全局事件中心，支持启动/停止和事件缓存。
  - 导航能力：封装跳转逻辑（location.href），后续可扩展鉴权/埋点等。
  - 业务常量：应用枚举、错误码、社区场景 ID 等。
- 入口文件为 src/index.ts，仅在此文件导出对外 API；新增对外能力时必须在此集中出口，保持公共 API 清晰稳定。
- 业务无关逻辑（事件、变量、导航、常量）应保持纯函数/无副作用，禁止直接依赖具体业务应用（如 apps/*）。

## 目录结构与关键模块

- src/index.ts
  - 聚合导出 redirect、GlobalEventBus、globalVars、COZE_TOKEN_INSUFFICIENT_ERROR_CODE、BaseEnum、SpaceAppEnum、community 相关常量。
  - 如需新增公共 API，请在实现文件内完成单测后，再在此处导出。
- src/global-var.ts
  - 使用 Map + Proxy 实现的通用全局变量仓库：
    - 通过 GlobalVars 接口预声明强约束字段（如 LAST_EXECUTE_ID），其余字段通过 [key: string | symbol]: unknown 扩展。
    - get：不存在的 key 返回 undefined，不抛异常；允许上层自行做空值判断。
    - set：简单写入 Map，不做深拷贝或持久化，不负责响应式。
  - 约定：
    - 仅存放「无需响应式」或「跨应用共享」的轻量状态，例如最近一次执行 ID；禁止滥用为通用状态管理。
    - 新增强类型字段时需同步在 __tests__/global-var.test.ts 中补充用例。
- src/event-bus.ts
  - GlobalEventBus<T>：基于 eventemitter3 的包装类，提供：
    - 静态单例工厂 create(key: string)：同 key 共用同一总线，用于不同模块间共享事件通道。
    - emit/on/off：与标准 EventEmitter3 语义一致，使用泛型 T 约束事件名及参数类型。
    - stop/start/clear：关闭时新事件写入 buffer，start 时顺序回放；clear 清空缓存。
  - 约定：
    - 每个业务域建议使用稳定的 key（如 "app", "community"），禁止在运行时频繁创建无意义 key 以免泄漏。
    - 使用方应在合适时机 off 掉订阅，避免长生命周期对象中的内存泄漏。
- src/location.ts
  - redirect(href: string)：目前是对 window.location 的简单封装；保留未来扩展能力（路由前校验/埋点/白名单）。
  - 约定：
    - 只能从此处发起导航，不要在上层直接写 window.location/History API。
- src/const/*.ts
  - app.ts：BaseEnum、SpaceAppEnum 等空间/应用维度的枚举，作为跨应用统一语义源头。
  - custom.ts：如 COZE_TOKEN_INSUFFICIENT_ERROR_CODE 等全局错误码与特殊常量。
  - community.ts：社区 Bot Store 等特定场景下的默认会话 key/uniqId 等。

## 开发与运行工作流

- 依赖管理
  - 本包通过 rush 管理，package.json 中 runtime 依赖仅限 eventemitter3、lodash-es 等基础库。
  - 新增依赖前应优先复用 workspace 内已有工具包，确需新增时需评估对体积与 tree-shaking 的影响。
- 测试
  - 包内脚本（在此子包目录运行）：
    - npm test：使用 vitest 执行单测（NODE_ENV=test，已配置最大内存参数）。
    - npm run test:cov：在上面基础上开启 coverage。
  - 从前端整体工程运行：
    - rush test --to @coze-arch/web-context
    - rush test:cov --to @coze-arch/web-context
  - 单测文件位于 __tests__ 目录，例如：
    - __tests__/event-bus.test.ts：覆盖 create 单例语义、stop/start 缓存回放、off/unsubscribe 等。
    - __tests__/global-var.test.ts：校验 Proxy 存取、默认 undefined 行为。
    - __tests__/location.test.ts、__tests__/index.test.ts：验证导出与导航封装。
- Lint 与格式
  - 本包遵循 @coze-arch/eslint-config 与 workspace 统一 Prettier 规则：
    - npm run lint：在包内执行 ESLint，开启缓存；也可在仓库根目录通过 rush lint --to @coze-arch/web-context 定向执行。
  - 不要随意改动已有 ESLint 规则；若确有必要，优先在上游共享配置库中处理。
- 构建
  - 当前 package.json 中 build 脚本为 "build": "exit 0"，说明该包暂由上游构建流程统一处理（如 bundler 直接消费 TS）。
  - 不要在本包内引入编译输出目录（如 dist/）；若未来改造为可独立构建包，应与团队确认统一策略。

## 约定与编码风格

- API 设计
  - 所有对外导出必须从 src/index.ts 暴露，禁止从内部路径被调用方直接 import（例如禁止 import '@coze-arch/web-context/src/event-bus'）。
  - 新增功能时应保持「小而精」：
    - 本包只承担「全局上下文」相关的职责（变量、事件、导航、常量）；与具体 UI、网络请求等无关的逻辑才可放入。
  - 命名：
    - 全局变量 key 使用大写 + 下划线（如 LAST_EXECUTE_ID）。
    - 事件总线 key 使用语义化字符串（如 'app', 'workflow'）。
- 类型与安全
  - EventBus 使用泛型接口约束事件：
    - 调用方应显式定义事件接口（例如 interface MyEvents { userLogin: [userId: string]; }），再传入 GlobalEventBus.create<MyEvents>('app')，保证 emit/on 参数一致。
  - globalVars 的扩展字段类型统一为 unknown：
    - 使用方应在读取后立即做 narrowing（如 typeof 检查或自定义类型守卫），不要在不检查的情况下直接断言。
- 副作用与全局状态
  - 禁止在模块顶层读取/写入 globalVars 或发射事件；顶层逻辑仅允许定义类型、常量、类。
  - 所有对 GlobalEventBus/globalVars/redirect 的调用，应位于显式的函数或生命周期内，由上层控制调用时机。

## 重要外部依赖与集成

- eventemitter3
  - 仅在 src/event-bus.ts 中使用，由 GlobalEventBus 对外隐藏具体实现。
  - 不要在其他模块直接依赖 eventemitter3；如确需事件能力，应通过 GlobalEventBus 创建实例。
- lodash-es
  - 目前主要用于生成唯一 ID（例如 community 默认会话 uniqId）。
  - 引入时应按需 import，避免整包导入影响 tree-shaking。
- 内部共享配置
  - @coze-arch/eslint-config、@coze-arch/ts-config：统一 ESLint/TS 规则，禁止在本包内覆盖为自定义版本。
  - vitest + @vitest/coverage-v8：作为默认测试框架；新增测试请遵循现有测试文件组织形式。

## 项目流程与协作规范

- Rush 集成
  - 本包在 config/rush-project.json 与 config/rushx-config.json 中注册：
    - 在根目录使用 rush test/ rush lint --to @coze-arch/web-context 时会按依赖图增量执行。
  - 新增脚本（如本包特有调试命令）时，应先在本包 package.json scripts 中增加，再依据需要在 rushx 配置中暴露别名。
- 分支与提交
  - 遵循仓库统一流程（参见仓库根 README/贡献文档），本包无额外分支策略；
  - 对公共 API 变更（新增/删除/破坏性修改）需在 PR 描述中明确说明影响范围，并考虑下游包的适配。
- 发布与版本
  - version 字段目前为 0.0.1，且通过 workspace:* 方式被其它包依赖；版本与发布由整体仓库流程统一管理，不在本包单独处理。

## 特殊注意事项与坑点

- 避免滥用 globalVars
  - globalVars 仅适合存放「少量关键的跨模块状态」；不可将其当作通用 store 使用（例如存放大对象、频繁变化列表）。
  - 如需响应式或复杂状态管理，应在上层使用专用状态管理方案（Redux/MobX/自研 store 等），本包不负责。
- EventBus 缓存行为
  - stop() 后 emit 的事件会进入 buffer，直至 start() 时回放；
  - 若上层在 stop 期间销毁了监听者而未 off，对应回放可能访问到已失效对象；因此停启策略需由调用方自行设计并配套 off 调用。
- 导航封装未来扩展
  - redirect 目前实现简单，但被设计为统一扩展点；
  - 不要在上层绕过它直接修改 window.location，以免未来接入拦截/统计/安全验证时遗漏场景。
