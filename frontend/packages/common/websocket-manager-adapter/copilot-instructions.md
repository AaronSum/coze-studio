# @coze-common/websocket-manager-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/websocket-manager-adapter）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 包名：@coze-common/websocket-manager-adapter，位于 frontend/packages/common/websocket-manager-adapter。
- 当前实现主要是一个「WebSocket 管理器适配层」的接口骨架，尚未接入具体 FWS/WS 实现，用于在各端统一管理长连接：
  - ConnectionOptions：封装业务 biz、service、acceptBiz 等连接参数。
  - Connection：单条逻辑连接抽象，负责事件监听、发送、重连、ping、关闭等生命周期操作。
  - WebSocketManager：管理底层物理 channel 与 Connection 创建的入口，对外默认导出单例。
- 设计目标是让上层业务只依赖统一的 Connection/WebSocketManager 接口，由本包对接具体的 FWS 客户端或浏览器 WebSocket，实现「一处适配，多处复用」。

## 2. 代码结构与职责

- src/index.tsx
  - 导出所有核心类型与类：ConnectionOptions、FrontierEventMap、Connection、WebSocketManager，并默认导出 WebSocketManager 单例。
  - 目前各方法均为空实现，仅定义了 API 形状和注释说明，上层调用方可在不修改签名的前提下填充具体逻辑。
- stories/demo.stories.tsx
  - Storybook 示例仍引用 DemoComponent from '../src'，与当前导出不符，可视为模板残留；未来若在本包补充 UI demo（例如连接状态面板），可改为导出对应组件，否则可以删除该 story 或调整为展示模拟连接的简单组件。
- .storybook/main.js & preview.js
  - 配置为 React + Vite 的 Storybook 环境，附加 vite-plugin-svgr 以支持 SVG 组件化导入。
  - 如后续在本包中增加可视化组件（连接监控面板、日志列表等），可在 stories 目录下增加对应 stories 作调试入口。

## 3. 构建、测试与 Lint 工作流

- 包管理与依赖：
  - 使用 Rush + PNPM 的 workspace:* 依赖模式，devDependencies 统一来自 @coze-arch/* 系列（ts-config、eslint-config、stylelint-config、vitest-config 等）。
  - 开发前在仓库根目录执行 rush update 以安装/更新依赖。
- NPM Scripts（在本子包目录执行）：
  - build：当前为占位实现（"build": "exit 0"），不产生独立构建产物，类型检查与打包由上层构建系统统一负责。
  - lint：npm run lint → eslint ./ --cache，规则由 eslint.config.js 中的 @coze-arch/eslint-config web 预设提供。
  - test：npm test → vitest --run --passWithNoTests，配置在 vitest.config.ts，使用 @coze-arch/vitest-config.defineConfig({ preset: 'web' })。
  - test:cov：npm run test -- --coverage，基于 Vitest 的 v8 覆盖率统计。
- TypeScript 配置：
  - tsconfig.json：作为 composite 入口，仅声明 references 并 exclude 所有文件，编译实际由 tsconfig.build.json / tsconfig.misc.json 驱动。
  - tsconfig.build.json：
    - 继承 @coze-arch/ts-config/tsconfig.web.json，rootDir 为 src，outDir 为 dist，tsBuildInfoFile 为 dist/tsconfig.build.tsbuildinfo。
    - references 指向 arch/bot-typings 与一系列 config 包，支持 TS project references 与增量编译。
  - 后续若引入额外 TS 源文件（如 hooks、adapter 实现），应放在 src 目录下，以便纳入 build 配置。

## 4. 接口语义与实现约定

### 4.1 ConnectionOptions 与事件模型

- ConnectionOptions
  - biz：调用的业务标识，对应消息头中的 'X-Coze-Biz'，上层可以按业务线拆分不同连接。
  - service：发送目标服务 ID，可用于路由到特定后端服务或分片。
  - acceptAllBizMessages（默认 false）：
    - false：onMessage 只接收与当前 biz 或 acceptBiz 匹配的消息。
    - true：onMessage 接收该 channel 上的所有消息，由上层自行过滤。
  - acceptBiz：允许接收的额外 biz 列表；未设置时默认仅接收当前 biz。
  - fwsOptions：透传给底层 FWS/WS 客户端的初始化参数，类型暂为 any，具体结构由实际客户端定义。
- FrontierEventMap
  - 为未来事件类型提供泛型映射占位，目前定义了 error/message/open/close/ack 五类事件，类型均为 any。
  - 后续若接入具体 Frontier/FWS 客户端，可将这些字段细化为严格类型，并在 addEventListener/removeEventListener 中使用 keyof FrontierEventMap 做约束。

### 4.2 Connection 类（单连接抽象）

- 典型职责（需在本包中实现）：
  - 持有当前 ConnectionOptions 与底层 channel 引用（channel 的类型由接入的客户端决定）。
  - getInitConfig / getLaunchConfig：
    - getInitConfig：返回用于初始化 FWS/WS 的配置（如 URL、headers、biz/service 等）。
    - getLaunchConfig：如需要单独的启动参数（如重连策略、心跳间隔），可在此组装。
  - addEventListener(event, listener)：
    - 将监听注册到底层 channel（如 channel.on('message', handler)），并在内部维护一份 listenerMap，便于 removeEventListener 时解除绑定。
    - event 应限制在 FrontierEventMap 已声明的键集合内，必要时可扩展为泛型签名。
  - removeEventListener(event, listener)：
    - 从内部 listenerMap 中移除对应监听器，并调用底层 channel.off / removeEventListener。
  - send(data, options?)：
    - 将业务数据与必要元信息（biz、service 等）打包成底层协议要求的结构，通过 channel 发送。
    - options 可包含是否需要 ack、优先级等扩展字段，具体设计由后续实现补充。
  - reconnect()：
    - 触发单连接重连逻辑：关闭旧连接 → 使用同一 ConnectionOptions 重新建立底层 channel 并重新挂载监听。
  - pingOnce()：
    - 通过底层 channel 主动发送心跳消息（如 ping opcode 或特定 payload），常用于主动检测连接健康。
  - close()：
    - 不直接销毁底层物理 channel，而是通知 WebSocketManager 进行「引用计数 / 共享通道」层面的决策，由管理器决定是否真正关闭。
  - destroy()：
    - 真正释放与该逻辑连接相关的所有资源，包括 listenerMap、计时器以及与 manager 的关联引用。

### 4.3 WebSocketManager（通道管理器）

- 字段：
  - deviceId：预留的设备标识，可用于在 FWS 握手时携带统一 device_id 参数。
  - channel：当前共用的底层通道（如单个 WebSocket/FWS 实例），多个 Connection 可以复用。
- 方法实现建议：
  - createConnection(options: ConnectionOptions): Connection
    - 始终基于当前 manager.channel 创建一个逻辑 Connection 实例。
    - 若 channel 尚未初始化，可在第一次创建时调用 createChannel 初始化默认通道。
  - createChannel(options: ConnectionOptions)
    - 创建新的底层通道实例，不复用现有 channel：
      - 如果当前 channel 存在且仍被其他 Connection 使用，可选择并行存在或延迟关闭，具体策略视后续实现而定。
      - 初始化完成后，将 this.channel 指向新实例，后续 createConnection 默认复用该通道。
- 资源管理模式：
  - 建议在 manager 中维护一个引用计数或 Connection 列表：
    - close() 时减少计数，当计数为 0 时才真正关闭底层 channel。
    - destroy() 时强制从列表中移除并在必要时关闭底层连接，避免内存泄漏。

## 5. 与上游/下游的协作方式

- 下游（使用方）典型用法建议：
  - 创建连接：
    - const conn = WebSocketManager.createConnection({ biz: 'workflow', service: 1, acceptBiz: ['workflow', 'system'] });
  - 注册事件：
    - conn.addEventListener('message', handler);
    - conn.addEventListener('error', onError);
  - 发送消息：
    - conn.send({ type: 'ping' });
  - 关闭：
    - conn.close(); // 通知 manager，按需关闭底层通道。
- 与其它 common 包的关系：
  - 当前 package.json 只依赖 classnames，尚未与 @coze-arch/* 或 @coze-common/* 的运行时代码直接耦合。
  - 未来若需要将连接状态与全局 store、日志系统或埋点系统联动，建议通过各自包的公共 API 接入，不在本包内直接依赖具体实现细节。

## 6. 项目规范与注意事项

- 代码风格与 Lint：
  - eslint.config.js 使用 @coze-arch/eslint-config.defineConfig({ preset: 'web' })，新增代码需遵守统一规则（比如 import 顺序、no-explicit-any 等），当前文件中某些 eslint-disable 仅为临时占位，未来实现时可按需缩减。
- 类型与向后兼容：
  - ConnectionOptions、Connection、WebSocketManager 的方法签名应视为对外 API，在实现时尽量保持不变，如需扩展能力，优先通过可选参数或新增方法而非修改现有参数类型。
  - 若确需破坏性调整，应同步检查所有引用点，并在对应子包的 copilot-instructions 中更新说明。
- Storybook 模板：
  - 目前 stories/demo.stories.tsx 中引用的 DemoComponent 实际不存在，应在正式接入 UI 组件前谨慎使用该 story；AI 在自动重构时可以：
    - 暂时移除 DemoComponent 依赖，或
    - 新增一个简单的占位组件（例如展示当前 manager.deviceId 的 Panel）供调试使用。

## 7. 对 AI 助手的操作建议

- 若实现具体 WebSocket/FWS 逻辑：
  - 先在 src/index.tsx 内补全 Connection 与 WebSocketManager 的实现，遵循上述职责划分与资源管理模式。
  - 根据实际底层客户端（浏览器 WebSocket、FWS SDK 等）抽象出一个轻量的 channel 接口，以便后续在不改动上层调用的前提下更换实现。
- 若需要增加 demo 或测试：
  - 在 stories 目录下新增与 Connection/WebSocketManager 相关的可视化组件 stories，用于展示连接状态与消息流；
  - 在 __tests__ 目录新增基于 vitest + @testing-library/react 的单测，至少覆盖：createConnection 行为、事件注册/移除逻辑、close/destroy 的资源管理语义（可通过模拟 channel 实现）。
- 修改本包导出或对外 API 前：
  - 请在整个 frontend 目录中全局搜索 @coze-common/websocket-manager-adapter 的引用，评估影响范围后再进行重构，保持与其它 common/workflow 包现有模式一致。
