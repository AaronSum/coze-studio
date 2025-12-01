# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/prompt-kit/main）中安全、高效地协作开发。

## 子包定位与整体角色

- 子包名称：@coze-common/prompt-kit，对应路径 frontend/packages/common/prompt-kit/main。
- 主要职责：提供围绕「Prompt 提示词」的可复用前端组件与能力，包括 Prompt 推荐卡片、推荐面板、Prompt 库列表等，供 Studio/Agent-IDE 等上层产品集成。
- 技术栈：React 18、TypeScript、Less，结合内部设计系统 @coze-arch/coze-design、编辑器 @coze-editor/editor、i18n、Prompt 基础能力包 @coze-common/prompt-kit-base 等。
- 构建定位：Rush monorepo 中一个纯前端 UI/逻辑子包，不承担独立打包/部署，只作为其他应用或包的依赖使用。

## 全局架构与目录结构

核心目录（省略静态资源）：

- src/index.ts
  - 包主入口，当前仅做类型环境注入（@coze-arch/bot-typings、@coze-arch/bot-env/typings）并导出 usePromptLibraryModal。
  - 其他能力通过 package.json 的 exports 字段分别从 ./editor、./prompt-recommend、./create-prompt、./nl-prompt 等子入口导出。
- src/prompt-recommend
  - index.ts：导出 RecommendCard、RecommendPannel 两个主组件。
  - recommend-pannel/index.tsx：实现「Prompt 推荐面板」组件 RecommendPannel，整合 Tabs、滚动容器、推荐卡列表与 Prompt 库弹窗。
  - recommend-card/*：推荐卡 UI、loading 骨架、ViewAll 卡片等。
  - hooks/use-get-librarys.ts：封装从后端/服务获取 Prompt 库推荐数据的逻辑（通过 workspace 内部 HTTP/SDK，而非本包自己发请求）。
  - hooks/use-case/use-scroll-control.ts：负责水平滚动控制，暴露 canScrollLeft/canScrollRight/handleScroll 等给 UI 层使用。
- src/prompt-library
  - library-list.tsx：实现 Prompt 库列表组件 LibraryList（forwardRef），使用 InfiniteList 实现无限滚动加载；首条记录自动选中并通过 onActive 回调通知外部。
  - infinite-list/*：通用无限列表组件及类型定义 InfiniteListRef，封装滚动加载、空态、Footer 等共性逻辑。
  - 其他文件：空态 UI、样式（index.module.less）、请求类型定义（library-request.ts）等。
- src/assets
  - 存放 Prompt 相关图标与引导图片（如 empty-library-icon.svg 等），仅在组件中通过 import 引入。

设计思路：

- 将「Prompt 推荐」能力拆为三个层级：
  - 数据获取与滚动控制（hooks 层，例如 useGetLibrarys、useScrollControl）。
  - 列表/卡片 UI（RecommendCard、LibraryItem、InfiniteList 等）。
  - 容器与场景拼装（RecommendPannel、usePromptLibraryModal 返回的库弹窗）。
- 所有与编辑器真正交互的逻辑，尽量放在「Adapter / Base」包中（如 @coze-common/prompt-kit-base），本包更多是「UI+行为组合」，这点在 RecommendPannel 通过 insertToNewline 和 usePromptLibraryModal 可见。

## 关键数据流与交互

### 推荐面板 RecommendPannel

- 典型使用方式：从 @coze-common/prompt-kit/prompt-recommend 导入 RecommendPannel 组件并嵌入到已有 Prompt 编辑器下方或侧边。
- 关键依赖：
  - useEditor<EditorAPI>()：来自 @coze-editor/editor，获取当前 Prompt 编辑器实例。
  - insertToNewline({ editor, prompt })：来自 @coze-common/prompt-kit-base/shared，用于将选中的推荐 Prompt 插入到编辑器中的新行，同时返回实际插入后的字符串。
  - usePromptLibraryModal({ ... })：来自 src/prompt-library（通过 index.ts 再透出到包根），返回 { open, node } 形态的弹窗组件，供面板中的「查看全部」/「打开库」使用。
- 数据获取：
  - useGetLibrarys()：内部封装网络请求逻辑，通过 runAsync(tab, { space_id, size }) 拉取 Recommended / Team 两类推荐列表，结果保存在 data[tab] 中。
  - useEffect 监听 spaceId 与 activeTab 变化以触发初次加载或刷新。
- 滚动控制：
  - useScrollControl({ activeTab, tabs, loading, data }) 返回 scrollRefs、canScrollLeft、canScrollRight、handleScroll。
  - RecommendPannel 内在 TabPane 中根据 canScrollLeft/canScrollRight 显示左右滚动按钮，并通过 handleScroll 控制横向滚动容器。
- 与上层埋点/业务的接口：
  - onInsertPrompt(prompt, info)：在推荐 Prompt 成功插入编辑器后回调，info 含 id、category（Recommended/Team）。
  - onUpdateSuccess(mode, info)、onCopyPrompt(info)、onDeletePrompt(info)：透传给 PromptLibrary 弹窗，在用户编辑/复制/删除库内 Prompt 时回调。
  - getConversationId、getPromptContextInfo：由上层提供，用于埋点或服务端个性化推荐。

### Prompt 库列表 LibraryList

- 输入：
  - getData(req: LibraryListRequest) => Promise<LibraryListResponse>：上层注入的数据加载函数，本包不关心具体 HTTP 实现。
  - onActive、onEditAction、onDeleteAction：分别在选中/编辑/删除某条库记录时触发。
  - targetRef：承载滚动行为的 DOM 容器引用，配合 InfiniteList 的 scrollConf 使用。
- 内部行为：
  - 使用 InfiniteList 加载数据，并根据 scrollConf.reloadDeps（如 searchWord、category）自动刷新列表。
  - 在数据加载完成且非 loading 时，将第一条记录设为选中并通过 onActive 回调上报。
  - 将 InfiniteListRef 的 reload 与 getDataList 通过 useImperativeHandle 暴露给父组件，用于手动刷新或读取当前列表数据。
- 空态：
  - 通过 emptyConf 提供统一的空态图标、文案和「新建 Prompt」按钮，触发 onEmptyClick 回调交由上层处理。

## 构建、测试与开发工作流

### 包内脚本（package.json）

- build：当前为 "exit 0"，说明本包的最终构建可能由上层统一的构建系统驱动（如 rsbuild 或自定义 builder），本地单独运行 build 仅视为占位。
- lint："eslint ./ --cache" 使用 monorepo 共用 eslint 配置（@coze-arch/eslint-config）。在子包中写新代码时应保持与该配置兼容。
- test："vitest --run --passWithNoTests"，测试配置位于 vitest.config.ts，使用 @coze-arch/vitest-config 之类的共享配置。
- test:cov：在 test 基础上追加覆盖率采集（@vitest/coverage-v8）。

### 典型开发步骤

-（一次性）在仓库根目录执行 Rush 初始化：
  - rush update
- 在 frontend 根或应用层运行 dev/build：
  - 由于本包自身未定义 dev 命令，通常通过依赖它的应用（如 frontend/apps/**）来启动开发服务器。
- 在本包内进行局部验证：
  - npm test 或 npx vitest --run 运行单测。
  - npm run lint 检查代码风格与静态问题。

## 项目约定与编码风格

### TypeScript 与模块组织

- tsconfig.json 仅作为 references 指向 tsconfig.build.json 与 tsconfig.misc.json，本包遵循 monorepo 统一的 TS 配置（如路径别名、jsxRuntime 等）。
- 所有导出均通过 package.json 的 exports 管理，新增子模块时应：
  - 在 src 下创建对应目录与 index.ts。
  - 在 package.json.exports 与 typesVersions 中同步配置，保证类型与运行时代码路径一致。

### React 组件模式

- 常见模式：
  - 函数组件 + hooks（useState/useEffect/useRef/useImperativeHandle 等）。
  - forwardRef 包装导出，类型上通过泛型补全 Ref 能力（参考 LibraryList、RecommendPannel）。
  - UI 采用 classnames + CSS Modules（index.module.less）混合 Tailwind-like 原子类（coz-*、flex 等）。
- 状态管理：
  - 局部 UI 状态用 React useState。
  - 复杂跨组件状态通常交给上游（上下文 store/Redux/zustand 等），本包只通过 props 与回调交互。

### i18n 与文案

- 文案统一通过 I18n.t('key') 读取，key 值遵循 prompt_* / workflow_* 等命名空间。
- 新增文案时需要在对应 i18n 包中补充翻译，本子包不直接维护语言包文件。

### CSS 与样式

- 组件样式优先使用 CSS Modules（*.module.less），类名通过 styles['xxx'] 方式引用。
- 公共 Prompt 相关基础样式通过 @coze-common/prompt-kit-base/shared/css 注入，不要在本包重复定义全局样式。

## 与其他子包与外部依赖的集成

- @coze-editor/editor
  - 提供 useEditor 与 EditorAPI，RecommendPannel 依赖其当前聚焦编辑器来插入 Prompt。
  - 若在非标准编辑场景中使用本包组件，需要确保编辑器环境已正确初始化，否则 insertToNewline 可能失败。
- @coze-common/prompt-kit-base
  - 提供编辑器操作工具（insertToNewline）与通用 CSS，属于业务无关的 Prompt 编辑基础层，本包在行为层复用这些工具。
- @coze-arch/coze-design
  - 内部设计系统组件库，Tabs/Button/Icon 等都来自这里，遵循设计系统的 props 约定（如 itemKey/tab/activeKey 等）。
- @coze-arch/i18n
  - 提供 I18n.t，用于所有用户可见文案的国际化。
- 其他 chat-*、bot-* 依赖
  - 出现在 dependencies 中但在本包源代码中可能仅少量使用或未使用，属于整个 Chat/Agent 平台的通用基础设施；在修改行为前应先搜索查看它们在本包内的真实用法。

## 测试与质量约束

- 测试工具：Vitest + @testing-library/react/React Hooks。
- 在 frontend/rushx-config.json 中，本包被标记为 level-3，整体覆盖率要求较宽松，但仍建议：
  - 为关键交互（如 RecommendPannel 的插入/刷新、LibraryList 的空态和选中行为）补充基础单测。
- 代码重复检查：在 rushx-config.json 的 dupCheck.ignoreGlobPatterns 中，packages/common/prompt-kit/** 被忽略，这意味着：
  - 本包当前不会参与重复代码检测；
  - 但仍应在实现上主动复用 hooks/组件，避免无意义复制，保持可维护性。

## 协作与修改建议

- 新增功能时优先考虑所在层级：
  - 纯数据逻辑/复用型行为建议放到 hooks 或 shared 工具层（可能属于 prompt-kit-base）。
  - UI 变化集中在 RecommendCard/LibraryItem 等基础组件，避免在 RecommendPannel 中堆叠过多样式细节。
- 修改 insert 或请求逻辑前务必：
  - 搜索 @coze-common/prompt-kit-base 与依赖的 chat/agent 包，确认是否有统一约定（例如 Prompt 文本格式、埋点字段）。
- 对外 API（组件 props、导出函数）变更前，应：
  - 在 monorepo 中全局搜索该组件的使用位置，避免破坏上层产品（Studio、Agent-IDE、Workflow 等）。

## 非常规/需要特别注意的点

- build 脚本为占位，真实生产构建依赖 monorepo 顶层配置；不要在本包私自引入独立打包流程。
- 组件大量依赖工作区内其它包（workspace:*），在独立抽取或复制这些组件时，需要一并引入对应依赖，否则很难在外部项目复用。
- RecommendPannel 与 LibraryList 都通过 forwardRef + useImperativeHandle 暴露内部操作（如 refresh、reload）；在 AI 修改时，注意保持 Ref API 的兼容性，以免破坏现有调用方。
