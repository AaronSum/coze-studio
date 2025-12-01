# @coze-agent-ide/plugin-area-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/plugin-area-adapter）中安全、高效地协作开发。

## 1. 子包定位与全局架构

- NPM 包名：`@coze-agent-ide/plugin-area-adapter`，位于 frontend/packages/agent-ide/plugin-area-adapter。
- 职责：为 Agent IDE 机器人编辑页的「插件 APIs 区域」提供一个**高度集成的业务组件**，并作为其它工作区（如上层应用）接入插件 APIs 能力的稳定入口。
- 对外主要导出：
  - `PluginApisArea`：插件 API 区域主组件，用于在 bot 详情页中展示/配置插件 API 能力。
  - `IPluginApisAreaProps`：组件 props 类型，当前等价于 `ToolEntryCommonProps`，主要包含标题等工具区通用属性。
- 源码结构极简：
  - [src/index.ts](src/index.ts)：包级入口，仅 re-export `PluginApisArea` 与类型，不含业务逻辑。
  - [src/components/plugin-apis-area/index.tsx](src/components/plugin-apis-area/index.tsx)：**唯一核心业务实现文件**，包含状态读取、事件集成与 UI 组合。
  - [src/components/plugin-apis-area/index.module.less](src/components/plugin-apis-area/index.module.less)：本组件局部样式（工具内容区与空态文案样式）。
  - [src/typings.d.ts](src/typings.d.ts)：引入 `@coze-arch/bot-typings` 全局类型声明。
- 设计动机：
  - 将「插件 API 列表 + 配置弹窗 + 事件集成」这一块复杂交互封装为一个独立、稳定的 React 组件；
  - 复用已有基础能力：插件内容渲染使用 `@coze-agent-ide/plugin-content-adapter` 的 `PluginContent`，工具区框架使用 `@coze-agent-ide/tool` 的 `ToolContentBlock`/`AddButton` 等；
  - 上层页面只需要提供 `title` 等基础信息即可快速挂载插件区，而不需要关心内部事件、Store 与风险提示逻辑。

## 2. 全局数据流与职责边界

`PluginApisArea` 主要将多个上游 store、工具包和组件连接起来，整体数据流可概括为：

1. 从 bot 相关 Store 读取基础上下文：
   - `useBotInfoStore`：获得当前 `botId`。
   - `useBotDetailIsReadonly`：判断是否为只读场景（如被锁定或只读视图）。
   - `usePageRuntimeStore`：读取 `init` 标志，用于首屏或重新加载时触发刷新插件列表逻辑。
   - `useSpaceStore`：获取当前工作空间 `spaceID`，传入插件内容组件。
2. 从 bot-skill Store 读取插件 API 数据：
   - `useBotSkillStore(state => state.pluginApis)`：得到 `pluginApis` 列表，列表元素类型为 `PluginInfoForPlayground` 相关结构，包含 `plugin_id`、`plugin_name` 等。
3. 将 `pluginApis` 转换为 `plugins`：
   - 使用 `useState<PluginInfoForPlayground[]>` 存放本地 `plugins`，并在 `updatePluginApis` 中按如下规则转换：
     - `id = plugin_id`，`name = plugin_name`，其余字段透传。
   - 使用 `groupBy(pluginApis, api => api.plugin_id)` 去重计算当前插件种类数，并通过 `prevLength`（`useRef`）记忆上一次数量，只有在 `init` 为 true 或数量增加时才刷新 `plugins`，避免不必要重算。
4. 工具区状态与默认展开：
   - `useToolValidData()`：将当前是否已配置插件（`Boolean(pluginApis.length)`) 上报给工具体系，便于在其它区域判断该块是否“有效配置”。
   - `useDefaultExPandCheck({ blockKey: SkillKeyEnum.PLUGIN_API_BLOCK, configured: pluginApis.length > 0 })`：根据是否已配置插件和用户历史行为，决定 `ToolContentBlock` 初次渲染时是否展开。
5. 事件体系集成：
   - `usePluginApisModal()`：来自 `@coze-agent-ide/bot-plugin`，提供：
     - `node`：插件 API 配置弹窗节点，应挂载在 `PluginApisArea` 根节点内。
     - `open(type?: number)`：打开配置弹窗的方法，可选传入类型字段。
   - 通过 `handleEvent(OpenModalEvent.PLUGIN_API_MODAL_OPEN, openHandler)` 监听全局事件总线：
     - `openHandler($data)` 从 `$data` 中读取 `type` 字段（`$data as { type: number }`），并调用 `open(type)` 打开弹窗。
     - 在组件卸载时使用 `removeEvent` 取消监听，防止内存泄漏。
   - 同时通过 `OpenBlockEvent.PLUGIN_API_BLOCK_OPEN` 作为 `ToolContentBlock` 的 `blockEventName`，让通用工具区可以侦测到“插件区被展开”的行为。
6. 渲染插件内容：
   - 当 `pluginApis.length > 0` 时：
     - 渲染 `PluginContent`（来自 `@coze-agent-ide/plugin-content-adapter`），传入：
       - `spaceID`、`botId`、`pluginApis`、`plugins`、`readonly`；
     - 由主包 `@coze-agent-ide/plugin-content` 负责具体插件列表、卡片、交互等 UI 实现。
   - 当 `pluginApis` 为空时：
     - 显示 i18n 文案 `I18n.t('bot_edit_plugin_explain')` 作为空态提示。
7. 添加插件入口：
   - 工具区右侧使用 `AddButton`：
     - 点击时先 `open()` 打开插件 API 弹窗；
     - 紧接着调用 `handlePluginRiskWarning()`，触发插件风险提示（职责在 `@coze-agent-ide/plugin-risk-warning` 包内）。

> 综上：本包不直接处理插件配置细节、网络请求或表单，只负责**汇聚 Store、事件与主展示组件**，为 Agent IDE 页面提供「插件 API 区域」的一站式入口。

## 3. 构建、测试与本地开发流程

- 依赖管理：
  - 整个前端仓库使用 Rush + workspace 统一管理依赖；在仓库根目录执行：
    - `rush update`：安装/更新全部前端子包依赖。
- 本子包常用 NPM Script（在 frontend/packages/agent-ide/plugin-area-adapter 目录执行）：
  - `build`: `exit 0`
    - 当前为**占位命令**，不产生构建产物；真实打包在上层统一构建流程中完成（例如 Rush 的 ts-check / app 级 bundler）。
  - `lint`: `eslint ./ --cache`
    - 使用根部 `eslint.config.js` + `@coze-arch/eslint-config` 的 web 规则，开发/修改 TSX 文件时需保证通过。
  - `test`: `vitest --run --passWithNoTests`
  - `test:cov`: `npm run test -- --coverage`
    - 测试配置在 [vitest.config.ts](vitest.config.ts)，通过 `@coze-arch/vitest-config.defineConfig` 设置 `preset: 'web'`，适配前端 React 组件测试环境。
- TypeScript 配置：
  - [tsconfig.build.json](tsconfig.build.json)：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，启用统一前端 TS 规范；
    - `rootDir: src`，`outDir: dist`，`jsx: react-jsx`，`module: ESNext`，`target: ES2020`，`moduleResolution: bundler`；
    - 通过 `references` 引用 arch/config 相关包与 agent-ide 其它子包，支持 TS project references 与 Rush 增量构建。
  - [tsconfig.json](tsconfig.json) 作为 composite 工程入口，配合 `tsconfig.misc.json` 管理测试/配置文件类型检查。
- Storybook：
  - `.storybook/` 目录存在，说明该包可通过 Storybook 进行交互调试；dev 命令通常为 `npm run dev`（具体配置可参考 `.storybook/main` 与 root rushx 配置）。

## 4. 关键依赖与集成细节

`PluginApisArea` 处于 Agent IDE 多个子系统交汇处，关键外部依赖如下：

- Agent IDE 领域包：
  - `@coze-agent-ide/tool`：
    - `ToolContentBlock`：标准化工具区块组件，负责区块标题、展开/收起、右侧操作按钮等布局；
    - `AddButton`：右上角「添加」按钮组件，内置禁用/tooltip/自动隐藏逻辑；
    - `useToolValidData`：向上层工具配置系统上报当前区块是否已有效配置（用于导航提示等）。
  - `@coze-agent-ide/tool-config`：
    - `SkillKeyEnum.PLUGIN_API_BLOCK`：标识插件 API 区块的技能 key，用于默认展开逻辑和埋点。
  - `@coze-agent-ide/plugin-content-adapter`：
    - `PluginContent`：插件内容展示主组件，本包只负责传入 `spaceID`/`botId`/`pluginApis`/`plugins`/`readonly`。
  - `@coze-agent-ide/bot-plugin`：
    - `usePluginApisModal`：插件 API 配置弹窗 Hook，返回 `node` 与 `open`；本组件负责挂载 `node` 并在按钮/事件中调用 `open`。
  - `@coze-agent-ide/plugin-risk-warning`：
    - `handlePluginRiskWarning`：在打开添加插件弹窗时触发插件风险提示，防止用户忽略风险信息。
- Coze Arch 基建：
  - `@coze-arch/bot-utils`：
    - `handleEvent` / `removeEvent`：用于订阅/取消订阅全局事件；
    - `OpenModalEvent.PLUGIN_API_MODAL_OPEN`、`OpenBlockEvent.PLUGIN_API_BLOCK_OPEN`：插件 API 模态与区块打开相关的事件常量。
  - `@coze-arch/bot-studio-store`：
    - `useSpaceStore`：读取当前 workspace `space.id`，用于 PluginContent 调用。
  - `@coze-arch/bot-api`：
    - `PluginInfoForPlayground`：插件信息类型定义，本包对其做轻量封装后传给 `PluginContent`。
  - `@coze-arch/i18n`：
    - `I18n.t(key)`：统一文案国际化；空态与按钮 tooltip 均使用 i18n key（如 `bot_edit_plugin_explain`、`bot_edit_plugin_add_tooltip`）。
  - `@coze-arch/bot-hooks`：
    - `useDefaultExPandCheck`：根据 blockKey 与是否已配置，决定区块初始展开态，并与用户历史偏好结合。
- Bot 详情 Store：
  - `@coze-studio/bot-detail-store`：
    - `useBotDetailIsReadonly`：读取当前 bot 是否为只读。
  - `@coze-studio/bot-detail-store/bot-info`：
    - `useBotInfoStore`：当前 botId 等基础信息。
  - `@coze-studio/bot-detail-store/bot-skill`：
    - `useBotSkillStore`：提供 `pluginApis` 列表，是插件区主数据源。
  - `@coze-studio/bot-detail-store/page-runtime`：
    - `usePageRuntimeStore`：`init` 标志影响插件区是否重新刷新数据。
- 通用工具：
  - `zustand` + `useShallow`：对 Store 进行浅比较选择，减少不必要渲染。
  - `lodash-es/groupBy`：根据 `plugin_id` 对 `pluginApis` 分组，统计不同插件数量，用于控制刷新的频率。
  - `classnames`：在样式文件中可能使用（目前 index.tsx 内未直接使用，但被声明为依赖）。

## 5. 工程规范与项目约定

- 组件职责与边界：
  - `PluginApisArea` 作为**单一组件入口**，其主要责任是：
    - 整合 Store、事件与主展示组件；
    - 管理「是否已配置插件」状态；
    - 提供添加操作入口与风险提示；
    - 将插件列表渲染交给 `PluginContent`；
  - 不在本包内实现插件配置表单、网络请求或数据校验，这些逻辑属于 `@coze-agent-ide/bot-plugin` 与 `@coze-agent-ide/plugin-content`。
- 状态管理：
  - 仅使用 React 自身的 `useState`/`useRef` 管理局部 UI 状态（如 `plugins` 列表、`prevLength`），**不创建新的全局 store**；
  - 跨组件/页面的业务状态全部来自外部 store（bot-detail-store、space-store 等）。
- 事件处理：
  - 与全局事件的对接统一通过 `handleEvent` / `removeEvent`，并在 `useEffect` 中配对注册/注销，避免内存泄漏；
  - 对事件数据 `$data` 无显式类型约束，目前通过 `as { type: number }` 使用，若未来拓展事件结构，应优先在 `@coze-arch/bot-utils` 声明确切类型后再更新此处。
- 样式与测试：
  - 样式使用 CSS Modules（`index.module.less`），类名通过 `s['xxx']` 方式引用；
  - 关键交互元素（添加按钮、空态文案）均设置了 `data-testid`，测试时建议通过这些 id 进行选择器匹配，而不要依赖样式类名。
- 版权与 License：
  - 所有源码文件头部使用 Apache-2.0 版权声明（参考 [src/index.ts](src/index.ts)、[src/components/plugin-apis-area/index.tsx](src/components/plugin-apis-area/index.tsx)）；新增文件时需保持一致。

## 6. 对 AI 助手的具体协作建议

- 若需调整插件区展示行为或交互：
  - 优先在 `PluginApisArea` 中修改：
    - 例如更改默认展开逻辑、添加新的工具区按钮、调整空态展示文案；
  - 若涉及插件卡片布局、操作菜单等 UI，请前往 `@coze-agent-ide/plugin-content` 源码（frontend/packages/agent-ide/plugin-content）查看对应说明与实现，在主包中修改后，再通过本包适配。
- 若需扩展插件配置弹窗行为：
  - 修改 `@coze-agent-ide/bot-plugin` 中的 `usePluginApisModal` 实现或注入参数；
  - 本包只负责调用 `open(...)` 与挂载 `node`，一般无需变更。
- 若需新增与插件有关的全局事件：
  - 在 `@coze-arch/bot-utils` 中增加新的 `OpenModalEvent` / `OpenBlockEvent` 常量；
  - 在 `PluginApisArea` 中通过 `handleEvent` 进行监听，记得在 `useEffect` 清理函数中使用 `removeEvent`。
- 开发注意事项：
  - 保持 `src/index.ts` 仅做 re-export，不在入口文件添加业务逻辑；
  - 变更公共导出（新增/重命名导出）前，应在 monorepo 中全局搜索 `@coze-agent-ide/plugin-area-adapter` 的引用，评估影响范围；
  - 避免在本包中引入与插件区无关的组件或工具函数，这类能力应放在更合适的领域包中（如 tool、plugin-content 等）。

## 7. 本子包的特殊/需要注意的点

- 构建脚本为 no-op：
  - `npm run build` 仅执行 `exit 0`，真实编译依赖于 monorepo 统一流程（Rush ts-check / 应用级打包），因此：
    - 不要在本包内增加自定义 bundler 或打包脚本；
    - 类型检查与产物问题应通过上层 CI 或 Rush 命令排查。
- 强依赖多个 workspace 子包：
  - 插件区行为高度依赖 `@coze-agent-ide/*` 与 `@coze-studio/*`、`@coze-arch/*` 包，修改类型或 API 时要意识到联动影响；
  - 如需在本包增加新依赖，优先检查 monorepo 其它包是否已使用同一版本，保持版本统一，避免 workspace 冲突。
- 逻辑极薄但集成点多：
  - 虽然代码量不大，但本包处于多条业务链路交汇处（bot 详情页、插件系统、风险提示、工具区框架等），修改逻辑时建议：
    - 尽量通过小步改动 + 单测验证；
    - 在上层应用（如 Agent IDE 页面）实际跑通「添加插件、编辑插件、查看空态」全流程后再提交改动。