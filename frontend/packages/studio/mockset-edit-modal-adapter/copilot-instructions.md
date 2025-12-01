# 子包协作开发说明（@coze-studio/mockset-edit-modal-adapter）

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/mockset-edit-modal-adapter）中安全、高效地协作开发。

## 全局架构与定位

- 本子包是一个 React 18 组件适配层，核心导出位于 src/index.ts，向上层暴露 MockSetEditModal 组件、builtinSuccessCallback 和 MockSetEditModalProps 类型。
- 组件实现集中在 src/components/mockset-edit-modal/index.tsx，通过 @coze-arch/bot-semi 的 UIModal、Form、UIFormTextArea 等 UI/表单组件完成弹窗与表单交互。
- 数据与业务依赖来源于工作区级别包：
  - @coze-arch/bot-api：提供 debuggerApi.SaveMockSet 调用以及 MockSet、SpaceType 等类型和常量；
  - @coze-arch/bot-studio-store：提供 useSpaceStore 获取当前空间信息（判断个人/团队空间）；
  - @coze-arch/bot-tea：提供埋点常量 EVENT_NAMES、埋点参数类型 ParamsTypeDefine、枚举 PluginMockDataGenerateMode 以及 sendTeaEvent 事件上报能力；
  - @coze-arch/i18n：提供 I18n.t 文案国际化能力；
  - @coze-studio/bot-utils：提供 withSlardarIdButton 将错误文案包装为带埋点的按钮；
  - @coze-studio/mockset-shared：承载 mock 集合共享逻辑（环境、插件信息、业务上下文、错误码等）。
- 样式采用 CSS Modules：src/components/mockset-edit-modal/index.module.less，仅通过 styles['mockset-create-form'] 这类类名挂载到根 Form 容器，避免样式泄漏。
- 整体作为“适配器”定位：将底层 API / 埋点 / 业务上下文封装进语义清晰的 MockSetEditModal 组件，供上层 Studio 或 IDE 页面按需挂载。

## 关键数据流与交互流程

- 对外 Props（MockSetEditModalProps）：
  - visible/zIndex：控制弹窗显隐与层级；
  - disabled：只读查看模式，将输入区转为 Form.Slot + 文本展示；
  - initialInfo：EditMockSetInfo（继承 BasicMockSetInfo，增加 id/name/desc/autoGenerate），作为表单初始值；
  - onSuccess：保存成功时回调，传出 MockSet 以及可选 config.generateMode；
  - onCancel：点击关闭时回调；
  - needResetPopoverContainer：控制 UIModal.getPopupContainer 是否固定到 document.body，避免父级 overflow 场景下弹层被裁剪。
- 打开态时，Form 初始化逻辑：
  - 若 initialInfo.id 不存在，则视为创建模式（isCreate），表单初始值在 initialInfo 基础上为 name 自动生成一个随机名称（getRandomName）；
  - 若存在 id，则视为编辑模式，直接填充 initialInfo。
- 表单字段验证规则（mockSetInfoRules）：
  - name：必填；根据 IS_OVERSEA 选择不同的正则表达式：
    - 海外：仅允许 \w 和空格，报错文案 create_plugin_modal_nameerror；
    - 国内：额外允许中文 \u4e00-\u9fa5，报错文案 create_plugin_modal_nameerror_cn；
  - desc：仅在 IS_OVERSEA 为 true 时做 ASCII 字符校验，国内环境不做额外校验（但有长度限制）。
- 提交主流程（handleSubmit）：
  - 从表单值中抽取 id/name/desc/bindSubjectInfo/bizCtx；
  - 调用 getPluginInfo(bizCtx, bindSubjectInfo) 获取当前插件/空间维度的 toolID、spaceID；
  - 组装 basicParams（ParamsTypeDefine[EVENT_NAMES.create_mockset_front]）：环境、workspace、tool_id、mock_set_id 等基础埋点参数；
  - 调用 debuggerApi.SaveMockSet：
    - 入参：name、description、mockSubject（由 getMockSubjectInfo 派生）、bizCtx、id（无 id 时使用 '0' 视为创建）；
    - options：{ __disableErrorToast: true }，表示统一由本组件自行处理错误提示；
  - 成功：
    - 调用 onSuccess?.({ id, name, description: desc }) 通知上层；
    - sendTeaEvent(EVENT_NAMES.create_mockset_front, {...basicParams, status: 0, mock_set_id: String(id)}) 上报成功埋点；
  - 失败：
    - 解析 e 中的 msg/code，并构造 reportParams；
    - 若 code 为 MOCK_SET_ERR_CODE.REPEAT_NAME：
      - formApiRef.current?.setError('name', I18n.t('name_already_taken')) 在表单上展示“重名”错误；
      - sendTeaEvent(EVENT_NAMES.create_mockset_front, {...reportParams, error_type: 'repeat_name'});
    - 其他错误：
      - UIToast.error({ content: withSlardarIdButton(msg) }) 弹出错误提示，并附带可追踪的按钮；
      - sendTeaEvent(EVENT_NAMES.create_mockset_front, {...reportParams, error_type: 'unknown'})。
- 内置成功回调（builtinSuccessCallback）：
  - 仅做 UIToast.success(I18n.t('created_mockset_please_add_mock_data'))；
  - 上层通常可组合使用：调用方先传给 onSuccess，或在外层自行串联。

## 构建、测试与运行工作流

- 包级别命令定义在 package.json：
  - lint：`rushx lint` 或在包内执行 `npm run lint`（脚本为 `eslint ./ --cache`），依赖 @coze-arch/eslint-config；
  - test：`rushx test` 或 `npm run test`，底层是 `vitest --run --passWithNoTests`，默认使用 @coze-arch/vitest-config；
  - test:cov：`npm run test:cov`，在 test 基础上追加 `--coverage` 并使用 @vitest/coverage-v8；
  - build：当前脚本为 `exit 0`，构建由统一的前端构建系统/上层包负责（例如 rollup/vite 构建 library），本子包只提供源码入口（main 指向 src/index.ts）。
- 推荐在仓库根目录执行前置命令：
  - 初始化依赖：在 frontend 目录运行 `rush update`（见 frontend/README.md 和 rushx-config.json 约定）；
  - 在项目级别通过 `rushx <command>` 调用统一脚本，以确保环境与配置一致。
- Storybook：本包带有 .storybook/main.js 与 .storybook/preview.js，遵循工作区统一的 Storybook 配置；可通过上层统一命令运行 storybook，而不是在该包单独维护命令。

## 代码风格与约定

- 语言与框架：
  - 使用 TypeScript + React 18 + JSX/TSX，遵循 @coze-arch/ts-config 约束；
  - 样式使用 Less + CSS Modules（.module.less）。
- ESLint & Stylelint：
  - 根目录存在 eslint.config.js、.stylelintrc.js，继承自工作区统一配置；
  - 部分规则通过文件顶部注释禁用，如 @coze-arch/max-line-per-function、no-control-regex 等，仅在确有必要时关闭。
- 类型约定：
  - 对外 props、重要业务数据均通过显式 interface/type 定义，如 EditMockSetInfo、MockSetEditModalProps；
  - 依赖包导出的类型（RuleItem、FormApi、MockSet 等）直接使用 type import 形式，减少运行时代码体积。
- 表单与校验：
  - 表单统一使用 @coze-arch/bot-semi 的 Form 组件，并通过 getFormApi 获取 FormApi 引用用于 setError/setValue 等 imperative 操作；
  - rules 使用 I18n.t 的 key，而非直接硬编码文案，保证多语言支持；
  - onBlur 时统一对 name/desc 执行 trim 操作，避免首尾空格带来的校验与后端不一致问题。
- 埋点与监控：
  - 埋点事件使用 @coze-arch/bot-tea 的 EVENT_NAMES 枚举和 ParamsTypeDefine 类型，保证事件名称与参数结构的强类型约束；
  - 所有埋点都需要在成功和失败分支中显式设置 status 与 error_type，便于后续分析；
  - UIToast 与 withSlardarIdButton 结合使用，用于将错误内容与 Slardar 埋点串联起来。

## 与外部模块的集成细节

- @coze-arch/bot-api：
  - debuggerApi.SaveMockSet 是保存 mock 集合的唯一后端入口，调用时传入 mockSubject（来源于 getMockSubjectInfo）、bizCtx 等上下文信息；
  - SpaceType.Personal 用于判断当前空间是否为“个人空间”，从而影响 workspace_type 上报值（personal_workspace 或 team_workspace）。
- @coze-studio/mockset-shared：
  - BasicMockSetInfo：封装基础 mockSet 业务字段，EditMockSetInfo 在其基础上追加 UI 级别字段（id/name/desc/autoGenerate）；
  - getEnvironment：返回当前运行环境（如 prod/stage/local），直接用于埋点参数 environment；
  - getPluginInfo：根据 bizCtx 与 bindSubjectInfo 推导出 toolID 与 spaceID；
  - getMockSubjectInfo：将前端绑定主体信息转换为后端所需 mockSubject 结构；
  - MOCK_SET_ERR_CODE：枚举后端错误码，当前组件仅使用 REPEAT_NAME；如需扩展错误分支，请在这里同步维护。
- @coze-arch/bot-studio-store：
  - useSpaceStore(s => s.space.space_type) 是获取空间类型的标准方式，不要自行从其他地方取值，以免与全局 store 不一致。
- @coze-arch/bot-semi：
  - Form、UIModal、UIFormTextArea 组件行为与 Semi Design 家族保持一致，但封装了统一的主题和交互差异；
  - 表单 className 建议继续挂载在根 Form 或 Form.Slot 上，以便样式作用域可控。
- @coze-arch/i18n：
  - I18n.t(key) 依赖于上层已注入的国际化上下文，本包不直接初始化 i18n，仅约定 key 与业务语义；
  - 新增文案时请同步更新对应 i18n 资源包，而不是写死字符串。

## 开发流程与协作规范

- 分支与提交：
  - 本仓库遵循统一的 Git 流程（在根级 CONTRIBUTING.md 中说明），本子包不额外定义独立分支策略；
  - 修改该包时应保持变更原子性，避免一次提交修改多个无关子包。
- 与其他子包协作：
  - 所有对 mockSet 能力的封装均应优先下沉到 @coze-studio/mockset-shared 中，再由本适配层组合使用；
  - 若需要扩展埋点字段或事件，请先在 @coze-arch/bot-tea 侧定义常量与类型，再在本包中引用，避免魔法字符串；
  - 若新增 UI 形态（例如新增输入项、切换为步骤条等），请优先复用 @coze-arch/bot-semi 的现有组件和交互规范。
- Storybook/文档：
  - 可在 .storybook 下为 MockSetEditModal 增加/维护 story，用于交互验证与回归；
  - README.md 提供包层级的简要说明，若增加重要功能，建议同步补充使用说明或示例代码。

## 扩展与修改建议（针对 AI 助手）

- 在修改 handleSubmit 逻辑时：
  - 必须保持成功与失败两个分支的埋点都被触发，并正确设置 status 与 error_type；
  - 不要吞掉 debuggerApi.SaveMockSet 抛出的 msg/code 信息，至少需要将 msg 透传给 UIToast 或日志。
- 在调整表单字段时：
  - 若新增字段，请考虑是否需要加入 EditMockSetInfo，并在 initValues、rules 与后端 SaveMockSet 入参中同步；
  - 注意 disabled 模式下需有只读展示分支（Form.Slot），避免在详情查看场景中出现输入框。
- 在引入新依赖时：
  - 优先查找 workspace 内是否已有同类封装（例如 bot-semi/bot-utils 族），避免平行引入第三方库；
  - 如确需新增 npm 包，请更新 package.json 并保证与 monorepo 版本策略一致（通常使用 workspace:* 或统一 semver）。
