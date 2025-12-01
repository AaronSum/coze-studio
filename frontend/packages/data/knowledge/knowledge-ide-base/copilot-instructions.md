# Knowledge IDE Base 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-ide-base）中安全、高效地协作开发。

## 全局架构与职责
- 本子包提供「知识库 IDE」的通用基础层，聚焦于数据集 / 文档的读取、进度轮询、视图模式与操作选项等通用能力，不直接关心上层业务页面布局。
- 入口导出位于 src/index.tsx，主要对外暴露：
  - ActionType（操作类型枚举，定义在 src/types）
  - useGetKnowledgeType、useReloadKnowledgeIDE 等 use-case 级别 hooks（位于 src/hooks/use-case）。
- 组件层位于 src/components，提供知识 IDE 相关的 UI 组件，如：
  - knowledge-nav-bar、knowledge-source-menu、knowledge-config-menu、related-bots-list 等导航/菜单/侧边栏类组件；
  - auto-generate-photo-detail-button、photo-filter、preview-navigation 等文档/图片预览与筛选组件；
  - tag 及 Icon-with-suffix 等基础展示组件。
- feature 层位于 src/features，封装可复用的业务功能块，例如：
  - text-knowledge-workspace：文本知识工作区主界面（文档列表、标签、操作区等），内部再划分 utils、styles 等子目录；
  - import-knowledge-source-button、import-knowledge-source-radio-group：知识导入来源选择与操作；
  - knowledge-ide-table-config-menus：表格配置菜单注册与渲染；
  - 其他按功能拆分的 features 均以小型「业务模块」形式存在。
- service 层位于 src/service，统一封装与 KnowledgeApi 的交互：
  - dataset.ts：数据集列表、详情、处理进度轮询等；
  - document.ts：文档列表、处理进度轮询、文档更新；
  - slice.ts：文档切片滚动列表与切片增删改（数据分片相关能力）。
- constant 层位于 src/constant，集中维护：
  - 视图模式、文档更新类型标签、禁用的单元类型 / 格式类型、轮询间隔（POLLING_TIME）等；
  - 与 I18n 文案 key 绑定的展示选项（如 VIEW_MODE_OPTIONS、DOCUMENT_UPDATE_TYPE_MAP）。
- layout 层位于 src/layout，当前主要通过 module 定义 KnowledgeIDEBaseLayoutProps 等类型/接口，外部包可在自身 UI 布局中组合使用本子包能力。

## 关键数据流与服务边界
- 所有与后端的接口交互统一通过 @coze-arch/bot-api 暴露的 KnowledgeApi 完成，本子包不直接拼接 URL 或处理底层 HTTP 细节。
- useRequest（来自 ahooks）是主力数据驱动手段：
  - service 层 hooks（如 useListDataSetReq、useListDocumentReq、usePollingDatasetProcess、usePollingTaskProgress、useUpdateDocument）均基于 useRequest 封装，统一支持 loading、手动触发、错误处理和轮询等能力；
  - 轮询场景（数据集处理进度、文档处理进度）通过 pollingInterval + window.setInterval + 自定义 clearPolling/isStopPolling 实现。
- 空间/租户信息统一从 @coze-arch/bot-studio-store 获取（useSpaceStore），避免外层组件自行传入 spaceId：
  - 如果需要在新 service 中访问空间信息，应优先使用 useSpaceStore 并保证只在 hook 内部读取。
- 状态持久化与缓存：
  - dataset 详情使用 sessionStorage 做前端缓存（cacheKey = dataset-${datasetID}），配合 useRequest 的 setCache / getCache；
  - 正在处理中的数据集状态存入 @coze-data/knowledge-stores 对应的 zustand store（useProcessingStore）。
- 错误与事件上报：
  - 日志捕获：统一使用 @coze-arch/logger 提供的 useErrorHandler；
  - 数据埋点：统一使用 @coze-data/reporter 的 dataReporter.errorEvent，命名空间一般为 DataNamespace.KNOWLEDGE，事件名来自 @coze-arch/report-events 常量（如 KnowledgeGetDataSetDeatil、KnowledgeUpdateDocumentName 等）；
  - 用户提示：统一通过 @coze-arch/coze-design 的 Toast.error 展示「Network_error」等国际化文案。

## 开发与运行工作流
- 本子包自身 package.json 中 scripts：
  - lint：eslint ./ --cache（使用仓库统一的 eslint 配置 @coze-arch/eslint-config）；
  - test：vitest --run --passWithNoTests；
  - test:cov：npm run test -- --coverage；
  - build：当前实现为 exit 0，本子包通常由顶层构建系统统一打包。
- 在 monorepo 顶层：
  - 推荐通过 Rush / workspace 脚本对该包执行构建与测试（例如查找使用 @coze-data/knowledge-ide-base 的脚本或统一的 rushx 测试/构建命令）；
  - Storybook 相关 demo/stories 存放在 stories 目录（如 stories/demo.stories.tsx、stories/hello.mdx），用于演示与开发时联调，但并非生产入口。
- 单测框架：
  - 使用 vitest + @testing-library/react / jest-dom 进行组件与 hooks 测试；
  - 子包预留 __tests__ 目录（当前含 .gitkeep），新增测试时应遵循仓库统一风格与 vitest.config.ts 中定义的别名/环境。

## 重要约定与编码风格
- Hooks 设计约定：
  - 以 useXxxReq 命名的 hook 一般封装具体接口请求（ListDataset、DatasetDetail、ListDocument、GetDocumentProgress 等）；
  - 仅在 hook 内部访问 store（useSpaceStore、useProcessingStore）与 sessionStorage，不在组件中重复拉取相同信息；
  - 需要外部控制的请求统一使用 manual: true，并通过 run 触发。
- 轮询与进度：
  - 文档进度轮询统一通过 usePollingTaskProgress 实现：内部调用 KnowledgeApi.GetDocumentProgress（及可能的 PhotoDetail），将结果汇总到 ProgressMap，再通过 onProgressing 回调向上抛出；
  - 是否继续轮询由 @coze-data/knowledge-resource-processor-base 中的 isStopPolling 判定，停止时必须调用 clearPolling 结束 interval；
  - 数据集进度轮询通过 usePollingDatasetProcess，实现对 processing_file_id_list 的监测，并维护 useProcessingStore 中的 processingDataset 集合。
- 常量与枚举：
  - 与后端 / 资源处理强相关的常量集中在 src/constant：如 MAX_SEGMENT_TOTAL、CREATE_UNIT_DISABLE_UNIT_TYPES、CREATE_UNIT_DISABLE_FORMAT_TYPES、ViewMode、SegmentOptSelect、DOCUMENT_UPDATE_TYPE_MAP 等；
  - 所有展示文案（标签、视图模式名、更新类型说明等）都通过 I18n.t(key) 获取，对应 key 需要在上游 i18n 仓库维护。
- 样式风格：
  - 使用 less + CSS Modules（index.module.less），类名/文件命名与组件一一对应；
  - 通用样式与变量放在 src/assets/common.less 或各 feature 的 styles 目录中。
- TypeScript 与路径别名：
  - tsconfig.build.json / tsconfig.json 中定义了编译目标与路径别名，源码中使用 @coze-arch/*、@coze-data/* 以及 @/constant、@/types 等别名访问；
  - 新增文件时应复用现有别名，不要硬编码相对路径层级过深的 import。

## 与外部子包及后端的集成细节
- 与知识资源处理核心：
  - 通过 @coze-data/knowledge-resource-processor-core 的 UnitType 常量，约束创建单元的可用类型；
  - 与 @coze-data/knowledge-resource-processor-base 的工具方法 clearPolling、isStopPolling、reportFailGetProgress 协作完成进度轮询与失败上报。
- 与知识模态框 / 弹层：
  - 依赖 @coze-data/knowledge-modal-base 暴露的 KNOWLEDGE_MAX_DOC_SIZE 等常量，控制列表请求的 size 上限；
  - 通过 @coze-data/knowledge-modal-adapter与上层 IDE / Studio 的弹层体系连接。
- 与存储与状态管理：
  - 使用 @coze-data/knowledge-stores（基于 zustand）维护跨页面/功能共享的处理状态；
  - 使用 @coze-foundation/local-storage 做更低层级的状态持久化（本子包中如果有引用，遵循统一封装）。
- 与埋点与监控：
  - 所有埋点事件名统一来自 @coze-arch/report-events 中的 REPORT_EVENTS / REPORT_EVENTS as ReportEventNames；
  - dataReporter.errorEvent 的 payload 中包含 eventName 与 error，调用方不直接处理上报结果。

## 项目流程与协作规范
- 代码版权与 License：
  - 所有 ts/tsx 源文件头均附带 Apache-2.0 版权信息，新增文件时需保持一致格式。
- Git / 分支策略：
  - 具体分支/发布流程在仓库根目录文档（如 README、CONTRIBUTING）中约定；在本子包中开发时遵循仓库统一规范（feature 分支、PR 审查等）。
- 国际化：
  - 所有面向用户的文本都应使用 I18n.t(key)；
  - 新增文案时只在组件中引用 key，不在本子包内维护多语言资源文件。

## 开发本子包时的注意事项
- 避免直接操作 window.setInterval / clearInterval，而应尽量复用已有的 clearPolling / isStopPolling 及统一封装的轮询逻辑，保持行为一致性。
- 新增 service hook 时：
  - 必须处理 datasetID / document_id 等关键参数的非空校验，统一抛出 CustomError，错误 code 需有前缀（如 useDataSetDetailReq_error）；
  - 在 onError 中统一展示 Toast.error + I18n.t('Network_error')，并调用 capture(error) 与 dataReporter 上报；
  - 明确是否需要缓存（cacheKey、sessionStorage）以及是否参与全局 processing store。
- 新增 feature / 组件应：
  - 放在对应的 src/features 或 src/components 子目录下，index.tsx 作为公开入口，样式文件命名为 index.module.less；
  - 如果对外暴露给其他包使用，需要在 package.json.exports 中补充路径映射，并在 src/components/index.ts 或 src/features 对应 index 中统一 re-export。
- 任何涉及知识处理进度、文档/数据集状态变更的改动，都需要审慎评估对轮询逻辑、埋点与 store 状态的影响，尽量通过现有 hooks 扩展而非重复实现。
