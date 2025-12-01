# @coze-workflow/test-run-next 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/test-run-next/main）中安全、高效地协作开发。

## 1. 子包定位与整体角色

- 本子包 package.json 名称为 `@coze-workflow/test-run-next`，位于 [frontend/packages/workflow/test-run-next/main](frontend/packages/workflow/test-run-next/main)。
- 从目录名和上层 `workflow` 结构推断：该子包主要用于「工作流」相关的“测试运行 / 试跑（test-run）”场景，通常承担：
  - 提供前端 UI，用于在浏览器中调试和执行 workflow
  - 与后端 API 通讯，触发工作流执行、查看日志和结果
- 本子包是前端 monorepo 的一部分；通用基础能力（UI 组件、工具函数、API client 等）大多来自 [frontend/packages](frontend/packages) 内其他包或者 [frontend/apps](frontend/apps) 下的应用。

## 2. 目录结构与架构概览

> 注意：本节只描述当前已存在的目录/文件和可确认的模式，不做未来规划。

- 顶层常见文件：
  - `package.json`：声明 `@coze-workflow/test-run-next` 包名、入口文件、脚本命令及依赖。
  - `tsconfig.json` 或 `tsconfig.*.json`：TypeScript 编译配置；通常继承 workspace 公共配置（例如 [frontend/tsconfig.json](frontend/tsconfig.json) 或根配置）。
  - `rushx-config.json`（若存在）：对 Rush/Rushx 的脚本别名声明，用于统一 monorepo 内命令风格。
- 典型源码组织（根据同 workspace 其它包推断，并需在改动前确认实际文件）：
  - `src/`：主要源码目录，通常包含：
    - `pages/` 或 `app/`：如果是 Next.js 应用，会有路由页面目录，负责页面级 UI 与数据获取。
    - `components/`：与工作流测试运行强相关的通用视图和交互组件，例如“节点面板”、“运行日志面板”、“输入输出配置”等。
    - `hooks/`：封装工作流 test-run 状态管理和副作用逻辑（轮询运行状态、拉取日志、重置运行环境等）。
    - `api/` 或 `services/`：对后端接口的轻薄封装，如 `runWorkflow()`, `getRunResult()`, `stopRun()` 等，通常基于统一的 `request`/`fetcher` 工具。
    - `store/` 或 `state/`：若存在全局状态，如使用 Zustand、Redux 或自研 store，用于跨组件共享当前运行实例、日志、节点状态等。
- 整体数据流：
  - UI 组件 → 调用 hooks / service → 通过 HTTP / WebSocket 与后端交互 → 更新状态 → 重新渲染 UI。
  - 「当前 workflow 配置」和「某次运行的上下文/结果」一般被分开管理，以避免误写入原始配置。

## 3. 构建、运行与调试流程

> 所有命令都应从仓库根目录执行，使用 Rush 管理。

- 安装依赖：
  - 在仓库根目录运行：`rush install`
- 构建本子包：
  - 通常通过 Rush：`rush build -t @coze-workflow/test-run-next`
  - 或在包目录使用 Rushx：`rushx build`（需在 package.json 的 `scripts.build` 中定义）。
- 启动开发环境：
  - 如果本包是直接运行的 Next.js 应用：
    - 在子包目录：`rushx dev` 或 `rushx start`，依 Next/脚本命名而定。
    - 默认端口通常为 `3000` 或在 `.env` / `next.config.js` 中指定。
  - 如果本包仅作为组件库，被某个 app 引用：
    - 需要在对应应用（位于 [frontend/apps](frontend/apps)）中启动 dev server，本包通过 `pnpm/rush` 联动编译。
- 测试：
  - 看 `package.json` 中是否定义 `test` 或 `test:unit`、`test:e2e` 等脚本：
    - `rushx test` / `rushx test:unit`
    - 单元测试多使用 Jest / Vitest，E2E 偏向 Playwright / Cypress。
- 调试建议：
  - UI 问题：通过浏览器 DevTools + React/Next DevTools 结合断点调试。
  - 数据流问题：优先定位 `services` / `hooks` 内网络请求与状态变更，再回到具体组件。

## 4. 项目特有约定与模式

- 代码风格：
  - 遵循 workspace 统一 ESLint/Prettier 规则；不要在本包中自定义与全局冲突的风格规则。
  - TypeScript 类型尽量显式，但不强行为每个局部变量添加注解；重点覆盖公共 API（hooks 导出、组件 props、service 函数等）。
- 目录与命名：
  - 组件文件使用帕斯卡命名（如 `RunPanel.tsx`、`LogViewer.tsx`）。
  - hooks 使用 `useXxx` 命名，放在 `hooks/` 目录，如 `useWorkflowRunner.ts`，内聚对某一类场景（运行、日志、断点调试等）。
  - service 层以功能聚合，例如 `workflowRunService.ts`，不要在组件中直接写 `fetch` / `axios`。
- 状态管理：
  - 若使用统一 store（如 Zustand）：
    - 对 workflow run 相关状态（当前 runId、状态机、错误信息、输出数据）集中在一个 slice 或单独 store 文件。
    - 通过 selectors 限制组件订阅范围，避免不必要重渲染。
  - 若使用 React 本地状态：
    - 保持「页面级容器组件」负责抓取/组织数据，向下传递到展示组件。
- 错误与异常：
  - 对后端返回的错误（如运行失败）要区分：
    - 业务错误（如配置错误） → UI 提示 + 引导用户修改配置。
    - 系统错误（网络、权限等） → 统一错误提示组件。

## 5. 关键交互与外部集成

> 具体接口路径和字段需根据 `api` / `services` 源码确认，本节说明交互认知层面的注意事项。

- 后端工作流运行服务：
  - 通常经由统一 API 客户端模块（在 [frontend/infra](frontend/infra) 或公共 package 中）发送 HTTP/JSON 请求。
  - 典型方法：`startWorkflowRun`, `getWorkflowRunDetail`, `listWorkflowLogs`, `stopWorkflowRun` 等。
  - 注意 runId 的生命周期：
    - 启动接口返回 runId → 保存在 state / URL query 中。
    - 后续所有轮询/日志/停止操作都基于 runId。
- 实时日志与状态更新：
  - 若有 WebSocket / SSE：
    - 会在 `hooks` 或 `services` 中封装连接逻辑，UI 只关心「追加日志」与「状态变化事件」。
    - 需要在组件卸载时关闭连接，避免资源泄漏。
  - 若使用轮询：
    - 统一在 hooks 中关闭/重启定时器，避免在多个组件中重复 `setInterval`。
- 与其它 workflow 子包的协同：
  - 节点/边配置结构（graph schema）通常定义在上层 workflow 核心包（例如 [frontend/packages/workflow](frontend/packages/workflow) 的别的子包）。
  - 本 test-run 包只消费这些结构，不应擅自修改 schema 设计；如需新增字段，应先在核心包中扩展，再在本包中适配显示/输入。

## 6. 分支策略与发布流程

> 实际流程以根仓库 CONTRIBUTING / README 中为准，本节仅总结与本包开发相关的注意点。

- 分支：
  - 开发一般在 feature 分支进行（如 `feature/workflow-test-run-ui`），通过 PR 合并到主干（`main` / `master` 或团队指定分支）。
  - 修改本包时，若涉及跨包改动（例如核心 workflow schema 更新），务必在同一 PR 中保持前后兼容或提供迁移脚本。
- 代码评审：
  - PR 中应明确列出影响范围：UI 变更、接口调用变更、性能影响等。
  - 避免在本包中引入与 workspace 规范不一致的库（如重复的 HTTP 客户端、状态管理库等）。
- 构建与发布：
  - 使用 Rush 的 publish 或 CI pipeline 进行版本升级与构建；版本、changelog 由 monorepo 统一管理。
  - 如果本包被某个 app 直接依赖，在合入前至少完成：
    - 本包的 `build` 和 `test` 均通过。
    - 依赖此包的 app 至少能正常启动，并完成一次基础流程（启动一次 workflow 试跑）。

## 7. 开发注意事项与常见坑

- 注意与后端 API 的契约：
  - 不要在前端硬编码 magic string / 枚举值，优先从共享常量、类型或后端返回数据中派生。
  - 后端字段调整时，优先在 `services` 层兼容处理，而不是在所有组件中逐一修改字段名。
- 性能与体验：
  - 运行日志量可能很大；日志组件应避免一次性渲染过多 DOM 节点，可考虑虚拟滚动或分段渲染（具体实现以现有代码为准）。
  - 轮询频率需折中「实时性」与「负载」，遵循现有 hooks 默认值，如 `POLL_INTERVAL_MS`。
- 类型安全与重构：
  - 新增公共类型时，优先放在已有的 `types/` 或统一类型包中，避免在多个子包里重复定义运行结果 / 节点 / 边等类型。
  - 对外导出的 API（公共 hooks、组件 props）修改需谨慎，尽量以向后兼容方式演进。

## 8. AI 助手协作建议

- 在修改代码前，先阅读本包下的：
  - `package.json`（脚本与依赖）
  - `src/` 目录下的入口文件（如 `pages/index.tsx` 或 `App.tsx`）
  - 与 workflow 运行高度相关的 `hooks` 与 `services` 文件
- 生成变更时优先：
  - 遵循既有目录和命名模式，不新建风格不一致的模块。
  - 小步修改，保持接口与类型兼容，必要时在 PR 描述中说明兼容策略。
- 不要：
  - 引入新的基础技术栈（新的路由器、状态库、HTTP 客户端）替代既有方案。
  - 随意更改运行行为语义（例如改变默认运行模式，从串行改为并行）而没有在 UI / 文档层面同步说明。