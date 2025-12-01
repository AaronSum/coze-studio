# @coze-data/knowledge-modal-base 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-modal-base）中安全、高效地协作开发。

## 1. 全局架构与职责边界
- 本子包是「知识库相关弹窗与配置 UI」的基础组件库，面向其他前端应用通过 npm 包形式使用，入口为 src/index.tsx 与 src/create-knowledge-modal-v2/index.ts。
- 主要提供两类能力：
  - 一组基于 hook 的业务弹窗（*modal hooks*），如 useKnowledgeListModal、useEditKnowledgeModal、useSliceDeleteModal 等，用于管理数据集、文档切片、频率配置等。
  - 新一代「创建知识库」流程组件 create-knowledge-modal-v2，对知识来源选择、格式选择、表格/文本/图片导入进行高度拆分和复用。
- UI 基于 @coze-arch/bot-semi 与 @douyinfe/semi-ui，业务数据类型依赖 @coze-arch/bot-api/knowledge 与 @coze-data/knowledge-resource-processor-core，过滤与配置依赖 @coze-data/utils。
- 数据流遵循「父组件持有数据、子组件通过回调变更」的模式：
  - 例如 useKnowledgeListModal 由调用方传入 datasetList 与 onDatasetListChange，内部仅在点击添加/移除时调用回调，不自行请求后端。
  - 统计与日志上报通过 @coze-arch/bot-tea 的 EVENT_NAMES 与 sendTeaEvent 实现，UI 交互与埋点解耦。
- 样式采用 less CSS Modules（如 src/knowledge-list-modal/index.module.less），并辅以 classNames + 统一类名常量 DATA_REFACTOR_CLASS_NAME 进行灰度/样式切换。
- TS 配置分层：
  - tsconfig.build.json：实际打包编译配置，rootDir=src、outDir=dist，并通过 references 依赖 arch/common/studio 等基础包，保证类型一致性。
  - tsconfig.misc.json：测试、stories、配置文件的类型环境（包含 vitest/globals）。
  - 顶层 tsconfig.json 仅做 composite + references 聚合。

## 2. 关键模块与数据流
- 入口导出（src/index.tsx）：
  - 汇总所有对外能力：
    - 弹窗 hooks：useKnowledgeListModal、useDeleteUnitModal、useTableSegmentModal、useFetchSliceModal、useBatchFrequencyModal、useBatchFetchModal、useTextResegmentModal、useEditUnitNameModal、useSetAppendFrequencyModal 等。
    - 业务常量：KNOWLEDGE_UNIT_NAME_MAX_LEN、KNOWLEDGE_MAX_DOC_SIZE、KNOWLEDGE_MAX_SLICE_COUNT、DATA_REFACTOR_CLASS_NAME。
    - RAG 配置组件：RagModeConfiguration 及 IDataSetInfo 类型。
    - 工具函数：transSliceContentOutput/transSliceContentInput/imageOnLoad/imageOnError 等从 src/utils 导出。
  - 设计上将 UI、常量、工具方法整合为一个「知识弹窗基础能力」集合，便于调用方按需 tree-shaking 导入。
- 知识列表弹窗（src/knowledge-list-modal）：
  - index.tsx：
    - useKnowledgeListModal 负责构建 UICompositionModal（来自 @coze-arch/bot-semi），组合侧边栏（UICompositionModalSider）与主内容（UICompositionModalMain）。
    - 通过 useKnowledgeListModalContent 获取 renderContent / renderSearch / renderCreateBtn / renderFilters 四类渲染函数，实现「逻辑在 hook 中、UI 在调用方」的模式。
    - 侧边栏 SiderCategory 提供「库资源」与「项目资源」两类视图切换，内部使用 projectID 与 category 状态控制数据范围。
  - use-content.tsx：
    - useKnowledgeListModalContent 内部依赖 useKnowledgeFilter（自定义 hook，包含过滤条件、搜索、创建按钮等逻辑），scene 固定为 Scene.MODAL。
    - children 渲染函数中使用 KnowledgeCardListVertical 展示数据集列表，并在 onAdd/onRemove 时调用 onDatasetListChange 与 sendTeaEvent 做埋点。
    - 不直接使用 toast，而是预留注释中的 I18n + Toast 模板，保持逻辑纯粹。
- RAG 模式配置（src/rag-mode-configuration）：
  - 通过 RagModeConfiguration 组件和 IDataSetInfo 类型导出，主要用于配置数据集在不同 rag 策略中的行为（细节可在该目录下进一步查阅）。
  - 通常与知识列表/数据集选择组件组合使用，需要保证传入的数据结构符合 @coze-arch/bot-api/knowledge 定义。
- 知识切片与工具方法（src/utils）：
  - common.ts：文件大小/单位转换、Base64 处理等基础工具（getEllipsisCount、formatBytes、getBase64、getFileExtension、getUint8Array）。
  - slice.ts：与知识切片内容结构与大小校验相关的工具（transSliceContentOutput/transSliceContentInput/transSliceContentInputWithSave/isValidSize/imageOnLoad/imageOnError）。
  - index.ts：统一 re-export，供包外直接从 '@coze-data/knowledge-modal-base' 导入。
- 创建知识库 v2（src/create-knowledge-modal-v2）：
  - index.ts 暴露：
    - CozeKnowledgeAddTypeContent + 表单数据类型 CozeKnowledgeAddTypeContentFormData。
    - TableCustom/TableLocal/TextCustom/TextLocal/ImageLocal 这类与来源/格式相关的导入组件。
    - SourceRadio/SourceSelect 等来源选择 UI 组件。
    - ImportKnowledgeSourceModule 与 ImportKnowledgeSourceSelectModule（含 Props 类型）作为组合模块，对外屏蔽内部实现细节。
    - SelectFormatType 作为格式选择基础组件。
  - features/* 与 components/* 中的模块以「模块化功能 + 轻薄 UI 壳」为设计目标，每个 feature 专注于一个导入/选择环节。

## 3. 开发与构建流程
- 包级基础命令（见 package.json 与 README.md）：
  - 安装依赖：在仓库根目录使用 Rush，执行 rush update。
  - 开发（一般在上层应用中使用，本包自身主要作为组件库）：README 中提到 npm run dev，但在本包的 package.json 中未定义 dev 脚本，实际 UI 预览建议通过 Storybook（stories 目录）或在上层应用集成后调试。
  - 构建：本包的 build 脚本暂时为 'exit 0'，表示当前仓库层面构建由更高层的 Rush/整体构建流程接管，本子包自身不单独产物构建。
- Lint：
  - 执行：npm run lint。
  - 配置：eslint.config.js 使用 @coze-arch/eslint-config.defineConfig({ preset: 'web' })，并以 packageRoot 定位到当前包；规则集中由统一配置仓库维护，子包不应随意覆盖。
- 单测：
  - 执行：npm test 或 npm run test:cov（带覆盖率）。
  - 配置：vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig({ dirname: __dirname, preset: 'web' })，统一了浏览器环境、别名、快照等；
  - tsconfig.misc.json 中 types: ['vitest/globals']，意味着测试代码中可以直接使用 describe/it/expect 等全局 API。
- Storybook：
  - stories/demo.stories.tsx 与 stories/hello.mdx 提供基础示例，用于在设计/交互层验证组件，不建议在此写复杂业务逻辑，仅用于展示组件用法。

## 4. 项目内约定与编码风格
- 语言与类型：
  - 全量使用 TypeScript + React 18（函数式组件与 hook）；
  - 严格开启 strictNullChecks 与 noImplicitAny，新增代码必须补全类型，优先使用显式类型别名/interface。
- 目录与命名：
  - 特征模块按功能维度划分目录：如 knowledge-list-modal、rag-mode-configuration、create-knowledge-modal-v2/features/import-knowledge-source 等；
  - hook 使用 useXxxModal/useXxxFilter 命名，组件使用 PascalCase；
  - 所有与知识库数据相关的常量统一存放在 src/constant.ts，并从入口 index.tsx 统一导出，避免魔法数字散落各处。
- 样式：
  - 使用 less + CSS Modules（*.module.less），引用变量统一从模块导入（例如 styles/s），不直接写全局类名；
  - 跨模块功能标记统一使用 DATA_REFACTOR_CLASS_NAME（值为 'data-refactor'），以便上层 CSS 或 A/B 实验选择性覆盖。
- 依赖使用：
  - 国际化统一通过 @coze-arch/i18n.I18n.t 调用；
  - 埋点统一通过 @coze-arch/bot-tea，事件名从 EVENT_NAMES 常量集中获取；
  - 与后端/资源 API 交互只在上层应用中进行，本子包仅通过类型（如 Dataset、UnitType）与回调函数对接数据，不发起实际 HTTP 请求。
- 别名与路径：
  - 通过 tsconfig.build.json/tsconfig.misc.json 中 paths 配置 '@/*' 指向 ./src/*，在业务代码中统一使用 '@/xxx' 代替相对路径嵌套。

## 5. 集成与外部依赖细节
- 与 @coze-arch/bot-api：
  - 通过 @coze-arch/bot-api/knowledge 中的 Dataset 等类型描述知识库/数据集信息；
  - 所有对 datasetList 的修改（添加/删除）都通过回调 onDatasetListChange 通知上层，由上层负责真正持久化。
- 与 @coze-data/knowledge-resource-processor-core：
  - UnitType 等类型定义知识单元/文档的粒度类型；
  - 在 onClickAddKnowledge 等回调中，上层必须传入与 UnitType 匹配的行为逻辑（如跳转上传页、弹出新建文档等）。
- 与 @coze-studio/bot-detail-store：
  - useKnowledgeListModalContent 使用 useBotInfoStore 读取当前 botId，用于埋点；
  - 调用该组件的页面应提前初始化好 bot-detail-store，否则埋点中的 bot_id 可能为空。
- 与 @coze-arch/bot-semi：
  - UICompositionModal / UICompositionModalSider / UICompositionModalMain 用于搭建两栏布局的弹窗；
  - 在修改布局或新增 slot 时，应沿用该组合组件体系，避免引入完全不同的 modal 实现。
- 与 @coze-data/utils：
  - FilterKnowledgeType 在知识过滤/筛选中作为枚举使用；
  - 使用该类型时应避免自行扩展字符串字面量，而是从依赖包中引入统一的定义。

## 6. 流程与协作规范
- 版本与发布：
  - package.json 中 version 为 0.0.1，依赖大量 workspace:* 包，实际版本管理由仓库根部的 Rush 与变更日志流程控制；
  - 修改对外导出（src/index.tsx 或 create-knowledge-modal-v2/index.ts）时，应同时检查相关上层包的引用，避免破坏 API 兼容性。
- 分支与提交：
  - 具体分支策略由仓库根部规范（如 README/CONTRIBUTING）约束，本子包应遵循统一的 feat/fix/chore 命名与变更集划分；
  - 与知识库交互逻辑通常牵涉多个包（stores、utils、processor-core），在提交前建议至少执行 lint 与 test，确保 TS 引用链无误。
- UI/交互变更：
  - 对外导出的 hook/组件是跨多个产品线复用的基础能力，调整 props、回调语义或视觉结构时，应优先保持向后兼容（新增参数/分支而不是修改现有含义）。
  - 若必须产生破坏性变更，应在变更说明中明确标注，并同步检查所有 workspace:* 依赖包的编译情况。

## 7. 对 AI 编程助手的特别提示
- 修改或新增 modal 相关 hook 时：
  - 遵守「返回 { node, open, close }」的约定（如 useKnowledgeListModal），不要随意改变返回结构，避免调用方集成失败。
  - 所有涉及 Dataset 或 UnitType 的回调参数必须使用准确的类型定义，不要用 any 或宽泛的 Record 类型代替。
- 编写新工具函数时：
  - 优先放入 src/utils/common.ts 或 src/utils/slice.ts，并在 index.ts 中统一导出；
  - 注意与现有函数命名、参数风格保持一致（例如 transXxxInput/transXxxOutput）。
- 引入新外部依赖前：
  - 检查是否已有等价功能存在于 @coze-data/utils、@coze-arch/bot-semi、@coze-arch/coze-design 等内部包中，优先复用内部实现。
- 在 stories 或 __tests__ 中编写示例/测试时：
  - 通过包入口导入组件/hook（从 '@coze-data/knowledge-modal-base' 或其子 path），避免直接引用深层相对路径，以便在重构内部目录时保持稳定。