# @coze-common/chat-area-plugin-chat-background 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/plugin-chat-background）中安全、高效地协作开发。

## 1. 全局架构与设计意图

- 本子包实现「聊天区背景配置/展示」插件，挂载在共用聊天容器 @coze-common/chat-area 上，为 Studio/IDE 聊天面板提供背景图展示能力。
- 核心由三层组成：
  - **业务上下文与事件层**：通过 mitt 事件总线和 zustand store 驱动背景信息的变更与同步。
  - **插件生命周期层**：基于 @coze-common/chat-area 暴露的只读插件基类和生命周期接口，在会话初始化/销毁阶段与宿主消息服务对齐背景数据。
  - **UI 展示层**：包装 @coze-common/chat-uikit 提供的 WithRuleImgBackground 组件，在 MessageListFloatSlot 插槽中叠加背景与遮罩。
- 数据流大致如下：
  - 外部（其它模块或 IDE 逻辑）通过 chatBackgroundEvent 触发 OnBackgroundChange 事件，携带 BackgroundImageInfo。
  - 插件 app lifecycle 在 onBeforeInitial 中订阅此事件并写入 zustand store。
  - 在 onAfterInitial 阶段从宿主 ctx.messageListFromService.backgroundInfo 同步初始背景；缺失时会清空 store。
  - UI 组件 ChatBackgroundUI 通过 useChatBackgroundContext 订阅背景状态，决定是否渲染背景与遮罩层。
- 插件为 **只读插件（ReadonlyChatAreaPlugin）**，不修改消息流本身，仅改变渲染外观。

## 2. 目录结构与核心文件

- src/index.ts
  - 子包入口，导出 createChatBackgroundPlugin 与 chatBackgroundEvent。
  - 负责组装 BackgroundPluginBizContext（storeSet + chatBackgroundEvent），返回给外部作为 PluginRegistryEntry 的实例。
- src/plugin.ts
  - 定义 BizPlugin：继承 ReadonlyChatAreaPlugin<BackgroundPluginBizContext>。
  - 固定 pluginMode = PluginMode.Readonly，pluginName = PluginName.ChatBackground，声明该插件类型与宿主系统约定一致。
  - 使用 createReadonlyLifeCycleServices 绑定 bizLifeCycleServiceGenerator，并通过 createCustomComponents 注册 MessageListFloatSlot: ChatBackgroundUI。
- src/store.ts
  - createBackgroundImageStore(mark: string)
    - 使用 zustand + devtools 创建 store，state 为 BackgroundImageState（backgroundImageInfo）+ BackgroundImageAction（setBackgroundInfo / clearBackgroundStore）。
    - 初始 backgroundImageInfo 中 mobile_background_image / web_background_image 为空对象。
    - devtools name 以 botStudio.ChatBackground.${mark} 命名，在 IS_DEV_MODE 下启用调试。
  - BackgroundImageStore 类型为上述工厂返回的 hook 类型。
- src/types/biz-context.ts
  - 定义 ChatBackgroundEventName 枚举（当前仅 OnBackgroundChange）。
  - ChatBackgroundEvent 类型为 mitt 事件映射：OnBackgroundChange -> BackgroundImageInfo。
  - BackgroundPluginBizContext：
    - storeSet.useChatBackgroundContext: BackgroundImageStore。
    - chatBackgroundEvent: Emitter<ChatBackgroundEvent>。
- src/services/life-cycle/app.ts
  - bizAppLifeCycleService: ReadonlyAppLifeCycleServiceGenerator<BackgroundPluginBizContext>。
  - onBeforeInitial:
    - 从 pluginBizContext 取 chatBackgroundEvent 和 storeSet。
    - 订阅 OnBackgroundChange 事件，事件回调中调用 setBackgroundInfo 更新 store。
  - onAfterInitial(ctx):
    - 读取 ctx.messageListFromService.backgroundInfo。
    - 若存在则 setBackgroundInfo；否则调用 clearBackgroundStore 保证状态一致。
  - onBeforeDestroy:
    - 清空 chatBackgroundEvent.all，避免事件泄漏。
- src/custom-components/chat-background-ui/index.tsx
  - ChatBackgroundUI: MessageListFloatSlot 实现。
  - 使用 useReadonlyPlugin<BackgroundPluginBizContext>(PluginName.ChatBackground) 获取插件实例，再从 plugin.pluginBizContext.storeSet 中取 useChatBackgroundContext。
  - 通过 useShallow 订阅 backgroundImageInfo；当 mobile_background_image.origin_image_url 存在时视为背景模式开启。
  - 背景模式下：
    - 如果传入 headerNode，则渲染一层样式遮罩（styles.mask）。
    - 始终渲染 WithRuleImgBackground backgroundInfo={backgroundImageInfo}。
- 其它配置文件
  - package.json：
    - main=src/index.ts，仅提供源码入口，构建/打包策略由上层 Rush/Rsbuild 统一管理。
    - scripts：build（当前为 no-op，占位）、lint（eslint ./ --cache）、test（vitest --run --passWithNoTests）、test:cov（带覆盖率）。
    - dependencies：
      - @coze-common/chat-area / chat-uikit / @coze-arch/bot-api / @coze-studio/bot-detail-store 等工作区包。
      - 状态和事件：zustand、mitt、immer、classnames。
  - tsconfig.json：
    - 作为 solution-level tsconfig，composite: true，引用 tsconfig.build.json、tsconfig.misc.json，exclude: ["**/*"]，实际编译配置在引用文件中。
  - vitest.config.ts / eslint.config.js：
    - 均采用 @coze-arch/* 预设（preset: 'web'），遵守前端仓库统一测试与 lint 规范。

## 3. 开发与运行工作流

### 3.1 子包内常用命令

- 安装依赖（在仓库根目录）：
  - rush install 或 rush update（遵循前端 README 说明）。
- 在本子包目录 frontend/packages/common/chat-area/plugin-chat-background 下：
  - 代码检查：npm run lint
  - 单元测试：npm run test
  - 带覆盖率测试：npm run test:cov
  - 构建：npm run build（当前实现为 exit 0，多为占位，实际打包由上层 app/rsbuild 负责）。

### 3.2 在应用中集成插件（概念层面）

- 宿主聊天区框架会使用 PluginRegistryEntry 机制收集插件：
  - 通过 createChatBackgroundPlugin() 拿到 { ChatBackgroundPlugin, chatBackgroundEvent }。
  - 将 ChatBackgroundPlugin 注册进 @coze-common/chat-area 的插件系统。
- 当业务侧希望更新背景：
  - 调用 chatBackgroundEvent.emit(ChatBackgroundEventName.OnBackgroundChange, backgroundImageInfo)。
  - 或宿主在初始化上下文 ctx.messageListFromService.backgroundInfo 中传入初值。

## 4. 项目特有约定与模式

- **只读插件模式**
  - 统一使用 ReadonlyChatAreaPlugin，pluginMode 固定为 PluginMode.Readonly。
  - 推荐仅在 lifeCycleServices 中读宿主数据/写本地 store，不直接操作 DOM 或宿主内部状态。
- **业务上下文约定**
  - BackgroundPluginBizContext 是插件对外暴露的唯一业务上下文：storeSet + chatBackgroundEvent。
  - 新增能力时尽量在 biz-context.ts 中扩展类型，而非在各处散落增加字段。
- **事件命名与清理**
  - ChatBackgroundEventName 统一集中在枚举中维护，避免魔法常量。
  - 在 onBeforeDestroy 中统一清理 chatBackgroundEvent.all，新增事件时不需额外手动解绑。
- **Zustand Store 使用**
  - store 工厂 createBackgroundImageStore 通过 mark 产生带命名空间的 devtools 实例，方便多实例调试。
  - 外部组件使用时应复用 useChatBackgroundContext hook，不直接创建新 store。
  - 默认空背景使用空对象，UI 通过是否存在 origin_image_url 进行「是否启用背景模式」判定。
- **UI 插槽与样式**
  - UI 接入点固定为 MessageListFloatSlot，保证与其它聊天插件互不干扰。
  - 遮罩样式使用本地 less 模块（index.module.less），仅控制局部视觉效果，避免全局样式污染。
- **配置与工具链共享**
  - ESLint/Vitest/TS 配置均通过 @coze-arch/* 包统一定义，子包仅负责声明 preset 与 dirname。
  - 如需修改风格/规则，应优先到相应 config 包中调整，而不是在本子包内覆盖大量规则。

## 5. 与外部模块的集成细节

- @coze-common/chat-area
  - 提供 PluginRegistryEntry、ReadonlyChatAreaPlugin、createCustomComponents、createReadonlyLifeCycleServices、ReadonlyAppLifeCycleServiceGenerator 等核心类型与工具。
  - 插件名称 pluginName 必须与 PluginName.ChatBackground 对齐，否则宿主无法正确识别该插件及其 UI 插槽。
- @coze-common/chat-uikit
  - WithRuleImgBackground 接收 BackgroundImageInfo 并绘制背景，内部已处理各种比例和规则，无需在本子包重复判断；只需确保传入的 backgroundInfo 字段完整。
- @coze-arch/bot-api/developer_api
  - BackgroundImageInfo 定义背景结构，包括 mobile_background_image / web_background_image 及各自的 origin_image_url 等。
  - 如 API 层新增字段，本子包通常只需透传给 WithRuleImgBackground 即可。
- mitt
  - chatBackgroundEvent 为单一 mitt 实例，用于在插件内及外部业务之间传递背景变更事件。
  - 事件通道是全局单例，应避免在本子包中创建多份无关 mitt 实例。

## 6. 团队流程与协作注意事项

- 仓库级流程参见 frontend/README.md：
  - 使用 Rush + PNPM 管理依赖，Node >= 21。
  - 前端整体采用 Rsbuild 构建，Vitest 做单测。
- 在本子包开发时的建议协作流程（非规范性，仅反映当前实践）：
  - 新增行为时优先通过 lifecycle service 和事件/store 扩展，而非在 UI 组件中直接写复杂逻辑。
  - 改动背景数据结构时同步更新：
    - store.ts 的默认初始值；
    - biz-context.ts 中事件和上下文类型；
    - 对应 UI 组件中对 BackgroundImageInfo 的依赖判断。
  - 若新增插件 UI 插槽或生命周期钩子，请复用 createCustomComponents / createReadonlyLifeCycleServices 的模式，与当前实现保持一致。

## 7. 典型扩展点与注意事项

- 新增背景来源场景
  - 可在外部业务侧通过 chatBackgroundEvent.emit 新增更多触发场景，无需修改本子包核心逻辑，只要事件 payload 满足 BackgroundImageInfo 即可。
- 调试背景状态
  - 在开发模式下，可通过浏览器 Redux/Zustand Devtools 观察 botStudio.ChatBackground.* 命名空间下的状态变化。
- 避免的反模式
  - 不要在 ChatBackgroundUI 中直接访问全局 store 实例或 window 变量，应通过 useReadonlyPlugin 得到当前插件上下文。
  - 不要在 lifecycle 回调中引入副作用以外的长生命周期单例（例如新的 mitt 实例），以免与已有 chatBackgroundEvent 行为冲突。
