# Chat Workflow Render 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/chat-workflow-render）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本子包是一个 React 组件库子模块，提供基于「工作流 / ChatFlow 卡片」的聊天内容区渲染能力，对外主要导出：
  - `WorkflowRender`：工作流节点卡片渲染器。
  - `ChatFlowRender`：ChatFlow 卡片渲染器。
- 对上层：
  - 通过 `@coze-common/chat-uikit` 暴露的 `ContentBox` 插槽机制接入，类型为 `ComponentTypesMap['contentBox']`。
  - 根据消息的 `contentType === ContentType.Card` 时，使用自定义渲染逻辑替代默认卡片渲染。
- 对下游 / 依赖：
  - 使用 `@coze-common/chat-uikit-shared` 中的 `ContentBoxType` 等常量区分内容类型。
  - 使用 `@coze-common/chat-area` 暴露的 `PluginScopeContextProvider` 和 `usePluginCustomComponents` 以支持可插拔插件 UI（`TextMessageInnerTopSlot` 插槽）。
  - 使用 `@coze-common/chat-area-utils` 提供的 `typeSafeJsonParse` 等工具进行 JSON 解析与容错。
- 业务数据流（Workflow 模式）：
  - 外层 `WorkflowRender` 收到一条 `card` 类型消息，其 `message.content` 是字符串化 JSON。
  - `WorkflowRenderEntry` 在 `components/workflow-render/components/index.tsx` 中：
    - 使用 `typeSafeJsonParse` 解析 `message.content` 为对象。
    - 通过 `isWorkflowNodeData` 校验其为 `WorkflowNode` 结构（见 `components/workflow-render/components/utils.ts` 与 `type.ts`）。
    - 根据 `content_type` 分发：
      - `'option'` → `QuestionNodeRender`（按钮选项问题卡）。
      - `'form_schema'` → `InputNodeRender`（表单输入卡）。
- 业务数据流（ChatFlow 模式）：
  - `ChatFlowRender` 结构与 `WorkflowRender` 类似，区别在于：
    - `components/chat-flow-render/components/index.tsx` 中通过 `extractChatflowMessage`（见 `components/chat-flow-render/components/utils.ts`）从 `message.content` 中解析 `x_properties.workflow_card_info` 字段。
    - 解析得到 `ChatflowNodeData`：
      - `card_type === 'INPUT'` → `InputNodeRender`。
      - `card_type === 'QUESTION'` → `QuestionNodeRender`。
- UI 结构：
  - `QuestionNodeRender`：基于 `@coze-arch/coze-design` 的 `Button`、`Space`、`Typography` 绘制标题+多按钮选项，点击后通过 `onCardSendMsg` 回传用户选择。
  - `InputNodeRender`：
    - 使用 `useState` 管理多输入项内容与是否已发送标记 `hasSend`。
    - 借助 `immer` 的 `produce` 更新输入数据。
    - 解析 `data.content` 为 JSON 数组，过滤出 `InputWorkflowNodeContent` 有效结构（`name`、`type` 字段校验）。
    - 拼接 `name:value` 多行文本，通过 `onCardSendMsg` 发送。
  - 两者都包在 `NodeWrapperUI` 中，统一容器样式和布局。

## 2. 开发与构建工作流

- 包管理与初始化（需要在仓库根目录执行）：
  - 使用 Rush + pnpm 进行 monorepo 管理。
  - 首次或依赖更新后：`rush update`（参见本包 `README.md`）。
- 本子包脚本（在本目录执行）：
  - `npm run build`：当前占位实现为 `exit 0`，实际构建行为由上层 Rush/打包系统处理，**不要在此子包内自行改造为真正构建脚本，除非同步调整 Rush 配置**。
  - `npm run lint`：调用 `eslint ./ --cache`，规则由 `eslint.config.js` 与 `@coze-arch/eslint-config` 统一配置。
  - `npm run test`：使用 Vitest，配置在 `vitest.config.ts` 中通过 `@coze-arch/vitest-config` 统一管理。
  - `npm run test:cov`：在 `test` 基础上开启覆盖率（`@vitest/coverage-v8`）。
- Storybook：
  - 本包存在 `.storybook/main.js` 与 `.storybook/preview.js`，使用 `@storybook/react-vite`：
    - main 中通过 `viteFinal` 注入 `vite-plugin-svgr`，用于 SVG 组件化导入。
    - 可在上层脚本（通常在 `frontend/apps`）中统一运行 Storybook，本包只提供配置与 stories（位于 `stories/` 目录，如果存在）。
- TypeScript：
  - 使用复合工程：`tsconfig.json` 只负责 references：
    - `tsconfig.build.json`：构建配置。
    - `tsconfig.misc.json`：额外工具 / Storybook / 测试配置。
  - 修改 tsconfig 时，遵循 monorepo 内的共享 `@coze-arch/ts-config` 约定，避免破坏引用关系。

## 3. 代码风格与项目约定

- 语言与框架：
  - React 18 + TypeScript，函数式组件为主，使用 `React.FC<Props>` 声明（见各组件文件）。
  - 使用 `memo` + `lodash-es` 的 `isEqual`/`omitBy`/`isFunction` 做浅层/函数过滤后的 props 比较，避免渲染抖动（见 `components/*/components/index.tsx`）。
- 类型与数据校验：
  - 所有重要业务结构都在 `type.ts` 定义：
    - `WorkflowNode`、`QuestionWorkflowNode`、`InputWorkflowNode` 等，以及对应的 `RenderNode*Props`。
  - `utils.ts` 负责运行时 type guard：
    - `isWorkflowNodeData`：校验对象是否符合 `WorkflowNode` 形状。
    - `isInputWorkflowNodeContent` / `isInputWorkflowNodeContentLikelyArray`：校验表单 schema 结构。
  - JSON 解析一律使用 `typeSafeJsonParse` 或 `safeJSONParse`，提供默认值以防解析失败导致崩溃（例如 `noop`）。
- 交互回调约定：
  - 向外发送用户选择或表单输入时统一使用 `onCardSendMsg`（来自 `IEventCallbacks`）：
    - 参数结构中 `extra.msg` 为最终字符串内容，`extra.mentionList` 当前传空数组。
    - 新增交互逻辑时，优先复用该回调而非自定义事件，以保证与上层聊天框一致。
- 插件与插槽约定：
  - 顶层 `WorkflowRender`/`ChatFlowRender` 都将 `multimodalTextContentAddonTop` 作为顶部插槽：
    - 插槽内容来源于 `usePluginCustomComponents('TextMessageInnerTopSlot')`。
    - 渲染时用 `PluginScopeContextProvider` 注入 `pluginName`，并将 `message` 传给自定义组件。
  - 若新增其它插槽类型，应与 `@coze-common/chat-area` 中的插件机制保持一致命名与调用方式。
- 样式与 UI 库：
  - 组件样式基于 `@coze-arch/coze-design` 的原子类和组件属性，不在本子包中写独立 CSS 文件。
  - 存在 `.stylelintrc.js` 与共享 `@coze-arch/stylelint-config`，如需新增 className，请保持 Tailwind 风格工具类命名和统一 spacing 体系。

## 4. 关键组件与外部依赖集成

- `src/index.ts`：
  - 仅导出 `WorkflowRender` 与 `ChatFlowRender`，是对外公共 API。新增导出前需确认：
    - 是否需要在其它包（如 `@coze-common/chat-area` 或业务 app）中使用。
    - 若是内部工具/子组件，优先保持非导出状态，防止 API 面积膨胀。
- `components/workflow-render/index.tsx` 与 `components/chat-flow-render/index.tsx`：
  - 充当桥接层：
    - 注册 `enhancedContentConfigList`，通过 `rule` 判断何时启用本包渲染逻辑（`ContentType.Card` 且对应卡片类型启用）。
    - 在 `render` 中接管卡片渲染，注入 `message`、`eventCallbacks`、`options` 等。
  - 集成 `@coze-common/chat-uikit`：
    - 不要直接在外部页面使用 `WorkflowRenderEntry`，而应通过 `ContentBox`/`ContentType` 机制保持一致行为。
- `components/workflow-render/components/*`：
  - `index.tsx`：根据工作流节点类型选择 `QuestionNodeRender` 或 `InputNodeRender`。
  - `question-node-render.tsx`：
    - 使用 `Button` 渲染可点击选项；点击后封装 `onCardSendMsg` 调用。
    - 注意按钮 `disabled` 状态由 `readonly`/`isDisable` 控制，改动时要考虑历史记录/回放场景。
  - `input-node-render.tsx`：
    - 解析嵌套字符串化的 `content`，可能是多字段表单数组。
    - 通过 `produce` 管理状态，避免直接 mutate；这是项目普遍做法，新增复杂状态时建议继续使用 immer。
    - 提交后将 `hasSend` 置为 true，避免重复发送。
    - 文案使用 `I18n.t('workflow_detail_title_testrun_submit')`，新增文案请按 i18n 规范在对应语言包中补充。
- `components/chat-flow-render/components/*`：
  - `utils.ts`：负责从 `message.content` 中提取 `workflow_card_info`，是 ChatFlow 与工作流卡片数据的适配层。
  - 其余 Node 渲染逻辑与 workflow 基本对齐，区别仅在数据结构（`ChatflowNodeData`）。

## 5. 测试与调试约定

- 单元测试：
  - 使用 Vitest + React Testing Library：
    - 依赖声明：`@testing-library/react`、`@testing-library/react-hooks`、`@testing-library/jest-dom`。
    - 测试文件推荐放在 `__tests__` 目录或与组件同级（遵循 monorepo 现有惯例）。
  - 运行方式：`npm run test`（或在仓库根目录用 Rush 统一脚本）。
  - 覆盖率：`npm run test:cov`，默认使用 v8 覆盖率插件。
- Storybook 调试：
  - 若为本包组件补充视觉/交互样例，应在 `stories/` 下新增 `.stories.tsx` 或 `.mdx`，并在 `.storybook/main.js` 的 `stories` 匹配范围内。
  - 注意：Storybook 运行环境由上层 app 统一管理，本包不单独提供 `storybook` 脚本。

## 6. 过程规范与注意事项

- Git 与分支：
  - 本仓库使用 Rush monorepo，分支策略与提交规范通常在仓库根部文档中（如 `README.md` / 贡献指南）约定；在本子包中不要引入独立的发布流程或版本号管理逻辑。
- 依赖管理：
  - 所有对内部包的依赖均通过 `workspace:*` 指定，新增依赖时：
    - 优先复用已有 `@coze-*` 内部包。
    - 外部库（如新的工具库）需评估对 bundle 体积与浏览器兼容性的影响。
- 与其它子包协作：
  - 若需要新增内容类型或卡片类型：
    - 需同步修改 `@coze-common/chat-uikit-shared` 的枚举/常量以及 `@coze-common/chat-uikit` 的渲染配置。
    - 在本包中扩展 `EnhancedContentConfig` 的 `rule` 与 `render`，并在 Node 层增加处理逻辑与类型定义。
- 不常见/易踩坑点：
  - `message.content` 在不同模式下嵌套 JSON 深度不同：
    - workflow：直接是工作流节点数据 JSON 字符串。
    - chatflow：需要从 `x_properties.workflow_card_info` 中二次解析。
  - 一些 JSON 字段本身再次字符串化（如 `InputWorkflowNode.content`），解析顺序需要严格遵守已有实现，避免遗漏一层 `JSON.parse` 导致类型 guard 失效。
  - `multimodalTextContentAddonTop` 插槽中渲染的插件组件依赖 `PluginScopeContextProvider` 提供的上下文，新增容器或调整时不要丢失该 provider。

## 7. 给 AI 助手的具体建议

- 修改或新增渲染逻辑前：
  - 先查阅对应 `type.ts` 与 `utils.ts`，更新类型守卫与运行时校验保持一致。
  - 确认是否需要在 `@coze-common/chat-uikit-shared` / `@coze-common/chat-uikit` 同步扩展枚举与配置（如新增 content_type 或 card_type）。
- 实现新的节点类型时：
  - 在相应 `components/*/components/index.tsx` 中扩展分发逻辑。
  - 新建具体 `*NodeRender` 组件，并复用 `NodeWrapperUI` 以保持一致 UI 风格。
  - 使用 `onCardSendMsg` 回调向外发送用户输入或选择，不要自行操作上层消息队列。
- 在本子包中避免：
  - 修改 Rush 构建流程或 monorepo 根级配置文件。
  - 引入与现有 UI 体系冲突的组件库或样式方案。
  - 依赖 git 未提交的变更进行行为假设（请始终基于当前工作区已存在文件推理）。
