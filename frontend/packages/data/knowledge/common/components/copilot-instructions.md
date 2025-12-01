# @coze-data/knowledge-common-components — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/common/components）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包为「知识库（Knowledge）」域提供可复用的前端组件，主要聚焦三类能力：
  - 文本类知识编辑器：基于 Tiptap 封装的富文本 / 结构化文本编辑体验，用于创建和编辑知识文档。
  - 文档预览：统一的 Markdown / TXT / PDF 预览组件，供知识浏览或导入流程复用。
  - 知识文件选择（file-picker）：用于从知识库或外部源选择文件/文档的业务组件。
- 包入口及导出：
  - package.json 中 exports：
    - "." → src/index.tsx：聚合导出预览与文本知识编辑相关主入口组件与 hooks。
    - "./file-picker" → src/file-picker/index.tsx：知识文件选择入口组件及配套类型。
    - "./text-knowledge-editor"、"./text-knowledge-editor/*" → 文本知识编辑器的入口与子模块（场景级/特性级组件）。
  - src/index.tsx 当前导出：
    - PreviewMd / PreviewTxt / usePreviewPdf：文档预览相关能力。
    - SegmentMenu：段落/分段菜单组件。
    - DocumentEditor / DocumentPreview：文本知识编辑器的核心编辑与预览组件。
    - LevelTextKnowledgeEditor / BaseTextKnowledgeEditor：不同封装层级的文本知识编辑器场景组件。
- 上游依赖：
  - @coze-data/knowledge-stores：知识域的状态与数据访问 store。
  - @coze-arch/bot-api、@coze-arch/bot-error：与知识相关的后端接口与错误模型。
  - @coze-arch/i18n、@coze-arch/report-events、@coze-data/reporter：文案与埋点体系。
  - @coze-arch/bot-md-box-adapter、react-pdf 等：富文本/Markdown/PDF 渲染适配层。

## 代码结构与模块职责
- 目录总览（src 下）：
  - doc-preview/：文档预览相关组件与 hooks。
    - preview-md.tsx：Markdown 文档预览组件，通常基于 @coze-arch/bot-md-box-adapter 以及安全的 HTML 渲染（dompurify）实现。
    - preview-txt.tsx：纯文本（TXT）预览组件，关注换行与简单样式展示。
    - use-preview-pdf/：PDF 预览 hook/组件封装，基于 react-pdf + use-resize-observer 之类能力。
  - segment-menu/：段落/片段菜单组件（SegmentMenu），用于在文档编辑或阅读时提供片段级操作（如插入、拆分、跳转）。
  - text-knowledge-editor/：文本知识编辑子系统，是本包代码量最大、结构最复杂的部分：
    - components/：UI 颗粒组件（工具栏、侧边栏、meta 区、弹窗等）。
    - features/：特性级模块，如 editor（编辑器主体）、preview（预览区）、搜索/替换等。
    - scenes/：场景级封装（BaseTextKnowledgeEditor、LevelTextKnowledgeEditor），面向具体业务场景组合 features 与 services。
    - hooks/：围绕 Tiptap 编辑器实例、知识文档状态、快捷键、埋点的自定义 hooks。
    - services/：与知识域 store / API 的交互服务（文档加载、保存、分段管理等）。
    - types/：文本知识编辑相关类型定义（文档结构、段落元信息、编辑上下文等）。
    - utils/：DOM/内容转换、分段/索引计算、剪贴板等工具函数。
  - file-picker/：知识文件选择组件子系统：
    - components/：列表、筛选、分页、空态提示等 UI 组件。
    - hooks/：数据加载、选中状态、滚动加载（结合 @coze-common/virtual-list）等。
    - services/：基于 @coze-data/knowledge-stores / @coze-arch/bot-api 的文件列表获取、搜索等服务封装。
    - types.ts / utils.ts / consts.ts：文件源类型、筛选条件常量、工具函数等。
  - assets/：本包私有静态资源（图标、SVG 等）。
  - typings.d.ts / global.d.ts：编辑器或第三方库的类型补充声明。

## 开发与测试工作流
- 包管理与构建：
  - 依赖通过 Rush + PNPM 工作区统一管理，开发前在仓库根目录执行：rush update。
  - 本包 package.json:
    - build: "exit 0" —— 不在本包内做实际打包，ts 编译与产物由上层统一构建流程处理；本包主要作为源码与类型提供方。
  - TypeScript：
    - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，使用 JSX: react-jsx、lib: [DOM, ESNext]、moduleResolution: bundler。
    - rootDir: src，outDir: dist，开启增量构建（tsBuildInfoFile: dist/tsconfig.build.tsbuildinfo）。
    - references 中显式声明对 arch/*、components/*、data/* 等内部包的依赖，应在新增跨包依赖时同步维护。
- 测试：
  - test: vitest --run --passWithNoTests。
  - test:cov: 在单测基础上增加覆盖率统计。
  - vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig，preset: 'web'，与其他前端子包保持一致。
  - __tests__ 目录若存在，将按照 Vitest 约定（*.test.ts(x)/ *.spec.ts(x)）执行；目前测试覆盖有限，修改关键逻辑（如文本保存、内容转换）时建议补充用例。
- Lint 与样式：
  - lint: eslint ./ --cache，规则来自 @coze-arch/eslint-config 的 web 预设。
  - 样式 lint 由 workspace 顶层的 stylelint 配置（@coze-arch/stylelint-config）统一管理，本包不单独暴露脚本。

## 项目约定与编码模式
- 技术栈：
  - React 18 函数组件 + TypeScript。
  - 富文本编辑：统一使用 Tiptap 2（@tiptap/core/react/starter-kit/pm 等），结合自定义 extension 与组件实现业务行为。
  - PDF 预览：依赖 react-pdf，需注意该库对 Web Worker / 浏览器环境的要求。
  - 列表滚动：使用 @coze-common/virtual-list 和 react-arborist 等库提升大列表性能（如树状目录、左侧导航）。
- 组件与场景划分：
  - features 层：只关心「一块功能」内部的编辑与展示（例如 editor/preview），不直接持久化业务状态；
  - scenes 层：按业务场景（如 Base/Level）组合 features + services + hooks，负责接入知识域 store、权限、埋点等；
  - 对外导出的通常是 scene 或高阶 feature 组件（如 DocumentEditor/Preview、LevelTextKnowledgeEditor 等）。
- 状态管理与数据源：
  - 知识文档、文件列表等业务数据通过 @coze-data/knowledge-stores 提供的 store/hook 管理，本包内部组件尽量通过这些 store/hook 访问，而不是自行维护远程状态。
  - 文本编辑器内部状态（Tiptap Editor 实例、selection 等）通过本地 useState/useRef/useEffect + Tiptap API 管理，不暴露给业务层，业务层通过回调（onChange/onSave）获取序列化内容。
- 安全与内容处理：
  - 预览 HTML/Markdown 时，应统一通过 dompurify 等工具进行 XSS 过滤；相关逻辑一般在 doc-preview 与 bot-md-box-adapter 内部，新增预览路径时需复用同样策略。
  - 处理外部文件（PDF/TXT）时，不应在本包中做上传/下载逻辑，只负责展示和触发上层回调。

## 关键组件与集成要点
- 文档预览组件：
  - PreviewMd：输入多为 Markdown 字符串或经 bot-api 转换后的片段；需要支持代码块、图片、链接等常见结构，并通过 bot-md-box-adapter 与 Coze Studio 统一 Markdown 风格。
  - PreviewTxt：面向纯文本知识（如日志/配置），对超长文本应考虑性能，典型策略是限制首屏渲染或允许外层容器滚动。
  - usePreviewPdf：通常提供打开 PDF 预览面板的 hooks/API，内部封装 react-pdf 的加载与错误处理。
- 文本知识编辑器：
  - DocumentEditor：富文本编辑主体：
    - 封装 Tiptap Editor 的初始化（extensions 列表、schema、自定义节点/mark）。
    - 内部处理键盘快捷键、工具栏操作、图片/表格插入等；
    - 对外暴露 onChange/onReady 等事件，以及必要的只读/禁用态支持。
  - DocumentPreview：只读预览组件，可与 DocumentEditor 共用部分渲染逻辑，在场景中用于「编辑区左侧树 + 右侧预览」布局。
  - BaseTextKnowledgeEditor / LevelTextKnowledgeEditor：
    - Base：面向通用文本知识编辑场景，提供最小必要 UI（标题、正文编辑、保存按钮等）。
    - Level：在 Base 基础上叠加分级结构、段落级管理、权限控制等能力，通常用于更复杂的知识结构编辑（如多层级目录）。
- 知识文件选择（file-picker）：
  - 列表渲染一般使用虚拟列表组件，以 support 大量文件；
  - 通过 services 与 @coze-data/knowledge-stores / bot-api 集成，实现分页、搜索、类型筛选；
  - 典型对外 props 包含：onSelect / onConfirm / filters / multiple 等；新增行为时应保持这些基础能力兼容。

## 与其它包的集成关系
- 与 @coze-data/knowledge-stores：
  - stores 中维护知识库的当前空间、数据源配置、文档列表/详情缓存等；
  - 文本编辑器与 file-picker 等需要通过该包读取/更新文档与文件信息，避免在组件内直接发起 HTTP 请求。
- 与 @coze-data/feature-register / @coze-data/reporter：
  - feature-register：将本包能力注册为知识域的一个「特性模块」供上层统一管理；
  - reporter：统一记录知识域相关的用户行为/错误日志，组件内部在关键交互（保存、预览、打开文件）处应复用 reporter，而不是自建埋点体系。
- 与 @coze-arch/bot-api / @coze-arch/bot-error / @coze-arch/report-events：
  - 请求/错误/埋点应使用这些基础包提供的接口和错误模型，避免硬编码接口路径或错误码。
- Tiptap 与编辑器扩展：
  - extensions/ 目录会封装自定义节点/mark（如图片、表格、段落标记），新增编辑能力时建议在 text-knowledge-editor/extensions 下实现并在 editor 初始化时注册。

## 流程、规范与对 AI 助手的注意事项
- 公共 API 维护：
  - 若需新增对外导出组件/函数：
    - 在对应子目录实现组件/逻辑；
    - 在 src/index.tsx 或 file-picker/text-knowledge-editor 的 index.tsx 中导出；
    - 同步更新 package.json 中 exports 与 typesVersions，保持 JS/类型路径一致。
- 修改行为时的建议：
  - 文本编辑相关改动（Tiptap 配置、extensions）：需考虑现有文档兼容性（例如 schema 变更对旧内容的解析影响）；
  - 预览组件改动：要确保不破坏现有安全策略（dompurify/XSS 过滤）与样式规范；
  - file-picker：新增筛选/排序等行为时，注意对虚拟列表与滚动加载的影响，确保不会导致大列表卡顿。
- 测试与验证：
  - 为关键工具函数与复杂交互（例如文本分段、文件多选逻辑、PDF 预览错误处理）添加 Vitest + Testing Library 用例；
  - 在上层应用（如 Studio 中的知识模块）中进行集成验证，确保编辑/预览/选择链路完整。
- 避免的做法：
  - 不在本包增加新的全局状态管理方案（如再次引入 Redux/Zustand），应复用 knowledge-stores 或局部 state；
  - 不在本包内引入与现有技术栈不兼容的大型 UI 框架；
  - 不直接在组件中书写网络请求，应在 services/ 或上游 store 中封装。
