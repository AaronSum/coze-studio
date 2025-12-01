# @coze-agent-ide/prompt 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/prompt）中安全、高效地协作开发。

## 全局架构与职责划分
- 本子包是 Agent IDE 中「机器人人格与 Prompt 配置」区域的 UI 组件与辅助逻辑封装，对外暴露统一入口：src/index.ts。
- 核心导出包括：
  - PromptView：用于在 IDE 中呈现「人格与 Prompt」区域的布局与交互外壳。
  - PromptLibrary / ImportToLibrary：Prompt 侧边/顶部的「插件与知识库库」操作入口组件。
  - useGetLibrarysData / useAddLibrary：围绕「技能库（插件/工作流/数据集）」的读取与添加逻辑的 hooks。
- 状态与数据完全依赖上层存储与数据模块：
  - 机器人详情与模式：@coze-studio/bot-detail-store 下的多个 store（bot-info、persona、bot-skill 等）。
  - 知识库数据集：@coze-data/knowledge-data-set-for-agent。
  - Bot/Workflow/Knowledge 类型定义：@coze-arch/bot-api、@coze-arch/idl 等。
- 本包不直接调用后端接口，而是通过上述 store 与数据包进行读写，保持「视图 + 适配层」角色。

## 代码结构概览
- 入口与类型
  - src/index.ts：集中导出组件与 hooks，是其他包引用的唯一入口，新增导出时务必在此补充。
  - src/typings.d.ts：本包的全局类型声明补充文件（如果需要声明全局类型或模块补充，可考虑放这里）。
- 视图组件
  - src/components/prompt-view/
    - index.tsx：PromptView 组件，负责：
      - 根据 useBotInfoStore 中的 mode 判断是单 Agent 还是多 Agent 模式。
      - 使用 ToolContentBlock 渲染「bot_persona_and_prompt」区域。
      - 控制折叠、只读态样式以及 editorExtensions（编辑器扩展渲染插槽）。
      - 内部挂载 PromptEditorEntry，并透传 actionButton、children 等插槽。
    - index.module.less：PromptView 的样式模块，基于 Coze 设计体系类名进行布局与皮肤控制。
  - src/components/prompt-editor/
    - index.tsx：PromptEditorEntry 组件，职责：
      - 从 usePersonaStore 读取与写回 systemMessage.data（即系统 Prompt 内容）。
      - 使用 React.lazy/Suspense 动态加载 AgentIdePrompt 组件，配合 Spin 做加载占位。
      - 控制只读态（来自 useBotDetailIsReadonly）和单多模式（isSingle）。
    - agent-ide-prompt/index.tsx：实际 Prompt 富文本/代码编辑器封装，与 PromptKit 等组件协作（查看文件内容时保持现有 API 与样式约定）。
    - agent-ide-prompt/index.module.less：编辑器区域样式。
- 库操作组件
  - src/components/prompt-view/components/actions/
    - index.tsx：汇总导出 PromptLibrary 与 ImportToLibrary，两者通常用于「插入到库」与「从库选择」等操作按钮。
    - prompt-library.tsx & import-to-library.tsx：具体按钮/下拉等交互实现，内部会使用 useGetLibrarysData / useAddLibrary。修改时要保持 API 与导出名称稳定。
- 业务 hooks
  - src/hooks/use-prompt/use-get-library-data.ts：
    - 从 useBotSkillStore 读取 plugins、workflows，从 useDatasetStore 读取 dataSetList。
    - 生成 ILibraryList：分为 plugin / workflow / imageflow / image / table / text 六大类，统一字段结构：id、name、desc、icon_url、type 等。
    - imageflow 会从 workflows 中按 WorkflowMode.Imageflow 过滤，注意依赖 WorkflowMode 枚举常量。
  - src/hooks/use-prompt/use-add-library.ts：
    - 针对不同 library.type 分发到不同的添加逻辑：plugin / workflow / imageflow / text / table / image。
    - 调用 useBotSkillStore 的 updateSkillPluginApis / updateSkillWorkflows / updateSkillKnowledgeDatasetList 等方法更新技能配置。
    - 同时更新 useDatasetStore 的 dataSetList，使知识库数据在 Editor 与全局 store 中保持一致。

## 依赖与跨包集成要点
- 状态管理：
  - 使用 zustand 作为底层状态管理库，但绝大部分 store 定义位于其他包（如 @coze-studio/bot-detail-store）。
  - 在本包中通过 useShallow 做浅比较选择器，减少渲染次数；新增字段时应优先扩展 selector，而非直接使用整个 state 对象。
- Bot/Workflow/Knowledge 模型：
  - WorkflowMode 来自 @coze-arch/bot-api/workflow_api 或 @coze-arch/idl/developer_api（根据具体文件）；
  - FormatType（Text/Table/Image）来自 @coze-arch/bot-api/knowledge 或 @coze-arch/idl/knowledge，用于知识库数据集过滤与新增；
  - ILibraryItem / ILibraryList 来自 @coze-common/editor-plugins/library-insert，封装了编辑器库插入的统一结构。
- UI 组件与样式：
  - 主要依赖 @coze-arch/coze-design（如 Spin, 其他基础组件）以及 @coze-agent-ide/tool 中的 ToolContentBlock 作为布局容器。
  - 所有样式使用 CSS Modules（*.module.less），类名组合通过 classnames 处理，并辅以 tailwind-like 的原子类（如 !pl-5, !p-0）。
  - 国际化通过 @coze-arch/i18n 的 I18n.t 使用 key，如 bot_persona_and_prompt。

## 构建、测试与本地开发
- 本子包作为前端 monorepo 中的一个 package，构建/开发命令部分由上层统一管理；本地常用命令：
  - 依赖安装与整体初始化：在仓库根目录执行 rush update。
  - 本包构建：当前 package.json 中 build 脚本为占位实现（exit 0），真实构建多半依赖 monorepo 统一构建流程（如 rush build），改动前需确认整体构建策略。
  - Lint：在本子包目录执行 npm run lint，使用 @coze-arch/eslint-config 与 stylelint 配置。
  - 单测：在本子包目录执行 npm run test 或 npm run test:cov，实质为 vitest --run --passWithNoTests，配置来自 vitest.config.ts 中的 defineConfig({ dirname, preset: 'web' })。
- Storybook / 组件调试：
  - README.md 提到支持 storybook，但本包未直接包含 storybook 配置，通常由更上层统一管理；如需新增 story，建议遵循 frontend 目录下其他包的约定结构。

## 项目惯例与注意事项
- 只读态与模式判断：
  - PromptView 和 PromptEditorEntry 都依赖 useBotDetailIsReadonly 来控制只读态，新增交互在只读态下应避免触发状态修改。
  - BotMode.SingleMode / MultiMode 决定样式与折叠逻辑：
    - 单 Agent：Prompt 区域通常展开且紧跟编辑器，无额外 padding（见 !p-0 类）。
    - 多 Agent：Prompt 区域一般可折叠，使用 isMulti && s['system-area-multi'] 等样式差异。
- 状态更新约定：
  - 使用 immer 风格的 setPersonaByImmer 更新 persona，避免手动拷贝嵌套对象；在 onChange 中直接修改 draft.persona 的属性即可。
  - 对于数组类字段（如 workflows, pluginApis, knowledge.dataSetList），统一通过解构 + concat 形式生成新数组，再交由 store 更新，避免原地修改。
  - useDatasetStore 与 useBotSkillStore 中关于同一数据集的字段需要保持同步更新（例如新增知识库时同时更新 dataSetList 和 knowledge.dataSetList）。
- 懒加载编辑器：
  - AgentIdePrompt 通过 React.lazy 动态加载，必须包裹在 <Suspense fallback={...}> 中；新增 props 时要确保 defaultValue、readonly、isSingle、editorExtensions 等核心参数保持兼容。
  - fallback 中使用 Spin，尺寸通过行内 style 的 width/height 设为 100%，不要移除以免 loading 态出现空白。
- 导出与对外 API 稳定性：
  - src/index.ts 即为对外正式 API：
    - 新增任何对外可用组件或 hooks 时，务必在此补充导出，并尽量保持向后兼容（不随意重命名或删除现有导出）。
  - actions 层的 PromptLibrary / ImportToLibrary 已被其他包依赖（例如上层 IDE 容器或工具栏），修改 props 需检查全局调用点。

## 开发流程与协作建议
- 分支与提交策略：
  - 整个仓库遵循常规 Git 流程，未在本包中定义特殊规则；在修改涉及多个子包时，建议以功能为单位创建 feature 分支，并保持提交信息语义化（例如 feat(prompt): xxx, fix(prompt): yyy）。
- 修改时的推荐步骤：
  - 在根目录执行 rush update 保证依赖完整。
  - 在 frontend/packages/agent-ide/prompt 下开发与运行 lint/test。
  - 如果本包改动涉及其他 store 包（如 @coze-studio/bot-detail-store），需要同时对那边的 API 变更进行说明和适配，避免运行时类型不匹配。

## 不寻常或特别之处
- 构建脚本当前为 "build": "exit 0"，说明：
  - 本包暂时仅作为运行时组件，被主应用在更高层统一打包；不要单独依赖 npm run build 产物。
- 库数据的双向绑定：
  - useGetLibrarysData 与 useAddLibrary 形成「读 + 写」闭环，前者从 store 构建 ILibraryList，后者基于 ILibraryItem 写回 store。
  - 新增 library type 时，必须同时扩展：
    - useGetLibrarysData 中 libraryList 的组装逻辑；
    - useAddLibrary 中的 type 分支与底层 store 更新逻辑；
    - 对应的 ILibraryItem / ILibraryList 类型（在 @coze-common/editor-plugins/library-insert 中）。
- Prompt 内容持久化路径：
  - PromptEditorEntry 直接读写 usePersonaStore.state.systemMessage.data；该字段的结构和含义是在其他包中定义的，本包只负责编辑与展示，不自行做格式转换。
