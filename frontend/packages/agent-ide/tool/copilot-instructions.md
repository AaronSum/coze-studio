# @coze-agent-ide/tool 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/tool）中安全、高效地协作开发。

## 全局架构与角色定位

- 本子包是 Bot Creator / Agent IDE 里的「工具区域（Tool Area）」前端库，面向业务是一个可复用的工具列表与能力区域 UI/状态层，负责：
  - 管理 Tool / Ability / Agent Skill 等配置与展示（列表、分组、折叠、操作按钮等）。
  - 将上层业务的全局 store（如 @coze-agent-ide/bot-editor-context-store、@coze-arch/bot-studio-store 等）中的数据，映射为工具区域可用的视图/状态。
  - 提供统一的 hooks 与 React 组件给其它子包消费（详见 src/index.ts 的导出）。
- 代码整体按「领域+层次」拆分：
  - components：纯视图组件和交互容器，如 ToolView、ToolContainer、ToolMenu、ToolItem* 等，用于渲染工具列表与操作区。
  - hooks：
    - builtin：对外暴露的业务 hooks，例如 useRegisteredToolKeyConfigList、useCreateStore、useRegisterToolGroup 等，封装通用逻辑。
    - public：供外部直接依赖的 UI/状态 hooks，例如 useInit、useToolToggleCollapse、useToolValidData、useToolContentBlockDefaultExpand 等。
    - 业务特定：如 agent-skill-modal、agent-skill 等能力相关 hooks。
  - context：React Context 层，提供 AbilityAreaContext、AbilityConfigContext、AgentSkillConfigContext、ToolItemContext、PreferenceContext 等，用于跨组件共享配置与状态。
  - store：以 zustand 为基础的局部状态（如 agent-area、tool-area），对 tools/ability 区域的展示与折叠等进行管理。
  - constants / utils / typings：
    - constants：如 tool-content-block 的映射工具 openBlockEventToToolKey。
    - utils：如 abilityKey2ModelFunctionConfigType 等映射/计算工具函数。
    - typings：复用/补充 @coze-arch/bot-typings & 本包内部类型（button、event、store、scoped-events 等）。
- 顶层导出文件 src/index.ts 视为「公共 API 面板」，对外暴露长期稳定能力和迁移动机下的过渡接口（例如标记 @Deprecated 的 SkillKeyEnum）。新增/重构时应优先在内部完成实现，再选择性在 index 中暴露。

## 关键数据流与交互边界

- 配置来源：
  - 工具与能力的基础配置由 @coze-agent-ide/tool-config 提供（AbilityScope、ToolKey、AgentSkillKey、SkillKeyEnum 等常量和配置结构）。
  - 与 Bot / Studio 相关的状态来自多个 workspace:* 依赖（bot-editor-context-store、bot-studio-store、bot-typings 等）。本包只消费这些 store/hooks，不直接发请求。
- 状态管理：
  - 内部通过 zustand 创建「工具区域状态 store」，通过 hooks（useToolStore、useToolStoreAction、useToolDispatch、useSubscribeToolStore）向外暴露。
  - store 主要管理：工具显隐、折叠状态、当前选择、分组信息、弹窗开关等 UI 相关状态，不直接存放业务后端原始数据。
- 事件与通信：
  - scoped events：
    - useEvent hook 抽象一个事件中心，事件名统一通过 EventCenterEventName 与 IToggleContentBlockEventParams 等类型约束。
    - openBlockEventToToolKey 提供从「区块事件」到 ToolKey 的映射，用于将其他模块的 UI 事件路由到本工具区域。
  - React Context：
    - AbilityAreaContext / AbilityConfigContext / AgentSkillConfigContext / ToolItemContext / PreferenceContext 等负责在组件树内传递配置与行为回调。
  - 外部交互：
    - 不直接依赖浏览器全局事件。所有对外暴露的通信能力应该包装为 hooks 或组件 props，以便宿主工程控制。

## 开发与工作流

- 依赖管理：
  - 使用 rush 管理 monorepo，项目元信息在 config/rush-project.json 中；常用输出目录：
    - test:cov → coverage
    - ts-check → dist
- 本子包常用命令（在 repo 根已执行 rush update 后）：
  - 单包构建：当前 package.json 的 build 脚本暂为占位（exit 0），真实构建一般通过上层构建系统（例如统一 rollup / tsup 配置）或 rush pipeline 触发。
  - 单包测试：在 frontend/packages/agent-ide/tool 目录下执行：
    - 测试：npm test
    - 覆盖率：npm run test:cov
  - Lint：npm run lint
- 测试环境：
  - 使用 vitest，配置在 vitest.config.ts，通过 @coze-arch/vitest-config.defineConfig 预设，preset 为 'web'，与其它 web 子包保持一致。
  - 测试文件位于 __tests__ 目录，示例包括：
    - __tests__/utils/error.test.ts
    - __tests__/hooks/duplicate-use-ability-config.tsx
  - 新增测试时建议复用现有测试 helpers 与 vitest 约定（describe/it/expect）。
- Storybook：
  - 配置位于 .storybook/main.js 与 .storybook/preview.js，采用 @storybook/react-vite 方案。
  - stories 目录用于演示组件（如 stories/demo.stories.tsx、stories/hello.mdx）。
  - Vite 与 svgr 已在 storybook 中集成，可直接 import SVG 为 React 组件。

## 项目约定与代码风格

- TypeScript & 构建：
  - tsconfig.json 仅定义 references（tsconfig.build.json、tsconfig.misc.json），自身 exclude 为 "**/*"，意味着类型检查/构建行为由上层 tsconfig 统一控制。
  - 遵循 @coze-arch/ts-config 提供的基础规则（具体在 workspace 根统一管理）。
- Lint & 样式：
  - eslint.config.js 使用 @coze-arch/eslint-config；请优先按照现有规则修复告警，不要随意改动配置。
  - 样式使用 Tailwind + Semi Design 体系：
    - tailwind.config.ts 继承 @coze-arch/tailwind-config。
    - Stylelint 配置在 .stylelintrc.js，依赖 @coze-arch/stylelint-config。
  - UI 组件大多基于 @coze-arch/bot-semi、@coze-arch/coze-design，编码时优先复用已有设计系统组件。
- 组件与 hooks 模式：
  - 组件命名：
    - 容器：ToolContainer、ToolView、GroupingContainer、AbilityAreaContainer 等，负责组合上下文与 store。
    - 原子组件：ToolItem、ToolItemList、ToolItemSwitch、ToolItemAction*、ToolItemIcon*、AutoGenerateButton、AddButton 等。
  - hooks 命名：
    - useXxx：纯函数式 hooks，以「领域+意图」命名，如 useToolToggleCollapse、useToolValidData、useAgentSkillModal、useHasAgentSkillWithPK。
    - useXxxStore：与 zustand store 相关的 hooks，如 useToolStore、useToolStoreAction。
  - 类型命名：
    - 接口/类型位于 src/typings/*，统一以 I 或明显语义前缀命名（如 IToggleContentBlockEventParams）。
- 公共 API 管理：
  - 对外只通过 src/index.ts 暴露。新增功能时：
    - 先在内部实现 & 测试；
    - 评估是否需要成为公共 API，若是则在 index.ts 显式 export。
  - 迁移期接口（例如 SkillKeyEnum）在 index.ts 内标记注释说明 @Deprecated，并指向新的用法。

## 重要模块与集成点

- 工具内容区块映射（tool-content-block）：
  - 文件：src/constants/tool-content-block.ts 以及相关 hooks。
  - 作用：将「内容区块事件」映射到具体 ToolKey，驱动工具区跳转/展开；当新增 Tool 或内容区类型时，需要同步扩展此映射。
- 能力/技能配置：
  - 能力与技能相关配置通过 @coze-agent-ide/tool-config 与多个 context/hook 串联：
    - src/context/ability-config-context.tsx
    - src/context/agent-skill-config-context.tsx
    - src/hooks/builtin/use-ability-config.ts
    - src/hooks/builtin/use-register-agent-skill-key.ts
  - 使用模式：外部提供配置（能力列表、技能配置），通过 Provider 包裹 Tool 区容器（AbilityAreaContextProvider 等），然后在子组件中通过 hooks 读取。
- 工具区域 store：
  - 文件：
    - src/store/tool-area.ts
    - src/store/agent-area.ts
    - src/hooks/public/store/use-tool-store.ts 及其导出相关 hooks。
  - 作用：集中管理工具列表、选中项、折叠/展开、显隐状态等；务必保持「UI 状态」与「业务数据」分层，避免把后端实体直接塞进 store。
- 模型能力提示与辅助组件：
  - ModelCapabilityTipsDisplay（src/components/model-capability-tips.tsx，导出为 TipsDisplay / ModelCapabilityTipsDisplay）。
  - AutoGenerateButton、AddButton 等组件封装了常见操作按钮及交互逻辑，建议在新功能中统一复用，以保持 UX 一致性。
- Model Function Config 映射：
  - 文件：src/utils/model-function-config-type-mapping.ts
  - 作用：从 abilityKey 到模型函数配置类型的映射，是连接「工具能力」和「底层模型配置」的关键环节，新增能力时需要同时更新此映射。

## 项目流程与协作规范

- 分支与提交规范：
  - 整个仓库遵循统一的 git 约定（详见仓库根下 README、CONTRIBUTING 等），本子包不单独定义分支策略。
  - 在修改公共 API（src/index.ts）或跨包依赖时，建议：
    - 保持改动向后兼容（先保留旧接口并标记 Deprecated）。
    - 在相关调用方子包中同步调整并补充测试/Storybook 用例。
- 发布与构建：
  - 本子包通过 rush 统一发布；打包产物包括：
    - ESM：dist/esm/index.js
    - UMD：dist/umd/index.js
  - package.json 中 main/module/unpkg/types 已指向相应入口，修改构建流程时需保持这些字段的正确性。

## 不寻常/需要特别注意的点

- tsconfig.exclude 为 "**/*"：
  - 说明当前包的 TS 编译完全依赖于上层工程的 references，单独在包内执行 tsc 可能不会产生期望结果；在调整 TS 配置时必须考虑整个 monorepo 的编译链路。
- build 脚本为 "exit 0"：
  - 意味着本包的实际打包流程不在本 package.json 中定义，而由上层（例如统一 rollup 配置或 rush pipeline）负责。不要直接在此处堆叠复杂构建逻辑，除非与仓库整体方案对齐。
- workspace:* 依赖：
  - 本包严重依赖其它本地 workspace（bot-*、coze-* 等），在重构类型或 store 时必须同步关注这些依赖的 API 变更，避免出现循环依赖或 breaking change。
- 过渡期导出：
  - src/index.ts 中有「START/END 过渡期」注释块，说明部分接口处于迁移阶段。若需要移除旧接口，应：
    - 先在调用侧清理依赖；
    - 再在本包中删除导出并更新文档/变更记录。
