# @coze-studio/plugin-shared — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/plugin-shared）中安全、高效地协作开发。

## 一、子包定位与全局架构

- 位置与作用：本包位于 frontend/packages/studio/plugin-shared，对应 npm 包名 `@coze-studio/plugin-shared`，是 Studio 插件体系中「通用常量与类型」的共享层，主要承载：
  - 插件类型与创建方式等枚举常量（PluginType、CLOUD_PLUGIN_COZE 等）。
  - 与插件创建/配置相关的下拉选项、提示文案结构（pluginTypeOption、locationOption、extInfoText、authOptionsPlaceholder 等）。
  - 与插件 API 调试状态与服务上下线状态相关的映射（PLUGIN_API_TYPE_MAP、PLUGIN_SERVICE_MAP）。
  - 与插件信息结构相关的类型封装（PluginInfoProps、ExtInfoText、InitialAction）。
- 出口结构：
  - 对外唯一入口为 src/index.ts，仅做 re-export：
    - 从 src/constants/index.ts 导出 PluginType、pluginTypeOption、locationOption、OauthTccOpt、extInfoText、authOptionsPlaceholder、CLOUD_PLUGIN_COZE、CLOUD_PLUGIN_IDE、LOCAL_PLUGIN_COZE、doGetCreationMethodTips、grantTypeOptions、PLUGIN_SERVICE_MAP、PLUGIN_API_TYPE_MAP。
    - 从 src/types/index.ts 导出 ExtInfoText、PluginInfoProps、InitialAction。
  - 任何需要在 Studio 其他子包中使用上述常量/类型的场景，应通过 `@coze-studio/plugin-shared` 引用，而不是复制实现。
- 设计动机：将与「插件创建 / 鉴权配置 / 运行状态」强相关但无 UI 的配置与类型集中在一个轻量包中，减少在各个插件编辑页重复维护文案 key、Magic Number、枚举字符串的风险。

## 二、代码结构与职责划分

- package.json
  - scripts：
    - `build`: `exit 0`（当前不在包级执行实际构建，统一由上层构建链处理）。
    - `lint`: `eslint ./ --cache`，规则来自 @coze-arch/eslint-config。
    - `test`: `vitest --run --passWithNoTests`。
    - `test:cov`: `npm run test -- --coverage`。
  - 依赖特征：
    - 运行时依赖：@coze-arch/bot-api、@coze-arch/bot-semi、@coze-arch/i18n、classnames。
    - dev 依赖：统一使用 @coze-arch/* 的 tsconfig、eslint、stylelint、vitest-config，测试依赖 React 18 与 Testing Library。
  - peerDependencies：要求宿主提供 React/ReactDOM >= 18.2.0，但本包自身不暴露 React 组件，仅为类型/常量共享包。
- src/types/index.ts
  - PluginInfoProps：
    - 类型别名：`GetPluginInfoResponse & { plugin_id?: string }`，在后端返回结构基础上增加可选 plugin_id 字段，用于某些调用场景下缺失或需要额外挂载 id 的情况。
  - ExtInfoText：
    - 描述 extInfoText 中每一行文案块的数据结构，字段：
      - `type`: `'title' | 'text' | 'br' | 'demo'`，对应前端渲染时的样式/排版类型。
      - `text?`: 文本内容；类型为 `string | undefined`，`br` 行通常没有 text。
  - InitialAction：
    - 用于描述插件创建页/插件入口的「初始操作」，可选值：
      - `default`：默认行为。
      - `create_tool`：引导创建工具。
      - `select_tool`：引导选择已有工具。
      - `publish`：引导发布插件。
- src/constants/index.ts
  - 上游枚举与类型：
    - 从 @coze-arch/bot-api/plugin_develop 引入：CreationMethod、PluginType as PluginTypeFromApi、GrantType、APIDebugStatus、OnlineStatus。
    - 从 @coze-arch/bot-semi/Tag 引入 TagColor，用于 Tag 颜色类型约束。
  - PluginType（本包内部枚举）：
    - Form = 1：表单模式插件。
    - Code = 2：代码模式插件。
    - 主要用于前端 UI 和选项值，与后端 PluginTypeFromApi 保持语义一致，但数值来源可独立维护。
  - pluginTypeOption：
    - 插件创建模式下拉选项数组：
      - value: 1 / label: I18n.t('form_mode')。
      - value: 2 / label: I18n.t('code_mode')。
    - 调用方应优先使用此数组而非手写枚举。
  - locationOption：
    - 描述插件的挂载位置（例如「顶部入口」「查询区域」）的下拉选项数组：
      - value: 1 / label: I18n.t('create_plugin_modal_header')。
      - value: 2 / label: I18n.t('create_plugin_modal_query')。
  - OauthTccOpt 接口：
    - 描述 OAuth 配置项结构：key、label、max_len、required、type、default、placeholder、ruleList 等字段，用于插件 OAuth 表单配置（尤其是 TCC 配置部分）。
  - extInfoText：
    - shape：`Record<string, ExtInfoText[]>`，每个 key 对应某一类说明文案：「header_list」「auth」「location」「service_token」等。
    - 每个数组元素为 ExtInfoText，type 控制前端渲染形式：
      - `title`: 标题行。
      - `text`: 普通说明文案。
      - `br`: 换行。
      - `demo`: 示意或示例行。
    - 所有文案内容通过 I18n.t(key) 生成，不直接写死字符串；前端展示组件通常根据 key 渲染一段富文本说明区域。
  - authOptionsPlaceholder：
    - 各类 OAuth/鉴权字段的 placeholder 映射：client_id、client_secret、client_url、scope、authorization_url、authorization_content_type、service_token、key 等。
    - 统一从 i18n 拉取，对插件配置表单输入框直接复用此对象，可避免多处散落 placeholder key。
  - CLOUD_PLUGIN_COZE / CLOUD_PLUGIN_IDE / LOCAL_PLUGIN_COZE：
    - 通过 `${PluginTypeFromApi.*}-${CreationMethod.*}` 形式构建的字符串常量，用于区分「云插件-COZE 创建」「云插件-IDE 创建」「本地插件-COZE 创建」等模式。
    - 调用方如需判断插件来源类型，应优先使用这些常量构造/比对，而不是自行拼字符串。
  - doGetCreationMethodTips：
    - 简单辅助函数：`() => extInfoText.creation_method`，用于拿到创建方式的提示文案列表。
  - grantTypeOptions：
    - OAuth 授权模式下拉选项：TokenExchange 与 ClientCredential，对应后端 GrantType 枚举值，label 当前为固定英文字符串（而非 i18n）。
  - PLUGIN_API_TYPE_MAP：
    - Map<APIDebugStatus, { label: string; color: TagColor }>，用于根据 API 调试状态返回展示文案与 Tag 颜色：
      - DebugWaiting → label: I18n.t('plugin_api_type_fail')、color: 'red'。
      - DebugPassed → label: I18n.t('plugin_api_type_pass')、color: 'green'。
    - 插件详情或列表中展示 API 调试状态时应使用此 Map 获取 label 与颜色，而非手动写判断。
  - PLUGIN_SERVICE_MAP：
    - Map<OnlineStatus, { label: string; color: string }>，用于根据服务上下线状态展示文案与颜色：
      - ONLINE → label: I18n.t('plugin_service_status_online')、color: 'var(--plugin-unpublished-color)'。
      - OFFLINE → label: I18n.t('plugin_service_status_offline')、color: 'var(--plugin-published-color)'。
    - 请注意：这里的 color 使用 CSS 变量字符串，由上层全局样式控制具体色值。

## 三、开发与测试工作流

- 依赖安装与构建：
  - 在仓库根目录使用 Rush：`rush update` 以安装/更新所有 workspace:* 依赖。
  - 本包的 `build` 命令为 no-op（exit 0），真正构建由上层工具链（例如统一的打包/tsc pipeline）承担；不要在本包中单独引入新的 bundler 配置。
- 本包本地命令（在 frontend/packages/studio/plugin-shared 下）：
  - `npm run lint`：运行 ESLint 检查，必须保持通过。
  - `npm test`：使用 Vitest 运行测试，配置来自 @coze-arch/vitest-config（preset: 'web'）。
  - `npm run test:cov`：在 test 基础上收集覆盖率。
- Storybook/开发预览：
  - README 中提到「react component with storybook」模板，并存在 .storybook/main.js、preview.js，但本包当前不包含 React 组件，仅提供常量与类型；如未来增加 UI 组件，可直接复用现有 Storybook 配置进行开发调试。

## 四、项目约定与使用模式

- 使用方式（其他子包如何消费）：
  - 通过 `@coze-studio/plugin-shared` 引入常量与类型，例如：
    - 从 constants 中获得下拉选项或状态 Map：pluginTypeOption、locationOption、grantTypeOptions、PLUGIN_API_TYPE_MAP、PLUGIN_SERVICE_MAP。
    - 从 types 中获取插件信息类型与扩展文案结构：PluginInfoProps、ExtInfoText、InitialAction。
  - 调用方应避免直接依赖 @coze-arch/bot-api 中的 CreationMethod/PluginType/GrantType 等来拼接字符串或状态展示，而是优先复用本包已封装的常量与 Map，保证一致性与可维护性。
- i18n 与文案：
  - 所有文案文本通过 I18n.t(key) 获取，具体 key 在 constants/index.ts 中集中声明；新增/修改文案时：
    - 在对应块（如 extInfoText、authOptionsPlaceholder）中增加/调整 key。
    - 在上游 i18n 资源文件中添加/更新对应翻译。
  - 本包自身不引入 i18n 配置文件，仅依赖 @coze-arch/i18n 的全局实例。
- 与后端协议的关系：
  - PluginInfoProps 与 GetPluginInfoResponse 保持直接关联；如后端调整字段结构，通常优先修改 bot-api 包的类型，再在本包中（如果需要）补充兼容字段，而不是在这里仿造一份不一致的定义。
  - CLOUD_PLUGIN_* / LOCAL_PLUGIN_* 常量依赖后端 PluginType 与 CreationMethod 枚举值，任何后端语义变化需要同时回顾这些字符串约定。

## 五、协作与扩展注意事项

- 修改/新增导出时：
  - 必须同时：
    - 在 src/constants/index.ts 或 src/types/index.ts 中实现或调整逻辑/类型。
    - 在 src/index.ts 中增删对应 re-export，保持对外 API 面清晰、集中。
  - 避免在其他子包直接从 src/constants/index.ts 之类的相对路径导入本包内部模块，应统一通过包名导入。
- 兼容性：
  - 本包属于「共享依赖层」，被多个 Studio 子域消费；对外导出的常量/类型一旦修改语义或移除，可能影响广泛。
  - 如需变更行为：
    - 优先通过「新增常量/枚举值」的方式扩展，而不是修改现有值的含义。
    - 对于 BREAKING 变更，至少应在调用方全部调整完毕后再移除旧导出。
- 测试建议：
  - 对于新增的 Map/常量逻辑（例如状态到 label/颜色的映射），可添加简单的 Vitest 单元测试，校验 key → 值的一致性和预期文案；
  - 不需要对 i18n.t 调用本身做复杂测试，只需保证 key 不拼写错误即可（可以通过 snapshot 或简单 equality 断言）。
- 不建议的做法：
  - 在本包中引入任何与具体 UI 框架强耦合的实现（例如直接渲染 React 组件），以免影响其「共享配置层」定位。
  - 将后端请求逻辑写在这里；与插件相关的 API 调用应该位于上层 service 包或页面级 service 中，本包只负责「常量 / 类型 / 说明文案结构」。
