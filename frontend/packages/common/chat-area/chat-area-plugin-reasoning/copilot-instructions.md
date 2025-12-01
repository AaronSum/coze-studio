# chat-area-plugin-reasoning 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/chat-area-plugin-reasoning）中安全、高效地协作开发。

## 全局架构概览
- 本子包实现的是一个挂载在 @coze-common/chat-area 之上的「只读聊天区域插件」，用于扩展消息渲染、生命周期钩子和 UI 插槽，而不直接修改底层聊天核心逻辑。
- 入口文件为 src/index.ts，导出 ReasoningPluginRegistry，类型为 PluginRegistryEntry<PluginBizContext>，供上层 chat-area 注册和装配。
- 业务插件主体为 src/plugin.ts 中的 BizPlugin：
  - 继承自 @coze-common/chat-area 提供的 ReadonlyChatAreaPlugin<PluginBizContext>；
  - 通过 pluginMode 指定为 PluginMode.Readonly（只读插件，不应修改消息/对话状态）；
  - 通过 pluginName 指定插件标识（当前为 PluginName.Demo，实际接入时需按项目约定调整）。
- 生命周期服务聚合：
  - src/services/life-cycle/index.ts 定义 bizLifeCycleServiceGenerator，按 chat-area 约定返回 app/message/command/render 四类生命周期服务对象；
  - 对应子文件 app.ts、message.ts、command.ts、render.ts 目前均返回空对象，作为具体业务逻辑的填充位点。
- 自定义组件：
  - src/custom-components/message-inner-addon-bottom/index.ts 导出 BizMessageInnerAddonBottom；
  - 在 BizPlugin 中通过 createCustomComponents 注册到 TextMessageInnerTopSlot 槽位，实现针对文本消息的额外渲染区域。
- 业务上下文：
  - src/types/biz-context.ts 将 PluginBizContext 定义为 Record<string, unknown>，供后续按需扩展；
  - 上下文在 ReasoningPluginRegistry.createPluginBizContext 中创建，并在生命周期与组件中透传使用。

## 关键开发工作流
- 安装/初始化
  - 在 monorepo 根目录执行 rush update 安装依赖（遵循仓库统一流程）。
- 构建
  - package.json 中 build 脚本目前为占位："build": "exit 0"，真正的打包通常由上层工具链（例如 rsbuild、统一构建脚本）驱动；
  - 如需本地验证 TS 类型，可直接依赖仓库统一 tsconfig（@coze-arch/ts-config）并使用 IDE 类型检查。
- 测试
  - 单测框架为 vitest：
    - 运行全部测试：npm test 或 npm run test（等价于 vitest --run --passWithNoTests）；
    - 生成覆盖率：npm run test:cov（底层使用 @vitest/coverage-v8）。
  - 测试配置位于 vitest.config.ts，遵循 @coze-arch/vitest-config 提供的公司级约定。
- 代码质量
  - ESLint：npm run lint（使用 eslint.config.js + @coze-arch/eslint-config）；
  - Stylelint：.stylelintrc.js + @coze-arch/stylelint-config，主要用于样式文件；
  - 建议在修改 TS/TSX 或样式文件后先本地运行 lint，再提交代码。
- Storybook/开发调试
  - README.md 提到支持 storybook，但当前 package.json 未显式声明 dev/storybook 相关脚本；
  - 若需要交互式调试 UI，优先沿用仓库其它组件包的 storybook 约定（在本包内新增时应保持脚本命名风格一致，如 npm run storybook）。

## 项目约定与模式
- 插件模式
  - 所有插件实现均通过 ReasoningPluginRegistry（src/index.ts）向外暴露，统一暴露 createPluginBizContext 与 Plugin 两个核心能力；
  - 插件业务类 BizPlugin 必须继承自 ReadonlyChatAreaPlugin 或对应的可写插件基类，并显式声明 pluginMode 与 pluginName。
- 生命周期拆分
  - 约定将插件逻辑按 app/message/command/render 四个维度拆分到 src/services/life-cycle 下：
    - appLifeCycleServiceGenerator：与整体应用级别事件相关（初始化、销毁、会话切换等）；
    - messageLifeCycleServiceGenerator：与消息创建、加载、过滤、标记等行为相关；
    - commandLifeCycleServiceGenerator：与用户指令/快捷操作等命令型行为相关；
    - renderLifeCycleServiceGenerator：与消息渲染、重绘、滚动等 UI 相关生命周期钩子相关。
  - 实际导出的 bizLifeCycleServiceGenerator 组合各子 generator，供 createReadonlyLifeCycleServices 使用。
- 自定义组件插槽
  - 通过 createCustomComponents 注册自定义组件，key 必须是 chat-area 约定的插槽名称（如 TextMessageInnerTopSlot）；
  - 自定义组件文件位于 src/custom-components 下，按「业务作用域/具体位置」分目录，例如 message-inner-addon-bottom/index.tsx；
  - 组件通常使用 React + classnames，并可能依赖 @coze-arch/bot-md-box-adapter 进行 Markdown 内容渲染。
- 业务上下文使用
  - PluginBizContext 作为插件内共享的轻量级容器，建议在 types/biz-context.ts 中集中声明结构；
  - createPluginBizContext 应返回包含初始状态的对象，避免在生命周期或组件中动态创建结构；
  - 生命周期与组件通过 ReadonlyChatAreaPlugin 提供的能力访问上下文，保持只读插件的状态不可变约束。
- 命名与风格
  - TypeScript 使用严格类型，插件相关类型从 @coze-common/chat-area 与 @coze-arch/bot-typings 引入；
  - 类名、导出名常以 Biz 前缀标识业务实现（例如 BizPlugin、BizMessageInnerAddonBottom）；
  - 插件注册对象（例如 ReasoningPluginRegistry）按 PascalCase 命名，并作为该包的主导导出。

## 与外部依赖的集成细节
- @coze-common/chat-area
  - 提供 PluginRegistryEntry、ReadonlyChatAreaPlugin、PluginMode、PluginName 等核心类型，以及 createReadonlyLifeCycleServices、createCustomComponents 工具函数；
  - 本包所有对聊天框架的接入点均通过这些类型与工具完成，避免直接操作底层聊天状态或 DOM；
  - 当需要新增生命周期钩子或插槽时，应首先在 chat-area 包中确认支持，再在本插件中扩展。
- @coze-common/chat-core
  - 封装底层聊天消息、会话、用户等领域模型；
  - 本子包通常通过 chat-area 间接使用 chat-core，不建议在此直接依赖 chat-core 内部实现细节。
- @coze-arch/bot-md-box-adapter
  - 用于在自定义组件中渲染机器人的 Markdown 文本或解释内容；
  - 若需要在推理插件中高亮推理步骤、代码块或数学公式，应优先通过该适配层实现，而非自行拼装 HTML。
- React/DOM
  - React 版本锁定为 ~18.2.0，与整个 monorepo 保持一致；
  - 组件应遵循函数组件 + Hooks 的写法，使用 @testing-library/react 进行 UI 测试。

## 团队流程与协作规范
- 代码组织
  - 遵循 monorepo 结构：本包位于 frontend/packages/common/chat-area 之下，逻辑应尽量复用 common 层已有能力，避免直接依赖具体业务应用；
  - 若新逻辑属于通用聊天插件能力，优先考虑抽象到 @coze-common/chat-area 或 @coze-common/chat-core，而不是堆叠在单一插件中。
- 分支与提交（推测自 Rush/多包结构的一般实践）
  - 通常以 feature/xxx 或 fix/xxx 形式创建分支，在 PR 中尽量只改动与本插件直接相关的文件；
  - 提交前应至少完成：npm run lint + npm test（或更上层统一脚本）。
- 发布与集成
  - 版本号管理由 monorepo 顶层（rush/发布流水线）统一控制，单包不直接手动 publish；
  - 其他应用（如 Agent IDE、Studio 前端）通过 workspace:* 依赖引用本包，构建时由整体前端构建系统一打包。

## 项目中特殊/易踩坑点
- 插件模式为只读
  - BizPlugin.pluginMode = PluginMode.Readonly，意味着本插件不应直接修改消息内容、会话状态等写操作；
  - 若后续需要写入能力，应与 chat-area 约定迁移到可写插件模式，并审慎评估兼容性。
- 生命周期目前为空实现
  - app/message/command/render 四个 generator 当前返回空对象，新增逻辑时务必只填入 chat-area 类型系统允许的钩子；
  - 建议参考同目录下其它插件的实现，保持方法命名、参数签名一致。
- 插槽 key 必须与 chat-area 对齐
  - createCustomComponents 中的 key（如 TextMessageInnerTopSlot）必须与 chat-area 内部声明完全一致，否则不会生效且无编译期提示；
  - 在新增/修改插槽时，请先在 @coze-common/chat-area 中确认类型声明。
- 业务上下文扩展
  - PluginBizContext 目前过于宽泛（Record<string, unknown>），扩展时需在 types/biz-context.ts 中给出清晰的属性定义与注释，避免在各处以 any 形式使用。

## 面向 AI 助手的具体建议
- 修改或新增生命周期逻辑时：
  - 优先在 src/services/life-cycle 对应文件中实现，而不要直接在 BizPlugin 类里堆积逻辑；
  - 严格遵守 ReadonlyXXXLifeCycleServiceGenerator 类型约束，避免返回未定义的字段。
- 新增 UI 行为时：
  - 在 src/custom-components 下新增子目录与组件文件，并在 BizPlugin.customComponents 中注册；
  - 组件内部如需访问插件上下文或消息数据，应通过 chat-area 提供的 props / hooks，而非全局变量。
- 变更插件对外行为时：
  - 更新 src/index.ts 中的 ReasoningPluginRegistry 或 BizPlugin 配置，并确保与 @coze-common/chat-area 的注册机制兼容；
  - 如涉及接口/类型调整，应同步更新相关测试与文档（包括本文件）。
