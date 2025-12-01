# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-plugin/tools）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是「Bot 插件工具」前端子库，为插件创建/编辑相关页面提供可复用 UI 组件与业务 hooks，属于 React + TypeScript 单包，作为多个上层应用（bot-plugin 入口/导出、plugin-setting、workflow playground 等）的 UI & 逻辑适配层。
- 整体按“组件 + 工具 + hooks + 类型定义”拆分：
  - 核心配置与参数建模位于 [src/components/plugin_modal](src/components/plugin_modal)，封装插件请求/响应参数树、表单校验、默认值处理等复杂逻辑，是本子包的核心业务区域。
  - 示例调试相关逻辑集中在 [src/hooks/example](src/hooks/example) 和 [src/components/example-modal](src/components/example-modal)，负责在 Bot/Workflow 场景中查看和编辑调试示例。
  - 设置弹窗参数控制逻辑位于 [src/hooks/parameters](src/hooks/parameters)（例如 useParametersInSettingModalController），主要面向「Bot 默认参数设置」侧边/弹窗使用。
  - 通用 UI 辅助组件（如参数名/类型输入控件、信息气泡）位于 [src/components/plugin_modal/params-components](src/components/plugin_modal/params-components) 与 [src/components/info_popover](src/components/info_popover)。
  - 类型与配置常量集中在 [src/components/plugin_modal/types](src/components/plugin_modal/types) 与 [src/components/plugin_modal/config.ts](src/components/plugin_modal/config.ts)，例如参数类型枚举扩展、错误码、树型参数节点结构等。
- 包外依赖边界：
  - 与业务 API 的交互通过 @coze-arch/bot-api 提供的 PluginDevelopApi 与类型（如 PluginAPIInfo、APIParameter、DebugExample 等），本包不直接关心网络实现，只做数据适配、校验和 UI 呈现。
  - 与全局状态的交互通过 @coze-studio/bot-plugin-store、@coze-arch/bot-studio-store 等 store hooks（如 usePluginStore、useSpaceStore），本包只读/更新必要的字段，而不负责 store 的创建或生命周期管理。
  - UI 基础库统一使用 @coze-arch/bot-semi（基于 Semi Design）和自家 Icon 包 @coze-arch/bot-icons，样式通过本包内 less 模块（如 index.module.less）实现。
- 数据流模式：
  - 绝大部分复杂交互通过 hooks 封装“数据获取 + 本地 state + 变更接口调用”，返回给上游的是“渲染节点 JSX + 操作函数”，例如 useBaseInfo、useViewExample、useEditExample、useParametersInSettingModalController。
  - 参数编辑相关逻辑走“API 原始参数列表 → 内部树结构（带深度、默认值、校验状态）→ 提交前清洗/转换回 API 结构”的单向流，核心转换函数集中在 [src/components/plugin_modal/utils.ts](src/components/plugin_modal/utils.ts)。

## 关键开发工作流

- 依赖安装与初始化：
  - 整个 monorepo 使用 Rush + pnpm 管理，根目录执行 `rush update` 安装依赖（README 中的 `init: rush update`）。
  - 子包内不会单独执行 `npm install`，所有依赖版本统一靠 workspace 协调。
- 构建与打包：
  - 当前 package.json 中 `build` 脚本为 `exit 0`，表示本子包本身不负责独立打包，真实构建由上层 rsbuild / bundler 在 app 级统一处理，仅需保证 TS 类型与导出路径正确。
  - 若未来需要本地检查构建，可在根级或统一前端构建脚本（如 scripts/build_fe.sh、frontend 下 rsbuild-config）中触发；在本包内不应新增与全局不一致的构建链路。
- Lint 与代码规范：
  - 使用 @coze-arch/eslint-config，配置见 [eslint.config.js](eslint.config.js)，preset 为 `web`，规则统一从架构层下发；新增代码需满足 eslint 校验，必要时用 `// @ts-expect-error -- linter-disable-autofix` 等形式显式压制历史兼容问题，而非随意关闭规则。
  - 样式规范通过根级 .stylelintrc.js 和 @coze-arch/stylelint-config 管理，新增 less 需保持 BEM 风格 class 命名与已有样式一致（如 s['form-check-tip']）。
  - 推荐命令：在包内执行 `npm run lint` 检查本包；在仓库根按统一脚本执行全局 lint。
- 测试：
  - 测试框架为 Vitest，配置封装在 @coze-arch/vitest-config 中，见 [vitest.config.ts](vitest.config.ts)，preset 为 `web`，意味着运行环境近似浏览器（jsdom）。
  - 常用命令：
    - `npm test`：运行本包单测，`--passWithNoTests` 允许暂时没有测试文件。
    - `npm run test:cov`：生成覆盖率报告，通过 `@vitest/coverage-v8`。
  - 测试文件位置：遵循 monorepo 约定放在 [__tests__](__tests__) 目录或紧邻源码文件；编写新特性时优先在 hooks 与复杂 utils (如 plugin_modal/utils.ts) 周围补测试。

## 代码组织与项目特有约定

- 导出与模块边界：
  - 对外暴露统一通过 package.json 中 `exports` 字段和 [src/index.tsx](src/index.tsx)，例如：
    - `@coze-agent-ide/bot-plugin-tools` → 默认导出 useEditExample hook。
    - `@coze-agent-ide/bot-plugin-tools/useViewExample` → useViewExample 自定义 hook。
    - `@coze-agent-ide/bot-plugin-tools/pluginModal/config` / `types` / `utils` 等 → 插件参数配置与类型工具。
  - 新增 API 时需：
    - 在 src 内按现有层次放置（components/hooks/...）。
    - 在 package.json 的 `exports` 与 `typesVersions` 中补充路径，确保 TS 能正确解析类型提示。
- 参数树与默认值处理约定：
  - 统一使用 config.ts 中约定的字段与常量：
    - `ROWKEY` 作为每个参数节点的唯一键，统一使用 nanoid 生成；
    - `childrenRecordName = 'sub_parameters'`，所有树形结构递归子节点都用该字段名；
    - `ARRAYTAG` / `ROOTTAG` 用于数组元素和根节点的特殊占位展示，不可与真实参数名混淆。
  - 默认值相关：
    - 请求/响应参数从后端获取后，通常先经过 `initParamsDefault` 与 `addDepthAndValue` 处理：
      - 为 local_default/global_default 补齐默认值；
      - 设置 `deep`（层级）与 `value`（用于 UI 绑定）。
    - 提交时，响应参数通常经 `doRemoveDefaultFromResponseParams` 清理掉全局默认值字段，以避免多余数据回写；
    - 对参数树的增删改统一使用 `updateNodeById`、`deleteNode`、`cloneWithRandomKey` 等工具函数，避免直接 mutate 破坏结构。
- 表单与校验模式：
  - 使用 @coze-arch/bot-semi 的 Form / UIInput / UISelect / UIFormTextArea 等组件构建表单，结合 I18n.t 文案键，所有错误提示均从 i18n 文案中读取，不写死文字。
  - 参数名/类型输入使用 [src/components/plugin_modal/params-components/form-components.tsx](src/components/plugin_modal/params-components/form-components.tsx) 中的 InputItem、SelectItem 组件：
    - InputItem 通过 `ParamsFormErrorStatus` 与 `paramsFormErrorStatusText` 映射错误状态；
    - 支持 `checkSameName` 去重与 ASCII 校验（IS_OVERSEA 开关条件下）；
    - 根据 `deep` 控制缩进与动态宽度，保证树状参数 UI 效果一致。
  - 基础信息表单逻辑封装在 [src/components/plugin_modal/base-info.tsx](src/components/plugin_modal/base-info.tsx) 的 useBaseInfo：
    - 内部持有 Form ref 与 originDesc，用于在弹窗开启时初始化值；
    - submitBaseInfo 根据是否存在 apiId 决定调用 PluginDevelopApi.CreateAPI 或 UpdateAPI，并处理安全校验失败（ERROR_CODE.SAFE_CHECK）与通用错误 Toast。
- 示例调试与 Debug 组件约定：
  - 查看示例：useViewExample（[src/hooks/example/use-view-example.tsx](src/hooks/example/use-view-example.tsx)）通过 lazy import 加载 [src/components/plugin_modal/debug](src/components/plugin_modal/debug)，只在需要时渲染 Debug 组件；
    - 根据 scene = 'workflow' | 'bot' 选择调用 setWorkflowExampleValue 或 setStoreExampleValue 将 req_example JSON 合并进参数树；
    - 调用 addDepthAndValue 后构造 PluginAPIInfo 再传入 Debug 组件；
    - 对外暴露 { exampleNode, doShowExample }，上层页面负责挂载 exampleNode 并在合适时机触发 doShowExample。
  - 编辑示例：useEditExample（[src/hooks/example/use-edit-example.tsx](src/hooks/example/use-edit-example.tsx)）与 useViewExample 类似，但：
    - 从 usePluginStore 读取当前 pluginInfo；
    - 使用 ExampleModal 组件承载 UI；
    - onSave 时调用外部传入的 onUpdate，再关闭弹窗。
- 设置弹窗控制：
  - useParametersInSettingModalController（[src/hooks/parameters/use-parameters-in-setting-modal-controller.ts](src/hooks/parameters/use-parameters-in-setting-modal-controller.ts)）是「Bot 默认参数设置」的核心：
    - 初始化时调用 PluginDevelopApi.GetBotDefaultParams，根据 botId/devId/pluginId/apiName/space_id 拉取 request_params & response_params；
    - 使用 initParamsDefault + addDepthAndValue 预处理数据后写入本地 state；
    - 通过 doUpdateNodeWithData 封装树节点编辑逻辑，内部依赖 updateNodeById 与 cloneDeep 保持不可变更新；
    - doUpdateParams 调用 PluginDevelopApi.UpdateBotDefaultParams，将 request_params 原样保存，将响应参数经 doRemoveDefaultFromResponseParams 清洗后提交。

## 外部依赖与集成细节

- @coze-arch/bot-api & PluginDevelopApi：
  - 所有后端交互均通过该 SDK 调用，例如：
    - PluginDevelopApi.GetBotDefaultParams / UpdateBotDefaultParams；
    - PluginDevelopApi.CreateAPI / UpdateAPI。
  - 错误处理：
    - useBaseInfo 中通过 ERROR_CODE.SAFE_CHECK 判断安全审查失败并更新外部状态（setShowSecurityCheckFailedMsg）；
    - 其他 API 调用通过 useErrorHandler（@coze-arch/logger）或 Toast.error 处理错误。
- 状态管理：
  - 使用 Zustand 风格的 store hooks，例如 usePluginStore、useSpaceStore：
    - usePluginStore 提供 pluginInfo，用于 ExampleModal 等场景获取 pluginId / pluginName；
    - useSpaceStore.getState().getSpaceId() 获取当前 space_id，避免在 prop 层级层层传递。
  - AI 在本包内不应修改这些 store 的实现，仅通过现有选择器/方法读取更新。
- 其他基础依赖：
  - lodash-es：大量使用 cloneDeep、has、isEmpty、isNumber、isObject 等方法，保持对参数树操作的不可变性与健壮性；
  - nanoid：统一生成参数节点 id，与 ROWKEY 绑定；
  - ahooks：主要使用 useMemoizedFn；
  - @douyinfe/semi-icons / @coze-arch/bot-icons：统一的 Icon 体系；
  - I18n（@coze-arch/i18n）：所有用户可见文案必须使用 I18n.t 调用对应 key，不直接硬编码文案。

## 团队流程与其他注意事项

- 版本与发布：
  - 本包版本号目前为 0.0.1，由仓库统一发布流程（Rush + npm 发布）管理；AI 不应在本地擅自修改 version 字段。
- 分支与提交流程：
  - 具体 Git 流程在仓库根级文档（如 CONTRIBUTING.md）中定义；在本子包内做改动时：
    - 避免大范围重构既有核心工具（如 utils.ts）以免影响多个上层包；
    - 修改对外导出的 API 时，需同步更新所有引用方（bot-plugin entry/export、plugin-setting、plugin-shared、workflow playground 等），否则会出现运行时错误。
- 国际化与多区域：
  - 代码中存在 IS_OVERSEA 等全局变量判断，用于海外版本的 ASCII 校验；编写新逻辑时若涉输入校验，应复用同一判断逻辑，避免区域行为不一致。
- 性能与懒加载：
  - Debug 组件体积较大，通过 React.lazy + Suspense 实现懒加载，仅在真正需要展示示例时加载；新增重量级组件时建议复用此模式。

## AI 编程助手操作建议

- 在编写代码前：
  - 优先阅读 [src/components/plugin_modal/config.ts](src/components/plugin_modal/config.ts) 和 [src/components/plugin_modal/utils.ts](src/components/plugin_modal/utils.ts)，理解参数树结构与默认值处理方式；
  - 再看相关 hooks（useBaseInfo、useViewExample、useEditExample、useParametersInSettingModalController），把握数据流和 API 调用时机。
- 在进行修改/新增时：
  - 若只是在现有 UI 上做小改动，优先复用现有组件（InputItem、SelectItem、InfoPopover 等）和工具方法，不要重复造轮子；
  - 若需要新增导出能力，务必同时更新 package.json 的 `exports` 与 `typesVersions`，并确保路径指向 .ts(x) 源码文件；
  - 修改参数树结构相关逻辑时，必须保持 ROWKEY、sub_parameters 等关键字段名不变，且通过工具函数进行变更，避免破坏上游依赖的假设。
- 在提交前：
  - 至少在本包目录执行 `npm run lint` 与 `npm test`，保证无类型/语法/单测错误；
  - 若改动影响其他包（如对导出 API 的变更），建议在这些包中运行对应页面或测试进行端到端验证。