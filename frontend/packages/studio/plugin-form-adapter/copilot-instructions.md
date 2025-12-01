# @coze-studio/plugin-form-adapter 开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/plugin-form-adapter）中安全、高效地协作开发。

## 全局架构与角色定位

- 本子包是 Coze Studio 前端单体仓中的一个 React 组件子包，主要负责「云插件（Cloud Plugin）」的表单配置与注册流程 UI。
- 对外通过 src/index.ts 暴露三类能力：
  - 视图组件：PluginForm —— 渲染插件创建/编辑表单。
  - 表单状态 Hook：usePluginFormState，用于在上层容器中管理表单相关状态与依赖数据。
  - 元信息转换与接口封装：convertPluginMetaParams、registerPluginMeta、updatePluginMeta，用于把表单值转换为后端接口参数并发起注册/更新请求。
- 内部结构（关键目录/文件）：
  - src/components/plugin-form-content/index.tsx：核心表单 UI，实现大量业务逻辑与联动（授权方式、私网接入、Header 列表等）。
  - src/components/plugin-form-content/hooks.ts：usePluginFormState 自定义 Hook，聚合表单状态、授权 schema、运行时选项等。
  - src/components/plugin-form-content/utils.tsx：校验规则、授权 schema 拉取、表单值到接口参数的转换，以及调用 PluginDevelopApi 的注册/更新封装。
  - src/components/plugin-form-content/index.module.less：表单样式，仅通过 CSS Modules s[...] 的方式在组件中引用。
  - vitest.config.ts、.storybook/*：测试与 Storybook 配置，继承仓库级别的预设。
- 数据流概览：
  - 上层容器负责：
    - 调用 usePluginFormState() 获取 pluginState，并将其与可见性、是否创建(isCreate)、初始编辑信息(editInfo) 等一起传给 PluginForm。
    - 在提交时从 pluginState.formApi.current?.getValues() 读出表单值，并结合 headerList、spaceId、projectId、pluginType 等，调用 convertPluginMetaParams，再决定调用 registerPluginMeta 或 updatePluginMeta。
  - PluginForm 负责：
    - 基于 props.pluginState 渲染 Form；
    - 在首次创建时调用 DeveloperApi.GetIcon 预置插件图标；
    - 根据 editInfo 回填字段并设置主/子授权类型、Header 列表、私网连接等；
    - 把不同授权方式（无授权/Service/OAuth 等）拆分成表单段落，通过 extItems 动态渲染额外字段并做校验。
  - utils 中的 usePluginSchame 负责：
    - 调用 PluginDevelopApi.GetOAuthSchema 获取授权 schema 与 IDE 运行时配置；
    - 使用 safeJSONParse 解析后生成 authOption（授权树）与 runtimeOptions（运行时下拉列表），以及 defaultRuntime。

## 构建、测试与本地开发流程

- 本子包依赖 Rush 工作流，通常从仓库根目录使用：
  - 安装依赖/初始化：在仓库根执行 rush update。
  - 进入子包目录 frontend/packages/studio/plugin-form-adapter 后可使用 npm/yarn/pnpm 代理命令，具体以仓库配置为准。
- package.json 脚本（在本子包目录执行）：
  - npm run build：当前实现为 exit 0，占位脚本；实际产物构建通常由仓库统一的 build 流程或上层 app 使用 TS/打包配置生成。新增构建逻辑时应保持与其它 studio/* 子包一致（参考同级子包 tsconfig.build.json 与 Rush 构建规则）。
  - npm run lint：调用 eslint ./ --cache，依赖 @coze-arch/eslint-config 统一规则；修复问题时优先使用已有规则，不随意关规则，必要时仅在局部通过 eslint-disable 标记。
  - npm run test：使用 vitest --run --passWithNoTests，配置在 vitest.config.ts，通过 @coze-arch/vitest-config defineConfig 继承 web 预设。
  - npm run test:cov：在 test 基础上开启 coverage。
- Storybook：
  - .storybook/main.js 使用 @storybook/react-vite，stories 目录位于 ../stories；viteFinal 里统一挂载 vite-plugin-svgr，用于 SVG 以 React 组件方式引用。
  - 运行 Storybook 的命令一般在 workspace 顶层或 frontend 目录配置（本包未单独声明 dev 脚本），扩展/新增 stories 时遵循 *.stories.tsx 或 *.mdx 约定。

## 代码风格与项目特有约定

- 语言与框架：
  - 使用 React 18 函数组件与 Hooks，强类型 TS。
  - 表单组件由 @coze-arch/coze-design 与 @coze-arch/bot-semi/Form 提供，尽量复用已有 FormInput/FormTextArea/FormSelect/Form.RadioGroup 等封装。
- 状态管理：
  - PluginForm 自身只持有与表单联动紧密的局部状态（授权类型、Header 列表、是否禁用 URL、合规校验状态等），共享状态由 usePluginFormState 暴露。
  - 所有与表单值本身相关的读写操作，优先使用 formApi.current?.getValue/setValue，避免直接维护重复状态。
- 授权方式与常量约定：
  - 授权类型(auth_type)为数组，含主授权类型与子类型：
    - 主类型 0：无授权；1：Service；3：OAuth。
    - Service 下子类型通过 sub_auth_type 标记，再在前端压缩为 authType=5/6/7（API Key / Zero / OIDC 等）；详见 index.tsx 中对 setAuthType 的逻辑注释。
  - findAuthTypeItemV2 根据 authType/subAuthType 在 authOption 中定位配置项，extItems 来源于该配置项的 items，用于动态渲染字段。
  - extItems 中字段的 placeholder、必填等提示由 authOptionsPlaceholder 与 extInfoText 提供，新增字段时注意同时补全这两个映射（在 @coze-studio/plugin-shared 中）。
- 国际化与运营环境：
  - 全局使用 I18n.t 读取文案，且不同环境存在差异：
    - formRuleList.name/desc 在 IS_OVERSEA 或 IS_BOE 环境中仅允许 ASCII；国内环境支持中文（使用 \u4e00-\u9fa5 范围 regex）。
  - 环境常量（如 IS_OPEN_SOURCE、IS_RELEASE_VERSION、IS_OVERSEA、IS_BOE）由上层构建环境注入，不在本包内定义；在使用时默认它们已存在于运行环境中，避免重新声明。
- Header 列表约定：
  - headerList 为 commonParamSchema[]，其中 name/value 均为字符串；
  - 初始化时默认包含 { name: 'User-Agent', value: 'Coze/1.0' }；
  - HEADER_LIST_LENGTH_MAX=20，超出则禁止新增；删除最后一项时会重置为仅一条空项，而非完全清空。
- 表单与接口映射：
  - convertPluginMetaParams 是前后端协议的关键：
    - 负责从 FormState 构造 RegisterPluginMetaRequest；
    - 按 ParameterLocation 将 headerList 写入 common_params[Header]，其它位置置空数组；
    - 承担 private_link_id 的归一化逻辑：表单值为 '0' 时视为未设置，写入 undefined，其余保持原值；
    - 根据主 auth_type 写入 sub_auth_type、auth_payload 或 oauth_info，确保后端能正确反序列化 extItemsJSON。

## 对外依赖与集成要点

- 依赖的内外部包（仅列关键部分）：
  - @coze-arch/bot-api 与 PluginDevelopApi：
    - plugin_develop 模块提供 RegisterPluginMetaRequest、AuthorizationType、commonParamSchema 等类型，以及 PluginDevelopApi.GetOAuthSchema/GetIcon/RegisterPluginMeta/UpdatePluginMeta 等接口。
    - 所有网络调用均通过该 SDK；调用时一般带 { __disableErrorToast: true } 以由上层自行处理错误提示。
  - @coze-studio/plugin-shared：
    - 提供 CLOUD_PLUGIN_COZE 常量、doGetCreationMethodTips、extInfoText、locationOption、authOptionsPlaceholder、grantTypeOptions 等 UI/业务配置；
    - PluginInfoProps 类型用于 editInfo 结构，包含 meta_info、plugin_type、creation_method 等字段。
  - @coze-foundation/enterprise-store-adapter 与 @coze-studio/premium-store-adapter：
    - useCurrentEnterpriseInfo 提供 enterprise_id；
    - useBenefitBasic().compareLevel 与 UserLevel.Enterprise 搭配 FLAGS['bot.studio.plugin_vpc'] 控制 VPC 私网功能的启用与 URL 编辑权限。
  - @coze-common/biz-components：
    - PictureUpload 组件负责插件图标上传，与 FileBizType.BIZ_PLUGIN_ICON、IconType.Plugin 组合使用。
  - @coze-arch/coze-design 与 @coze-arch/bot-semi：
    - 提供表单 UI 与布局组件；其中 withField(Cascader) 用于将 Cascader 适配为表单字段 FormCascader。
  - ahooks：
    - useRequest 用于封装 PluginDevelopApi.PrivateLinkList 调用，并通过 ready 控制何时发起请求。
  - @coze-arch/bot-flags：
    - useFlags() 返回特性开关 FLAGS；本子包中关键使用为 bot.studio.plugin_vpc。
- 与上层产品的协作约定：
  - 外层容器负责：
    - 提供 spaceId、projectId、creationMethod、pluginType、extItemsJSON 等参数给 convertPluginMetaParams；
    - 决定在何时调用 registerPluginMeta / updatePluginMeta（例如在弹窗点击“提交”后）。
  - PluginForm 不直接持久化数据，也不负责路由跳转或 toast，只暴露交互与数据结构。

## 开发流程与注意事项

- 新增/修改表单字段：
  - 如为基础字段（名称、描述、URL 等），应：
    - 在 index.tsx 中添加对应 FormInput/FormTextArea 等控件；
    - 在 formRuleList 中补充校验规则（必要时区分境内/境外）；
    - 确认 convertPluginMetaParams 是否需要映射到后端字段。
  - 如为授权相关字段（OIDC/OAuth 配置等），优先通过后台返回的 schema：
    - 修改 GetOAuthSchema 返回值或 @coze-studio/plugin-shared 中的配置；
    - 通过 extItems 动态渲染，保持前端通用逻辑，减少硬编码。
- 处理 editInfo（编辑态）：
  - 修改此处逻辑时，要确保：
    - auth_type/auth_payload/oauth_info/sub_auth_type 三者保持互斥与一致；
    - 私网场景下 URL 的禁用/自动填充逻辑不被破坏（private_link_id !== '0' 时禁用 URL 并从 privateLinkMap 中读取 plugin_access_url）。
- 错误处理与日志：
  - 所有 API 调用在失败时不抛出未捕获异常：
    - getIcon 使用 try/catch 并记录 logger.info；
    - 其它接口依赖上层或统一的错误处理机制；在本包内不要直接调用全局弹窗/Toast，保持纯 UI 组件性质。

## 贡献与分支规范（结合仓库通用约定）

- 本子包受前端 monorepo 管理，具体贡献流程参考仓库根目录的 CONTRIBUTING.md；常见约定包括：
  - 使用 Rush 管理依赖与构建；不要在子包直接运行 npm install，改用 Rush 命令。
  - 遵循统一的 ESLint、TSConfig 与 Stylelint 配置（本包通过 @coze-arch/* 预设继承）。
  - 提交前至少运行 npm run lint 与 npm run test，保证无新增报错；如修改样式，注意通过 Storybook 或上层应用验证 UI 效果。
- 分支与发布：
  - 分支命名、合并策略、发布流程以团队统一规范为准（通常为 Git Flow 或简化的 feature/bugfix 分支模式）；
  - 本子包版本由 workspace 统一管理，单独修改 version 字段前请确认是否符合 Rush/发布策略。

## 本子包的特殊性与踩坑提示

- 强依赖外部环境常量与特性开关：
  - 代码中大量使用 IS_OPEN_SOURCE、IS_RELEASE_VERSION、IS_OVERSEA、IS_BOE、FLAGS 等外部变量，如需在独立环境中调试或在 Storybook 中 mock，需要在上层做 polyfill 或通过 webpack/vite define 注入。
- 授权类型编码规则较绕：
  - 需要同时理解：
    - 前端表单中的 auth_type 数组；
    - mainAuthType、serviceSubAuthType、本地 authType（5/6/7 编码）；
    - 后端的 auth_type/sub_auth_type/auth_payload/oauth_info 字段；
  - 在调整授权逻辑时建议先画状态表或流程图，确保所有组合在创建态与编辑态都能双向映射正确。
- Header 列表的行为是业务约定：
  - 删除最后一个 Header 时并不会留下空数组，而是重置为单个空项；如要变更此行为，需确认是否影响既有插件配置与后端兼容。
- 私网(VPC)能力依赖特定企业等级与 flag：
  - compareLevel === UserLevel.Enterprise 且 FLAGS['bot.studio.plugin_vpc'] 为真时才请求 PrivateLinkList，并开放 private_link_id 选择；
  - 该逻辑与企业权限体系紧密相关，修改前请确认业务规则。
