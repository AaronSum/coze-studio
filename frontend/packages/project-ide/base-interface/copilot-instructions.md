# @coze-project-ide/base-interface 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/base-interface）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 位置：frontend/packages/project-ide/base-interface。
- 包名：@coze-project-ide/base-interface，main 指向 src/index.ts。
- 角色：ProjectIDE 体系中的「基础接口与全局状态定义层」，对上游暴露统一的 IDE 全局 Store/Context 以及与工作流 Bot 相关的 WsMessage 类型。
- 上游主要使用方：
  - @coze-project-ide/base-adapter（通过本包透出 IDEGlobal* 能力和 WsMessageProps）。
  - @coze-project-ide/framework（从 base-adapter 再次转出 WsMessageProps 与 IDE 全局状态）。
  - 其他 ProjectIDE 业务包（biz-workflow、main 等）往往通过 framework 侧间接依赖本包的类型。

## 2. 代码结构与架构分层
- 顶层文件：
  - src/index.ts：对外导出 IDEGlobalProvider / useIDEGlobalContext / useIDEGlobalStore、以及 WsMessageProps 类型，是包的唯一公共入口。
  - src/global.d.ts：全局类型声明入口，引入 @coze-arch/bot-typings，保证 Bot/Workflow 相关的全局类型在消费方可用。
- 子目录：
  - src/context/：
    - index.ts：二次导出 IDEGlobalProvider / useIDEGlobalContext / useIDEGlobalStore，实际实现位于 provider.ts。
    - provider.ts（未在本说明展开，需阅读此文件以理解 Store 结构和 zustand 使用方式）：封装 React Context + zustand store，将 IDE 全局状态（项目、空间、布局、运行时信息等）集中管理，并提供 Hook 访问。
  - src/types/：
    - index.ts：定义并导出 WsMessageProps，内部引用 @coze-arch/bot-api/workflow_api 中的 MessageOperateType、MessageBizType，作为 IDE 与工作流/Agent 之间消息总线的统一载体类型。
- 架构意图：
  - 将「IDE 全局上下文」和「跨窗口/流程的消息类型」收敛在一个最下游的纯接口层，保证：
    - 上层 UI/业务包不直接依赖 bot-api、bot-typings，而是通过 base-interface 取得稳定的抽象；
    - 变更 workflow_api 或全局 Store 结构时，可以在本包集中处理，减少上游破坏性改动。

## 3. 与外部模块的依赖与数据流
- 对外导出：
  - IDEGlobalProvider / useIDEGlobalContext / useIDEGlobalStore
    - 典型用法：
      - 在 IDE Shell 根节点包裹 <IDEGlobalProvider>，向下游各业务模块提供统一的全局状态。
      - 下游通过 useIDEGlobalContext / useIDEGlobalStore 读取或更新当前 ProjectIDE 的项目 id、空间 id、当前模式、会话信息等（实际字段以 provider.ts 中定义为准）。
  - type WsMessageProps
    - 字段：resId、extra、saveVersion?、operateType、bizType。
    - operateType / bizType：由 @coze-arch/bot-api/workflow_api 中的 MessageOperateType、MessageBizType 决定，是前后端/窗口间消息分发的统一枚举。
    - 主要使用场景：
      - @coze-project-ide/framework 中的 WebSocket/消息事件服务；
      - biz-workflow、workflow/playground 等对工作流执行事件的监听与转发。
- 对外全局类型：
  - src/global.d.ts 通过 /// <reference types='@coze-arch/bot-typings' /> 引入 Bot 相关全局类型，避免在每个消费包单独安装/引用此依赖。
- 数据流大致路径：
  - 用户操作 / IDE 事件 → IDEGlobalStore 更新（如当前项目/工作流状态）→ 通过 WsMessageProps 封装消息 → 由 framework/client 层的 WebSocket 或 EventService 向后端/其他窗口广播。

## 4. 开发与构建测试流程
- 本包脚本（package.json）：
  - build："exit 0" —— 当前不做单独构建，依赖 TS 引用和消费方的构建流程；不要在本包期望生成独立产物。
  - lint："eslint ./ --cache" —— 依赖根级 Rush 和 @coze-arch/eslint-config。
  - test："vitest --run --passWithNoTests" —— 使用 @coze-arch/vitest-config 作为测试配置基础。
  - test:cov：在 test 基础上打开 coverage。
- 在 monorepo 中常见用法：
  - 仅针对本包运行测试/检查：
    - 在 frontend/ 根目录：
      - 使用 Rush：`rushx test --to @coze-project-ide/base-interface`（具体脚本名需参照 rushx-config）。
      - 直接 npm：`cd frontend/packages/project-ide/base-interface && npm test`。
  - 安装依赖：
    - 在仓库根目录执行 `rush install` / `rush update`，不在子包单独执行 pnpm 命令。
- 注意：
  - 构建产物（lib-ts 等）由 TS references 体系和上层应用构建链路统一处理，本包的 build 脚本目前仅占位，不要擅自改为实际打包命令，除非同步评估所有引用路径。

## 5. 代码风格与约定
- TypeScript/React：
  - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，启用 strictNullChecks、isolatedModules 等。
  - JSX："jsx": "react"，types 中显式包含 react，适合 React 18 函数组件/Hook 写法。
- Store/状态管理：
  - package.json 依赖 zustand，说明 IDEGlobalStore 很可能基于 zustand 创建；
  - 在新增/调整全局状态时：
    - 首先修改 src/context/provider.ts 中的 Store 结构和操作 API；
    - 通过 useIDEGlobalStore 暴露给下游，而不是在消费包重新创建全局 Store。
- 类型来源与收敛：
  - 涉及 Bot/Workflow 业务类型：优先使用 @coze-arch/bot-api、@coze-arch/bot-typings 中已有定义，通过本包统一转出（如 WsMessageProps）。
  - 避免在上游包重复定义 MessageOperateType/MessageBizType 等枚举或复制字段，变更应优先在 base-interface/types 中集中。

## 6. 与其他 ProjectIDE 子包的协作关系
- 下游强依赖链：
  - @coze-project-ide/base-adapter：
    - 说明文档中明确「IDEGlobalProvider / useIDEGlobalContext / useIDEGlobalStore：直接从 @coze-project-ide/base-interface 透出」，因此任何对本包导出名或行为的破坏性修改都会影响 base-adapter 及 framework、main 等。
  - @coze-project-ide/framework：
    - tsconfig.build.json 中直接引用 ../base-interface/tsconfig.build.json，意味着 framework 在 TS 构建上依赖本包；
    - src/types/index.ts 中从本包 re-export WsMessageProps，供业务包统一使用。
- 变更原则：
  - 若需修改 IDEGlobalProvider/useIDEGlobal* 的签名或行为：
    - 同步检查 base-adapter、framework、ui-adapter、main、biz-* 等包对这些 Hook 的调用；
    - 优先通过向 Store 中新增字段/方法而非重命名现有字段来保持向后兼容。
  - 若需调整 WsMessageProps：
    - 需确认后端（workflow_api）与前端 workflow/playground、biz-workflow 的消费逻辑；
    - 优先新增字段并保持原字段语义不变，必要时在 README 与相关 Copilot 指南中更新描述。

## 7. 常见扩展场景与建议操作
- 新增全局状态字段（例如当前编辑模式、选中资源信息等）：
  - 在 src/context/provider.ts 中扩展 zustand Store state/interface；
  - 在 IDEGlobalContext 中加入对应字段/方法；
  - 通过 useIDEGlobalStore/useIDEGlobalContext 暴露给上游；
  - 若上游已有依赖（如 framework 的 Hook 使用某字段），确保默认值与初始行为向后兼容。
- 扩展消息类型（WsMessageProps）：
  - 若需要携带更多业务标识（如 workspaceId、traceId 等）：
    - 优先在 WsMessageProps 上新增可选字段；
    - 如与后端接口强绑定，需同步更新 @coze-arch/bot-api/workflow_api，并评估所有以 WsMessageProps 消费的调用链。
- 引入新的 Bot/Workflow 类型：
  - 在 @coze-arch/bot-typings 或 bot-api 中补充类型定义；
  - 通过 global.d.ts 或 src/types 进行集中导出，让消费方不必直接依赖这些底层包。

## 8. 提交与评审注意事项
- 变更前检查：
  - 搜索全仓库对 IDEGlobalProvider/useIDEGlobal*/WsMessageProps 的引用，确认修改影响范围。
  - 对跨包接口（尤其是本包暴露的导出）避免随意重命名或删除，优先采用向后兼容的扩展方式。
- 本包体量较小，但处于 ProjectIDE 类型与全局状态的「核心底座」位置：
  - 任意看似微小的字段变更，都可能在 IDE/工作流 UI 的多个模块中产生连锁影响；
  - 在大型变更前建议先在本包和直接依赖包（base-adapter、framework）范围内增补最小单元测试，再进行集成验证。
