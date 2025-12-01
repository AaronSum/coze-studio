# chat-area-plugin-message-grab 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/plugin-message-grab）中安全、高效地协作开发。

## 总体架构与角色定位
- 本子包实现「消息选中抓取 + 引用回复」能力，是 `@coze-common/chat-area` 的可写插件之一，插件名为 `PluginName.MessageGrab`，继承自 `WriteableChatAreaPlugin`，实现写场景下的选区管理与引用 UI。
- 全局入口在 `src/index.ts`，对外导出：
  - 与选区模型相关的 `GrabNode/GrabElement/...` 等类型与工具（来自 `@coze-common/text-grab`）。
  - 业务上下文 `GrabPluginBizContext`、公共事件中心 `PublicEventCenter` 和事件名 `PublicEventNames`。
  - 插件公共方法类型 `GrabPublicMethod`，以及 React Hook `useCreateGrabPlugin`。
  - 单例事件中心 `publicEventCenter`。
- 插件主体类在 `src/plugin.ts` (`ChatAreaGrabPlugin`)：
  - 通过 `pluginMode = PluginMode.Writeable`、`pluginName = PluginName.MessageGrab` 与聊天区域宿主系统对齐。
  - 使用 `createCustomComponents` 提供多个挂点组件（如 `MessageListFloatSlot`、`TextMessageInnerTopSlot`、`InputAddonTop`）。
  - 组装三类生命周期服务：`GrabAppLifeCycleService`、`GrabMessageLifeCycleService`、`GrabCommandLifeCycleService`，分别负责应用级、消息级、命令级行为。
- 状态管理全部基于 Zustand + devtools 中间件：
  - `src/stores/preference.ts` 管理是否启用抓取 `enableGrab`。
  - `src/stores/selection.ts` 管理当前选区、归一化节点列表、人类可读文本、浮层显隐与位置。
  - `src/stores/quote.ts` 管理引用内容与引用可见性，并暴露 `subscribeQuoteUpdate` 让外部通过 `onQuoteChange` 感知引用状态。
- 外部宿主（Studio / Agent IDE）通过 `useCreateGrabPlugin` Hook 快速创建插件实例，并通过回调接收引用行为。

## 关键数据流与交互
- 用户在聊天区选中文本后，会通过 `@coze-common/text-grab` 解析为 `GrabNode[]`、`SelectionData` 等结构，再写入 `SelectionStore`：
  - `updateNormalizeSelectionNodeList`、`updateSelectionData`、`updateHumanizedContentText`、`updateOriginContentText` 等操作保持 UI 与内部模型一致。
  - 浮层菜单（通常是右上角的悬浮操作面板）依赖 `isFloatMenuVisible` 与 `floatMenuPosition` 渲染。
- 当用户触发「引用」类操作时：
  - `QuoteStore.updateQuoteContent`/`updateQuoteVisible` 将引用消息内容与显隐状态写入；
  - `subscribeQuoteUpdate` 会监听 `quoteContent`，触发 `EventCallbacks.onQuoteChange` 回调，让上层可以根据是否存在引用控制上传按钮等交互；
  - `useCreateGrabPlugin` 中默认实现 `onQuoteChange`：当 `isEmpty` 为 `true` 时允许上传，否则禁用，暴露给宿主为 `grabEnableUpload` 布尔值。
- 插件公共方法 `publicMethods.updateEnableGrab`：
  - 通过插件注入的 `pluginBizContext.storeSet.usePreferenceStore` 获取当前偏好 store，更新 `enableGrab`；
  - 这是上层开关抓取能力的标准入口，避免直接操作 store 细节。
- 生命周期服务（`src/services/life-cycle/*`）负责与聊天区框架的事件对接：
  - `GrabAppLifeCycleService`：应用初始化 / 销毁、store 创建与订阅等。
  - `GrabMessageLifeCycleService`：消息渲染过程中挂载抓取逻辑、解析 message 内容并写入 `SelectionStore` / `QuoteStore`。
  - `GrabCommandLifeCycleService`：处理与命令面板/快捷键/指令相关的操作，例如清除引用、切换抓取模式等。

## 源码结构速览
- `src/index.ts`：对外 API 汇总，导出类型、Hook、事件中心，是其他包唯一需要依赖的入口。
- `src/plugin.ts`：`ChatAreaGrabPlugin` 插件主类，配置插件元信息、自定义组件和生命周期服务，并实现公共方法。
- `src/create.ts`：封装 `createGrabPlugin` 与 `publicEventCenter`，负责：
  - 创建各类 Zustand store（preference/selection/quote），并以 `mark` 字符串区分实例。
  - 注册 `subscribeQuoteUpdate` 等订阅逻辑，将内部状态变化转换为外部回调。
  - 根据传入的 `Scene`（如 `store` / 其它）调整初始化行为。
- `src/hooks/`：
  - `use-create-grab-plugin.ts`：唯一公开 Hook，创建插件实例并下发 `GrabPlugin` React 组件和 `grabPluginId`；同时内部处理上传开关 `grabEnableUpload` 状态。
  - 其他 Hook（如 `use-float-menu-listener`、`use-auto-get-max-position`、`use-hide-quote`）只在本包内被使用，用来封装 DOM 事件和 UI 交互细节。
- `src/stores/`：Zustand store 定义与订阅封装（见上一节）。所有 store 名称前缀统一为 `botStudio.ChatAreaGrabPlugin.*.${mark}`，方便 devtools 与多实例调试。
- `src/custom-components/`：
  - `message-list-float-slot`：消息列表浮层入口，承载选区浮动菜单按钮或列表。
  - `message-inner-top-slot`：消息气泡顶部插槽，用于展示被引用摘要内容或 tag。
  - `input-addon-top`：输入框上方的引用栏，显示已选择的引用消息并提供清除交互。
- `src/services/`：
  - `life-cycle/app.ts` / `message.ts` / `command.ts`：面向 `@coze-common/chat-area` 生命周期的适配与事件处理核心。
- `src/types/`：
  - `plugin-biz-context.ts`：定义 `GrabPluginBizContext`、`PublicEventCenter`、`PublicEventNames` 与 `EventCallbacks` 等类型，是插件与宿主之间的契约层。
  - `public-methods.ts`：暴露 `GrabPublicMethod` 接口，用于限制可对外公开的操作集合。
- `src/utils/` 与 `src/constants/`：收敛本插件专项工具函数与常量（如浮层位置计算、特定 flag、事件名字符串等），避免与其它 ChatArea 插件重复实现。

## 构建、测试与本地开发
- 包元数据在 `package.json` 中：
  - `main: "src/index.ts"`，表明在 monorepo 内使用 TS 源码直接作为入口。
  - 当前 `build` 脚本为 `exit 0`，构建由上层统一 Rsbuild/Rush 流程接管，本包不负责产出独立 bundle。
- 常用脚本：
  - `npm run lint`：基于根目录与本包 `eslint.config.js` 的 ESLint 检查，支持 `--cache`。
  - `npm run lint:type`：`tsc -p tsconfig.json --noEmit` 做类型校验，配置与 `@coze-arch/ts-config` 对齐。
  - `npm run test`：使用 Vitest 运行单测，`--passWithNoTests` 表示短期内无用例也不会失败；配置由 `@coze-arch/vitest-config` 统一下发。
  - `npm run test:cov`：在 Vitest 基础上开启 coverage，配合仓库 `rushx-config.json` 中的 level-3 覆盖要求（本包要求为 0%，可渐进补充）。
- Rush / monorepo 级命令：
  - 在仓库根目录执行 `rush install` / `rush update` 以安装或更新依赖。
  - 使用 `rushx test --to @coze-common/chat-area-plugin-message-grab` 可只运行本包相关测试（遵循仓库通用约定）。
- Storybook：
  - README 中提到支持 Storybook，但具体 story 配置在 `.storybook/` 或上层 infra 中，本包只需保证导出的 React 组件是纯函数组件、无副作用即可被复用。

## 项目特有约定与模式
- 插件模式：
  - 所有聊天区域插件均遵守 `@coze-common/chat-area` 的插件系统，需指定 `pluginMode` 与 `pluginName`，并提供 `customComponents` + `lifeCycleServices` + `publicMethods` 三部分能力。
  - 插件实例在宿主侧通常以 `GrabPlugin` 组件形式挂在 ChatArea 根节点下，通过 `grabPluginId` 完成内部注册与事件派发。
- Store 约定：
  - 每个插件实例通过 `mark` 区分，自定义 store 的 devtools name 带有该标记，避免多实例调试混淆。
  - 所有 `create*Store` 均返回「hook 本身」作为 `Store` 类型，外部统一以 `useXxxStore.getState()` 与 `.subscribe()` 访问，避免直接暴露 `setState`。
- 事件与回调：
  - 插件通过 `PublicEventCenter` 与 `PublicEventNames` 与外界通信，这部分定义在 `src/types/plugin-biz-context.ts` 中，不要随意改动枚举/字符串，以免破坏跨包事件订阅。
  - `EventCallbacks`（如 `onQuote`、`onQuoteChange`）由宿主在创建插件时注入，插件只负责在适当时机调用，不做业务决策。
- UI 组件规范：
  - 组件样式约定依赖 `@coze-arch/coze-design` 与 `@coze-arch/bot-semi`，并可能使用 `class-variance-authority` + `classnames` 组合动态 class。
  - 所有组件必须保持受控依赖于 store 状态，不直接访问全局 DOM 状态（除非有封装 Hook 统一管理）。
- 国际化与多语言：
  - 文案统一通过 `@coze-arch/i18n` 体系注入；在编写新 UI 时不要写死字符串，遵循仓库 i18n 规范。

## 外部依赖与跨包集成
- `@coze-common/text-grab`：
  - 本插件围绕该包的抓取模型构建，`GrabNode/GrabElement/GrabPosition/SelectionData` 等类型及 `isGrabTextNode/isGrabImage/isGrabLink` 辅助函数直接重导出供使用者复用，避免重复 import。
  - 在处理选区或引用内容时应始终以这些结构为唯一真相，不要额外引入自定义树结构。
- `@coze-common/chat-area`：
  - 提供 `WriteableChatAreaPlugin` 抽象、`PluginMode`、`PluginName`、`MessageSource` 类型，以及挂点组件名（如 `MessageListFloatSlot`）。
  - 若需新增插槽或生命周期，请先检查 `@coze-common/chat-area` 定义是否支持，再在本插件中扩展。
- 其他依赖：
  - `zustand` + `immer`：用于细粒度 state 管理，`updateQuoteContentMapByImmer` 即是在 store 内使用 `produce` 修改引用映射，保证不可变数据结构。
  - `mitt`：轻量事件总线，通常用于 `PublicEventCenter` 实现。
  - `lodash-es`、`nanoid` 等工具类按需使用，避免在核心 render 路径上引入重度计算。

## 开发协作与注意事项
- 变更公共类型需格外谨慎：
  - `src/types/*` 下的类型与事件名均可能被多个上游包依赖，修改前请全局搜索引用；必要时向上游团队同步变更计划。
- 避免直接跨包耦合：
  - 若需要从其它插件或模块复用逻辑，优先放到 `@coze-common/text-grab` 或 `@coze-common/chat-hooks` 等共享包，而不是在此处手动互相 import 具体实现。
- 保持插件无副作用：
  - 除 store 创建与事件订阅外，不要在模块顶层执行 DOM 读写或注册全局监听，所有副作用应封装在 Hook 或生命周期服务中，并在销毁时清理。
- 调试建议：
  - 使用浏览器 Redux/Zustand Devtools 观察 `botStudio.ChatAreaGrabPlugin.*` 前缀的 store 变化，配合 `IS_DEV_MODE` 切换。
  - 可在上层应用中打印 `grabPluginId` 与 `grabEnableUpload` 以排查引用状态与上传按钮逻辑。
