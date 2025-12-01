# @coze-project-ide/base-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/base-adapter）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是 Project IDE 前端的「适配层」工具包，当前主要导出三类能力：项目版本信息 Hook、全局 IDE 上下文桥接、以及通过依赖注入管理的 WebSocket/选项服务。
- 顶层入口为 src/index.ts，仅做命名导出：
  - useCommitVersion：来自本包 hooks 目录。
  - IDEGlobalProvider / useIDEGlobalContext / useIDEGlobalStore：直接从 @coze-project-ide/base-interface 透出，不在本包内实现。
  - OptionsService / WsService：来自本包 services 目录，对外暴露 DI 标识与服务类。
- 数据与依赖边界：
  - 状态与上下文（IDEGlobalProvider 等）由上游 base-interface 维护，本包只负责「转手」出口和少量补充能力。
  - WsService 通过 @coze-project-ide/client 提供的 Emitter，与 IDE 侧 WebSocket/消息总线打通；当前 send/init/onDispose 为占位实现，后续在此集中扩展。
  - OptionsService 把 spaceId / projectId / version / navigate 等运行时环境参数封装为可注入服务，由 inversify 在上层容器中注入具体实现。
- 结构设计上，本包不直接持有 UI 组件或路由，只提供「服务 + Hook + 上下文出口」，便于其他项目-IDE 子包统一消费这些核心适配能力。

## 代码结构与重要文件

- package.json
  - name: "@coze-project-ide/base-adapter"，main: "src/index.ts"。
  - scripts：
    - build: "exit 0"（占位，由上层 Rush/构建体系实际产出）。
    - lint: "eslint ./ --cache"，沿用 monorepo eslint 规则。
    - test: "vitest --run --passWithNoTests"，test:cov 追加 coverage。
  - dependencies：
    - @coze-arch/bot-typings：全局 Bot 类型声明，在 src/global.d.ts 中通过三斜线引用到全局。
    - @coze-project-ide/base-interface：IDE 全局上下文、消息类型等核心接口来源。
    - @coze-project-ide/client：提供 Emitter 等客户端基础设施。
    - inversify：DI 容器基础设施，用于 WsService 中的依赖注入。
    - react-router-dom：OptionsService 中暴露 NavigateFunction，用于上层路由跳转。
- src/index.ts
  - 统一导出 useCommitVersion、OptionsService、WsService，以及从 base-interface 透出的 IDEGlobal* API，是本包唯一对外入口。
- src/hooks/use-commit-version.ts
  - 暴露 useCommitVersion Hook，当前实现为占位：返回 { version: '', patch: () => null }。
  - 上层调用方不应依赖占位实现的具体细节，而应基于类型和后续真实版本信息扩展；修改逻辑时需兼顾 IDE 其他子包的调用方式。
- src/services/options-service.ts
  - 导出 OptionsService symbol 作为 inversify 的注入 token。
  - 定义 OptionsService 接口字段：spaceId、projectId、version、navigate，代表当前 IDE 会话的核心维度及路由能力。
  - 本包仅提供类型与 token，不提供默认实现，由上层容器在实际运行环境中绑定具体 OptionsService 实例。
- src/services/ws-service.ts
  - 使用 @injectable 装饰 WsService，以便被 inversify 管理生命周期。
  - 通过 @inject(OptionsService) 注入 OptionsService，WsService 在内部可访问 spaceId/projectId/version/navigate 等上下文。
  - 内部基于 @coze-project-ide/client.Emitter<WsMessageProps> 建立 onMessageSend 事件流，对外暴露订阅接口。
  - safeParseEvent(payload: string) 提供统一 JSON 解析入口，对解析失败场景只打 console.warn，不抛出异常；上层使用时要考虑 undefined 分支。
  - send/init/onDispose 当前为空实现，是未来 WebSocket 发送/初始化/清理逻辑的集中扩展点。
- src/global.d.ts
  - /// <reference types='@coze-arch/bot-typings' /> 将 Bot 相关类型提升为全局可见，方便本包及依赖本包的其他子包直接使用。
- 配置文件
  - tsconfig.build.json：基于 @coze-arch/ts-config/tsconfig.web.json，针对浏览器环境设置 rootDir=src、outDir=lib-ts，并通过 references 关联 monorepo 内其他 TS 工程。
  - tsconfig.misc.json：用于测试/脚本，extends tsconfig.node.json，target=ES2020，module=CommonJS，包含 vitest.config.ts 与 __tests__ 目录。
  - tsconfig.json：仅作为 project references 汇总（exclude: ["**/*"]，compilerOptions.composite: true），实际编译参照 tsconfig.build.json 与 tsconfig.misc.json。
  - vitest.config.ts：使用 @coze-arch/vitest-config.defineConfig，preset 为 "node"，dirname=__dirname，统一继承集团测试规范。

## 开发与调试工作流

- 依赖与初始化
  - 在仓库根目录执行 rush update 安装依赖（通过 workspace:* 关联 monorepo 内其他包）。
  - 本包本地不需要单独构建步骤，build 脚本为占位；实际构建通常由 Rush 或上层应用统一触发。
- 常用脚本（在 frontend/packages/project-ide/base-adapter 内）
  - npm run lint：按 @coze-arch/eslint-config 要求校验 TS/JS 代码。
  - npm test：运行 vitest 单测，--passWithNoTests 保证即使暂时没有测试也不会在 CI 中立刻失败。
  - npm run test:cov：在上述基础上增加 V8 覆盖率收集。
- 调试与集成建议
  - WsService / OptionsService 依赖 inversify 容器与 @coze-project-ide/client 环境，单独在本包中手工 new WsService 通常无法完整模拟真实场景，应通过上层 IDE 应用中的容器配置进行集成验证。
  - 若只需验证逻辑（例如 safeParseEvent、send 调用参数等），推荐通过 vitest 在 Node preset 下编写单元测试，而不是在浏览器环境中直接挂 demo 页面。

## 项目特有约定与模式

- DI 与服务模式
  - 使用 inversify 的 @injectable / @inject + Symbol token（OptionsService）组织服务，禁止在服务内部直接 new 上下游依赖，保持可替换性与可测试性。
  - 服务类（如 WsService）应保持「无 React 依赖」的纯逻辑层，只通过 OptionsService 暴露的 navigate 做路由跳转。
- 上下文与 Store
  - IDEGlobalProvider / useIDEGlobalContext / useIDEGlobalStore 全部从 @coze-project-ide/base-interface 透出，本包不重新定义 Store 结构或 Recoil/Redux 等状态库。
  - 在本包内新增与 IDE 全局状态相关的能力时，应优先考虑在 base-interface 中扩展类型/上下文，再由本包透出，而不是在本包自建全局状态容器。
- Hook 设计
  - useCommitVersion 当前实现极简，占位返回空版本和空 patch 函数，未来若扩展需保持返回结构的向后兼容（例如继续返回 { version, patch } 形态）。
  - 新增 Hook 时，应放在 src/hooks 下，并在 hooks/index.ts 与 src/index.ts 统一导出，保持公共 API 清晰收敛。
- 类型与全局声明
  - 与 Bot/IDE 相关的广义类型由 @coze-arch/bot-typings 和 base-interface 提供，本包只通过 global.d.ts 引入，不在此处重复声明或 copy 类型。

## 重要外部依赖与集成细节

- @coze-project-ide/base-interface
  - 暴露 IDEGlobalProvider / useIDEGlobalContext / useIDEGlobalStore，以及 WsMessageProps 等与 IDE 运行时强相关的接口。
  - WsService 的事件流类型来自 WsMessageProps，修改该类型时需同步关注本包的编译与对外契约。
- @coze-project-ide/client
  - 提供 Emitter，WsService 内部通过 new Emitter<WsMessageProps>() 构造消息事件流。
  - 目前仅用作内部事件通道，真实 WebSocket 通信逻辑尚未接入；未来扩展时需统一复用 client 中已有的连接/重连/错误处理机制，而非在本包重复造轮子。
- inversify
  - 用于组织可注入服务，依赖容器配置由上层应用承担，本包只负责声明可注入类与 token。
  - 在新增服务类时，保持与 WsService 相同的注解风格，并将 symbol 常量与 interface 一起放在 services/*-service.ts 中，便于统一管理。
- react-router-dom
  - 仅通过 OptionsService.navigate 暴露给服务层使用，不在本包中直接使用 useNavigate Hook 或 Route 组件。

## 项目流程与协作规范

- 代码所有权与评审
  - 遵循仓库根目录下的 CODEOWNERS 配置，frontend/packages/project-ide/base-adapter 的变更通常会路由到 Project IDE 相关负责人审核。
  - 在自动生成/修改文件（例如本说明）时，应避免大规模格式化无关文件，以保持 PR diff 聚焦。
- 分支与 CI
  - 本子包不单独定义发布流程，遵循 monorepo 统一分支/发布策略；CI 中通常会执行 Rush 检查、eslint 与 vitest 测试。
  - 若调整导出项（例如新增/重命名导出 Hook 或服务），需要同步检查依赖 @coze-project-ide/base-adapter 的所有上游包是否编译通过，避免破坏工作区内的 workspace:* 依赖链。

## 特色与注意事项

- 本包当前实现体量很小，部分功能（useCommitVersion、WsService.send/init/onDispose）仍为占位实现，但其导出形态与依赖关系已基本固定，是 Project IDE 侧「适配层」的基础骨架。
- 所有与 IDE 全局状态、WebSocket、路由相关的能力都应通过现有接口（base-interface、client、OptionsService）进行组合，而不是在此包内重新引入新的全局单例或路由/通信框架。
- 在扩展本包时，优先考虑：
  - 保持 src/index.ts 公共 API 收敛；
  - 通过 services + hooks + 透出上游接口的方式扩展能力；
  - 严格遵守现有 DI 与类型约定，避免破坏其他 Project IDE 子包的使用体验。