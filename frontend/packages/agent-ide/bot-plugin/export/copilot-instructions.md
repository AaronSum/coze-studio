# @coze-agent-ide/bot-plugin-export 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-plugin/export）中安全、高效地协作开发。

## 总体架构与角色定位
- 本包是 Agent IDE 插件体系中的「插件导出与协作 UI 模块」，以 React 组件库形式存在，通过 package.json 的 `exports` 向其他子包提供能力，而不是独立运行的应用。
- 入口与导出：
  - 统一入口：src/index.tsx（当前仅作占位，可按需扩展导出）
  - 通过 package.json 的 `exports` 暴露多个子模块：
    - ./agentSkillPluginModal/hooks → 组件与 hooks，用于 Agent 技能插件选择、配置弹窗
    - ./asyncSetting → 异步设置相关 UI（如异步配置面板）
    - ./pluginFeatModal、./pluginFeatModal/featButton → 插件功能/需求反馈弹窗及入口按钮
    - ./botEdit → Bot 编辑相关复用组件
    - ./fileImport → 插件规格文件导入能力（文件 / URL 文本）
    - ./editor → 插件编辑器封装（Monaco/代码编辑器等）
    - ./pluginDocs → 插件文档说明入口
- 与其他包的关系：
  - 强依赖 @coze-arch/bot-api、@coze-arch/bot-utils、@coze-arch/bot-semi、@coze-arch/coze-design、@coze-workflow/base、@coze-community/components 等基础能力，用于 API 调用、UI 组件、工作流 store 等。
  - 与业务 Store：通过 @coze-arch/bot-studio-store、@coze-studio/bot-detail-store、@coze-studio/bot-plugin-store 等交互，但本包主要是 UI + 适配层，不直接负责业务写入逻辑。
- 数据流：
  - 典型流程：用户在 IDE 中打开相关弹窗（导入配置 / 选择插件 / 提交反馈），组件通过 hook/接口调用 @coze-arch/bot-api，返回结果再通过 props 回传给上层容器，由容器负责状态落盘或导航。

## 关键模块与数据流细节

### 1. 插件文件导入（file-import）
- 入口：src/component/file-import/index.tsx（未在此文件中展开，可在修改前先阅读）
- 主要 UI 组件：
  - ImportModal（src/component/file-import/import-modal.tsx）
  - FileUpload / RawText（src/component/file-import/import-content）
- 关键工具函数：src/component/file-import/utils.ts
  - getFileExtension(name: string): string
    - 根据文件名后缀判断类型（yaml/json 等），被测试覆盖
  - isValidURL(str?: string): boolean
    - 使用正则校验 URL 合法性，给导入弹窗判断“文本是否为 URL”使用
  - getContent(file: Blob, onProgress): Promise<string>
    - FileReader 读取文件文本内容；读取失败会抛出 CustomError('normal_error', 'file read fail')
    - onProgress 以 { total, loaded } 回调，用于 UI 进度条
  - customService(url: string)
    - axios GET url，返回 response.data，用于从 URL 下载远端插件文件；responseType 为 text
  - parsePluginInfo(data: { aiPlugin?: string; openAPI?: string })
    - 使用 safeJSONParse 解析 aiPlugin（JSON 字符串），使用 yaml.parse 解析 openAPI（YAML 文本）
  - getInitialPluginMetaInfo(data: PluginInfoObject): PluginMetaInfo
    - 从 aiPlugin / openAPI 中提取 name、desc、auth_type、url、common_params 等，映射到 @coze-arch/bot-api 的 PluginMetaInfo
    - 通过 AUTH_TYPE_MAP、AUTH_LOCATION_MAP 完成 AIPluginAuthType → AuthorizationType 的转换
  - getRegisterInfo(pluginMetaInfo, data): PluginInfo
    - 基于已有 aiPlugin/openAPI 内容与新的 meta 信息合并：
      - 更新 aiPlugin：名称、描述、logo_url、auth 配置、公共参数等
      - 更新 openAPI：info.title、info.description、servers[0].url
    - 最终返回 JSON 字符串 + YAML 字符串，用于「回写」到插件规范文件
  - getImportFormatType(format?: PluginDataFormat)
    - 枚举映射：Curl / OpenAPI / Postman / Swagger / Unknown
  - isDuplicatePathErrorResponseData(value: unknown): boolean
    - 判断接口返回是否存在 paths_duplicated 字段，用于处理导入冲突错误

### 2. 导入弹窗 ImportModal
- 文件：src/component/file-import/import-modal.tsx
- Props：
  - visible: 是否可见
  - title: 标题
  - onCancel: 关闭回调
  - onOk: (data: { type, content }) => Promise<{ success?: boolean; result?: unknown; errMsg?: string }>
- 行为：
  - 用户可在「本地文件」和「URL/原始文本」之间切换：
    - File 模式：通过 FileUpload 组件上传文件，onUpload 返回文件内容文本
    - Text 模式：RawText 文本域；如果内容是合法 URL，则调用 customService 拉取远端文本，并将 type 标记为 file_url
  - 点击「下一步」（footer 中 UIButton）：
    - 构造 { type, content } 调用 onOk
    - 若 onOk 返回 { success: false, errMsg }，会将 errMsg 展示在弹窗底部
  - 错误处理：
    - 远端 URL 获取失败：logger.error + I18n.t('unable_to_access_input_url')
    - 输入变化时清空错误；弹窗关闭后 reset 状态
  - 焦点控制：Text 模式自动聚焦 textarea

### 3. 插件需求/反馈弹窗（plugin-feat-modal）
- 文件：src/component/plugin-feat-modal/index.tsx
- export：usePluginFeatModal()
  - 返回 { open, EntryButton, modal }
- 内部组成：
  - Modal：@coze-arch/coze-design.Modal
  - Form：@coze-arch/coze-design.Form
  - PluginSelect：远程搜索官方插件的下拉框，依赖 ProductApi.PublicGetProductList
  - 提交逻辑：调用 PluginDevelopApi.CreatePluginFeedback
    - 成功（code === 0）后 Toast.success 并关闭弹窗
  - 表单结构：
    - feedback_type: 反馈类型（找不到官方插件 / 对已存在插件反馈）
    - plugin_id: 当 feedback_type 为 OfficialPlugin 时必填
    - feedback: 文本内容，最大 2000 字
  - EntryButton：包装成可复用入口组件，内部调用 open

### 4. Agent 技能插件选择弹窗内容（agent-skill-plugin-modal/content）
- 文件：src/component/agent-skill-plugin-modal/content/index.tsx
- 核心组件：PluginModalContent
- 主要依赖：
  - useWorkflowStore（@coze-workflow/base/store）：获取 workflowNodes
  - useSpaceStore（@coze-arch/bot-studio-store）：获取当前空间 id
  - useInfiniteScrollCacheLoad（本包 hooks）：结合 InfiniteList，做插件列表的分页、缓存与滚动加载
  - fetchPlugin / formatCacheKey / PluginModalModeProps 等（来自 @coze-agent-ide/plugin-shared）
  - PluginPanel（@coze-agent-ide/plugin-modal-adapter）：实际渲染单个插件卡片，内含多种交互
- 数据流：
  - 外部传入 query、pluginApiList、onPluginApiListChange、setQuery 等参数
  - 内部通过 useInfiniteScrollCacheLoad(fetchPlugin, query) 拉取插件列表，并将数据注入 InfiniteList
  - InfiniteList.renderItem 中使用 PluginPanel，将 pluginApiList 与 workflowNodes 结合进行展示与勾选
  - getEmptyConf 用于在列表为空时给出「去创建插件」或「去插件市场」的引导

### 5. 插件文档入口（plugin-docs）
- 文件：src/component/plugin-docs/index.tsx
- 核心逻辑：
  - 根据全局常量 IS_OVERSEA 与 I18n.language 选择不同文档链接
    - 国内：/docs/guides/plugin 或 /docs/en_guides/en_plugin
    - 海外：当前配置为空字符串
  - 非海外环境下渲染 Typography.Text，其 link 属性指向 docsHref

## 构建、测试与调试流程

### 本子包相关命令
- 所有命令在仓库根目录或子包目录执行均可，建议：
  - 安装依赖（一次性）：
    - rush install 或 rush update
  - 在子包目录 frontend/packages/agent-ide/bot-plugin/export 下：
    - 构建：npm run build（当前实现为 `exit 0`，主要通过上游构建体系打包）
    - Lint：npm run lint（eslint ./ --cache）
    - 单测：npm run test（vitest --run --passWithNoTests）
    - 单测 + 覆盖率：npm run test:cov
- Rush 集成：config/rush-project.json
  - 配置 operationSettings：
    - test:cov → 输出目录 coverage
    - ts-check → 输出目录 dist
  - 这些 operationName 会在 Rush pipeline 中被统一调用，避免直接在本包里改硬编码命令。

### 建议的调试方式
- UI 组件使用场景均在上层应用（如 frontend/apps/coze-studio）中：
  - 典型流程：
    - 在上层应用装配这些导出的组件（如导入弹窗、反馈按钮、插件选择弹窗）
    - 启动 dev：在 apps/coze-studio 目录执行 rushx dev 或 npm run dev
  - 在修改本包组件后，依赖 Rush workspace 自动链接，无需手工 npm link。
- 本包自身不包含 Storybook 或 demo app 的命令（README 形容为“project template”，但当前仅保留脚本与依赖），如需增加本地 Demo，请避免破坏现有 exports 结构。

## 项目约定与代码风格

### TypeScript / React 约定
- 使用 React 18 + TypeScript：
  - 函数组件统一使用 FC/React.FC 声明，Props 使用显式 interface 导出
  - hooks 命名以 useXxx 形式（如 usePluginFeatModal、useInfiniteScrollCacheLoad）
- 侧重组合式 API：
  - 导出 “hook + modal + EntryButton” 的组合模式，方便上层装配：
    - 例如 usePluginFeatModal 返回 { open, EntryButton, modal }
  - InfiniteList / PluginPanel 组合也遵循同样思路：列表逻辑与单项渲染分离。

### 国际化与文案
- 所有文案通过 @coze-arch/i18n.I18n 进行：
  - 使用 I18n.t('key')，不要写死中文或英文
  - 条件逻辑中根据 I18n.language 选择不同文本/链接

### 错误处理与日志
- 日志：使用 @coze-arch/logger：
  - logger.error / logger.info 等，附带结构化参数，如 { error, eventName }
- 异常：
  - 对于文件读取错误使用 CustomError('normal_error', 'file read fail')，来自 @coze-arch/bot-error
  - 网络/解析错误尽量捕获并转换为 UI 可展示的 errMsg，交由父组件控制展示。

### 样式与 UI 组件
- 统一使用内部 UI 库：
  - @coze-arch/bot-semi / @coze-arch/coze-design 提供 Modal、Form、Button、Avatar 等
  - 通过 className 拼接 tailwind-like 原子类和模块化 less：
    - 如 className={styles['import-modal']} + "min-h-[472px]"
- 样式文件通常为 *.module.less，与组件同目录；修改时保持命名风格：
  - 使用短横线命名（import-modal.module.less、index.module.less）

## 与外部系统/模块的集成

- @coze-arch/bot-api：
  - plugin_develop / developer_api / product_api 等：
    - PluginDevelopApi.CreatePluginFeedback：创建插件反馈
    - ProductApi.PublicGetProductList：查询官方插件列表
    - PluginDataFormat、PluginMetaInfo、PluginInfoForPlayground 等类型用于插件导入/展示
- @coze-workflow/base.store：
  - 提供 workflowNodes 等工作流上下文，用于在 PluginModalContent 中展示「可调用至 workflow」等能力
- @coze-community/components.InfiniteList：
  - 用于实现无限滚动与懒加载列表，结合 useInfiniteScrollCacheLoad 管理数据与缓存
- axios：
  - 仅在 customService 中使用，统一 responseType 为 text；如需新增 HTTP 请求，请优先考虑内部 http 封装（如 @coze-arch/bot-http），并保持拦截器/鉴权一致。

## 开发流程与协作规范

- 分支与提交（从仓库整体推断，本包自身未额外声明）：
  - 遵循主仓库 Rush monorepo 的通用流程：
    - 在上游说明中常配合团队 level（level-1~4）进行代码评审要求，本包标记为 level-3，意味着属于业务核心但可相对快速迭代。
- 变更建议：
  - 修改导出结构（package.json.exports）前，务必搜索整个 frontend 目录对对应路径的引用，避免破坏其他子包编译。
  - 对工具函数（如 file-import/utils.ts）增加/修改行为时，应同步补充 vitest 单测（__tests__/file-import-utils.test.ts）或新建测试文件，保持核心逻辑有覆盖。
  - 保持 Apache-2.0 版权头；新增文件应复制现有 Header 模板。

## 对 AI 编程助手的特别提示

- 在本包中修改/新增代码时：
  - 优先复用现有工具函数与 UI 模式（如 useXxxModal + EntryButton 模式、InfiniteList + fetchXxx 数据层模式），不要在组件内部直接写请求或业务逻辑。
  - 避免在本包新增全局单例状态，所有状态应通过 props / 上层 store（如 bot-studio-store、workflow store）注入。
  - 所有文案必须走 I18n；所有对外 HTTP 调用优先走现有 API sdk。
  - 新增导入/解析逻辑时，应保持 getInitialPluginMetaInfo、getRegisterInfo 的双向转换一致性，避免只改一侧导致回写不兼容。
