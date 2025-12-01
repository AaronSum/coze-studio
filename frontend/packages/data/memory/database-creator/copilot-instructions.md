# @coze-data/database-creator 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/memory/database-creator）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本包是 Coze Studio 前端 monorepo 中的数据记忆子模块，主要负责「数据库 / 表结构创建与编辑」的交互逻辑与 UI。
- 对外仅暴露少量高层组件与类型：见 src/index.tsx 中的导出：
  - DatabaseModal：数据库表创建 / 编辑弹窗的主入口组件。
  - ProcessingTag：与从 Excel 创建数据库流程相关的进度提示标签组件（对应已废弃的 database-create-from-excel 目录，仅在兼容场景中使用）。
- Domain 模型来源于外部：
  - 表结构类型、数据库信息等来自 @coze-studio/bot-detail-store（如 DatabaseInfo、TableMemoryItem）。
  - 读写模式、字段类型等枚举来自 @coze-arch/bot-api/memory（如 BotTableRWMode、FieldItemType、SceneType 等）。
- 服务边界：
  - 负责 UI 与交互、表结构本地校验、用户行为埋点和错误上报；
  - 不负责底层 HTTP 请求实现，只调用 @coze-arch/bot-api 暴露的 MemoryApi；
  - 不负责全局状态管理，仅通过 props 与外部 store 协同（如 DatabaseInfo 来自上层）。

### 1.1 组件分层

- src/index.tsx
  - 聚合导出包内对外 API，其他文件仅作为内部实现细节。
- src/components/database-modal/
  - DatabaseModal 负责：弹窗容器、入口选择（自定义 / Excel / 模板）、AI 生成表结构入口、预览区、保存按钮区等。
  - 通过 ref 与子组件 DatabaseTableStructure 协作，触发表单校验与保存逻辑。
- src/components/database-table-structure/
  - 负责表基本信息（名称、描述、读写模式、prompt_disabled）和字段列表的编辑表格。
  - 内部再拆为 helpers（如 validate）和子组件（受 UITable 渲染表头等）。
- src/const.tsx
  - 存放与表结构相关的常量：字段类型选项、模板示例表、读写模式文案和映射、内置系统字段（uuid / id）、数据库内容审核错误码等。
- src/hooks/use-create-from-excel-fg.ts
  - 单独管理「从 Excel 创建数据库」的功能开关（feature flag）。目前实现恒为 false，意味着 Excel 入口默认关闭。
- 样式与资源
  - 所有样式使用 less 模块（如 index.module.less），图片使用本地静态资源（assets/）。

## 2. 关键数据流与交互流程

### 2.1 表创建 / 编辑主流程（DatabaseModal + DatabaseTableStructure）

- 输入 props（见 DatabaseModalProps）：
  - database: DatabaseInfo 初始表结构（当存在 tableId 时视为编辑模式）。
  - botId, spaceId: 用于埋点、API 请求参数。
  - readonly: 控制是否只读（禁止编辑和保存）。
  - NL2DBInfo: 用于自然语言生成表结构的预置信息（含 prompt 和场景类型），为 null 时走普通流程。
  - expertModeConfig: 控制专家模式下可用的读写模式、最大列数等。
  - onSave?: OnSave：保存完成后的回调，由上层处理后续状态更新 / 刷新。
- 状态管理：
  - DatabaseModal 内部维护 data: DatabaseInfo，用于传递给 DatabaseTableStructure 作为受控初值。
  - isEntry / createType 决定当前展示的是「入口页」还是「结构编辑区 / Excel 流程」。
  - generateTableLoading / AIPopoverVisible 等用于 AI 生成交互体验。
- 保存逻辑：
  - DatabaseModal 调用 tableStructureRef.current.submit()，真实的校验与保存逻辑在 DatabaseTableStructure 中。
  - DatabaseTableStructure.validate / submit：
    - 先通过 validateFields 和 validateNaming 做表名与字段级校验；
    - 再通过 Semi Form 的 formApi 校验 name 字段；
    - 确保字段列表非空且无错误后，构造 InsertBotTableRequest/AlterBotTableRequest，并通过 MemoryApi.InsertBotTable / MemoryApi.AlterBotTable 调用后端；
    - 捕获内容审核类错误码（DATABASE_CONTENT_CHECK_ERROR_CODE 等），转换为可展示的错误文案。

### 2.2 AI 生成表结构（NL2DB / RecommendDataModel）

- DatabaseModal.generateTableByNL：
  - 使用 MemoryApi.RecommendDataModel({ bot_id, scene_type, text }) 调用后端生成推荐表结构。
  - 根据 SceneType 选择 createType（recommend / naturalLanguage），并将返回的 field_list 映射为前端的 tableMemoryList（为每个字段生成新的 nanoid，保留 id 字段）。
  - 同步更新 DatabaseTableStructure 内部的字段列表（通过 ref.setTableFieldsList），确保 UI 与 data 状态一致。
  - 失败时：
    - 场景为 BotPersona：提示 recommended_failed，并重置为默认空表结构。
    - 场景为 ModelDesc：提示 generate_failed 并打开 AI popover 引导用户重试。
  - 所有异常上报 dataReporter.errorEvent(DataNamespace.DATABASE, REPORT_EVENTS.DatabaseNL2DB)。

### 2.3 读写模式与系统字段注入

- 读写模式相关配置：
  - RW_MODE_OPTIONS_CONFIG 提供各读写模式的标题和解释文案；
  - RW_MODE_OPTIONS_MAP 将 ReadAndWriteModeOptions（excel/normal/expert）映射到实际可选的 BotTableRWMode 数组。
- DatabaseTableStructure.onValueChange：
  - 当 readAndWriteMode 切换为 UnlimitedReadWrite 时，会自动在字段列表前添加系统字段 SYSTEM_FIELDS（uuid / id）；
  - 当切回 LimitedReadWrite 时，会自动移除系统字段；
  - isSystemField 字段用于 UI 层禁用删除 / 禁用部分编辑行为。

### 2.4 删除字段与危险操作确认

- DatabaseModal 中维护 isDeletedField：
  - onDeleteField 回调会比较新字段列表与原始 database.tableMemoryList 的 nanoid 集合，若有缺失则判定为删除字段操作；
  - 若存在删除字段，保存按钮会包裹在 Popconfirm 中，要求用户二次确认；
  - 否则直接调用 handleSave。

## 3. 构建、测试与调试流程

### 3.1 包级命令

- 在 frontend 根目录通过 rush 驱动执行更常见；但此子包 package.json 提供的脚本为：
  - build: `exit 0`
    - 当前构建入口由上层统一管理，本包本地 build 脚本仅占位，不做实际编译。
  - lint: `eslint ./ --cache`
    - 使用 @coze-arch/eslint-config，preset: web，定制了一些项目特有规则（见 eslint.config.js）。
  - test: `vitest --run --passWithNoTests`
    - 使用集中配置的 @coze-arch/vitest-config，通过 tsconfig.misc.json 将 __tests__ 与 stories 纳入测试工程。
  - test:cov: `npm run test -- --coverage`
- 常用调试方式：
  - 运行 vitest 测试：在 frontend 目录使用 rushx 或 pnpm 调用此包测试命令（按 monorepo 统一规范）。
  - 组件联调通常在上层页面中以 DatabaseModal 为入口进行 UI 调试，本包不单独提供 Storybook 运行脚本，stories/ 目录主要服务于单元 / 视觉测试。

### 3.2 TypeScript 配置与工程引用

- tsconfig.build.json：
  - 继承 @coze-arch/ts-config/tsconfig.web.json；
  - rootDir=src，outDir=dist；
  - references 指向多个 arch 级与 config 级子包，形成 TS Project References，保障类型联编译和跨包跳转。
- tsconfig.json：
  - 标记为 composite 工程，并仅包含 tsconfig.build.json / tsconfig.misc.json 两个子工程；
  - exclude: ["**/*"]，保证顶层不直接被编译，所有编译由子 tsconfig 控制。
- tsconfig.misc.json：
  - 包含 __tests__、stories、vitest.config.ts，用于测试与辅助文件的类型检查；
  - compilerOptions.types 中包含 vitest/globals。

## 4. 项目特有约定与模式

### 4.1 表结构编辑的校验约定

- 所有字段级校验通过 validateFields 和 validateNaming 实现（位于 src/components/database-table-structure/helpers/validate.ts）：
  - 触发点分为 change / blur / save 三类 TriggerType；
  - UI 中的错误提示通过记录在每个字段的 errorMapper 上，并在 SLInput/SLSelect 中展示。
- 表名校验：
  - getTableNameErrorMessage 会对空值和命名规范错误进行本地校验，在 FormInput 中以浮层形式展示，避免 Semi 默认的表单错误气泡。
- 空字段列表：
  - isEmptyList 定义了「有效字段」概念：过滤掉 isSystemField，再过滤掉没有任何 name/desc/type 的记录；
  - 若最终为空，视为非法表结构，禁止保存并给出提示文案（db_table_save_exception_nofield）。

### 4.2 埋点与错误上报模式

- 埋点事件：
  - sendTeaEvent(EVENT_NAMES.*) 用于记录用户关键行为，如 create_table_click, edit_table_click, generate_with_ai_click, nl2table_create_table_click 等；
  - 上报参数中固定包含 need_login、have_access、bot_id 等字段，有的还包含 table_name、database_create_type。
- 错误上报：
  - dataReporter.errorEvent(DataNamespace.DATABASE, { eventName, error }) 用于统一上报 API 调用异常和内容审核失败；
  - DatabaseModal 与 DatabaseTableStructure 都在对应的 catch 分支中进行上报。

### 4.3 Feature Flag 与废弃代码约定

- useCreateFromExcelFG：
  - 当前硬编码返回 false，并在注释中说明功能 flag 关闭原因；
  - 与之相关的 UI（DatabaseCreateFromExcel）仍保留，以便未来可能重新启用；
  - 单测目录下 readme 明确说明“本轮单测不包括 database-create-from-excel，因为该文件夹下内容为废弃内容”。
- 编写新逻辑时：
  - 若涉及实验性功能，请优先参考 useCreateFromExcelFG，采用独立 hook 暴露 boolean 的方式；
  - 避免在组件内部直接写死 flag，以便后续统一接入远程配置 / A/B 实验平台。

### 4.4 表格 UI 模式

- 使用 @coze-arch/bot-semi 提供的 UITable / UITableAction 组件，不直接使用原始 antd/semi 组件；
- 字段编辑行的最后一行保留“新增字段”按钮行：
  - 通过在 dataSource 末尾追加 { operate: 'add' } 实现；
  - 行渲染中根据 record.operate === 'add' 判断显示 Button 还是实际表单控件。
- 当字段数达到上限 maxColumnNum 时：
  - 替换新增按钮为 disabled 状态，并通过 Tooltip 提示最大列数限制；
  - 额外显示 Banner 提示（db_table_0126_027）。

## 5. 与外部子包与后端的集成

- @coze-arch/bot-api & MemoryApi：
  - RecommendDataModel：根据场景（SceneType.BotPersona / ModelDesc）和文本生成推荐表结构；
  - InsertBotTable：创建新 bot table；
  - AlterBotTable：修改现有 bot table；
  - isApiError：用于判定后端返回是否为标准 API 错误对象，并提供 code/msg 字段。
- @coze-arch/i18n：
  - 通过 I18n.t(key) 获取多语言文案，本包内所有 UI 文案均走 i18n；
  - getUnReactiveLanguage() 用于根据当前语言环境切换不同的示意图片（如中/英文模板截图）。
- @coze-data/reporter & @coze-data/e2e：
  - dataReporter 负责数据上报，DataNamespace.DATABASE 标识当前模块；
  - BotE2e 中定义了测试自动化使用的 data-testid 常量，本包将其大量用于按钮、输入框等测试标记。
- @coze-arch/bot-semi & @coze-arch/bot-icons：
  - 提供 UI 组件库和图标库，本包代码风格上优先使用这些封装组件而非第三方库原始组件。
- ahooks / lodash-es / nanoid：
  - useLocalStorageState / useBoolean 管理用户偏好与只读状态；
  - lodash-es 中使用 noop 等实用函数；
  - nanoid 用于为字段生成前端唯一 key（避免依赖后端 id 规则）。

## 6. 项目流程与协作规范

- Git / 分支策略
  - 由 monorepo 统一约束，在本包内未定义独立规则；遵循仓库根目录的 CONTRIBUTING.md 和相关文档。
- 代码风格：
  - 使用 @coze-arch/eslint-config preset web，整体风格接近现代 React + TypeScript；
  - 在本包中关闭了 max-lines、max-lines-per-function 等限制，允许单文件存在较复杂组件（如 DatabaseModal / DatabaseTableStructure）。
- 测试策略：
  - 重点覆盖核心交互（入口切换、AI 生成、字段校验与保存逻辑等）；
  - 废弃模块（database-create-from-excel）当前不在测试范围。
- 覆盖率要求：
  - 根据 frontend/rushx-config.json，本包标签为 team-data + level-3，对应的最低覆盖率要求为 0%，增量覆盖要求为 0%；
  - 实际开发仍鼓励为新增逻辑补充必要的单测，特别是复杂校验与保存流程。

## 7. 对 AI 编程助手的具体建议

- 修改 / 新增功能时：
  - 优先查阅 src/index.tsx 确认对外暴露 API，避免随意增加导出；
  - 任何对表结构编辑核心逻辑的修改应同步调整 validateFields/validateNaming、DatabaseTableStructure、DatabaseModal 三处的一致性；
  - 涉及后端交互时，仅使用 MemoryApi 提供的方法，不在本包新增独立 HTTP 客户端。
- 新增交互入口时：
  - 参考 DatabaseModal 中 Entry / AI 生成 popover 的写法，复用现有埋点和 i18n 模式；
  - 为关键按钮和输入控件添加 BotE2e data-testid，保持测试自动化能力。
- 若不确定某行为是否为废弃路径：
  - 先查看 __tests__/readme.md 与相关注释（例如 useCreateFromExcelFG 和 database-create-from-excel），遵循现有“功能关闭但代码保留”的约定，不轻易物理删除。