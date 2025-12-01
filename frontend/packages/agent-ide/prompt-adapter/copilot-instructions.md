# @coze-agent-ide/prompt-adapter — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/prompt-adapter）中安全、高效地协作开发。

## 全局架构与职责边界

- 子包定位：为 Agent IDE 的「提示词编辑器」提供一层适配包装，在不改动底层通用组件的前提下，为 Agent 详情页注入只读控制、提示词库入口以及编辑器扩展等能力。
- 对外导出：当前只有一个主要导出组件 PromptView（从 src/index.tsx 导出 React 组件）。
- 依赖的上游能力：
  - @coze-agent-ide/prompt：基础 Prompt 编辑视图组件 PromptView（此处命名为 BaseComponent），包含主编辑器和基本交互。
  - @coze-studio/bot-detail-store：暴露 useBotDetailIsReadonly，用于根据 Bot 详情上下文控制编辑权限。
  - @coze-arch/i18n：统一多语言文案（I18n.t）。
  - @coze-common/editor-plugins：ActionBar 与 InsertInputSlotAction 等编辑器插件，注入到 Prompt 编辑器上方的工具栏中。
  - @coze-common/prompt-kit-base：ActiveLinePlaceholder，用于在当前光标行显示占位提示文案。
- 本包不直接发起网络请求，也不维护全局状态，仅通过上述依赖读写上下文并拼装 UI；所有业务逻辑（如保存、校验等）由上游包负责。

## 组件设计与数据流

- PromptView 组件（src/index.tsx）：
  - Props：PromptViewProps = Omit<BaseProps, 'actionButton'>，即继承上游 @coze-agent-ide/prompt 的 PromptViewProps，但禁止调用方自定义 actionButton，以确保 Agent IDE 统一注入的操作栏不被覆盖。
  - 数据流：
    - 外部通过 PromptViewProps 传入所有 Prompt 内容与回调（如 value、onChange、onBlur 等），组件内部只是完整透传到 BaseComponent。
    - useBotDetailIsReadonly() 决定当前是否处于只读模式：
      - 只读时不渲染 ImportToLibrary / PromptLibrary 按钮。
      - ActiveLinePlaceholder 中的提示文案仍会渲染，但上游编辑器会基于只读状态控制是否可编辑。
  - 扩展位：
    - actionButton：在 BaseComponent 上注入一个自定义操作区域：
      - 当 !isReadonly 时渲染：
        - ImportToLibrary readonly={isReadonly} enableDiff={false}
        - PromptLibrary readonly={isReadonly} enableDiff={false}
      - 当 isReadonly 时，该区域为空，避免出现无效可点 UI。
    - editorExtensions：传入一组编辑器扩展节点：
      - ActionBar 包裹 InsertInputSlotAction，为 Prompt 编辑器增加「插入输入槽」（形如 {input}）等快捷操作按钮。
      - ActiveLinePlaceholder：在当前行显示本地化提示文案 I18n.t('agent_prompt_editor_insert_placeholder', { keymap: '{' })，提醒用户可通过键入 { 触发占位符。
- 状态与副作用：
  - 本组件本身不维护本地 state，也无副作用逻辑；所有行为均委托给上游组件与编辑器插件。
  - 这也意味着 AI 助手在修改时应保持「薄包装」特性，不在此组件中堆叠复杂业务逻辑。

## 构建、测试与本地开发

- 包管理与依赖：
  - 使用 Rush + workspace:* 管理依赖，首次开发需在仓库根目录执行 rush update。
  - package.json 中 dependencies 基本都是内部 workspace 包（@coze-*），无独立 bundler 依赖。
- npm scripts（在本子包目录）：
  - build：exit 0
    - 当前不产出独立构建结果，本包在 monorepo 中主要作为源码/类型入口，由上层应用（如 Studio / Agent IDE）统一打包。
  - lint：eslint ./ --cache
    - ESLint 配置继承 @coze-arch/eslint-config（web 预设），禁止在本包内新增与全局冲突的规则。
  - test：vitest --run --passWithNoTests
  - test:cov：npm run test -- --coverage
- Vitest 配置：
  - vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig({ dirname: __dirname, preset: 'web' })。
  - 当前包内暂无测试文件（__tests__ 为空），可以按需添加 React 组件测试（基于 @testing-library/react）。
- TypeScript 配置：
  - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，出参目录 dist，仅包含 src 目录：
    - compilerOptions：jsx: 'react-jsx'，module: 'ESNext'，target: 'ES2020'，moduleResolution: 'bundler'。
    - references：显式声明对 arch/bot-typings、arch/i18n、common/editor-plugins、common/prompt-kit/base、config 下各 tsconfig 以及本域 prompt 子包、studio/stores/bot-detail 的依赖，用于 TS project references 与 Rush 增量构建。
  - main 指向 src/index.tsx，类型也依赖源码；构建产物通常不在本包内直接消费。

## 项目约定与模式

- 只读控制：
  - 编辑权限完全基于 useBotDetailIsReadonly() 控制：
    - 只读状态下，动作按钮区必须保持不可操作（当前直接不渲染）。
    - 不要在本包内通过其他来源（如 props）重复判断只读；若需扩展，只能通过上游 bot-detail-store 或额外 props 的受控方式扩展。
- Prompt 视图封装：
  - PromptView 作为一个窄包装组件，不负责：
    - Prompt 内容的存储和加载；
    - 与后端的保存/发布逻辑；
    - 复杂的错误处理和提示。
  - 若未来需要扩展复杂行为（如自动保存、校验等），应优先在 @coze-agent-ide/prompt 内实现，再通过适配 props 在本包接入。
- 编辑器插件扩展：
  - 所有针对富文本/代码编辑器的扩展都应通过 editorExtensions 注入：
    - 现有 ActionBar + InsertInputSlotAction、ActiveLinePlaceholder 均来自通用 editor-plugins / prompt-kit-base 库。
    - 新增扩展时，优先在这些通用包内增量实现，再在本组件中组合；避免在此处直接操作底层编辑器实例。
- i18n：
  - 文案统一使用 I18n.t，并在上游 i18n 包中维护 key；本组件仅负责引用 key 和传参（如 keymap）。
  - 新增提示文案时，请勿直接写死字符串，应向 @coze-arch/i18n 对应资源添加 key 后，再由本组件引用。

## 与其他子包的集成关系

- @coze-agent-ide/prompt：
  - 定义 PromptView 组件及相关类型/子组件（ImportToLibrary、PromptLibrary 等），本包只做轻量包装与组合。
  - 若需要理解 Prompt 编辑器的内部行为（例如 editorExtensions 如何渲染），应前往该子包的源码阅读，而不要在本包内猜测其实现细节。
- @coze-common/editor-plugins：
  - ActionBar：提供统一的编辑器工具栏容器，与编辑器实例对接由上游组件完成。
  - InsertInputSlotAction：用于在 Prompt 中插入输入占位符；本包只负责将其放入 ActionBar 中。
- @coze-common/prompt-kit-base：
  - ActiveLinePlaceholder：在编辑器当前行显示占位文案，常用于提示可用快捷键或动态参数语法。
- @coze-studio/bot-detail-store：
  - useBotDetailIsReadonly：通过 Agent 详情上下文判断编辑权限，是本包只读控制的唯一来源。
  - 如需在其他上下文（非 Bot 详情）中使用 PromptView 且需要不同逻辑，应考虑：
    - 在上层通过 Provider 或 store 提供合适的只读状态；
    - 或在 @coze-agent-ide/prompt 层新增更通用的 props，而非在本包内硬编码多种来源。

## 项目流程与协作规范

- 变更约束：
  - PromptView 是对外公开组件，修改其 props 结构、默认行为或依赖列表时，都可能影响 Agent-IDE 相关多个子包；修改前应：
    - 在整个 frontend/packages 目录搜索 PromptView 的引用，评估影响范围。
    - 尽量以向后兼容方式演进（增加可选 props，而非移除原有行为）。
- 提交与测试建议：
  - 本包目前未配置单元测试，但建议为关键行为（只读状态切换、actionButton 区域渲染、editorExtensions 注入）补充简单组件测试，使用 @testing-library/react + Vitest。
  - 修改完成后，至少在依赖本包的上层应用（如 Agent IDE 详情页）中手动验证：
    - 只读与可编辑两种模式下，按钮与占位提示是否正常显示；
    - 编辑器的输入槽插入行为是否工作正常。

## 对 AI 助手的补充建议

- 在本包内新增功能时，优先考虑是否应放在：
  - @coze-agent-ide/prompt（基础 Prompt 组件）；
  - @coze-common/editor-plugins / prompt-kit-base（编辑器插件与占位逻辑）；
  - @coze-studio/bot-detail-store（上下文与权限控制）。
- 只有当确实是「Agent IDE 视角下的特定组装方式」时，才将逻辑放入本子包；并保持组件尽量简单、可读，避免引入额外状态管理或副作用。
