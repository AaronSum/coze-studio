# Copilot 使用说明（@coze-studio/chat-app-sdk）

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/open-platform/chat-app-sdk）中安全、高效地协作开发。

## 全局架构与角色定位
- 本包是 Coze Studio monorepo 中的 **Web Chat 应用 SDK**，以浏览器脚本方式向宿主页面暴露 `window.CozeWebSDK.WebChatClient`，用于在任意站点集成 Coze 聊天组件。
- 核心职责：
  - 接收宿主侧传入的 `CozeChatOptions` 配置；
  - 处理鉴权（token 获取与刷新）；
  - 通过 React + Zustand 渲染并管理一个可嵌入的 Chat Widget；
  - 对外提供少量 imperative API（如显示/隐藏聊天窗、销毁实例、获取 token）。
- 入口与导出：
  - 浏览器入口位于 `src/index.ts`，将 `WebChatClient` 挂载到 `window.CozeWebSDK` 命名空间；
  - SDK 主实现类在 `src/client/index.tsx` 中定义；
  - 状态管理、组件、hooks、工具等拆分在 `src/store/`、`src/components/`、`src/hooks/`、`src/util/` 等目录下。

## 主要模块与数据流
- `src/index.ts`
  - `import { WebChatClient } from '@/client';` 并执行：
    - `window.CozeWebSDK = window.CozeWebSDK || {};`
    - `window.CozeWebSDK.WebChatClient = WebChatClient;`
  - 约定所有外部集成代码均通过 `new window.CozeWebSDK.WebChatClient(options)` 来创建实例。

- `src/client/index.tsx`（WebChatClient 核心实现）
  - `formatOptions(optionsRaw)`：对外部传入的 `CozeChatOptions` 做归一化处理：
    - 统一兼容 `config.botInfo.botId`、`config.botId`、`config.bot_id` 三种写法；
    - 根据 `react-device-detect` 的 `isMobileOnly` 自动选择默认布局 `Layout.MOBILE` 或 `Layout.PC`；
    - 将 `componentProps` 中的 UI 配置（布局、语言、标题、宽度、上传开关等）合并进 `options.ui.base` 与 `options.ui.chatBot`；
    - 为 `ui.asstBtn`、`ui.header` 追加合理默认值（如按钮是否需要、Header 是否展示和显示关闭按钮）。
  - `WebChatClient` 类：
    - 静态属性 `clients: WebChatClient[]`：所有已创建实例的列表（用于后续排查或扩展管理）；
    - 实例属性：
      - `root`：`createRoot` 创建的 React 根节点；
      - `defaultRoot`：未指定 `options.el` 时自动创建并挂载到 `document.body` 的容器 div；
      - `globalStore`：Zustand 全局状态仓库（见 `src/store/global.ts`）；
      - `authClient`：鉴权客户端（`src/client/auth.ts`）；
      - `chatClientId`：`nanoid()` 生成的实例 ID；
      - `options`：归一化后的配置；
      - `senderName`：带时间戳的发送者标识字符串。
    - 构造函数流程：
      - 记录并格式化 `options`，创建 `AuthClient` 实例；
      - 通过 `createGlobalStore(this)` 创建全局状态；
      - 调用 `authClient.checkOptions()` 校验配置合法性，如失败则直接返回（不会渲染 UI）；
      - 根据 `options.el` 判断是使用外部传入的 DOM 容器，还是在 `document.body` 动态插入 `defaultRoot`；
      - 使用 `createRoot(renderEl)` 渲染 `CozeClientWidget` 组件，并注入 `client` 实例与 `globalStore`；
      - 将实例 push 入 `WebChatClient.clients` 静态数组。
    - 公共方法：
      - `showChatBot/hideChatBot`：分别通过 `globalStore.getState().setChatVisible(true/false)` 控制聊天窗显示状态；
      - `getToken`：当 `options.auth.type === AuthType.TOKEN` 时，通过 `onRefreshToken` 回调拉取 token；
      - `destroy`：卸载 React 根节点、移除默认容器 DOM，并从 `clients` 静态数组里删除自身。

- `src/store/global.ts`（Zustand 全局状态）
  - 使用 `zustand` + `subscribeWithSelector` + `devtools` 构建 `ClientStateAction`：
    - 状态字段：
      - `chatVisible`：聊天窗是否可见；
      - `iframe` / `iframeLoaded`：用于管理内部 iframe 宿主（由组件层设置）；
      - `imagePreview`：图片预览状态（url、是否可见等）；
      - `layout`：当前布局，默认取自 `options.ui.base.layout`；
      - `senderName`：从 `WebChatClient` 实例注入的标识；
      - `themeType`：当前主题（`'bg-theme' | 'light'`）。
    - Action 方法：
      - `setThemeType`：切换主题；
      - `setIframe` / `setIframeLoaded`：更新 iframe 相关状态；
      - `setChatVisible`：**带鉴权与生命周期回调的显隐控制**：
        - 先通过 `authClient.initToken()` 尝试初始化 token，如失败则发送 `ChatSdkErrorType.OPEN_API_ERROR` 错误消息并中止；
        - 显示前调用 `chatBot.onBeforeShow`，如返回 `false` 则阻止显示；
        - 隐藏前调用 `chatBot.onBeforeHide`，如返回 `false` 则阻止隐藏；
        - 修改 `chatVisible` 状态后，根据最终状态分别触发 `chatBot.onShow` 或 `chatBot.onHide`；
      - `setImagePreview`：使用 `immer.produce` 以函数式方式修改 `imagePreview` 子对象。
    - `devtools` 配置：
      - 仅在 `IS_DEV_MODE` 下启用，并将 store 命名为 `sdkChatApp.global`。

- `src/store/context.tsx`（Store 上下文与 Hook）
  - 定义 `GlobalStoreContext`，value 中仅有一个 `globalStore: ClientStore` 字段；
  - `GlobalStoreProvider`：将 `globalStore` 注入 React Context；
  - `useGlobalStore(selector)`：封装 `useStoreWithEqualityFn` + `shallow`，对外暴露类型安全的状态选择 hook，供组件内部消费状态。

- 其他目录（只做结构级说明）：
  - `src/components/`：承载聊天组件 UI，如入口 Widget、图标库等，均围绕 `GlobalStore` 提供的状态和动作工作；
  - `src/hooks/`：封装复用逻辑（如图片预览、消息交互等）；
  - `src/util/`：通用工具函数；
  - `src/test/`：可能包含集成或 demo 测试代码；
  - `assets/`：静态资源，如样式、图片等；
  - `dev-app/`：本地开发或调试用的小应用壳。

## 构建、调试与测试流程
- 构建脚本（见 package.json）：
  - `npm run build`：
    - 设置 `IS_OPEN_SOURCE=true`，清理 `dist_ignore`、`inhouse`、`libs`；
    - 使用 `concurrently` 运行所有 `npm:build:*` 脚本，主要产出 inhouse/online/不同 Region 的构建包；
  - 分环境打包：
    - `build:inhouse:cn/sg/boe`、`build:release:cn/oversea` 等脚本，通过设置 `CUSTOM_VERSION`、`BUILD_TYPE`、`REGION` 环境变量，最终调用 `npm run rsbuild`；
  - `npm run rsbuild`：通过 `rspack build -c ./rspack-config/build.config.ts` 执行生产构建；
  - TypeScript 构建：`npm run build:ts` 调用 `tsc -b tsconfig.build.json`，仅做 TS 编译，不负责打包。

- 本地开发与调试：
  - `npm run dev`：等价于 `IS_OPEN_SOURCE=true npm run dev:cn:rl`，默认以 release + cn 区配置启动；
  - 各 Region/版本的 dev 命令（如 `dev:boe`、`dev:cn`、`dev:sg` 等）通过设置环境变量后调用 `pnpm rsdev`；
  - `npm run rsdev`：`rspack serve -c ./rspack-config/dev.config.ts`，提供本地 HMR 开发服务器；
  - 本包依赖的 Rspack 配置位于 `rspack-config/`，并通过 exports `./rspack` 对外暴露（可供其他包复用）。

- 测试：
  - 单元测试使用 Vitest：
    - `npm run test`：`vitest --run --passWithNoTests`；
    - `npm run test:cov`：带覆盖率运行；
  - Vitest 配置在 `vitest.config.ts`，基于 `@coze-arch/vitest-config` 统一预设，环境为 Node + Web 兼容；
  - React 组件测试通常使用 `@testing-library/react` / `@testing-library/react-hooks` 配合；
  - 编写新逻辑时，如可被单元化，应尽量在 `src/**/__tests__` 或 `src/test/` 下增加对应 case。

## 关键依赖与集成特性
- UI 与框架：
  - React 18（`react`、`react-dom`）作为渲染框架，通过 `createRoot` 挂载到宿主 DOM；
  - Zustand + Immer 组合为状态管理与不可变更新工具；
  - UI 组件与样式基于 `@coze-arch/coze-design`、`@coze-common/assets/style/index.less`、Tailwind/Turbo 等内部设计体系（详见根目录配置）。

- Coze Open Chat 集成：
  - 类型与常量从 `@coze-studio/open-chat/types` 引入（`Language`、`Layout`、`AuthType` 等）；
  - 错误上报与 SDK 行为通过 `@coze-studio/open-chat` 的 `postErrorMessage`、`ChatSdkErrorType` 进行统一处理；
  - 开放的 UI 配置（`options.ui`）与生命周期钩子（`onBeforeShow/onBeforeHide/onShow/onHide` 等）由 `open-chat` 体系定义，chat-app-sdk 仅在本地 store 中进行编排调用。

- 构建相关：
  - Rspack (`@rspack/cli`, `@rspack/core`, `@rspack/plugin-react-refresh`)；
  - 各类 loader：`css-loader`、`less-loader`、`sass-loader`、`postcss-loader`、`style-loader`、`file-loader`、`@svgr/webpack` 等，用于处理样式与静态资源；
  - `.env` 变量通过 `rspack-plugin-dotenv` 注入，影响构建行为和运行时特性。

## 项目特有约定与模式
- 全局命名空间挂载：
  - SDK **仅通过 `window.CozeWebSDK` 命名空间对外暴露 API**，不要新增其它全局变量或污染 `window`；
  - 如需扩展导出能力（例如新增辅助工具类），建议统一聚合到 `window.CozeWebSDK` 下，保持对外接口收敛。

- 配置兼容性与默认值：
  - 对 `botId` 等关键配置字段，要继续保持多种命名形式兼容；
  - 对 `options.ui.*` 与 `componentProps` 的合并策略必须谨慎维护，以避免破坏既有接入方的默认展示行为；
  - 任意新增 UI 开关或属性，建议先在 `componentProps` 中支持，再由 `formatOptions` 合并至对应 `options.ui` 子块。

- 鉴权与生命周期：
  - Chat 显隐需要通过 `AuthClient.initToken()` 校验权限；任何直接绕开 `setChatVisible` 修改 `chatVisible` 的行为都是不推荐的；
  - `onBeforeShow/onBeforeHide` 允许返回 `false` 阻断显示/隐藏，这是外部业务控制的关键能力，修改时务必保留该语义；
  - 错误统一通过 `postErrorMessage` 上报，并带上 `ChatSdkErrorType.OPEN_API_ERROR` 等类型，AI 扩展错误类型时需遵循 open-chat 规范。

- 状态管理约定：
  - 全局状态应统一挂在 `ClientStateAction` 中，通过 `createGlobalStore` 创建；
  - 组件访问状态应使用 `useGlobalStore(selector)`，避免直接通过上下文读取和手动订阅；
  - 针对复杂嵌套字段（如 `imagePreview`），推荐使用 `immer.produce` 提供的函数式更新接口，保持不可变更新习惯。

## 工程配置与约束
- TypeScript：
  - `tsconfig.build.json` 继承自 `@coze-arch/ts-config`，目标浏览器环境且使用路径别名 `@` 指向 `src/`；
  - 新增 TS 文件需放在 `src/` 下，注意不要破坏已有路径别名解析；
  - 类型层面尽量依赖 `@coze-arch/bot-typings`、`@coze-studio/open-chat/types` 已有定义，避免重复造轮子。

- ESLint / Stylelint / Tailwind：
  - `eslint.config.js` 基于 `@coze-arch/eslint-config`，preset 为 `react`/`node` 结合，局部规则可能有调整；
  - 样式规范由 `@coze-arch/stylelint-config` 与 `tailwind.config.js` 约束；
  - 图片、样式等资源处理依赖 postcss/autoprefixer 等链路，新增样式时优先沿用现有 less/tailwind 约定。

## 开发协作建议（面向 AI 助手）
- 修改代码时优先关注：
  - 入口与对外 API：`src/index.ts`、`src/client/index.tsx`；
  - 状态管理：`src/store/global.ts`、`src/store/context.tsx`；
  - 关键 UI：`src/components/widget` 及其下属组件；
  - 配置/构建：`package.json`、`rspack-config/*.ts`、`tsconfig*.json`、`eslint.config.js`、`vitest.config.ts`。
- 在以下场景务必同步更新测试：
  - 改变聊天显隐的触发时机或生命周期回调调用顺序；
  - 修改鉴权逻辑（包括 `AuthClient` 行为或 `setChatVisible` 的前置校验）；
  - 调整 options 归一化规则（尤其是 `botId` 解析、多语言和布局默认值）。
- 如需新增特性：
  - 优先在 `CozeChatOptions` 类型层定义字段 → 在 `formatOptions` 中归一合并 → 在 `globalStore` 中引入状态与 action → 最后在组件中消费；
  - 避免直接操作 DOM 或绕开 React/Zustand 流程，除非是挂载根节点这类框架级操作。