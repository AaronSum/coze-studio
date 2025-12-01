# @coze-agent-ide/onboarding – Copilot Instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/onboarding）中安全、高效地协作开发。

## 全局架构概览

- 本子包是一个 React/TypeScript 前端子模块，用于 Bot 编辑页面中的“开场白（prologue）+ 推荐问题（suggested_questions）”编辑与预览。
- 对外唯一入口为 src/index.ts，集中导出 React 组件、业务方法和常量，供上层应用（Coze Studio / Bot Editor）按需引入。
- 组件层：
  - src/components/onboarding-markdown-modal：主 UI 入口，封装弹窗、Markdown 编辑器、问题列表以及右侧预览区。
  - src/components/markdown-editor、src/components/onboarding-preview、src/components/onboarding-suggestion 等子组件，各自关注单一 UI 职责。
- 状态与数据层：
  - 依赖 @coze-studio/bot-detail-store 和 @coze-agent-ide/bot-editor-context-store 提供的 zustand store，**本包自身不创建全局 store**，只通过 hooks 读写外部 store。
  - src/utils/onboarding.ts 封装对 onboardingContent.prologue / suggested_questions 的更新与同步逻辑（基于 immer 与 lodash-es）。
- 常量与类型：
  - src/constant/onboarding-variable.ts 定义开场白中可注入的变量枚举（如 OnboardingVariable.USER_NAME）及映射类型。
  - src/utils/typed-keys.ts、src/utils/exhaustive-check.ts 用于类型安全与穷举检查（recordExhaustiveCheck）。
- 设计理念：
  - UI 与数据更新解耦：组件通过 props 触发回调，具体写入逻辑交给 utils + 外部 store 完成。
  - 最小导出面：index.ts 只导出对上层有用的组件、hook、工具函数和常量，保证调用方 API 清晰。

## 关键导出与数据流

- 对外导出（见 src/index.ts）：
  - OnboardingMarkdownModal / OnboardingMarkdownModalProps：开场白编辑弹窗组件。
  - getImmerUpdateOnboardingSuggestion、getOnboardingSuggestionAfterDeleteById、immerUpdateOnboardingStoreSuggestion、updateOnboardingStorePrologue、deleteOnboardingStoreSuggestion、getShuffledSuggestions：用于维护 suggested_questions 与 prologue 的纯函数 / 辅助函数。
  - OnboardingVariable / OnboardingVariableMap：变量体系（目前包含 USER_NAME），上层可扩展映射内容。
  - useRenderVariable：变量渲染相关 hook（位于 src/hooks/onboarding），用于在 Markdown 或 UI 中插入变量展示。
  - ONBOARDING_PREVIEW_DELAY：预览更新节流时间（毫秒），用于控制 OnboardingPreview 的刷新频率。
  - useBatchLoadDraftBotPlugins / useDraftBotPluginById：基于 bot-editor-context-store 的插件加载 hook，桥接 Bot 草稿插件与 Onboarding 逻辑。
- 主要数据来源：
  - useBotSkillStore（来自 @coze-studio/bot-detail-store/bot-skill）：
    - onboardingContent.prologue：开场白正文。
    - onboardingContent.suggested_questions：推荐问题列表（数组，每项含 id, content, highlight 等）。
    - updateSkillOnboarding：接受局部更新对象或 updater 函数，用于写入 onboarding 区块。
  - useBotEditor（来自 @coze-agent-ide/bot-editor-context-store）：
    - storeSet.useDraftBotPluginsStore：提供 draft plugins map 与 batchLoad 方法。

## Onboarding 编辑与预览流程

- 文本编辑：
  - OnboardingMarkdownModal 内部使用 MarkdownEditor 组件，透传：
    - value=prologue / onChange=onPrologueChange。
    - getValueLength / maxLength / getSlicedTextOnExceed：统一字数统计与超长截断策略，由上层注入。
  - 组件本身不直接访问 store，而是依赖外层传入的 onPrologueChange 与 onboardingSuggestions。
- 建议问题编辑：
  - OnboardingSuggestionContent 以列表形式呈现 onboardingSuggestions，触发 onSuggestionChange / onDeleteSuggestion 回调。
  - 结合 utils/onboarding.ts 中的函数，可将 UI 操作映射为对 useBotSkillStore 的更新：
    - immerUpdateOnboardingStoreSuggestion：更新某条 suggested_question 的内容或 highlight 状态。
    - deleteOnboardingStoreSuggestion：删除某条 suggested_question。
    - getShuffledSuggestions：在聊天区域与 Bot 调试页之间对推荐问题做对齐、增删与内容同步。
- 预览：
  - OnboardingMarkdownModal 使用 ahooks.useDebounce 对 prologue 做 500ms 去抖，减少预览频繁刷新。
  - OnboardingPreview 接收 content / suggestions / getBotInfo / getUserName，渲染出最终用户看到的开场白与问题列表。
  - 右侧预览容器利用 ref 与 scrollHeight/clientHeight 判断是否需要滚动样式，并通过 classNames 切换样式类。

## 依赖与外部集成

- UI 与基础库：
  - React 18 + TypeScript；样式采用 less 模块（*.module.less），通过 classNames 组合。
  - 组件库来自 @coze-arch/bot-semi（UIModal、Tag、Tooltip 等）和 @coze-arch/bot-icons（IconInfo 等），保持与 Team Studio 统一的视觉风格。
  - 国际化使用 @coze-arch/i18n，所有文案采用 I18n.t('key') 形式，AI 修改或新增文案时需同时考虑 i18n key 管理。
- 数据与状态：
  - Zustand store 封装在外部包中，本子包通过 hooks 访问：
    - useBotSkillStore（onboarding 内容）。
    - useBotEditor().storeSet.useDraftBotPluginsStore（草稿插件）。
  - 由于 store 来自 workspace:* 依赖，AI 在修改相关调用时必须保持函数签名与使用方式不变，以兼容其他子包。
- 工具库：
  - lodash-es：intersectionBy / xorBy 等用于集合差集与对齐逻辑（getShuffledSuggestions）。
  - immer：produce 用于以不可变方式更新数组与对象状态。
  - ahooks：useDebounce 控制预览更新频率。

## 开发与调试工作流

- 子包级命令（在 frontend/packages/agent-ide/onboarding）：
  - Lint：npm run lint（调用 eslint.config.js，preset 为 web，规则继承 @coze-arch/eslint-config）。
  - Test：npm test 或 npm run test（执行 vitest --run --passWithNoTests，配置见 vitest.config.ts，使用 @coze-arch/vitest-config 的 web 预设）。
  - 覆盖率：npm run test:cov（基于 @vitest/coverage-v8）。
  - Build：当前 package.json 中的 build 脚本为占位实现（exit 0），真实打包由上层 Rush / 应用构建流水线负责。
- Monorepo / Rush 集成：
  - 初始化依赖：在仓库根目录执行 rush update。
  - 开发：通常通过上层 app（如 frontend/apps 下的具体应用）引入本包后，使用 rushx 或 app 自带 dev 命令进行联调；README 中的 npm run dev 可能是模板残留，实际需以上层工程为准。
- 推荐调试方式：
  - 在上层 Bot 编辑页面中寻找使用 OnboardingMarkdownModal 的位置，通过 props 传入本包导出的函数实现与 Bot store 的连通。
  - 修改样式时，优先在对应 *.module.less 中添加或调整类，避免全局样式泄漏。

## 项目约定与风格

- 代码组织：
  - components / hooks / utils / constant / demo / assets 分层清晰，新增模块时应遵循现有目录结构（例如新的业务常量放入 constant，新 hook 放入 hooks）。
  - src/index.ts 作为唯一出口，新导出能力需在对应子模块实现后在此统一 re-export。
- TypeScript 风格：
  - 强类型优先，公共类型通过导出 type XXX 的方式暴露给调用方。
  - 使用 Record<>、枚举等表达 map / 常量，避免魔法字符串（如 OnboardingVariable.USER_NAME）。
- 副作用与状态：
  - 除 React hook 内部与外部 store 操作外，工具函数（尤其在 utils/onboarding.ts）应保持纯函数特性，便于测试与复用。
  - 使用 produce 进行不可变更新，避免直接修改原数组或对象。
- 国际化与文案：
  - 组件内部不直接写死用户可见文案，统一走 I18n.t；新增文案时务必沿用此约定，以便多语言扩展。

## 测试与质量保障

- 测试框架：
  - 使用 Vitest + @coze-arch/vitest-config 的 web 预设；可结合 @testing-library/react 与 @testing-library/react-hooks 编写组件与 hook 测试。
- 典型可测对象：
  - utils/onboarding.ts 中的纯函数（getImmerUpdateOnboardingSuggestion、getOnboardingSuggestionAfterDeleteById、getShuffledSuggestions 等）——期望对输入数组做不可变更新并保持 id 对齐与内容同步。
  - hooks/bot-plugins 中的 hooks，通过 mock useBotEditor 返回的 storeSet 验证选择器逻辑正确性。
  - OnboardingMarkdownModal 的交互（字数限制、预览去抖、滚动样式切换等），可以在上层应用中通过集成测试验证。

## 团队流程与其他说明

- 许可与版权：
  - 所有源码均采用 Apache-2.0 许可证，文件头统一使用已有版权声明模版；新增文件需保持相同头注释。
- Git / 分支：
  - 仓库整体通常采用 feature 分支 + PR 合入主干的工作流；在修改本子包时，应遵循仓库根部 CONTRIBUTING.md 与 CI 规范（如 Rush change、lint/test 必须通过）。
- 与其他子包的协作：
  - @coze-agent-ide/onboarding 被视作“等级 3（level-3）”子包，依赖较多上层 IDE / Studio 能力，本身不直接处理网络请求或复杂业务，只负责 UI 与 store 状态更新。
  - 变更公共类型或导出时需评估对依赖本包的上游子包的影响（在 monorepo 中搜索引用再修改）。

## 特殊注意事项

- 忽略 CLAUDE.md：本仓库存在 CLAUDE.md，但与本子包开发无关，AI 助手生成或更新文档与代码时无需参考或修改。
- 保持兼容性：workspace:* 依赖（例如 @coze-agent-ide/bot-editor-context-store、@coze-studio/bot-detail-store）在整个 monorepo 中被多处使用，调整其调用方式前必须先查阅对应包的文档与使用场景。
- 性能与体验：
  - 预览更新节流（ONBOARDING_PREVIEW_DELAY）是 UX 关键参数，随意调整可能会影响输入流畅度与预览实时性。
  - 建议问题的同步逻辑（getShuffledSuggestions）依赖 intersectionBy/xorBy 的语义，修改时需先完全理解“调试页 vs 聊天区域”两侧数据结构与更新策略。
