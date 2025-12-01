# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/memory/variables）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是记忆系统中的“变量管理”与“变量值预览”前端模块，位于 Rush Monorepo 的 data/memory 领域下，与 database / llm-plugins 等包并列。
- package.json 的 main 指向 src/index.tsx，整体以 React + TypeScript 实现，可复用到多个上层应用（如 Bot Studio / 知识 IDE）。
- 变量“结构与配置”由 Zustand store 管理（src/store），对外暴露 useVariableGroupsStore 与类型；
  - store 层维护变量分组（VariableGroup）、变量树（Variable）以及 meta 信息。
  - 与后端 project_memory DTO 通过 transform/vo2dto.ts、transform/dto2vo.ts 做双向转换。
- 变量“值预览与操作”由 UI 组件承担（目前主要是 src/variables-value.tsx）：
  - 通过 MemoryApi.GetPlayGroundMemory / DelProfileMemory 访问后端记忆接口。
  - 使用 @coze-arch/coze-design 的 Table / Select 组件进行展示与交互。
- src/context 提供变量树上下文（VariableTreeContext），用于在组件树中共享当前变量组及变量列表。
- src/utils/traverse.ts 提供通用树遍历工具，被 store 中的 getAllVariables / saveHistory 等逻辑复用。

## 关键数据流与核心模块

- “变量结构”数据流：
  - 外部模块调用 useVariableGroupsStore.initStore({ variableGroups, canEdit }) 初始化，variableGroups 为后端返回的 GroupVariableInfo 列表。
  - store.transformDto2Vo 使用 getGroupListByDto 将 DTO 转为前端 VO 结构，然后立即调用 updateMeta 为每个变量计算 level / hasObjectLike / parentId。
  - store 通过 addRootVariable / addChildVariable / deleteVariable / updateVariable / findAndModifyVariable 等方法操作变量树，并在每次变更后维护 meta。
  - getAllRootVariables / getAllVariables 使用 traverse 工具在分组树/变量树上遍历返回集合，用于上层做校验/批量处理。
- “变量类型系统”数据流：
  - src/store/variable-groups/types.ts 定义 ViewVariableType（前端视图类型）与 VariableTypeDTO（后端 schema type）。
  - BASE_ARRAY_PAIR / VARIABLE_TYPE_ALIAS_MAP 用于将基础类型扩展为 Array 类型，并提供展示别名。
  - ViewVariableType.getComplement / ViewVariableType.isArrayType 用于 UI/校验侧计算可选类型与数组类型判断。
  - ObjectLikeTypes 用于在 store.updateMeta 时标记 hasObjectLike，用于区分对象/对象数组变量。
- “变量值预览与重置”数据流（VariablesValue 组件）：
  - 通过 useRequest 包装 MemoryApi.GetPlayGroundMemory，请求参数包含 project_id 与可选 version。
  - 接口返回的 memories 映射为 Table dataSource，每一行对应 KVItem（keyword/value/schema/update_time）。
  - 对支持编辑的变量，使用 Select + showClear + 自定义 clearIcon 作为“重置当前变量值”入口，实际动作为 DelProfileMemory({ keywords: [keyword] })。
  - “全部重置”按钮调用 DelProfileMemory({ project_id })，清空所有 profile memory。
  - 所有重置行为都会发送 EVENT_NAMES.memory_click_front 埋点，resource_type 固定为 variable，action 固定为 reset，并带上 source/source_detail 标记来源。

## 开发与调试工作流

- 本子包自身的 npm scripts（位于 package.json）：
  - lint：`eslint ./ --cache`，使用工作区统一 ESLint 配置（@coze-arch/eslint-config）。
  - test：`vitest --run --passWithNoTests`，使用 @coze-arch/vitest-config；当前 __tests__ 目录为空，允许无测试通过。
  - test:cov：`npm run test -- --coverage`，Rush 通过 config/rush-project.json 把 coverage 目录标记为 test:cov 的产物。
  - build：当前为 `exit 0`，真实构建由上层工具链（例如统一构建命令）完成，不在子包内单独维护。
- TypeScript 配置：
  - tsconfig.json 仅作为 composite 根，全部文件通过 tsconfig.build.json 与 tsconfig.misc.json 管理；通常不直接修改 tsconfig.json。
  - 引入 @coze-arch/ts-config 作为基础配置（在子 tsconfig.*.json 中）。
- 测试与覆盖率在 Rush 中的约定：
  - rush test 或 rushx 触发时，会识别 operationName=test:cov 并收集 coverage 文件夹。
  - 如需新增测试，请放在 __tests__ 目录或与文件同级，遵循 vitest 默认命名规则。

## 代码风格与项目特有约定

- 代码风格：
  - 使用 ESLint + TypeScript，遵循 @coze-arch/eslint-config；常见规则包括：
    - 尽量使用类型导入（type 前缀）。
    - 禁用 @typescript-eslint/no-explicit-any，除 DTO schema 等极少数场景（例如 VariableSchemaDTO.schema）。
    - 允许在少数工具函数中使用 max-params，通过局部 eslint-disable 覆盖。
  - 样式使用 Less 模块（如 src/index.module.less），同时在 JSX 中允许使用 Tailwind 风格的 className 组合。
- 状态管理约定：
  - 全局状态使用 zustand + middleware.subscribeWithSelector + middleware.devtools 组合，统一通过 useXXXStore Hook 导出。
  - store 的 state 与 action 接口在同一个文件中定义（如 src/store/variable-groups/store.ts），对外统一由 src/store/index.ts 再导出。
  - 所有变更操作使用 immer.produce 包裹，保证不可变更新与可读性。
  - findAndModifyVariable 是本包内“在树中定位并可选修改/删除变量”的唯一入口，其他逻辑应复用该函数避免重复实现树遍历。
- 变量元数据约定（VariableMeta）：
  - isHistory：true 表示该变量来自历史版本或已被保存的历史状态；saveHistory 会将当前所有变量标记为历史。
  - level：树深度，从 0 开始；addRootVariable 时为 0，子节点在 updateMeta 中递增。
  - hasObjectLike：根据 ObjectLikeTypes 判断，标记该变量是否为对象或对象数组，供 UI 与校验逻辑使用。
  - parentId：指向父变量 variableId；根节点 parentId 为空字符串。
- 事件与埋点：
  - 与记忆变量相关的交互需要通过 sendTeaEvent 上报埋点，统一使用 EVENT_NAMES.memory_click_front，并按现有字段命名规范扩展。

## 与外部系统与包的集成

- Bot/记忆后端 API：
  - 通过 @coze-arch/bot-api 与 @coze-arch/bot-api/memory 交互，依赖其导出的 MemoryApi、KVItem、project_memory.DTO 类型与 VariableChannel/VariableType 等枚举。
  - DTO/VO 转换需遵循后端契约，不要直接在 UI 逻辑中拼生的字段；统一通过 src/store/variable-groups/transform/* 完成。
- 设计系统与组件库：
  - UI 基于 @coze-arch/coze-design 和 @douyinfe/semi-illustrations：
    - 表格与交互按钮使用 Table / IconButton / Tooltip / Empty 等组件。
    - 图标优先使用 IconCoz* 命名的自定义图标（来自 @coze-arch/coze-design/icons）。
  - 国际化统一使用 @coze-arch/i18n 的 I18n.t(key)；新增文案请复用现有命名风格（如 variable_Table_Title_*）。
- 通用工具：
  - 类型安全 JSON 解析统一使用 @coze-arch/bot-utils 的 typeSafeJSONParse（例如解析 KVItem.schema）。
  - 日期时间统一使用 dayjs（如在变量值表格中格式化 update_time）。
  - 不可变更新/深拷贝使用 immer.produce 与 lodash-es.cloneDeep；不要手写深拷贝逻辑。
- 状态/存储：
  - 如需与本地存储交互，优先通过 @coze-foundation/local-storage 封装，而不是直接访问 window.localStorage。

## 项目流程与协作规范

- 本包遵循整个仓库的通用流程（见仓库根目录与 frontend 下文档）：
  - 使用 Rush 进行包管理与任务编排，子包的 config/rush-project.json 仅声明产物目录。
  - 分支与发布策略跟随上层项目（Bot Studio / Data Studio），本子包自身不单独维护版本发布文档。
- 在变量模块上做改动时推荐实践：
  - 若涉及与后端 DTO 的字段/结构变更，需同时更新 transform 层与类型定义，并验证其他依赖变量模块的包是否受影响。
  - 对变量树结构的任何修改（增删字段/层级）应确保 updateMeta 行为仍然正确，包括 level / parentId / hasObjectLike。
  - 对变量值预览（VariablesValue）行为做调整时，要同步评估埋点字段是否仍满足埋点平台的消费预期。

## 特色与注意事项

- build 脚本为占位实现（exit 0），真实构建完全依赖上游 Rush/Vite 配置；在子包内新增构建相关脚本前需确认不会与全局流程冲突。
- 变量树相关逻辑高度封装在 useVariableGroupsStore 中：
  - 建议在新增功能时优先扩展 store action，而不是在组件内直接操作 variableGroups 结构。
  - findAndModifyVariable 封装了“按 groupId + predicate 查找并可选修改/删除”的通用逻辑，避免自行编写递归遍历。
- traverse 工具函数设计为可配置 children key 与最大深度，适用于变量树与分组树两种结构；调用时请显式传递 traverseKey 以避免结构变更带来的隐性 bug。
- 本子包已存在多个 data/memory 相关的 copilot-instructions.md（例如 database/database-v2-* 等）；在迁移/复用模式时，可以参考这些包的实践，但本文件描述应始终与当前实际代码保持一致。