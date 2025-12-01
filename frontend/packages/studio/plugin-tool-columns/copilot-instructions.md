# @coze-studio/plugin-tool-columns 开发指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/plugin-tool-columns）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是 Studio 插件开发域中的「工具列表表格列定义」模块，对外仅暴露一个 React Hook：useGetToolColumns（见 src/index.ts）。
- useGetToolColumns 接收外部传入的插件信息、权限与操作回调，返回一组适配 @coze-arch/bot-semi/Table 的列配置，用于渲染插件工具列表页。
- 展示数据类型以 PluginAPIInfo、GetUpdatedAPIsResponse、PluginInfoProps 等领域模型为核心，统一来自 @coze-arch/bot-api、@coze-studio/plugin-shared 等 workspace 包。
- 交互动作（启用/停用 API、删除 API、跳转 IDE、打开调试示例、跳转 mock 集合等）统一通过：
  - PluginDevelopApi（远端接口调用）
  - usePluginNavigate（路由跳转到 IDE、mock 列表等）
  - usePluginStore（插件锁检查与包装执行）
- 视觉与交互控件使用内部 Semi 包装库 @coze-arch/bot-semi，样式通过 Less 模块 src/hooks/index.module.less 维护，不在 Hook 中直接写硬编码样式。
- 本包依赖特性旗标 useFlags 控制部分能力（如 mockset、导入导出），避免在不开放的场景中暴露 UI 操作。

## 源码结构概览

- package.json：定义构建、测试、lint 命令及依赖。注意当前 build 脚本为 "exit 0"，真实打包通常由上级 Rush/Vite 配置驱动。
- src/index.ts：集中导出 useGetToolColumns 与类型 UseGetToolColumnsProps，是外部唯一入口。
- src/hooks/use-get-tool-columns.tsx：核心逻辑所在，返回 getColumns，内部包含：
  - 工具名称、描述列：多行排版 + 溢出 Tooltip。
  - 参数列：使用 OverflowList + UITag 展示 request_params，支持折叠统计 " +N" 并 Tooltip 展示完整列表。
  - 服务状态列：根据 PLUGIN_SERVICE_MAP 渲染颜色点与文本。
  - 调试状态列：根据 PLUGIN_API_TYPE_MAP 渲染状态 Tag。
  - 使用统计列：展示 bot_quote，使用 formatNumber 统一格式化。
  - 创建时间列：使用 formatDate 统一格式化时间。
  - 启用开关列：使用 Switch 控制 disabled 字段，内部调用 PluginDevelopApi.UpdateAPI，并通过 usePluginStore 做并发锁检查。
  - 操作列：
    - 编辑：handleIdeJump(InitialAction.SELECT_TOOL, api_id)。
    - 调试：resourceNavigate.tool?.(api_id, { toStep: '3' })，受 CreationMethod 限制。
    - 示例：openExample(record) 并按照 debug_example_status 渲染不同图标。
    - 下拉更多：导出代码片段、管理 mockset、删除工具等，均包裹 wrapWithCheckLock，且结合 FLAGS2 与插件状态决定是否可操作。
- src/hooks/index.module.less：存放表格列需要的样式类（如 min-width-200、tool-table-desc、circle-point、icon-more 等）。新增/修改列时，应同步维护样式以保证一致视觉风格。
- .storybook/main.js & preview.js：Storybook 的 Vite 配置，集成 svgr 等插件，用于本地开发与 UI 展示，遵循 workspace 统一配置。
- vitest.config.ts：继承 @coze-arch/vitest-config，用于单元测试配置，与 workspace 里的测试规范保持一致。
- eslint.config.js、.stylelintrc.js、tsconfig*.json：统一接入 @coze-arch/* 配置，保证代码风格、类型及样式检查的一致性。

## 关键数据流与交互流程

- 数据来源：
  - 列表数据由外部 Table 容器通过 dataSource 传入，useGetToolColumns 本身不拉取列表，仅负责展示与交互行为。
  - 插件基础信息 pluginInfo、版本及状态来自上层页面，决定能否编辑、是否允许删除、是否允许某些操作（例如上市状态禁止删除）。
  - updatedInfo 用于判断某些 API 是否为新创建（如 created_api_names），影响 mockset 入口的可用性。
  - feature flags（FLAGS2）决定是否展示导出代码片段、mockset 等能力入口。
- 状态与锁控制：
  - usePluginStore 提供 checkPluginIsLockedByOthers 与 wrapWithCheckLock：所有会修改后端状态的操作（开关、编辑、调试、mockset、删除等）均需通过锁检查，避免多人编辑冲突。
  - targetSwitchId 与 loading 控制某一行开关的 loading 状态，防止用户误以为点击未生效。
- 后端通讯：
  - PluginDevelopApi.UpdateAPI：更新某个 API 的 disabled 状态，参数包含 plugin_id、api_id、edit_version 等。
  - PluginDevelopApi.DeleteAPI：删除指定工具 API，同样需要插件版本信息。
  - 成功后统一调用外部传入的 refreshPage 以刷新列表。
- 导航与 IDE 集成：
  - usePluginNavigate 提供 tool、mocksetList 等方法，将业务跳转解耦出本 Hook。
  - handleIdeJump 由上层传入，封装 IDE 打开逻辑及埋点，Hook 仅负责触发。

## 开发与运行流程

- 依赖安装：在仓库根目录使用 Rush 管理依赖，一般执行：
  - rush update
- 本包局部开发方式：
  - Storybook：在上层 workspace 中运行统一的 Storybook 命令（参考 frontend/README.md），本包 stories 挂载在 .storybook/main.js 配置的 stories 路径下。
  - 由于 package.json 中 build 脚本为占位实现（exit 0），不要在本包内直接依赖 npm run build 产物，真实构建由 Rush+Vite 顶层工程处理。
- 质量检查：
  - Lint：在本子包目录执行 npm run lint，使用 @coze-arch/eslint-config 和 stylelint 进行代码和样式检查。
  - 测试：npm run test 调用 vitest --run --passWithNoTests，目前 __tests__ 目录仅有 .gitkeep，允许在无测试情况下通过；如新增测试文件，需遵循 vitest 配置与 Testing Library 规范。
  - 覆盖率：npm run test:cov 生成覆盖率报告，底层使用 @vitest/coverage-v8。

## 代码风格与约定

- 类型与 Props：
  - 公共类型尽量复用上游包定义（PluginAPIInfo、PluginInfoProps 等），避免在本包重复声明业务字段。
  - useGetToolColumns 的 props 尽量保持扁平，不在 Hook 内发起新的全局数据请求，只依赖传入数据与全局 store/flags。
- 交互约定：
  - 所有修改后端状态的操作必须：
    - 先通过 checkPluginIsLockedByOthers 或 wrapWithCheckLock 做锁检查。
    - 成功后调用 refreshPage 刷新上层列表，避免本地状态与后端不一致。
  - 点击行内按钮时要 stopPropagation，避免触发行级点击事件（例如跳详情）。
  - Tooltip 与 Popconfirm 要求在禁用状态下仍能解释原因（例如上市状态禁止删除），本包通过嵌套 Tooltip + Popconfirm 实现。
- 文案与多语言：
  - 所有用户可见文案必须通过 I18n.t 调用，key 命名复用插件域中既有规范（plugin_api_list_table_* 等）。
  - 新增列或操作时，需要先在上游 i18n 资源中补充文案 key，再在本包使用。
- 样式与布局：
  - 使用 Less 模块 s[...] 引用样式类，不直接硬编码 className 字符串，便于后续统一主题和样式演进。
  - 表格列宽需结合现有列宽与最小宽度样式，避免超出或过度压缩。

## 重要依赖与集成细节

- @coze-arch/bot-semi：
  - 本包仅使用其暴露的 UI 组件（UIIconButton、UITag、Tooltip、Dropdown、Switch、OverflowList 等），不直接依赖底层 Semi。
  - ColumnProps 类型也来自该包的 Table，新增列时需遵循其类型定义（dataIndex、render 签名等）。
- @coze-arch/bot-api：
  - 提供 PluginDevelopApi 及相关枚举（APIDebugStatus、ProductStatus、CreationMethod、PluginType、DebugExampleStatus 等）。
  - 修改 API 调用时须保证请求参数与服务端契约保持一致，并注意 edit_version、plugin_id 等版本/身份参数必填性。
- @coze-studio/bot-plugin-store：
  - usePluginStore 负责插件级别的锁校验与操作包装，是全局并发控制的关键点。
  - usePluginNavigate 封装路由跳转，避免在本 Hook 内直接耦合路由实现。
- @coze-arch/bot-flags：
  - useFlags 返回的 feature flag（如 bot.devops.plugin_import_export、bot.devops.plugin_mockset）决定下拉菜单中功能的显隐，新增实验性功能时应通过旗标控制曝光范围。

## 测试与扩展建议（基于现有实践）

- 当前子包缺少实际测试文件，但已配置 vitest 与 Testing Library，可按以下思路补充：
  - 对 useGetToolColumns 的行为做单元测试，校验列数量、关键列的 title、dataIndex，以及在特定 props 输入下的 render 结果（如 mocksetDisabled 条件、Tooltip 内容等）。
  - 对开关列和删除操作列可通过模拟 wrapWithCheckLock 与 PluginDevelopApi 的调用，验证在不同锁状态下行为是否符合预期。
- 新增功能时，请尽量通过扩展 props（例如新增 customRender 变体或增加回调）而不是在 Hook 内引入新的全局依赖，以保持职责单一与复用性。
