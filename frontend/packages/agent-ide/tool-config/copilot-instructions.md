# @coze-agent-ide/tool-config 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/tool-config）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本包位于 Rush + PNPM 管理的前端 monorepo 中：frontend/packages/agent-ide/tool-config。
- 所属域为 Agent IDE 下的「Tool 配置」子模块，主要职责是统一管理工具/技能在前端的配置枚举和类型映射，而非渲染 UI 组件。
- 本包通过导出枚举、映射表和快捷指令类型，为上层应用（如 agent-ide、playground、coze-studio）提供：
  - 「工具 / Agent 技能」类型系统（ToolKey / AgentSkillKey / AbilityScope 等）；
  - 工具在前端 store 中的字段名映射；
  - 工具在后端 TabDisplayItems / 各类状态字段中的映射；
  - Shortcut（快捷指令）的类型安全模型与过滤逻辑。
- 设计上，本包充当「配置与协议编排层」，通过对 @coze-arch/bot-api 的类型依赖，实现前后端协议之间的衔接。

## 2. 代码结构与关键模块

### 2.1 入口与导出
- 入口文件：[src/index.tsx](src/index.tsx)
  - 仅做 re-export，不含业务逻辑。
  - 对外暴露：
    - 能力与工具相关：AbilityScope、ToolKey、AgentSkillKey、AgentModalTabKey、AbilityKey、ToolGroupKey、SkillKeyEnum。
    - 工具配置：TOOL_KEY_STORE_MAP、AGENT_SKILL_KEY_MAP、TOOL_KEY_TO_API_STATUS_KEY_MAP、TOOL_GROUP_CONFIG。
    - 快捷指令类型与工具方法：ShortCutCommand、TemplateShortCutForWorkFlow、QueryShortCut、TemplateShortCutForPlugin、ShortCutStruct、getStrictShortcuts。
  - 新增能力或工具时，应保证在相应子模块中定义/修改后，再由 index.tsx 统一导出。

### 2.2 枚举与能力模型（types.ts）
- 文件：[src/types.ts](src/types.ts)
- 主要内容：
  - AbilityScope：区分能力作用域（TOOL vs AGENT_SKILL），用于统一处理工具和 Agent 技能。
  - ToolKey：本项目内所有「工具」的主键枚举，例如 PLUGIN、WORKFLOW、IMAGEFLOW、KNOWLEDGE、VARIABLE、DATABASE、LONG_TERM_MEMORY、FILE_BOX、TRIGGER、ONBOARDING、SUGGEST、VOICE、BACKGROUND、DOCUMENT、TABLE、PHOTO、SHORTCUT、DEV_HOOKS、USER_INPUT。
  - AgentSkillKey：Agent 层技能主键（PLUGIN、WORKFLOW、KNOWLEDGE），与 ToolKey 部分重合但含义为「Agent 技能维度」。
  - AgentModalTabKey：工具配置相关弹窗 Tab 的枚举（TOOLS、WORKFLOW、DATASETS），用于 UI 层控制当前显示的配置页签。
  - ToolGroupKey：工具分组（SKILL、KNOWLEDGE、MEMORY、DIALOG、HOOKS、CHARACTER），用于前端分组展示和排序。
  - SkillKeyEnum：旧版 module primary key，带有 @Deprecated 说明，提示使用 ToolKey 代替；仍被部分老逻辑引用，新增字段时要考虑兼容性。
- 结构性原则：
  - ToolKey 和 AgentSkillKey 是前后端协议中最核心的 ID，变更会影响 constants.ts 映射、上层 store 字段名以及后端 TabDisplayItems 字段。
  - 新增 Tool 时，应优先确认后端协议字段名（TabDisplayItems、draftbot 接口入参）后，再在此定义稳定的枚举值。

### 2.3 工具映射配置（constants.ts）
- 文件：[src/constants.ts](src/constants.ts)
- 对外导出：
  - TOOL_KEY_STORE_MAP：ToolKey → 前端 store 字段名
    - 示例：
      - ToolKey.PLUGIN → 'pluginApis'
      - ToolKey.SHORTCUT → 'shortcut'
      - ToolKey.DEV_HOOKS → 'devHooks'
    - 主要用于 IDE 内状态管理，如存储对应工具的配置列表。
  - AGENT_SKILL_KEY_MAP：AgentSkillKey → store 字段名
    - 示例：AgentSkillKey.PLUGIN → 'pluginApis'。
    - 作用在 Agent 维度的技能配置映射上，通常与 TOOL_KEY_STORE_MAP 保持一致语义。
  - TOOL_KEY_TO_API_STATUS_KEY_MAP：ToolKey → TabDisplayItems 字段名
    - 该映射严格依赖 @coze-arch/bot-api/developer_api 中 TabDisplayItems 类型。
    - 映射示例：
      - ToolKey.PLUGIN → 'plugin_tab_status'
      - ToolKey.WORKFLOW → 'workflow_tab_status'
      - ToolKey.IMAGEFLOW → 'imageflow_tab_status'
      - ToolKey.DATABASE → 'database_tab_status'
      - ToolKey.KNOWLEDGE → 'knowledge_tab_status' 等。
    - 会被 /api/draftbot/update_display_info 等接口调用使用，驱动前端 Tab 显示/隐藏与状态。
  - TOOL_GROUP_CONFIG：ToolGroupKey → 分组展示名称
    - 示例：SKILL → 'Skill'，KNOWLEDGE → 'Knowledge' 等。
    - 上方注释强调「此处顺序决定展示顺序」，因此对对象字面量的键顺序要保持谨慎。
- 变更约束：
  - 新增 ToolKey 时：
    - 必须同步更新 TOOL_KEY_TO_API_STATUS_KEY_MAP，确保 TabDisplayItems 中存在对应字段；
    - 如该 Tool 需要持久化/列表展示，也要在 TOOL_KEY_STORE_MAP 和/或 AGENT_SKILL_KEY_MAP 中建立映射；
    - 如该 Tool 需要被分组展示，需要给 TOOL_GROUP_CONFIG 增加或复用分组。
  - 修改/删除现有映射前，需要确保调用方（特别是 draftbot/update 与 update_display_info）已完成迁移，否则会导致运行时字段缺失。

### 2.4 快捷指令模型（shortcut-config/*）

#### 2.4.1 类型定义（shortcut-config/type.ts）
- 依赖外部类型：@coze-arch/bot-api/playground_api 中的 SendType、ToolType、ShortcutCommand、ShortcutStruct。
- 定义目标：在后端协议的基础上，生成更严格、更适合前端渲染与交互的类型。
- 关键类型：
  - ShortCutStruct：基于服务端 ShortcutStruct，只保留 shortcut_sort，并将 shortcut_list 强类型化为 ShortCutCommand[]。
  - ShortCutCommand：联合类型 = TemplateShortCutForWorkFlow | TemplateShortCutForPlugin | QueryShortCut。
  - BaseShortCutInfo：抽取快捷指令公共字段（command_name、template_query、description、send_type、command_id、object_id、bot_info 等）。
  - WorkflowTool / PluginTool：基于服务端 ShortcutCommand 的 ToolType 区分：
    - WorkflowTool：tool_type 固定为 ToolType.ToolTypeWorkFlow，必带 work_flow_id；
    - PluginTool：tool_type 固定为 ToolType.ToolTypePlugin，必带 plugin_id、plugin_api_name、plugin_api_id。
  - TemplateShortCutForWorkFlow / TemplateShortCutForPlugin：
    - send_type 强制为 SendType.SendTypePanel；
    - components_list 强制存在并复用服务端类型；
    - 分别组合 WorkflowTool / PluginTool。
  - QueryShortCut：send_type 强制为 SendType.SendTypeQuery，其余字段来自服务端。
- 设计要点：
  - 通过 Omit + & 重新组合服务端类型，收紧可选字段，避免前端到处写空字段判断。
  - 所有 ToolType 相关字段都在本地类型中重新约束，便于后续做基于 tool_type 的类型守卫。

#### 2.4.2 严格过滤逻辑（shortcut-config/get-strict-shortcuts.ts）
- 函数：getStrictShortcuts(shortcuts?: ShortcutCommandFromService[]) → ShortCutCommand[] | undefined。
- 实现逻辑：
  - 首先将列表 filter，并通过 Type Guard 语法断言返回值为 ShortCutCommand[]。
  - 过滤条件：
    - 无 command_id 的快捷指令会被丢弃（withoutCommandId）。
    - workflowWithoutWorkflowId：当 tool_type === ToolType.ToolTypeWorkFlow 且没有 plugin_id 时丢弃（目前逻辑使用 plugin_id 校验，可能是历史兼容/命名问题，修改需谨慎）。
    - pluginWithoutPluginId：当 tool_type === ToolType.ToolTypePlugin 且没有 plugin_id 时丢弃。
  - 对 send_type 为 Panel 但无 card_schema 的校验目前被注释掉（panelWithoutCardSchema），若后续服务端保证该字段存在，可重新开启进一步收紧。
- 使用约定：
  - 上层调用应优先使用 getStrictShortcuts 结果驱动 UI，避免直接使用原始服务端数据。
  - 如需新增过滤规则（例如要求 components_list 非空），请在此函数集中维护，确保规则一致性。

## 3. 构建、测试与本地开发

### 3.1 包级脚本
- package.json：[frontend/packages/agent-ide/tool-config/package.json](package.json)
  - build："exit 0"（当前无独立构建输出，通常由上层应用/构建系统统一打包）。
  - lint："eslint ./ --cache"，依赖 @coze-arch/eslint-config 与 eslint.config.js。
  - test："vitest --run --passWithNoTests"，使用 Vitest 与 @coze-arch/vitest-config。
  - test:cov：执行带覆盖率的 Vitest。

### 3.2 测试配置
- Vitest 配置：[frontend/packages/agent-ide/tool-config/vitest.config.ts](vitest.config.ts)
  - 使用 defineConfig from @coze-arch/vitest-config，preset 为 'web'，dirname 为当前目录。
  - 建议在 __tests__/ 中添加针对 getStrictShortcuts 和关键映射的单元测试。

### 3.3 在 monorepo 中运行
- 在仓库根目录执行依赖安装：
  - rush install 或 rush update（详情见 frontend/README.md）。
- 进入本子包后可执行：
  - pnpm test / npm test：运行本包 Vitest 测试。
  - pnpm lint / npm run lint：运行 ESLint 检查。
- 构建一般由上层 apps/coze-studio 或 infra 配置统一完成；本包无需单独发布构建产物。

## 4. 项目约定与特殊注意事项

### 4.1 命名与兼容策略
- ToolKey / AgentSkillKey / ToolGroupKey 等枚举为协议级稳定接口，变更会影响：
  - 前端 store 字段（TOOL_KEY_STORE_MAP、AGENT_SKILL_KEY_MAP）；
  - 后端 TabDisplayItems 字段（TOOL_KEY_TO_API_STATUS_KEY_MAP）；
  - 其他包中对这些枚举的引用（如 agent-ide UI、workflow、playground 等）。
- SkillKeyEnum 标记为 @Deprecated，但仍被历史逻辑引用：
  - 新增字段时优先在 ToolKey 中添加；
  - 若需要兼容旧逻辑，可在 SkillKeyEnum 中增加对应 BLOCK 枚举，但要在注释中说明用途。
- TOOL_GROUP_CONFIG 对象中的键顺序有展示含义，不要随意排序；新增分组时按产品约定追加。

### 4.2 与后端协议联动
- 本包强依赖 @coze-arch/bot-api 中两类接口：
  - developer_api：TabDisplayItems 类型（工具 Tab 显示状态）；
  - playground_api：与 Shortcut 相关的类型（SendType、ToolType、ShortcutCommand、ShortcutStruct）。
- 修改映射、字段或过滤逻辑前，应检查：
  - 对应后端 proto/IDL（项目 idl/ 目录及相关生成代码）；
  - 其他前端包中是否依赖同一字段名/枚举值。
- 建议在 PR 中：
  - 标注当前修改对应的后端变更；
  - 为新 ToolKey/映射增加最小化的单元测试或 snapshot。

### 4.3 测试与回归关注点
- getStrictShortcuts：
  - 覆盖 workflow / plugin / query 三类 Shortcut；
  - 针对 command_id 缺失、plugin_id/work_flow_id 缺失等情况应有明确断言（被过滤掉）。
- constants.ts：
  - 对 TOOL_KEY_TO_API_STATUS_KEY_MAP 的 key 完整性做校验（可以通过类型推断 + 测试保证所有 ToolKey 都有映射）。
- types.ts：
  - 新增枚举值时，推荐增加简单测试确保与对应映射表保持一致。

## 5. AI 助手具体协作建议

- 在本子包中进行修改或新增能力时，请优先遵循以下流程：
  1. 在 src/types.ts 中为新工具/能力定义稳定的枚举（ToolKey / AgentSkillKey / ToolGroupKey 等）；
  2. 在 src/constants.ts 中：
     - 为新 ToolKey 配置 store 与 TabDisplayItems 映射（如有需要）；
     - 根据产品分组需求更新 TOOL_GROUP_CONFIG；
  3. 若涉及快捷指令：
     - 在 shortcut-config/type.ts 中补充相应类型（必要时新增联合类型分支）；
     - 使用或扩展 getStrictShortcuts 的过滤规则，确保不产生无效数据。
  4. 更新或新增测试用例于 __tests__/ 目录，并运行 vitest 确认通过。
- 修改跨包会话（例如 bot-api typings 变化）时，只在已存在调用场景上做「同步与修复」，避免引入新的跨包耦合逻辑；如果需要更复杂的行为，优先在上层应用/业务包中实现。