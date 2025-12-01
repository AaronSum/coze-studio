# bot-editor-context-store 开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-editor-context-store）中安全、高效地协作开发。

## 1. 子包定位与整体作用
- 本包 `@coze-agent-ide/bot-editor-context-store` 位于 agent-ide 体系下，用于为「Bot 编辑页面」提供上下文相关的前端状态管理能力。
- 对外主要暴露：React Context Provider、若干 zustand store、以及围绕 Bot 模型配置的工具方法和 hooks，供 Studio 侧各 UI 组件复用。
- 依赖上游包：
  - `@coze-studio/bot-detail-store/*`：提供 bot 基本信息和模型配置的 zustand store；
  - `@coze-arch/bot-api` / `@coze-arch/bot-typings`：提供 Bot 模型、能力配置等类型/常量（如 `BotMode`、`ModelFuncConfigType` 等）。
- 本包不会单独启动应用，而是被 Studio / Agent-IDE 其他前端包（例如 bot-creator、layout 等）作为库引入。

## 2. 目录结构与核心模块
- 根目录关键文件：
  - `package.json`：
    - `main: src/index.ts`，本包直接以 TS 源码为入口，构建由上层 Rush / rsbuild 统一负责；
    - `scripts.build` 当前仅为占位（`exit 0`），不要在本包内单独实现复杂 build 逻辑；
    - `scripts.test` 使用 Vitest（通过 `@coze-arch/vitest-config` 预设）运行单测。
  - `vitest.config.ts`：调用 `defineConfig({ dirname: __dirname, preset: 'web' })`，使用统一前端测试预设。
  - `eslint.config.js`、`.stylelintrc.js`：沿用 monorepo 的 lint 规范，不在此包内重写规则。

- `src/` 结构概览：
  - `src/index.ts`
    - 汇总导出：
      - React Context Hook：`useBotEditor`；
      - Provider：`BotEditorContextProvider`（定义在 `context/bot-editor-context/context` 中）；
      - Store：`ModelState` / `ModelAction`、`NLPromptModalStore` / `FreeGrabModalHierarchyStore` 等；
      - Hooks：`useModelCapabilityConfig`；
      - Utils：模型能力合并逻辑、模型查询与类型转换等。
  - `src/context/bot-editor-context/`
    - `index.ts`：`useBotEditor` hook，内部通过 React `useContext` 读取 `BotEditorContext`，并：
      - 解构出 `storeSet` 并返回 `{ storeSet }` 给调用侧；
      - 对 context 剩余字段调用 `recordExhaustiveCheck`，强制在 TS 层面保证 context 结构被完全覆盖（防止字段遗漏）；
      - 若 `storeSet` 不存在则抛出错误 `'invalid BotEditorContext'`，因此使用前必须保证外层有 `BotEditorContextProvider` 包裹。
    - `context.ts`（未在此处展示，默认实现 React Context + Provider）：为整个 Bot 编辑区域提供 store 汇总和依赖注入入口。
  - `src/store/`
    - `model.ts`：定义模型编辑相关的 zustand store（`ModelState`、`ModelAction`），含获取模型、更新配置、同步到上游 store 等逻辑。
    - `nl-prompt-modal.ts`：管理自然语言 Prompt 模态框的开关、位置、数据等状态（`NLPromptModalStore` / State / Action）。
    - `free-grab-modal-hierarchy.ts`：管理「自由截取」类模态框在页面上的层级关系（层叠顺序、挂载容器等），避免与其他弹层冲突。
    - `dataset.ts` / `bot-plugins.ts` / `onboarding-dirty-logic-compatibility.ts` 等：围绕知识库、插件、Onboarding 提示等编辑场景提供独立 store 或兼容逻辑。
    - `helpers/get-model-preset-values.ts`：根据模型信息计算预置值（如温度、最大 token、开关项等），供表单初始化与展示使用。
    - `type.ts`：集中定义与 Bot 编辑器相关的类型别名（如 `BotEditorOnboardingSuggestion`、`ModelPresetValues`、`NLPromptModalPosition` 等），并由根导出复用。
  - `src/hooks/model-capability/`
    - `index.ts`：暴露 `useModelCapabilityConfig` hook：
      - 从 `useBotEditor().storeSet.useModelStore` 读取 `getModelById`；
      - 使用 `@coze-studio/bot-detail-store` 提供的 `useMultiAgentStore`、`useModelStore`、`useBotInfoStore` 获取当前 Bot 模式和模型 ID 列表；
      - 按 `BotMode` 选择单、多、Workflow 不同的能力配置合并策略；
      - 返回最终的 `ModelCapabilityConfig`，供能力面板或配置 UI 渲染。
  - `src/utils/model-capability/`
    - `index.ts`：封装模型能力配置的合并与兜底逻辑：
      - 类型 `ModelCapabilityConfig` 以 `ModelFuncConfigType` 为 key，value 为 `[configStatus, modelName]`；
      - 提供 `defaultModelCapConfig`，作为所有能力默认 “完全支持” 的兜底；
      - `mergeModelFuncConfigStatus(...values)`：按最大值合并能力状态；
      - 内部 `mergeModelCapabilityConfig`：在遍历模型 func_config 时合并到已有配置中，并记录来源模型名称；
      - `getMultiAgentModelCapabilityConfig` / `getSingleAgentModelCapabilityConfig`：
        - 多 Agent 模式：遍历所有模型 ID，将 func_config 累积合并；
        - 单 Agent 模式：只取首个模型并合并；
        - 未配置能力一律按 FullSupport 处理。
  - `src/utils/model/`：
    - `convert-model-value-type.ts`：转换模型配置中的原始数据类型（字符串、枚举等）到编辑 UI 需要的结构；
    - `get-model-by-id.ts`：根据模型 ID 从 zustand store 中安全获取模型实体，并处理不存在或空值场景。
  - `src/utils/exhaustive-check.ts`：`recordExhaustiveCheck` 工具，用于在运行时记录未覆盖分支，帮助在 TS 层面保持 `switch` / context 结构的穷尽性检查。

## 3. 数据流与与其他子包的边界
- 页面级数据流：
  - 上游：`@coze-studio/bot-detail-store` 提供 Bot 基本信息、模型配置等原始数据；
  - 本包：在 React Context 中注入与 Bot 编辑器强相关的 zustand store 集合（storeSet），同时提供统一的模型能力配置、NL Prompt 弹框状态等；
  - 下游：Agent-IDE / Studio UI 组件通过：
    - `BotEditorContextProvider` 包裹路由 / 页面入口；
    - `useBotEditor()` + 各种 store hooks / actions 获取与编辑器上下文相关的状态；
    - `useModelCapabilityConfig`、`getModelById`、`convertModelValueType` 等工具进行业务逻辑计算。

- 功能边界约束：
  - 不直接发起网络请求；数据拉取由上游包负责，本包只对本地状态进行组合与衍生计算；
  - 不直接操作 DOM 或样式，UI 层职责归属到外部组件包；
  - 与后端接口 Schema 的强绑定，通过 `@coze-arch/bot-api` 和 `@coze-arch/bot-typings` 中的类型与常量完成，避免在本包硬编码 magic string。

## 4. 开发与调试流程
- 安装依赖（在 monorepo 根目录）：
  - `rush update`：安装 / 更新所有前端包依赖。

- 本包常用命令（在子包目录执行）：
  - `npm test`：
    - 调用 Vitest，配置由 `@coze-arch/vitest-config` 提供；
    - 约束：coverage 要求由 monorepo 级 `rushx-config.json` 控制，本包 level-3 当前无强制覆盖率门槛，但新逻辑应尽量补齐测试。
  - `npm run test:cov`：在上述基础上开启覆盖率统计。
  - `npm run lint`：使用 monorepo 公共 ESLint 配置检查 TS/JS 代码。
  - `npm run build`：目前为 no-op（`exit 0`），真实产物构建依赖上层 rsbuild / bundler 统一处理。

- 联调方式：
  - 本包不提供独立 dev server；
  - 在 `frontend/apps/coze-studio` 或相关 Agent-IDE 应用内引用本包，执行对应 app 的 `rushx dev` / `npm run dev`，即可在真实产品环境中调试；
  - 修改本包源码时，确保被依赖 app 已经引用 workspace 版本（Rush 默认如此），保存即会被 HMR / 重启 dev server 重新加载。

## 5. 项目约定与编码风格
- React 与 Zustand：
  - 上下文访问统一使用 `useBotEditor`，不要直接从内部 `BotEditorContext` 取值，确保 `recordExhaustiveCheck` 能覆盖新增字段；
  - 各具体状态建议继续使用独立 zustand store，并在 Provider 中聚合，以减少上下文重渲染；
  - 从 store 获取数据时优先使用 selector 和 `useShallow`，避免无关字段更新导致过度渲染（见 `hooks/model-capability/index.ts`）。

- 模型能力配置：
  - 新增能力类型时：
    - 保证 `ModelFuncConfigType` 在 `@coze-arch/bot-api` 中已有定义；
    - 如需在多 Agent / 单 Agent 模式做特殊聚合逻辑，扩展 `getMultiAgentModelCapabilityConfig` 或 `getSingleAgentModelCapabilityConfig`；
    - 任何未配置能力必须继续遵守 “默认 FullSupport” 的语义（即保持 `defaultModelCapConfig` 的策略）。

- 类型与 Exhaustive Check：
  - 当向 `BotEditorContext` 新增字段时，应：
    - 在 `context.ts` 中扩展 Context 类型；
    - 确认 `useBotEditor` 中的 `recordExhaustiveCheck(rest)` 未报错，必要时更新其参数类型；
  - 对 switch / mode 分支逻辑，保持以 `BotMode` / 其他枚举为 key 的 map 结构（如 `getModelCapabilityConfigMap`、`getModeIdsMap`），减少 default 分支。

- 文件组织：
  - store 相关逻辑（state / action / helpers / types）统一放在 `src/store/**`，避免分散在 hooks 或 utils 中；
  - 与模型数据结构直接相关的通用逻辑放入 `src/utils/model/**`，供多个 store / hooks 共享；
  - 新增 hook 请存放在 `src/hooks/**`，保持目录按业务主题（如 `model-capability`）划分。

## 6. 与外部系统 / 包的集成细节
- `@coze-studio/bot-detail-store`：
  - `useMultiAgentStore`：多 Agent 模式下提供 `agents` 列表，`useModelCapabilityConfig` 会从中提取各 Agent 绑定的 modelId；
  - `useModelStore`：单 Agent 配置下读取 `config.model` 字段；
  - `useBotInfoStore`：提供当前 Bot 的 `mode`（Single / Multi / Workflow），用于选择不同的能力聚合策略。

- `@coze-arch/bot-api/developer_api`：
  - `BotMode`：Bot 工作模式枚举，是 `getModelCapabilityConfigMap` 与 `getModeIdsMap` 的索引 key；
  - `ModelFuncConfigType` 与 `ModelFuncConfigStatus`：描述模型在不同能力维度上的支持情况，是 `ModelCapabilityConfig` 的核心类型。

- 其他工具依赖：
  - `ahooks`：在部分高级 hooks / 组合逻辑中使用，统一在 peerDependencies 声明；
  - `immer`：可选用于不可变数据处理，通常在 zustand reducer 风格 action 中使用；
  - `lodash-es`：按需引入工具函数，注意 tree-shaking 友好写法（`import { xxx } from 'lodash-es'`）。

## 7. 测试约定
- 测试框架：Vitest（web preset），断言 / mock 风格与 Jest 基本兼容。
- 测试目录：
  - 位于 `__tests__/` 目录下，目前只有 `.gitkeep` 占位，新逻辑应就近新建测试文件；
  - 常见命名：`*.test.tsx` / `*.test.ts`。
- 测试内容建议：
  - 对核心 hooks（如 `useModelCapabilityConfig`）、工具函数（如 `mergeModelFuncConfigStatus`、`getMultiAgentModelCapabilityConfig`）提供单元测试；
  - 对 zustand store 的行为测试采用 “创建 store -> 触发 action -> 断言 state” 的方式。

## 8. 提交与协作注意事项
- 遵循 monorepo 通用流程：
  - 代码提交前运行：`npm run lint` 与 `npm test`，确保通过；
  - 该包为 level-3，代码覆盖率门槛较低，但仍鼓励为关键逻辑补齐测试，避免在 CI 中未来提升门槛时造成历史债务。
- 若变更影响到其他 Agent-IDE 包（如 `bot-creator`、`workflow` 等），应在对应 app 中做一次手动冒烟：
  - 主要检查：模型能力展示是否正确、NL Prompt 弹窗交互是否受影响、多 Agent 配置是否能正常保存。
