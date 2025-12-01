# @coze-devops/testset-manage 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/devops/testset-manage）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本包是 Coze Studio 前端 monorepo 中的一个业务子库，提供“测试集（Testset）管理”能力，包括：下拉选择组件、管理侧边栏、测试集编辑侧边栏、配套的 hooks 与 store。
- 对外导出统一入口位于 src/index.ts，暴露组件、hooks、工具函数与类型：
  - 组件：TestsetSideSheet（管理侧边栏）、TestsetSelect（测试集选择下拉）。
  - 容器：TestsetManageProvider，用于注入业务上下文（bizCtx、bizComponentSubject 等）和可编辑性 editable。
  - Hooks：useTestsetManageStore、useTestsetOptions、useCheckSchema。
  - 类型与工具：FormItemSchemaType、NodeFormItem、NodeFormSchema、TestsetData、TestsetDatabase、getTestsetNameRules、TestsetManageEventName 等。
- 数据与状态流：
  - 业务上下文 TestsetManageState 及其 zustand store 定义在 src/store.ts，并通过 TestsetManageProvider 注入 React Context。
  - 所有内部 hooks（如 useTestsetOptions、useCheckSchema）必须在 Provider 之下使用，通过 useTestsetManageStore 读取 bizCtx、bizComponentSubject、editable 等，并调用 debuggerApi 发起后端请求。
  - UI 组件（TestsetSideSheet、TestsetSelect、TestsetEditSideSheet）纯粹消费 hooks 返回的数据与回调，不直接管理跨组件共享状态。
- 与外部系统交互：
  - debuggerApi（@coze-arch/bot-api）是和后端测试集/工作流调试服务交互的唯一入口，包含 MGetCaseData、DeleteCaseData、SaveCaseData、GetSchemaByID、CheckCaseDuplicate 等接口。
  - 依赖 @coze-arch/i18n 做文案国际化，禁止硬编码中文/英文文案。
  - 依赖 @coze-arch/bot-semi UI 组件库和表单能力，以及 @coze-arch/logger 统一日志上报。

## 2. 关键模块与文件结构

- 状态管理与上下文
  - src/store.ts
    - TestsetManageState：承载 bizCtx、bizComponentSubject、editable、formRenders、reportEvent 等业务级信息。
    - createTestsetManageStore(initState)：使用 zustand 创建 store，统一通过 patch 进行部分更新；不要在组件内直接构造新 store。
    - useInnerStore：内部使用的小型 zustand store，目前用于标记 generating（AI 自动填充中）。
  - src/context.tsx
    - TestsetManageContext：提供 zustand store 实例的 React Context。
    - TestsetManageProvider：在首次渲染时创建 store，并将 props 作为初始状态注入；后续 props 改变不会自动同步进 store，新增字段请在调用方自行控制生命周期。
- Hooks
  - src/hooks/use-testset-manage-store.ts
    - useTestsetManageStore(selector)：从 context 中取出 store 并用 zustand useStore 订阅；若缺少 Provider 会抛出 CustomError('normal_error', 'Missing TestsetManageProvider in the tree')，编写新组件时要保证调用栈内有 Provider。
  - src/hooks/use-testset-options.ts
    - 提供测试集下拉列表数据的加载与分页逻辑：loadOptions（重载）、loadMoreOptions（增量）、optionsData（{ list, hasNext, nextToken }）。
    - 调用 debuggerApi.MGetCaseData，依赖 bizCtx、bizComponentSubject；在分页时使用上次返回的 nextToken。
    - updateOption 用于在编辑成功后就地更新当前列表项，而不是整体刷新，保持下拉的性能与用户体验。
  - src/hooks/use-check-schema.ts
    - 对工作流节点表单 schemaJson 做合法性校验，避免在 schema 为空或不合法时创建/编辑测试集。
    - checkSchema 通过 debuggerApi.GetSchemaByID 获取服务端 schema，再通过 validateSchema 进行：
      - 空检查：整体为空或 Start 节点 inputs 为空时返回 SchemaError.EMPTY。
      - 命名检查：使用 PARAM_NAME_VALIDATION_RULE 正则限制变量名（禁止 true/false/and/or/not/null 等关键字，必须以字母/下划线开头）。
      - 复杂字段检查：递归校验 object/list 类型的 schema，保证子字段命名唯一且格式正确。
    - schemaError 仅作为 UX 提示，不阻断 API 调用异常；异常时会打印 logger.error 并返回 SchemaError.OK。
- 类型与 schema 工具
  - src/types.ts
    - 将后端 CaseDataDetail / CaseDataBase 类型别名为 TestsetData / TestsetDatabase，避免直接在业务中使用 API 类型名。
    - 定义 FormItemSchemaType、FormItemSchema、NodeFormSchema、NodeFormItem（渲染表单项组件的签名）。
  - src/components/testset-edit-sidesheet/utils.ts
    - 定义 toNodeFormSchemas、isNil、isSameType、traverseNodeFormSchemas 等 schema 处理基础工具。
    - getTestsetNameRules 封装测试集名称校验规则：必填、名称 pattern（海外/国内规则不同）、重名校验（debuggerApi.CheckCaseDuplicate）。
    - getLabel / getTypeLabel / getPlaceholder 为 UI 渲染提供统一的字段展示文案和类型字符串（如 Array<Number>）。
    - getSubFieldName 将字段名与 component_id 组合成唯一 key，表单内部依赖此 key 存值。
    - 利用 Ajv 对 object/list 类型的 JSON 输入做 schema 级校验，validateByJsonSchema 在 JSON.parse 或校验失败时返回 false 并配合表单规则输出 I18n.t('workflow_debug_wrong_json')。
    - 针对 boolean 字段定义枚举值 ValuesForBoolSelect 及转换函数 transBoolSelect2Bool / transBool2BoolSelect，让表单可以用下拉选项管理布尔值。

## 3. UI 组件与交互流程

- TestsetSelect：测试集下拉选择组件
  - 文件：src/components/testset-select/index.tsx。
  - 职责：
    - 通过 useTestsetOptions 加载测试集列表，支持关键字搜索与滚动加载更多（useInViewport + AutoLoadMore）。
    - 支持在下拉中直接编辑、删除测试集：
      - 编辑：打开 TestsetEditSideSheet，mode='edit'，完成后调用 onSelect 更新当前选择并通过 updateOption 局部刷新列表。
      - 删除：二次确认弹窗（UIModal.error），成功后如当前选择为被删除项则清空 onSelect(undefined)，再重新加载列表。
    - 通过 editable prop 或 store 中的 editable 控制是否可编辑，内部将两者进行合并（组件参数优先生效）。
  - 使用注意：
    - testset 为受控值，必须由上层组件管理；onSelect 返回新的 TestsetData 或 undefined。
    - 组件依赖 TestsetManageProvider 提供 bizCtx（用于 DeleteCaseData）和 bizComponentSubject。
- TestsetSideSheet：测试集管理侧边栏
  - 文件：src/components/testset-sidesheet/index.tsx。
  - 职责：
    - 左侧列表分页加载全部测试集（useInfiniteScroll + debuggerApi.MGetCaseData）。
    - 通过 useCheckSchema 在面板打开时检查当前工作流 schema 状态；若 schemaError 为 EMPTY 或 INVALID，在点击“新建/编辑”时会通过 UIToast 显示错误并阻止打开编辑面板。
    - 创建/编辑/删除：
      - 创建：setTestsetEditState({ visible: true, mode: 'create' })。
      - 编辑：setTestsetEditState({ visible: true, testset, mode: 'edit' })。
      - 删除：调用 DeleteCaseData 后清空列表并 reloadTestsetList。
    - 所有成功操作（创建、编辑、删除）通过 reloadTestsetList 重新拉取列表，确保数据刷新。
- TestsetEditSideSheet：测试集编辑侧边栏
  - 文件：src/components/testset-edit-sidesheet/index.tsx。
  - 表单结构：
    - 测试集名称 TestsetNameInput（使用 getTestsetNameRules 做校验）。
    - 描述 UIFormTextArea（限制 200 字）。
    - 节点参数 NodeFormSection 列表（基于 NodeFormSchema 渲染每个节点的输入）。
    - AutoFillButton：提供自动填充参数的能力，onAutoFill 将 AI 生成的 NodeFormSchema 转成表单值并触发单字段校验。
  - Schema 加载与合并逻辑：
    - useRequest 在可见时调用：
      - 从 testset.caseBase.input 解析本地 schemas（编辑模式）。
      - 从 debuggerApi.GetSchemaByID 获取最新远端 schema。
    - 若本地 schema 存在，则遍历本地/远端 schemas 的字段（基于 getSubFieldName）并在类型一致时继承旧值，用于在 workflow 结构变化后尽量保留原有参数值。
    - 若在创建模式下没有本地 schema，会为 object/list/boolean 字段设置合理的默认值（assignDefaultValue）。
  - 提交逻辑：
    - onConfirm 先进行表单整体 validate，存在错误则阻断提交。
    - onSubmit 将表单值与当前 nodeSchemas 合并：
      - 写回 ipt.value；对于 object/list 为空值时将 value 清空，避免保存无意义的空 JSON。
      - 对 boolean 字段使用 transBoolSelect2Bool 将下拉值转换为真实布尔值。
      - 构造 caseBase（name、caseID、description、input），其中 input 为 JSON.stringify 后的 NodeFormSchema[]。
    - 调用 debuggerApi.SaveCaseData 保存，若为创建模式则通过 reportEvent 上报 TestsetManageEventName.CREATE_TESTSET_SUCCESS。

## 4. 开发与构建工作流

- 包级构建配置
  - config/rush-project.json：声明了 "ts-check" operation，outputFolderNames 为 ./dist；ts-check 由 monorepo 顶层 rush.json 统一驱动。
  - 本包无独立的脚本入口，构建/检查需从 monorepo 顶层执行。
- 典型开发步骤（在仓库根目录执行）：
  - 安装依赖：rush update。
  - 仅做类型检查/构建该包：
    - 可在 monorepo 顶层通过 rush build -t @coze-devops/testset-manage 或对应的 rushx 命令（参考 frontend 目录下的 rushx-config）。
  - 本包不直接启动独立 dev server，一般作为公共组件被上层应用（如 devops 相关 app）引用并在统一前端 dev 环境中调试。
- 诊断与调试建议
  - 与后端交互失败时（debuggerApi 抛错）通常会被 catch 并 logger.error 记录，但不会总是向 UI 透出；调试接口时可在浏览器 Network 中观察具体请求。
  - 针对 schema 校验问题，可暂时在 validateSchema 或相关函数中增加日志输出（注意提交前删除不必要的调试日志）。

## 5. 项目约定与编码规范

- 通用约定
  - 严格使用 TypeScript，类型定义在 src/types.ts 或就近定义，避免 any。
  - 组件文件命名统一采用 kebab-case 目录 + index.tsx 形式，例如 testset-sidesheet/index.tsx。
  - 较大组件允许通过 eslint disable max-line-per-function 标注豁免，但不要随意新增超大函数，新增逻辑优先拆分子组件/工具函数。
- 状态与上下文使用约定
  - 所有需要访问 bizCtx、bizComponentSubject、editable、reportEvent 等业务上下文的地方都必须通过 useTestsetManageStore 获取，禁止直接操作 zustand store 实例或 context 对象。
  - 新增 store 字段时：
    - 在 TestsetManageState 中扩展类型定义。
    - 在 TestsetManageProvider 的 props 中透出，并在调用方正确传入初始值。
    - 使用 patch 更新局部字段，避免 set 全量覆盖。
- 命名与国际化
  - 所有对用户可见的文案必须使用 I18n.t('key')，key 与现有 workflow*\* / create_plugin*\* 命名保持一致风格；新增 key 需在 i18n 资源中补齐。
  - 变量命名风格：业务数据使用 testsetXXX、nodeSchemaXXX；布尔值使用 isXXX / hasXXX 或带 Error 后缀的枚举。
  - 对 workflow 节点参数名等用户输入做统一校验（见 use-check-schema.ts 中 PARAM_NAME_VALIDATION_RULE），新增校验应复用该规则，而不是在组件内部重复实现。
- 错误处理
  - 对外暴露的 hooks/组件在关键错误场景下应保持“安全失败”：
    - 缺少 Provider 时通过 CustomError 显式抛错，便于上层在开发阶段及时发现问题。
    - 网络/后端错误在组件中尽量通过 UIToast/UIModal 给用户友好提示，同时使用 logger 记录详细错误以便排查。

## 6. 与外部系统的集成细节

- debuggerApi 集成
  - MGetCaseData：分页获取测试集列表，调用方需传入 bizCtx、bizComponentSubject、可选 caseName（搜索）、pageLimit、nextToken。
  - GetSchemaByID：通过 bizCtx、bizComponentSubject 获取当前 workflow 节点表单 schemaJson，用于构造 NodeFormSchema 和参数表单。
  - SaveCaseData：保存/更新测试集，入参包含 caseBase（name、description、caseID、input 等）。
  - DeleteCaseData：根据 caseIDs 删除测试集；删除后需要手动刷新列表或下拉选项。
  - CheckCaseDuplicate：校验测试集名称是否重复，getTestsetNameRules 中已封装，新增名称校验逻辑应尽量复用。
- 分析与埋点
  - store 中的 reportEvent（可选）用于上报用户操作埋点，如 TestsetManageEventName.CREATE_TESTSET_SUCCESS、AIGC_PARAMS_CLICK；
  - 编写新事件时：
    - 在 src/events.ts 中新增枚举值。
    - 确保调用方在合适的时机调用 reportEvent?.(eventName, params)。

## 7. 特殊特性与注意事项

- Schema 兼容性与容错
  - TestsetEditSideSheet 的 schema 合并逻辑对 workflow 变更具有一定兼容性（按 component_id + 字段名匹配），但不能保证所有结构变更都能自动迁移；在大幅调整 workflow schema 时建议提醒用户重新设置参数。
  - useCheckSchema 中的 validateSchema 在 JSON.parse 失败时不会将错误状态传给用户，只是 logger.error；若需要更严格行为，可以在未来考虑将解析失败视为 INVALID（目前代码未如此处理，AI 助手修改时需谨慎，避免破坏现有行为）。
- 布尔字段的下拉选择模式
  - 所有布尔型 workflow 参数在表单中以三态下拉值（true/false/undefined）呈现，以避免与 JS 中的 falsy/undefined 混淆；
  - 任何新增布尔字段渲染逻辑必须复用 optionsForBoolSelect 与转换函数，避免写死 'true'/'false' 字符串。
- Provider 生命周期
  - TestsetManageProvider 只在首次挂载时创建 store 并保存到 ref，后续 props 变化不会改变 store 引用；
  - 若需要根据上层传入的 bizCtx/bizComponentSubject 动态切换上下文，应由上层在 key 变化时重新挂载 Provider，而不是期望 props 自动传导。

以上约定均基于当前仓库实现提取，AI 助手在修改现有逻辑或新增功能时，应优先保持这些架构与行为的一致性。
