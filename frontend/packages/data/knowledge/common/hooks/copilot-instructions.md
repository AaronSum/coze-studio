# @coze-data/knowledge-common-hooks 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/common/hooks）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包提供「知识库」域的通用 React Hooks，对上层页面隐藏跨包依赖与通用处理逻辑，目前对外主要导出三类能力（见 src/index.tsx、src/use-case）：
  - useKnowledgeNavigate：在知识模块内使用的导航 Hook，自动附带知识 IDE 的公共查询参数。
  - useGetKnowledgeListInfo：按 datasetID 获取单个知识库（dataset）详情的请求 Hook，并带有缓存和统一错误处理。
  - useTosContent：按 URL 拉取知识库相关协议 / 说明（TOS）的 JSON 内容。
- 架构定位：
  - 「data/knowledge/common」域下的 hooks 层，不直接渲染 UI，只封装路由、API、store 和 ahooks 的组合逻辑；实际视图由上游 apps/components 负责。
  - 与 @coze-data/knowledge-common-services 形成「服务 + hooks」的配合关系：services 提供纯函数/服务封装，本包在此之上提供面向组件的 Hook API。
- 导出形式：
  - package.json.exports：
    - "." → src/index.tsx：主入口导出全部公共 Hooks。
    - "./use-case" → src/use-case/index.tsx：给其他包按 use-case 维度引入。
  - typesVersions 对应维护了 TypeScript 的路径映射，新增公共入口时需同步维护 exports 与 typesVersions。

## 开发与测试工作流

- 包管理与构建：
  - 属于前端 Rush monorepo 的 workspace:* 子包，依赖安装在仓库根目录执行 rush update 即可。
  - 本包自身 build 脚本为占位："build": "exit 0"，实际构建/打包由上层工具链统一完成；不要在本包内自建打包流程。
- 测试：
  - 使用 Vitest，配置文件为 vitest.config.ts：
    - 通过 @coze-arch/vitest-config.defineConfig 配置，preset: 'web'，dirname: __dirname。
  - 常用命令（在本包目录下）：
    - npm test：vitest --run --passWithNoTests。
    - npm run test:cov：在上面基础上增加 --coverage。
  - 目前 __tests__ 目录仅有 .gitkeep，可按需补充单测（建议使用 @testing-library/react-hooks / React Testing Library 结合 Vitest）。
- Lint：
  - npm run lint：使用 eslint.config.js 与 @coze-arch/eslint-config 的 web 预设，对 TS/TSX 进行检查。
  - stylelint 由 workspace 统一配置（@coze-arch/stylelint-config），本包不额外定制。
- Storybook：
  - README 提示为「react component with storybook」模板，目录下有 stories/demo.stories.tsx、stories/hello.mdx 以及 .storybook/main.js、preview.js，可用于本地调试 Hook 的使用示例（通过封装为演示组件）。

## 代码组织与约定

- 目录结构要点：
  - src/index.tsx：包主入口，集中导出 useKnowledgeNavigate、useGetKnowledgeListInfo、useTosContent。
  - src/use-case/index.tsx：按「用例」维度导出相同 Hooks，方便其他 data/knowledge 子包通过 "@coze-data/knowledge-common-hooks/use-case" 引用。
  - src/use-case/use-knowledge-navigate.ts：封装知识模块下的导航逻辑。
  - src/use-case/use-get-knowledge-list-info.ts：封装按 datasetID 查询 dataset 详情的请求逻辑。
  - src/use-case/use-tos-content.tsx：封装 TOS 协议内容拉取逻辑。
- TypeScript 与样式：
  - 所有源码均为 TS/TSX 文件，使用严格的类型声明（依赖 @types/react、@types/react-dom）。
  - 本包自身不包含样式文件，仅作为逻辑库；如需 UI，请在上游组件库中实现。
- 导出与命名：
  - 对外导出的 Hook 必须在 src/index.tsx 和 src/use-case/index.tsx 中统一声明，命名统一以 use 前缀 + 业务语义。
  - 新增 Hook 时，保持文件名、小写短横线分词（如 use-new-feature.ts），并放在 src/use-case 目录中。

## 关键 Hook 行为说明

### useKnowledgeNavigate（src/use-case/use-knowledge-navigate.ts）

- 目标：为「知识模块」中的页面提供一个替代 useNavigate 的 Hook，在路由跳转时自动携带知识 IDE 上下文 query 参数（如空间、项目或业务标识）。
- 依赖：
  - react-router-dom：useNavigate、To、Path、NavigateOptions。
  - @coze-data/knowledge-common-services/use-case：getKnowledgeIDEQuery，用于获取需要继承的 query 参数集合。
- 行为：
  - 调用时返回一个重写后的 navigate 函数，签名与 useNavigate 一致。
  - 对三种 to 类型做分支处理：
    - string：
      - 若是相对路径，则基于当前 location.pathname 拼接为绝对路径。
      - 使用 URL + window.location.origin 解析，再对每个 knowledgePageQuery 中的键值：
        - 若值存在且 URL 中尚未包含该查询参数，则追加；已存在则保持调用方传入的值。
      - navigate 到组装后的 pathname + search。
    - Path 对象（Partial<Path>）：
      - 使用 URLSearchParams 对其 search 字段加工，同样按 knowledgePageQuery 填充缺失的参数，最后 navigate({ ...to, search }).
    - number：
      - 视为历史栈跳转（前进/后退），直接透传给原始 navigate。
- 使用建议：
  - 在知识域内的所有页面与组件，优先使用 useKnowledgeNavigate，而不是直接使用 useNavigate，确保 query 上下文在路由跳转中被保留。
  - 由于依赖 window.location 和 URL 等浏览器对象，该 Hook 仅适用于浏览器环境，不宜在 SSR 阶段调用。

### useGetKnowledgeListInfo（src/use-case/use-get-knowledge-list-info.ts）

- 目标：按 datasetID 获取单个 Dataset 详情，并对请求结果进行缓存、错误上报和通用错误提示。
- 依赖：
  - ahooks：useRequest，用于封装异步请求和状态管理。
  - @coze-arch/bot-studio-store：useSpaceStore，读取当前 space.id 作为 space_id 传参。
  - @coze-arch/logger：useErrorHandler，统一捕获和上报错误。
  - @coze-arch/bot-error：CustomError，自定义错误类型，便于统一处理与上报。
  - @coze-arch/bot-api：KnowledgeApi.ListDataset，知识库 dataset 列表接口。
  - @coze-arch/i18n：I18n.t，用于展示统一的错误文案（例如 Network_error）。
  - @coze-arch/coze-design：Toast，全局错误提示组件。
- 行为：
  - 入参：{ datasetID: string }。
  - 内部逻辑：
    - 读取当前 spaceId，并构造 cacheKey = `dataset-${datasetID}`。
    - useRequest 执行异步函数：
      - 若 datasetID 为空，则抛出 CustomError('useListDataSetReq_error', 'datasetid cannot be empty')，依赖上层捕获。
      - 调用 KnowledgeApi.ListDataset，传入 filter.dataset_ids 和 space_id。
      - 若 res.total 为 truthy：返回 dataset_list 中 dataset_id 匹配的那一项（可能为 undefined）。
      - 若 res.total 不等于 0（含 null/undefined）：认为请求未按预期返回，使用 capture 记录 CustomError，并不抛错给调用方。
    - 缓存策略：
      - setCache：将响应数据序列化后写入 sessionStorage 中，对应 cacheKey。
      - getCache：从 sessionStorage 读取并 JSON.parse，默认 '{}'，因此建议调用方对返回值做类型收窄。
    - onError：
      - 统一展示 Toast.error，文案为 I18n.t('Network_error')，并关闭关闭按钮。
      - 调用 capture 进一步上报 error。
- 返回值：直接透传 useRequest 返回的结果（data、loading、error 等），data 为「单个 dataset 对象」或 getCache 的结果。
- 使用建议：
  - 调用时务必确保 datasetID 非空，否则会抛出 CustomError；可以在上层做前置校验或 try/catch。
  - 需要考虑 getCache 默认 '{}' 的情况，使用方应检查 data 是否为空对象或缺失关键字段。
  - 若要修改缓存策略（如改为 localStorage 或取消缓存），请在本 Hook 内统一调整 setCache/getCache 实现，而不要在调用方绕过 useRequest 的缓存机制。

### useTosContent（src/use-case/use-tos-content.tsx）

- 目标：按指定 URL 拉取 JSON 格式的协议/说明文档内容（Terms of Service），并提供 loading/error 状态。
- 依赖：
  - ahooks：useRequest。
  - 浏览器 fetch API：直接调用 fetch(tosUrl, { cache: 'no-cache' })，不经过统一 HTTP 客户端。
- 行为：
  - 入参：tosUrl?: string。
  - useRequest 内部：
    - 若未提供 tosUrl，则返回 null，认为无需请求。
    - 调用 fetch，并显式禁用缓存；若 response.ok 为 false，则抛出 Error('Failed to fetch content')。
    - 成功时调用 response.json()，假设 TOS 内容为 JSON。
  - refreshDeps: [tosUrl]，即 URL 变化时自动重新请求。
- 返回值：{ content, loading, error }，直接来自 useRequest 的解构。
- 使用建议：
  - 仅适用于返回 JSON 的 TOS 地址；若未来需要支持 Markdown/HTML，需要在本 Hook 中扩展解析逻辑，而不要在调用方重复处理。
  - 上层组件应根据 loading / error 状态展示 skeleton 或错误提示，不要假设 content 一定存在。

## 与其他子包和外部依赖的集成

- 知识域服务层（@coze-data/knowledge-common-services）：
  - useKnowledgeNavigate 依赖 use-case/getKnowledgeIDEQuery，保证知识相关页面在路由跳转时共享 IDE 上下文（如当前知识空间、工程、过滤条件等）。
  - 若知识域的公共 query 规则变更，应在 services 包中更新 getKnowledgeIDEQuery 的实现，本包不负责具体规则，只负责透传。
- 工作空间与用户上下文（@coze-arch/bot-studio-store）：
  - useGetKnowledgeListInfo 通过 useSpaceStore 读取当前 space.id，作为所有 dataset 请求的必需参数。
  - 若未来空间模型发生变化（如多空间并行、临时空间），应在 useSpaceStore 层做兼容，本 Hook 只负责读取最新 space.id。
- 错误处理与埋点（@coze-arch/logger、@coze-arch/bot-error）：
  - useErrorHandler 提供 capture 函数，用于将异常统一上报到日志/监控系统。
  - CustomError 用于标记特定错误场景（如 datasetid 为空、后端返回异常 total），便于统一过滤和统计。
- 国际化与 UI 提示：
  - 所有「网络相关」错误提示使用 I18n.t('Network_error') + Toast.error，保证知识域内提示文案一致。
  - 若需更精细的错误提示（如展示后端 msg），建议：
    - 在不改变现有默认行为的前提下，通过新增参数/可选配置扩展本 Hook，而不是在调用方绕过 Toast 和 capture。

## 工程规范与协作建议

- 新增 Hook 时的推荐流程：
  - 在 src/use-case 下创建新文件，实现业务逻辑，优先复用 ahooks/useRequest、bot-api、bot-studio-store、logger、i18n 等现成能力。
  - 在 src/use-case/index.tsx 与 src/index.tsx 中分别导出该 Hook。
  - 若需要对外作为子路径导出（例如 "./use-case"），确保 package.json.exports 与 typesVersions 一并更新。
  - 视情况在 stories/ 下添加 demo.stories.tsx 中的新故事，便于 Storybook 演示与联调。
  - 使用 Vitest + Testing Library 针对复杂逻辑添加单测（如特殊错误码处理、缓存策略等）。
- 变更已有 Hook 时的注意事项：
  - 保持返回结构（字段名与类型）稳定，除非已确认所有调用方均已更新。
  - 优先通过新增可选参数或配置对象扩展行为，而不是更改默认行为。
  - 修改 API 依赖（如 KnowledgeApi 参数、space store 字段）前，应检查其他 data/knowledge 子包的调用情况，避免破坏现有链路。
- 浏览器环境依赖：
  - useKnowledgeNavigate 和 useTosContent 都依赖 window/location/fetch 等浏览器 API，
    - 不应在 Node 环境或 SSR 前执行这些 Hook。
    - 如需在更广泛场景使用，应通过特性检测或条件渲染保证仅在客户端调用。
