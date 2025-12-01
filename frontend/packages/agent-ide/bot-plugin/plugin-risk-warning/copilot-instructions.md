# copilot-instructions for @coze-agent-ide/plugin-risk-warning

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-plugin/plugin-risk-warning）中安全、高效地协作开发。

## 全局架构与职责

- 本子包是 Coze Studio 中的 Bot 插件风险提示 UI，提供一次性风险告知弹窗逻辑。
- 核心入口在 src/index.tsx，导出 handlePluginRiskWarning，用于在业务侧调用时弹出风险提示 Modal。
- 状态管理集中在 src/store.ts，使用 zustand + devtools，负责记录「是否已阅读」等风险相关标记。
- UI 依赖内部设计系统与图标库：@coze-arch/bot-semi 的 Modal，@coze-arch/bot-icons 的图标组件。
- 国际化统一通过 @coze-arch/i18n 的 I18n.t 完成，所有文案 key 需要在上游 i18n 仓库维护。
- 与后端/用户配置交互通过 @coze-arch/bot-api 暴露的 PlaygroundApi.UpdateUserConfig 完成，写入 risk_alert_type: RiskAlertType.Plugin。
- TypeScript 工程配置继承 @coze-arch/ts-config 的 web 预设（tsconfig.build.json），构建产物输出到 dist 目录。
- Storybook 位于 .storybook 与 stories 目录，只用于开发和展示该弹窗/组件行为，不影响生产逻辑。

### 数据流简述

- 调用方在合适的时机（例如首次进入插件市场或使用插件前）调用 handlePluginRiskWarning。
- handlePluginRiskWarning 通过 useRiskWarningStore.getState() 读取 pluginRiskIsRead 状态，若为 false 才展示 Modal，并立刻将其设置为 true，防止重复弹出。
- 用户点击确认按钮后，Modal 的 onOk 回调触发 PlaygroundApi.UpdateUserConfig，将 risk_alert_type 标记为 RiskAlertType.Plugin，实现后端侧的「已读」记录。
- 关闭逻辑 onCancel 与 onOk 统一调用 handleClose，确保无论交互如何结束都会写入用户配置（目前 hasCancel: false，实际上只会走确认路径）。

## 开发与运行流程

- 本包遵循整体 Rush monorepo 规范，项目信息由 config/rush-project.json 维护，对应测试与 TS 检查输出目录。
- 依赖安装在 monorepo 根目录执行：rush update（详见仓库 README）。
- 在本包目录下常用命令：
  - lint：npm run lint（使用 @coze-arch/eslint-config 与 eslint.config.js）。
  - test：npm run test（使用 vitest，配置见 vitest.config.ts，preset 为 web）。
  - test:cov：npm run test:cov（生成 coverage 目录，对应 rush-project.json 中 coverage 输出）。
  - build：当前为占位命令（exit 0），真正 bundling 由上层构建体系处理，本子包仅需保证 TS 通过编译以及类型检查。
- Storybook：
  - main 配置位于 .storybook/main.js，使用 @storybook/react-vite + vite-plugin-svgr；stories 统一放在 stories 目录（mdx 与 stories.tsx）。
  - 若需要新增交互 demo，请在 stories 目录新增文件并按现有例子注册。

## 代码与模式约定

- 语言与框架：React 18 + TypeScript，函数式组件和 Hook 为主。
- 状态管理：
  - 所有风险相关 UI 状态通过 src/store.ts 的 useRiskWarningStore 管理，避免在组件内引入局部重复状态。
  - store 初始值 initialStore 中 pluginRiskIsRead 和 toolHiddenModeNewbieGuideIsRead 默认 true，表示在没有外部重置时不自动弹窗。
  - 若需要在业务流程中强制重新弹出，需要显式调用 useRiskWarningStore.getState().reset() 或 setPluginRiskIsRead(false)。
  - devtools 中使用 name: 'botStudio.riskWarningStore'，仅在 IS_DEV_MODE 下启用（该常量来自上游环境定义）。
- UI 与样式：
  - 所有样式使用 CSS Modules（index.module.less），类名通过 styles['class-name'] 访问，避免直接硬编码字符串。
  - Modal 配置遵循 @coze-arch/bot-semi 的 API：hasCancel、maskClosable、okButtonProps 等属性按当前用法保持一致。
  - ContentMap 中的列表项（图标 + 文本）应通过统一的样式类 modal-item / modal-text 进行布局和排版。
- 文案与 i18n：
  - 文案统一走 I18n.t(key)，严禁在组件中写死字符串。
  - 新增文案需要在 @coze-arch/i18n 对应语言包中补充 key，否则会在运行时显示占位或导致回退行为。
- 接口与后端交互：
  - PlaygroundApi.UpdateUserConfig 约定使用 risk_alert_type 字段与 RiskAlertType.Plugin 枚举值，不要随意改动字段名或枚举值，否则会破坏后端兼容性。
  - 如果未来新增其它风险类型（如工具模式、工作流等），需要在 @coze-arch/bot-api/playground_api 中先对 RiskAlertType 扩展，然后在本包中按相同模式调用。

## 与其它子系统的集成

- bot-api：
  - 提供 PlaygroundApi 和 RiskAlertType 等类型与方法，用于和 Bot Playground / 用户配置服务通讯。
  - 本包严格依赖这些公共 API，不直接发起 HTTP 请求或访问底层网络。
- i18n：
  - 运行环境中需预先初始化 I18n 实例，本包仅调用 I18n.t，不负责加载或切换语言。
- UI 体系（bot-semi / bot-icons）：
  - Modal、IconApiOutlined、IconCommunityTabOutlined、IconDiscussOutlined 等均来自统一 UI 组件库，确保风格与 Team Studio 其他模块一致。
  - 若新增图标，应优先在 @coze-arch/bot-icons 中统一维护，而不是在本包内引入外部图标库。

## 测试与质量保障

- 测试框架使用 Vitest + @coze-arch/vitest-config，统一 web preset，避免在本包中单独维护复杂测试配置。
- __tests__ 目录当前仅有 .gitkeep，可按以下约定新增测试：
  - 单元测试文件命名建议为 *.test.ts / *.test.tsx，放在 __tests__ 或与被测文件同级。
  - 对 handlePluginRiskWarning 的测试应通过 Mock PlaygroundApi.UpdateUserConfig 与 useRiskWarningStore，验证：
    - pluginRiskIsRead 为 false 时会弹出 Modal 并调用 UpdateUserConfig；
    - pluginRiskIsRead 已为 true 时不会再弹出 Modal。
- ESLint 与 Stylelint 均使用 @coze-arch 提供的共享配置，不在本包内做自定义规则；新增代码需保持零 lint 错误。

## 贡献与协作注意事项

- 分支与提交：
  - 遵循仓库统一的分支策略与提交规范（参见仓库根目录 CONTRIBUTING.md），本子包不单独定义分支策略。
- 变更范围控制：
  - 涉及风险告知策略的行为修改（如何时弹窗、是否强制确认）通常会影响合规与产品体验，应在 PR 描述中明确说明业务背景，并与相关负责人评审。
  - 不要在本包中添加与「风险告知」无关的业务逻辑，例如权限控制、计费等，应交由其他子包或后端处理。
- 向前兼容性：
  - 变更 PlaygroundApi.UpdateUserConfig 参数或 RiskAlertType 枚举前，必须确认所有调用方（含其它子包与后端）已同步升级计划。

## 扩展与常见修改场景指引

- 新增一条风险提示文案：
  - 在 ContentMap 中追加一项（icon + I18n.t 新 key），并在 i18n 仓库补全多语言文案。
- 新增一种风险类型（例如工具新手引导）：
  - 在 store 中为新类型添加状态位与 set 方法，并确保 reset 时回到期望默认值。
  - 在 index.tsx 中新增对应的处理函数（例如 handleToolHiddenModeNewbieGuideWarning），沿用 handlePluginRiskWarning 的模式，并调用 PlaygroundApi.UpdateUserConfig 写入相应的 risk_alert_type。
- 调整首次弹出时机：
  - 由上层业务负责调用时机，本包仅通过 store 的布尔值控制「是否还需要弹窗」，不要在组件内部引入计时器或复杂副作用逻辑。
