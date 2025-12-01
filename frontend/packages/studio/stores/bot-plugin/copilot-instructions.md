# @coze-studio/bot-plugin-store Copilot Instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/stores/bot-plugin）中安全、高效地协作开发。

## 全局架构与核心职责

- 本子包是 Coze Studio 前端 monorepo 中的一个「Store 层子包」，通过 React Context + Zustand 管理「插件编辑器」相关状态。
- 对外仅暴露少量高层 API（见 src/index.ts），调用侧只依赖 Provider 和若干 hooks，不直接访问内部 store 实现或 utils。
- 核心结构：
  - React 上下文与 hooks：见 src/context.tsx，负责承载 store 引用、导航回调、UI 控制器等。
  - 业务状态 store：见 src/store/plugin.ts，封装插件信息、权限、锁定状态等，通过 PluginDevelopApi 与后端交互。
  - UI 辅助 store：见 src/store/plugin-history-panel-ui.ts，用于控制「历史版本面板」显示状态。
  - 类型定义：见 src/types/*，统一描述插件 API 响应、权限、角色等。
  - 工具方法：见 src/utils/*，负责错误文案封装与基于 fetch 的解锁请求等。
- 数据流向：
  - 组件树外层使用 BotPluginStoreProvider 提供上下文和 store。
  - 内部通过 usePluginStore/usePluginStoreInstance 在子组件中选择性订阅 store（带 shallow 比较），避免无关重渲染。
  - 针对「多人编辑锁」场景，既有 store 内部的 CheckAndLock/Unlock 调用，也有 utils/api.ts 提供的独立函数给外部调用，保持逻辑一致。

## 关键导出与使用方式

- 顶层导出：见 src/index.ts。
  - Provider：BotPluginStoreProvider
    - 必须在插件相关 React 组件树外层包裹，传入 pluginID、spaceID、可选 projectID/version 以及回调 resourceNavigate/onStatusChange/onUpdateDisplayName。
  - Store Hooks：
    - usePluginStore(selector)：按 selector 读取/订阅 BotPluginStateAction；内部使用 useStoreWithEqualityFn + shallow，编写 selector 时尽量窄。
    - usePluginStoreInstance()：直接获得整个 Zustand store 实例，适合在 util 层或复杂操作中使用；谨慎使用，避免绕过 selector 最佳实践。
  - UI/控制 Hooks：
    - useMemorizedPluginStoreSet()：获取 memorizedStoreSet，目前只包含 usePluginHistoryPanelUIStore；若 Provider 未注入会抛异常。
    - usePluginHistoryController / usePluginHistoryControllerRegistry：利用 ref 保存「历史记录控制器」，组件调用 registry 将自身控制器注册给上层。
  - 回调与导航：
    - usePluginCallbacks()：从上下文中获取 onUpdateDisplayName/onStatusChange，供子组件触发外部 UI 变化。
    - usePluginNavigate()：返回 PluginNavType 对象，包含 toResource/tool/mocksetList/mocksetDetail/cloudIDE 等导航方法，由宿主注入并在本子包内透明转发。
  - 其他导出：
    - ROLE_TAG_TEXT_MAP：从 src/types/auth.ts 暴露，按 SpaceRoleType 映射本地化角色文案。
    - useUnmountUnlock：组件卸载或窗口关闭时触发解锁 fetch 调用的 hook。
    - checkOutPluginContext/unlockOutPluginContext：外部在本 store 体系之外也可进行锁检测/解锁的独立 API。

## 状态与业务逻辑细节

- 插件状态 store：src/store/plugin.ts
  - Zustand 模式：使用 create + subscribeWithSelector + devtools，中间件名称为 "botStudio.botPlugin"，只在 IS_DEV_MODE 时启用调试。
  - 核心字段（见 src/types/store/plugin.ts 的 PluginState）：
    - pluginId/spaceID/projectID/version：标识当前插件与所属空间、项目以及版本（version 存在时视为只读预览）。
    - canEdit：是否可编辑，受用户权限和 version 是否存在影响。
    - isUnlocking：当前是否正在执行解锁请求，防止重复触发。
    - auth：GetUserAuthorityData 用户权限信息。
    - updatedInfo：GetUpdatedAPIsResponse，包含 updated_api_names、created_api_names 等。
    - pluginInfo：GetPluginInfoResponse & { plugin_id?: string }，插件基础信息。
    - initSuccessed：是否完成 initUserPluginAuth + initPlugin + initTool 三项初始化。
  - 派生/操作方法（BotPluginStateAction）：
    - getIsIdePlugin：根据 pluginInfo.creation_method === CreationMethod.IDE 判断是否 IDE 插件；IDE 插件跳过锁逻辑。
    - initUserPluginAuth：调用 PluginDevelopApi.GetUserAuthority，失败时抛 CustomError(REPORT_EVENTS.normalError, getPluginErrorMessage('auth init'))，并设置 auth/canEdit。
    - initPlugin：通过 PluginDevelopApi.GetPluginInfo 加载插件详情并 setPluginInfo；错误同样包装为 CustomError + getPluginErrorMessage。
    - initTool：调用 PluginDevelopApi.GetUpdatedAPIs 获取更新的工具列表，并填充 updatedInfo。
    - init：并行执行上述三个 init 方法后 setInitSuccessed(true)。
    - checkPluginIsLockedByOthers：调用 PluginDevelopApi.CheckAndLockPluginEdit；若被其他用户占用则弹 UIModal.info，文案依赖 I18n 与 ROLE_TAG_TEXT_MAP，返回 true（被占用）。
    - wrapWithCheckLock(fn)：返回一个先执行 checkPluginIsLockedByOthers 再执行 fn 的包装函数，用于保护写入操作。
    - unlockPlugin：在非 IDE、可编辑、未处于 isUnlocking 状态时调用 PluginDevelopApi.UnlockPluginEdit 并维护 isUnlocking 标志；错误同样通过 CustomError 包装。
    - setPluginInfo/setUpdatedInfo/setCanEdit/setInitSuccessed/updatePluginInfoByImmer：所有写操作都通过 immer.produce 保证不可变更新，并给 devtools 设置明确 action 名。

- 历史面板 UI store：src/store/plugin-history-panel-ui.ts
  - 状态字段：isVisible；操作 setVisible(action) 支持直接传布尔值或 (prev) => boolean。
  - 通过 devtools 中间件记录 "botStudio.plugin-history-panel-ui"，只在 IS_DEV_MODE 时启用。

- 解锁与生命周期：
  - useUnmountUnlock：内部使用 window.beforeunload 注册 unlockByFetch 调用，确保浏览器关闭时通知后端解锁；注意 keepalive: true。
  - unlockByFetch：见 src/utils/fetch.ts，通过 fetch('/api/plugin_api/unlock_plugin_edit', POST, JSON body) 直接调用，无依赖 bot-api SDK，用于「出 store 上下文」场景。
  - checkOutPluginContext/unlockOutPluginContext：在 utils/api.ts 中使用 PluginDevelopApi.CheckAndLockPluginEdit/UnlockPluginEdit 实现，与 store 内锁逻辑保持一致；同样使用 I18n、UIModal、ROLE_TAG_TEXT_MAP 进行占用提示与错误处理。

## 依赖与外部集成

- 内部 monorepo 依赖：
  - @coze-arch/bot-api：PluginDevelopApi、SpaceRoleType、GetUserAuthorityData 等类型/接口来源。
  - @coze-arch/bot-error：CustomError，用于统一上报与错误处理。
  - @coze-arch/bot-semi：UIModal，用于交互式提示（例如编辑锁占用提示）。
  - @coze-arch/i18n：I18n.t，用于生成本地化文案（同时在 ROLE_TAG_TEXT_MAP 中提供默认英文文案）。
  - @coze-arch/report-events：REPORT_EVENTS.normalError 常量，用于错误事件上报类别。
  - @coze-arch/eslint-config、@coze-arch/vitest-config：统一 ESLint/Vitest 配置，避免在本子包里自定义规则。

- 第三方库：
  - React：用于 Provider 与 Hooks 实现（useContext/useRef/useEffect 等）。
  - Zustand：store 实现，使用 traditional API 与 middleware（devtools + subscribeWithSelector）。
  - ahooks：useCreation 负责创建且缓存 plugin-history-panel-ui store，避免重复实例化。
  - immer：produce 简化不可变更新。

- 全局环境依赖：
  - IS_DEV_MODE：用于 devtools.enabled，来自上层构建环境，编写代码时不要在本子包里定义该常量。
  - 浏览器 window/fetch：useUnmountUnlock 与 unlockByFetch 直接依赖浏览器环境，本子包默认在 Web 前端环境中运行。

## 开发与测试工作流

- 构建：
  - package.json 中的 build 脚本目前为 "exit 0"，实际打包由 monorepo 顶层构建管线处理；在本子包内无需单独产物，重点是类型检查与测试。

- Lint：
  - 在子包目录下运行：npm run lint
  - 配置文件：eslint.config.js，通过 @coze-arch/eslint-config.defineConfig({ packageRoot: __dirname, preset: 'web' }) 继承统一规则。
  - 禁用/放宽规则：在少数文件中使用 eslint-disable 注释以适配 store 函数较长、批量导出的场景，例如 src/store/plugin.ts。新增代码时应尽量遵守现有规则，确需关闭请局部注释并保持解释清晰。

- 测试：
  - 运行单元测试：npm test 或 npm run test
  - 覆盖率：npm run test:cov
  - 配置文件：vitest.config.ts，使用 @coze-arch/vitest-config.defineConfig({ dirname: __dirname, preset: 'web' })，统一 Web 前端测试基线。
  - 目前仓库中未见针对本子包的测试文件，编写新测试时应复用该 Vitest 配置，与其他 studio/stores 子包保持风格一致。

## 代码风格与模式约定

- Store 设计：
  - 统一使用 Zustand + immer，所有状态修改都封装为显式 action，带有 devtools action 名，避免在组件中直接 set 层级字段。
  - 带副作用的操作（API 调用、弹窗等）集中在 store 内部 action 中，实现「组件无副作用、仅调用 action」。
  - 锁定/解锁逻辑统一走 PluginDevelopApi.CheckAndLockPluginEdit / UnlockPluginEdit 或 unlockByFetch，禁止在其他地方手写重复逻辑。

- 错误与上报：
  - 遇到后端 code 非 0 的情况，一律抛 CustomError(REPORT_EVENTS.normalError, getPluginErrorMessage('...'))，其中消息通过 src/utils/error.ts 统一加上前缀 [PluginStore.Error]。
  - 占用提示弹窗统一使用 UIModal.info + I18n.t + ROLE_TAG_TEXT_MAP，不在组件层单独拼接。

- 类型与导出：
  - 类型统一集中于 src/types/*，通过 src/types/index.ts 聚合导出，供 store 与组件使用；新增类型时优先扩展该目录而非零散定义。
  - 对外导出由 src/index.ts 统一出口，新增对外 API 时请在此显式列出，保持包的公共接口清晰可见。

- 国际化与角色文案：
  - 所有用户可见文案必须通过 I18n.t 或依赖已有常量（如 ROLE_TAG_TEXT_MAP）；不要在逻辑代码中硬编码中文或英文字符串，除非作为 I18n.t 的默认 fallback。

## 项目流程与协作惯例

- 分支与发布：
  - 本子包受整个 tinker-studio 前端 monorepo 管理，具体分支策略、发布流程遵循仓库根目录的 README/贡献指南（如 README.md、CONTRIBUTING.md）以及 rush.json 中的配置。
  - 子包版本号在 package.json 中声明，但实际发布节奏由 monorepo 统一控制，修改时需考虑其他依赖包的 workspace:* 版本。

- 变更注意事项：
  - 修改锁定逻辑或权限相关行为（initUserPluginAuth/checkPluginIsLockedByOthers/unlockPlugin/useUnmountUnlock/checkOutPluginContext/unlockOutPluginContext）时，务必考虑：
    - IDE 插件与普通插件的差异（getIsIdePlugin）。
    - 浏览器关闭/刷新场景的 unlockByFetch 行为。
    - UI 文案和上报事件的一致性（I18n + REPORT_EVENTS）。
  - 对 store 字段或类型做 breaking change 时，需要同步检查：
    - 依赖 usePluginStore/usePluginStoreInstance 的所有调用点。
    - 与 PluginDevelopApi 相关的类型定义（位于上游 @coze-arch/bot-api）。

## 非常规/易踩坑特性

- tsconfig.json 中通过 "exclude": ["**/*"] 完全排除了源码，真正的 TS 编译由 tsconfig.build.json/tsconfig.misc.json 完成；在 IDE 中看到的行为与实际构建可能有差异，修改 TS 配置时需同时检查这两个文件。
- IS_DEV_MODE 来自全局构建环境而不是本子包，若在新文件中使用该常量，不要重新定义，而是假定由 bundler/全局声明注入。
- useUnmountUnlock 默认不依赖依赖数组中的 pluginId 变化（依赖数组为空），意味着在同一组件生命周期内 pluginId 视为常量；若要支持动态切换 pluginId，请谨慎调整依赖关系。
- unlockByFetch 使用 fetch keepalive 选项，在某些浏览器或测试环境下可能不被完全支持，编写测试或 mock 时需显式处理。
