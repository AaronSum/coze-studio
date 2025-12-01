# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/skills-pane-adapter）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是 Agent IDE 中“技能面板”的前端适配层，只暴露一个导出入口：src/index.ts 中导出的 SkillsPane 组件。
- 组件结构较简单：
  - src/components/skills-pane/index.tsx：主容器 SkillsPane，负责渲染调试工具面板入口、弹窗以及导航菜单。
  - src/components/skills-pane/skills-nav.tsx：左侧导航（SkillsNav），目前只包含“权限管理”一个导航项。
- 本包不直接发起网络请求，也不维护复杂业务状态，而是通过以下外部依赖完成数据与 UI：
  - @coze-studio/bot-detail-store：获取当前 botId 等 Bot 详情状态。
  - @coze-arch/i18n：统一文案多语言能力（I18n.t）。
  - @coze-arch/coze-design：UI 基础组件和图标（MenuItem、MenuSubMenu、IconCozSkill、IconCozUserPermission 等）。
  - @coze-agent-ide/space-bot：提供 NavModal、NavModalItem、PluginPermissionManageList、PermissionManageTitle 等 Agent 相关 UI 容器和业务组件。
  - @coze-agent-ide/debug-tool-list：提供 ToolPane 与 OperateTypeEnum，负责将入口挂到调试工具列表中。
- 数据流：
  - SkillsPane 从 useBotInfoStore 读取 botId，将其透传给 PluginPermissionManageList；
  - 通过 SkillsNav / 下拉菜单选择 navItem，切换弹窗内容；
  - 弹窗可关闭（onCancel）或从 ToolPane 入口再次打开。

## 开发工作流（构建 / 测试 / 调试）

- 包级脚本定义于 package.json：
  - build："exit 0"，当前不做真实构建，通常由上层 workspace 的统一构建流程处理（例如 rush、前端应用打包）。
  - lint："eslint ./ --cache"，使用根仓库的 @coze-arch/eslint-config 规则。
  - test："vitest --run --passWithNoTests"，基于 vitest，在无测试用例时也视为通过。
  - test:cov：在 test 基础上增加覆盖率统计。
- 测试配置：[vitest.config.ts](vitest.config.ts) 使用 @coze-arch/vitest-config：
  - 通过 defineConfig({ dirname: __dirname, preset: 'web' }) 继承统一 Web 预设（jsdom 环境、别名、基础 mock 等）。
- TypeScript 配置：
  - [tsconfig.json](tsconfig.json) 仅用于 Project References 管理，exclude 全部源码，引用 tsconfig.build.json 与 tsconfig.misc.json，实际编译选项在这些文件中定义（在本包开发时保持与 monorepo 其他包一致即可）。
- Storybook：
  - .storybook/main.js / preview.js 存在，但本包 README 中的 "dev: npm run dev" 是模板内容，当前 package.json 未定义 dev 脚本，如需 Storybook 调试请参考 monorepo 统一脚本或其他组件包的配置进行对齐。
- 典型本地开发步骤（在仓库根目录）：
  - 依赖安装：rush update 或遵循仓库 README 的安装流程。
  - 编辑本包源码：前端应用或 Storybook 中引用 @coze-agent-ide/skills-pane-adapter，热更新通常由上层应用的 dev 命令驱动。
  - 本包自检：在本包目录下执行 npm run lint、npm test 进行基础检查。

## 项目约定与编码风格

- 语言与框架：
  - 基于 React 18 + TypeScript，函数式组件为主；
  - 使用 React.FC 类型标注组件；
  - Hooks 只在顶级组件内部使用（useState、store hooks 等）。
- 组件与导出约定：
  - 子包对外仅通过 src/index.ts 暴露顶层组件（SkillsPane）；
  - 新增组件请放在 src/components/skills-pane 或新的 components 子目录，并由 index.ts 统一导出。
- UI / 交互模式：
  - 所有 UI 元素优先使用 @coze-arch/coze-design 提供的组件和图标，保证样式统一；
  - 调试面板入口统一使用 @coze-agent-ide/debug-tool-list 提供的 ToolPane，operateType 多为 DROPDOWN，并通过 dropdownProps.render 渲染下拉菜单；
  - 弹窗容器统一使用 @coze-agent-ide/space-bot 提供的 NavModal / NavModalItem，以保持 IDE 内整体风格一致。
- 文案与多语言：
  - 所有显示文案通过 I18n.t(key) 获取，不直接书写硬编码字符串；
  - 开发新交互时，应在对应 i18n 资源文件中新增 key（位置在本包之外的公共 i18n 包中）。
- 状态管理：
  - Bot 相关状态（如 botId）不在本包内部维护，通过 @coze-studio/bot-detail-store/bot-info 等 store hooks 获取；
  - 本包自身仅维护 UI 层局部状态，例如弹窗显隐 showModal、当前导航 navItem，使用 useState 即可。
- 枚举与导航：
  - 技能导航项通过 SkillsNavItem 枚举统一定义；
  - SkillsNav 组件使用 NavModalItem 渲染单个导航项，Props 包含 onSwitch、selectedItem 等，命名请对齐现有模式。
- 测试风格：
  - 使用 Vitest + React Testing Library；
  - __tests__ 目录已存在 .gitkeep，可在同级新增实际测试文件；
  - 断言风格建议使用 @testing-library/jest-dom 扩展匹配器。

## 关键外部依赖与集成方式

- @coze-agent-ide/space-bot：
  - NavModal：
    - Props: visible、onCancel、title、navigation、mainContent、mainContentTitle、width、bodyStyle 等；
    - SkillsPane 使用 NavModal 作为技能管理主弹窗，navigation 传入 SkillsNav，mainContent 由当前 navItem 决定。
  - NavModalItem：
    - 用于渲染左侧导航项，控制 selected 状态和点击回调；
  - PluginPermissionManageList、PermissionManageTitle：
    - 实现“权限管理”主内容区域，只需正确传入 botId / confirmType 等 props。
- @coze-agent-ide/debug-tool-list：
  - ToolPane：
    - 负责在调试工具列表中注册一个可点击的工具入口；
    - SkillsPane 中通过 itemKey、title、operateType、icon、onEntryButtonClick 以及 dropdownProps 配置；
    - 扩展功能时，应保持 itemKey 稳定，避免影响用户配置或埋点。
  - OperateTypeEnum：
    - 当前使用 DROPDOWN，表示入口以下拉菜单形式展开；
- @coze-studio/bot-detail-store：
  - useBotInfoStore：
    - 以 selector 形式获取当前 botId；
    - 本包不关心 store 实现细节，只需保证在 Agent IDE 环境中被正确 Provider 包裹。
- @coze-arch/coze-design：
  - MenuItem / MenuSubMenu：
    - 用于构建 ToolPane 下拉菜单；
    - 点击 MenuItem 时调用 onSwitchNavItem 切换导航并打开弹窗；
  - IconCozSkill / IconCozUserPermission：
    - 作为入口按钮图标和导航图标，新增图标时保持同一 icon 库来源。
- @coze-arch/i18n：
  - I18n.t(key)：
    - 在标题、菜单项文案中统一使用；
    - 关键 key："debug_skills"、"bot_preview_task"、"permission_manage_modal_tab_name" 等。

## 仓库流程与协作规范（与本子包相关部分）

- 版本与包管理：
  - 使用 Rush + workspace 协议管理多包依赖（见 common/config、rush.json 等）；
  - 本包的 workspace:* 依赖表示与同仓库其他包的协同开发，修改接口时需同步更新被依赖包；
  - 版本号目前为 0.0.1，作为内部组件使用，变更影响范围主要是 Agent IDE 前端。
- Lint / Stylelint：
  - eslint.config.js、.stylelintrc.js 引入统一的 @coze-arch/eslint-config 和 @coze-arch/stylelint-config，代码风格以这些配置为准；
  - 在本包新增样式或 JSX 时，如有风格冲突应优先修改代码而非调整全局规则。
- Storybook 与文档：
  - README.md 当前沿用模板（"Project template for react component with storybook"），实际行为以 package.json 为准；
  - 如为 SkillsPane 新增交互，建议同步在 Storybook 中补充示例，方便设计与前后端联调，但 Storybook 配置位于本包 .storybook 目录与上层工具链中。

## 扩展与修改时的注意事项

- 保持组件职责边界清晰：
  - SkillsPane 只做“入口 + 容器 + 导航选择”，具体业务内容通过外部组件（如 PluginPermissionManageList）承载；
  - 如果需要新增新的技能类别（例如“调试日志”、“调用统计”等），建议：
    - 在 SkillsNavItem 中增加新枚举；
    - 在 SkillsNav 中支持多项导航（或新增多导航组件）；
    - 在 getMainContent / getMainContentTitle 中为新枚举返回对应内容组件；
    - 在 getMenus 中追加新菜单项，复用 coze-design 的 MenuItem 与图标。
- 与上游 IDE 的集成：
  - ToolPane 配置（itemKey、title、icon）可能与 IDE 其他区域（快捷入口、埋点统计）有耦合，修改前建议在整个仓库中搜索引用确认；
  - NavModal 的宽度、样式（width=1000、bodyStyle.padding=0）是与其他弹窗对齐的约定，只有在确有 UI 需求时才应调整。
- 国际化 & 无障碍：
  - 不在本包内直接硬编码任何用户可见文本，所有新增展示文案必须通过 I18n；
  - Icon 与文案组合时，注意保持与其他 Agent IDE 面板一致的命名和 icon 语义（例如“权限”相关统一使用 IconCozUserPermission）。

## 特殊/非典型特性说明

- build 脚本当前是占位实现（exit 0）：
  - 说明本包的实际打包依赖于上层统一 pipeline，AI 助手在修改此处脚本前，应先查阅根仓库构建说明（例如 frontend/README.md、rushx-config 等）。
- 测试目录目前为空：
  - __tests__ 中只有 .gitkeep，这意味着尚未为 SkillsPane 编写单元测试；
  - 在新增功能时，可以参考仓库中其他前端包的测试风格，使用 Vitest + React Testing Library。
- 子包规模较小：
  - 当前代码行数有限，任何改动都可能对整体行为产生可见影响，提交前建议在实际 IDE 场景中验证弹窗、菜单与权限列表是否能正常联动。
