# @coze-common/chat-area-plugins-chat-shortcuts 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/plugin-chat-shortcuts）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本子包是 chat-area 的快捷指令插件实现，主要导出三类能力：
  - 运行时快捷指令栏：`src/index.tsx` 暴露 `ShortcutBar`，供聊天输入区域引用；
  - 快捷指令发送逻辑：`src/hooks/shortcut.ts` 中封装文本/多模态消息发送；
  - IDE 配置工具侧：`src/shortcut-tool` 下的 `ShortcutToolConfig`（通过包导出 `./shortcut-tool` 暴露），用于在 IDE / Studio 里配置快捷指令。
- 运行时侧数据来源：
  - 上游通过 `ShortCutCommand[]`（来自 `@coze-agent-ide/tool-config`）传入快捷指令定义；
  - 发送消息能力依赖 `@coze-common/chat-area` 的 `useSendTextMessage` / `useSendMultimodalMessage`；
  - WebSocket 设备信息来自 `@coze-common/websocket-manager-adapter`，通过 `deviceId` 写入扩展字段。
- 主要结构：
  - `src/shortcut-bar/`：快捷栏 UI 与交互，负责展示、激活快捷指令、控制 `popover/load more`；
  - `src/shortcut/`：单个快捷项（查询型 / 面板型）以及“更多”按钮展示；
  - `src/shortcut-template/`：当指令为表单/面板型（`SendTypePanel`）时的参数填写 UI；
  - `src/shortcut-tool/shortcut-edit/`：在 IDE 里编辑快捷指令表单（包括组件 DSL、tool params 兼容逻辑）；
  - `src/utils/`：
    - `shortcut-query.ts`：模板渲染，将 `template_query` 与组件/参数值拼接成最终 query；
    - `tool-params.ts`：校验与整理 tool 参数、补齐兼容字段；
    - `get-ui-mode-by-biz-scene.ts` 等：根据业务场景决定 UI 模式；
  - `src/context/chat-area-state/`：封装 `useChatAreaState`，从上层 context 读取聊天区状态（本包只消费、不创建 context）。
- 设计要点：
  - **配置/运行分离**：`shortcut-tool` 负责在 IDE 中配置生成 `ShortCutCommand`，`shortcut-bar` 只消费这份结构并驱动 `chat-area` 发送消息；
  - **向后兼容**：`shortcut-edit/method.ts` 中大量逻辑用于兼容旧指令（例如把 `tool_params_list` 反向生成 `components_list`，自动补充 upload options 等）；
  - **工具调用抽象**：`hooks/shortcut.ts` 把「是否走 plugin/workflow tool」与消息结构、埋点等收敛到一个统一的发送入口。

## 2. 关键数据模型与数据流

- 快捷指令结构 `ShortCutCommand`（来自 `@coze-agent-ide/tool-config`）：
  - 关键信息：`command_id`、`shortcut_command`（形如 `/xxx`）、`command_name`（按钮展示）、`send_type`、`template_query`、`components_list`、`tool_type`、`tool_info`（`tool_params_list` 等）、`plugin_id`、`work_flow_id` 等。
  - 本包不会自行构造任意字段，而是：
    - 在编辑端通过 `getSubmitValue` / `getInitialValues` 做表单到 `ShortCutCommand` 的变换；
    - 在运行时严格按该结构读取字段，避免私自扩展。
- 运行时发送数据流（用户点击快捷指令）：
  1. `ShortcutBar` 根据 `shortcut.send_type` 分支：
     - `SendTypeQuery`：直接渲染 `QueryShortcut`，点击后调用 `useSendTextQueryMessage`；
     - `SendTypePanel`：
       - 若 `enableSendTypePanelHideTemplate(shortcut)` 为真，则通过 `onShortcutTemplateNoParamsSubmit` 直接发送（无表单 UI）；
       - 否则展示 `ShortcutTemplate` 表单，提交后调用 `useSendUseToolMessage`。
  2. `useSendTextQueryMessage`：
     - 使用 `getQueryFromTemplate` 将 `template_query` + components/default values 渲染出最终 `queryTemplate`；
     - 根据 `tool_type` 判定是否需要通过 `getPluginDefaultParams` 组装工具调用参数；
     - 组合 `extendFiled`（包含 plugin 参数与 `device_id`），调用 `useSendTextMessage`；
     - 发送埋点事件 `EVENT_NAMES.shortcut_use`。
  3. `useSendUseToolMessage`：
     - 根据组件表单值与 `tool_params_list` 生成 `pluginParams`（`getPluginParams`）；
     - 使用 `getImageAndFileList` 将上传组件转换为混合消息 payload（文本 + 文件/图片）；
     - 按模板生成查询文本（支持 `withoutComponentsList` 流程）；
     - 调用 `useSendMultimodalMessage` 发送，并上报埋点；
- 配置端数据流（在 IDE 中编辑快捷指令）：
  - `getInitialValues(initShortcut)`：
    - 对新建指令给出最小初始值；
    - 对已有指令：
      - 通过 `initComponentsListFromToolParams` 把老数据里仅存在于 `tool_params_list` 的参数升级为 `components_list`；
      - 通过 `initComponentsUploadOptions` 自动填充上传组件的 `upload_options`；
      - 根据 `tool_type` 计算 `use_tool` 初始状态；
      - 去掉 `shortcut_command` 前缀 `/` 以便表单编辑。
  - `getSubmitValue(values)`：
    - 按组件是否存在动态设置 `send_type`（无组件 => `Query`，有组件 => `Panel`）；
    - `mutableFormatCommandName` 负责为 `shortcut_command` 自动加上 `/` 前缀；
    - 若是纯 Query 且无需工具：清空 tool 相关字段与组件；
    - 若无需工具但存在组件：清空 tool 字段，仅保留组件的默认值与参数名；
    - 更新 `tool_params_list` 与 `components_list` 的联动（`mutableModifyToolParamsWhenComponentChange`）。

## 3. 构建、测试与本地开发流程

- 子包自身脚本（见 `package.json`）：
  - `npm run build`：当前实现为 `exit 0`，即本包不独立产出构建产物，通常由上层 `rush` / workspace 构建统一处理；
  - `npm run lint`：运行 ESLint（配置来自 `@coze-arch/eslint-config`），对本包 TS/TSX 做检查；
  - `npm run test`：通过 `vitest` 执行单测（`@coze-arch/vitest-config` 提供统一配置）；
  - `npm run test:cov`：在 `test` 基础上开覆盖率报告。
- 在整个前端工程中的典型流程：
  - 根目录执行 `rush update` 初始化依赖；
  - 在 `frontend` 或根目录通过统一脚本启动 dev/build（参考 `frontend/README.md` 与根 `README.md`）；
  - 本子包多作为被依赖包调试：
    - 修改组件后，直接通过运行整体前端（工作区 apps）来观察快捷指令栏行为；
    - 单独运行测试/`lint` 时直接在本目录执行上述 npm scripts。

## 4. 项目约定与实现模式

- 导出约定：
  - 对外通常只通过 `src/index.tsx` 暴露运行时 API：
    - `ShortcutBar`：快捷指令栏核心组件；
    - `ComponentsTable`：来自 `shortcut-tool/shortcut-edit/components-table`，用作配置端复用组件；
    - `ShortCutCommand` / `getStrictShortcuts`：统一从 `@coze-agent-ide/tool-config` re-export；
    - `OnBeforeSendTemplateShortcutParams` / `OnBeforeSendQueryShortcutParams`：供上层在发送前注入/修改消息；
    - `getUIModeByBizScene`：按业务场景选择 UI 模式。
  - `shortcut-tool` 相关能力通过 `exports["./shortcut-tool"]` 单独出口，避免直接在根导出（文件内有注释说明原因：防止引入不必要的上传知识相关依赖）。
- 表单与 DSL 模式：
  - 配置端把 `components_list` 视为一组「表单组件描述」，同时利用 `getDSLFromComponents` 生成 `card_schema` （JSON 字符串）供其他模块使用；
  - 组件默认值与隐藏策略：
    - 若组件 `hide=true`，则其值从 `default_value` 写入 tool params，而不再暴露在表单 UI；
    - 初始化逻辑中会用 `InputType` 自动补 `upload_options`，保证上传组件最小可用配置。
- 校验与约束：
  - `tool-params.ts` 提供：
    - `validateCmdString`：限制指令名只能使用字母、数字和 `_`，且不能全为数字；
    - `validateCommandNameRepeat` / `validateButtonNameRepeat`：检查同一个快捷集合内的重复；
    - `validatePluginAndWorkflowParams`：限制 plugin/workflow 参数类型，拒绝 `array`/`object` 等复杂类型；
  - `enableSendTypePanelHideTemplate` 与 `getFormValueFromShortcut` 决定是否允许「直接发送而不展示表单」，以及如何从旧结构中恢复默认值。
- UI 风格与技术栈：
  - React 18 + TypeScript；
  - 组件库：`@douyinfe/semi-ui` 与 `@coze-arch/bot-semi` 封装组件（如 `OverflowList`、`Popover`）；
  - 样式：使用 `.module.less` + `classnames` 组合 Tailwind 实用类（例如 `flex justify-center` 等）。

## 5. 重要外部依赖与集成

- `@coze-common/chat-area`：
  - 提供核心聊天能力：`useSendTextMessage`、`useSendMultimodalMessage`、`useMessageWidth`；
  - 本包不会直接操作底层网络，仅通过这些 hook 发送消息。
- `@coze-common/chat-core`：
  - `getFileInfo` 用于区分 image/file，从而构造混合消息 payload 中的 `ContentType.Image` 或 `ContentType.File`。
- `@coze-arch/bot-api/playground_api`：
  - 类型与枚举：`SendType`、`InputType`、`ToolType`、`shortcut_command.ShortcutCommand` 等；
  - 确保在扩展/修改字段时与后端 proto/Thrift 对齐，避免擅自添加字段。
- `@coze-agent-ide/tool-config`：
  - 承载 `ShortCutCommand` 结构定义与工具函数 `getStrictShortcuts`；
  - 该包是**权威模型来源**，本子包不应为 Shortcut 增添新语义字段。
- `@coze-arch/bot-tea`：
  - 埋点 SDK，当前仅通过 `sendTeaEvent(EVENT_NAMES.shortcut_use, ...)` 记录快捷指令使用情况，新增埋点请保持事件名与字段风格一致。
- `@coze-common/websocket-manager-adapter`：
  - 暴露 `deviceId` 用于消息 `extendFiled`；使用时注意仅在发送侧读取，不要在 UI 中强耦合。

## 6. 团队流程与开发习惯（子包范围）

- 代码风格：
  - 统一使用 `@coze-arch/eslint-config` 与 `@coze-arch/ts-config`，新增文件应遵循现有 import 顺序、空行与命名规则；
  - 所有 TS/TSX 文件头部统一携带 Apache 2.0 版权头；
  - 函数命名以动词短语为主（`get*`、`init*`、`mutable*`、`validate*` 等），在 `shortcut-edit/method.ts` 中已有典型模式。
- 测试与可维护性：
  - 单元测试通过 `vitest`，建议对核心数据转换函数（如 `getSubmitValue`、`getTemplateQuery`、`getPluginParams`）编写测试，而不是仅测 UI；
  - 涉及后端类型/协议兼容的变更应优先在纯函数层添加用例。
- 变更范围控制：
  - 此子包处于 chat-area 中间层，改动容易影响多个应用：
    - 避免擅自更改对外导出 API 的签名（尤其是 `ShortcutBar` props 与 re-export 出去的类型）；
    - 若确需调整 `ShortCutCommand` 使用方式，应优先在 `@coze-agent-ide/tool-config` 或上游协议中演进，而不是在本包“局部修补”。

## 7. 不寻常/需要特别注意的点

- `index.tsx` 顶部的注释强调：**禁止**在默认导出中直接 re-export `shortcut-tool`：
  - 原因：这样会在运行时 bundle 中引入 IDE 相关的知识上传等能力，导致不必要的依赖耦合；
  - 若需要在其他子系统中使用 `ShortcutToolConfig`，请通过 `"@coze-common/chat-area-plugins-chat-shortcuts/shortcut-tool"` 子路径导入。
- `getQueryFromTemplate` 的实现是简单的 `{{key}}` 全局替换：
  - 不做转义或类型检查，调用方必须保证传入值已是字符串；
  - 若新增复杂占位符语法（如 `{{#if}}` 等），应在 utils 层扩展而非直接在业务组件中拼接字符串。
- `withoutComponentsList` 语义：
  - 在 `useSendUseToolMessage` 中，当 `withoutComponentsList` 为真时，会直接使用 `componentsFormValues`（通常为空对象）渲染模板；
  - 该分支用来支持「只有 tool 默认参数，但无需展示表单」的快捷调用场景，修改时需确保与 `enableSendTypePanelHideTemplate` 的条件保持一致。
- 兼容旧数据的逻辑较多：
  - 修改 `Components` 结构或 `ToolParams` 定义时，应同时检查 `initComponentsListFromToolParams`、`initComponentsUploadOptions`、`mutableModifyToolParamsWhenComponentChange` 等函数，避免破坏历史快捷指令。

> 在本子包中开发新功能时，优先考虑：能否通过补充 `utils` 层纯函数与配置端/运行时小范围组合来实现，而避免修改公共类型或导出 API。