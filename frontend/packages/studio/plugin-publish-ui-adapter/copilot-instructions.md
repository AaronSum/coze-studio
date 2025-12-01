# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/plugin-publish-ui-adapter）中安全、高效地协作开发。

## 全局架构与职责

- 本包是「插件发布 UI 业务逻辑」的适配层，对外提供一个业务级弹层组件 BizPluginPublishPopover，供 Studio 侧在不同页面中复用统一的插件发布流程。
- 入口为 [frontend/packages/studio/plugin-publish-ui-adapter/src/index.ts](frontend/packages/studio/plugin-publish-ui-adapter/src/index.ts)，仅导出：
  - BizPluginPublishPopover
  - BizPluginPublishPopoverProps
- 主要组件与文件：
  - [components/plugin-publish-ui/index.tsx](frontend/packages/studio/plugin-publish-ui-adapter/src/components/plugin-publish-ui/index.tsx)：
    - 定义 BizPluginPublishPopover 组件，封装获取下一版本号、提交发布请求、成功/失败反馈和跳转逻辑。
    - 使用 Popover 作为外层容器，内部内容为 PluginPublishUI。
  - [components/plugin-publish-ui/base.tsx](frontend/packages/studio/plugin-publish-ui-adapter/src/components/plugin-publish-ui/base.tsx)：
    - 定义纯 UI 组件 PluginPublishUI，负责渲染版本号/版本说明表单和发布按钮，并通过回调暴露表单值。
  - [components/plugin-publish-ui/version-description-form.tsx](frontend/packages/studio/plugin-publish-ui-adapter/src/components/plugin-publish-ui/version-description-form.tsx)：
    - 使用 Coze Design 的 Form 构建版本号(version_name)和版本说明(version_desc)表单，字段类型依据后端 IDL PublishPluginRequest 定义。
- 数据流（发布流程）概览：
  1. 上层业务传入 pluginId、spaceId、pluginInfo 等参数，渲染 BizPluginPublishPopover。
  2. BizPluginPublishPopover 在 isInLibraryScope 条件满足时，通过 PluginDevelopApi.GetPluginNextVersion 获取下一版本号，作为 VersionDescForm 的初始值。
  3. 用户在 PluginPublishUI 中填写版本号与说明，点击发布按钮后，PluginPublishUI 将表单值回调给 BizPluginPublishPopover。
  4. BizPluginPublishPopover 通过 PluginDevelopApi.PublishPlugin 调用后端发布接口，成功后：
     - 调用 onPublishSuccess 回调通知上层。
     - 通过 Toast.success 提示「发布成功」文案（I18n.t('Plugin_publish_update_toast_success')）。
     - 调用 usePluginNavigate 提供的 resourceNavigate.toResource('plugin') 跳转到插件列表或详情页。
     - 刷新下一版本号。
  5. 失败时，通过 logger.persist.error 上报 fail_to_publish_plugin 事件，同时保持弹层打开供用户修改重试。

## 构建、测试与基础设施

- 本包是 Rush monorepo 的一个 workspace 子包，基础配置：
  - package 名：@coze-studio/plugin-publish-ui-adapter。
  - 入口 main：src/index.ts（源码入口，真实打包由上层构建系统处理）。
  - 许可证：Apache-2.0。
- npm 脚本（在本子包目录执行）：
  - build：`exit 0`，当前为占位实现，**不要在本包内引入独立打包流程**，构建通常由上层统一工具链（Rsbuild/Vite/Rspack 等）完成。
  - lint：`eslint ./ --cache`，配置位于 [frontend/packages/studio/plugin-publish-ui-adapter/eslint.config.js](frontend/packages/studio/plugin-publish-ui-adapter/eslint.config.js)，preset 为 `web`，继承 @coze-arch/eslint-config。
  - test：`vitest --run --passWithNoTests`，Vitest 配置在 [frontend/packages/studio/plugin-publish-ui-adapter/vitest.config.ts](frontend/packages/studio/plugin-publish-ui-adapter/vitest.config.ts)，通过 @coze-arch/vitest-config 统一管理（preset: 'web'）。
  - test:cov：在 test 基础上追加 `--coverage` 覆盖率统计。
- TypeScript：
  - [tsconfig.json](frontend/packages/studio/plugin-publish-ui-adapter/tsconfig.json) 仅作为 composite 根，真正编译配置在 tsconfig.build.json 与 tsconfig.misc.json 中（未在此文件列表中展示，但遵循其它前端子包的同一模式）。
  - tsconfig.json 中 `exclude: ["**/*"]`，意味着编译入口由 references 控制，**不要直接在 tsconfig.json 中改 include 逻辑**，如需调整编译范围，应编辑 tsconfig.build.json / tsconfig.misc.json。

## 依赖与集成细节

- 业务与后端 API：
  - PluginDevelopApi 来自 @coze-arch/bot-api，当前在 BizPluginPublishPopover 中使用两个接口：
    - GetPluginNextVersion：输入 space_id 与 plugin_id，返回 next_version_name，用于作为初始版本号；调用通过 ahooks.useRequest 管理，ready 条件为 isInLibraryScope。
    - PublishPlugin：输入 plugin_id 与版本表单值(version_name、version_desc)，完成实际发布。
  - 发布表单值类型依据 @coze-arch/idl/plugin_develop 中的 PublishPluginRequest，通过 `Pick<PublishPluginRequest, 'version_desc' | 'version_name'>` 约束，确保与后端 IDL 一致。
- 路由与跳转：
  - usePluginNavigate 来自 @coze-studio/bot-plugin-store，BizPluginPublishPopover 成功发布后调用 `resourceNavigate.toResource?.('plugin')` 进行插件页跳转；
  - 上层如需改变跳转策略，应在 bot-plugin-store 中扩展该导航能力，而不是在本包中手写路由逻辑。
- UI 组件与样式：
  - 所有 UI 基于 @coze-arch/coze-design：
    - Popover：承载发布表单弹出层，使用 `trigger="custom"` 并由 visible/onClickOutSide 完全受控于上层。
    - Toast：展示发布结果提示。
    - Form、Form.Input、Form.TextArea、Button：用于版本信息表单和发布按钮。
  - 当前组件本身不包含单独样式文件，仅通过 className（如 `w-[400px] px-20px pt-16px pb-20px`、`w-full mt-16px`）使用 Tailwind 工具类统一布局样式。
- 国际化与日志：
  - 文案通过 I18n.t：
    - plugin_publish_form_version
    - plugin_publish_form_version_desc
    - Plugin_publish_update_toast_success
  - 错误上报通过 @coze-arch/logger 的 logger.persist.error：
    - eventName：'fail_to_publish_plugin'
    - error：后端返回的异常对象。

## 关键组件与模式

### BizPluginPublishPopover（业务适配层）

- 定义位置：
  - [components/plugin-publish-ui/index.tsx](frontend/packages/studio/plugin-publish-ui-adapter/src/components/plugin-publish-ui/index.tsx)
- 主要 Props：
  - pluginId：待发布插件的唯一标识，对应后端 plugin_id。
  - spaceId：当前空间 ID，用于 GetPluginNextVersion；可能为 undefined。
  - isPluginHasPublished：当前插件是否已发布，**目前代码中未直接使用**，上层可基于此属性决定是否渲染该弹层或控制交互。
  - visible：Popover 对外受控显示状态。
  - onClickOutside：点击弹层外区域时触发，通常用于关闭弹层。
  - onPublishSuccess：发布成功回调，由上层决定后续行为（如刷新列表、关闭弹层等）。
  - pluginInfo：来自 @coze-studio/plugin-shared 的插件信息结构，当前组件内部未使用，为未来拓展（如在弹层中展示插件名/图标）预留。
  - isInLibraryScope：控制是否在「插件库」域中，决定是否 ready 获取 nextVersionName。
- 行为特征：
  - useRequest 获取 nextVersionName：
    - 当 isInLibraryScope 为 true 且 spaceId 存在时自动请求；
    - 刷新函数 refreshNextVersionName 在发布成功后调用，以便用户可继续发布新版本。
  - useRequest 发布：
    - manual: true，由 PluginPublishUI 的 onClickPublish 触发；
    - loading 状态透传到发布按钮。
  - 错误处理：onError 仅日志上报，不做 UI 提示，业务侧需要在上层决定是否增加错误反馈（例如通过外部 Toast/error banner）。

### PluginPublishUI（通用发布 UI）

- 定义位置：
  - [components/plugin-publish-ui/base.tsx](frontend/packages/studio/plugin-publish-ui-adapter/src/components/plugin-publish-ui/base.tsx)
- 主要 Props：
  - onClickPublish：点击「发布」时调用，参数为 { versionDescValue }，其中 versionDescValue 为 VersionDescFormValue。
  - className/style：外层容器样式，便于调用方在不同弹层或容器中复用。
  - publishButtonProps：透传到 Button，用于配置 loading/类型等，但不允许覆盖 className/disabled/onClick。
  - initialVersionName：初始版本号，通常来自 GetPluginNextVersion。
- 内部逻辑：
  - 使用 useRef 存储 FormApi，以便按钮点击时获取最新表单值（versionValues = formApi.getValues()）。
  - 使用 useState 缓存表单变动的快照 versionFormValues，用于计算按钮 disabled 状态：
    - getIsSubmitDisabled 判定 version_name/version_desc 是否为空或仅空白；为 true 时禁用按钮。
  - VersionDescForm 通过 onValueChange 将 cloneDeep 后的值写入本地状态，避免引用共享导致潜在副作用。

### VersionDescForm（版本信息表单）

- 定义位置：
  - [components/plugin-publish-ui/version-description-form.tsx](frontend/packages/studio/plugin-publish-ui-adapter/src/components/plugin-publish-ui/version-description-form.tsx)
- 类型与字段：
  - VersionDescFormValue = Pick<PublishPluginRequest, 'version_desc' | 'version_name'>。
  - versionDescFormFiledMap 将字段名映射为自身，方便统一引用。
- 表单实现：
  - 使用 `<Form<VersionDescFormValue>>` 泛型保证字段类型安全；
  - `<Form.Input>`：
    - field: 'version_name'
    - label: I18n.t('plugin_publish_form_version')
    - rules: required
    - maxLength: 40
  - `<Form.TextArea>`：
    - field: 'version_desc'
    - label: I18n.t('plugin_publish_form_version_desc')
    - rules: required
    - maxLength: 800
  - noErrorMessage: true，意味着错误提示由上层自定义（例如 Button disabled），Form 自身不显示错误文本。

## 项目约定与编码规范

- 语言与框架：
  - 使用 React 18 函数组件与 TypeScript，所有导出组件和类型均有显式类型标注。
  - 组件文件统一使用 .tsx 后缀，逻辑辅助函数可放在同文件或未来拆分 utils 文件。
- 代码风格：
  - ESLint preset 为 `web`，依赖 @coze-arch/eslint-config；新增代码应尽量满足现有规则，避免随意增加 eslint-disable。
  - 引入 lodash-es 时使用按需导入（如 `import { cloneDeep } from 'lodash-es';`），保持 tree-shaking 友好。
- Props 与回调约定：
  - 业务交互（如发布结果响应）统一通过回调向上传递（onPublishSuccess、onClickOutside），不在本包内修改全局状态或路由。
  - onClickPublish/onPublishSuccess 等回调不处理错误提示逻辑，由上层决定是否增加更多反馈。
- 国际化：
  - 所有文案需通过 I18n.t 获取；新增字段时，先在对应 i18n 资源文件中新增 key，再在组件中引用。

## 与其他子包的协作关系

- 与 @coze-studio/plugin-shared：
  - BizPluginPublishPopover 接收 pluginInfo: PluginInfoProps，目前未使用，未来可能用于展示插件名称/图标或进行权限控制；若要使用，应在本包中以 UI 展示或透传到下层组件，而不在此处修改 pluginInfo 结构。
- 与 @coze-studio/bot-plugin-store：
  - usePluginNavigate 提供插件资源路由封装；本包只调用 toResource('plugin')，不关心具体路由路径。
  - 如果未来需要跳转到指定插件详情，可在 bot-plugin-store 中新增更具体的导航 API，再在 BizPluginPublishPopover 中调用。
- 与 @coze-arch 体系：
  - bot-api/idl 定义接口与请求类型，本包严格使用这些类型定义参数；修改后端接口时，需要同步更新 IDL 包，再调整本包的类型使用。
  - logger/i18n/coze-design 构成基础设施层，本包仅作为调用方，不应在此层实现新日志策略或国际化策略。

## 非常规点与注意事项

- build 脚本为 no-op：
  - `npm run build` 当前不会产出构建结果，所有打包行为由上层统一工具执行；在本包内添加额外 bundler 或输出目录，容易与整体构建流程冲突，应避免。
- isPluginHasPublished 未被使用：
  - BizPluginPublishPopoverProps 中的 isPluginHasPublished 目前没有参与逻辑分支；在扩展功能（例如已发布状态下显示「更新版本」文案）时，可以基于该字段调整 UI，但需保持向后兼容。
- 错误反馈策略：
  - onError 仅做 logger.persist.error 上报，不显示 Toast 或文案；如果需要用户可见的错误提示，建议在 BizPluginPublishPopover 中补充 Toast.error 或在上层统一处理；修改前应确认团队统一策略。
- 表单提交校验：
  - 版本号/版本说明必填校验通过两层保证：Form 规则与 Button disabled 判断；Form 规则在无错误信息展示时主要用于防止空提交（getValues 时仍可能返回空字符串），调用方需要确保在请求前二次校验（当前通过 getIsSubmitDisabled 基本满足要求）。

## 对 AI 编程助手的建议

- 如需扩展发布流程（例如增加「是否上架市场」之类的勾选）：
  - 优先在 VersionDescForm 中新增字段与类型定义，并在 PublishPluginRequest 中确认后端字段；
  - 更新 PluginPublishUI 的 VersionDescFormValue 与 getIsSubmitDisabled 逻辑；
  - 在 BizPluginPublishPopover 的 PublishPlugin 调用中追加对应字段，保持与后端契约一致。
- 如需在其它页面中使用相同发布 UI：
  - 直接复用 BizPluginPublishPopover，或在上层再包一层业务组件；不要在业务包中复制 base.tsx/version-description-form.tsx 代码。
- 修改对外导出时：
  - 所有新增组件或类型应通过 [src/index.ts](frontend/packages/studio/plugin-publish-ui-adapter/src/index.ts) 导出；
  - 避免破坏现有导出名称或类型签名，除非已审查所有引用点并规划好迁移步骤。
