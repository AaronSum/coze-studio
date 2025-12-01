# @coze-foundation/account-ui-base 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/account-ui-base）中安全、高效地协作开发。

## 1. 子包定位与整体职责

- 本包是账号体系的通用 UI 基座，主要提供「账号登录状态管理 UI」和「账号设置 / 个人资料编辑 UI」相关的可复用 React 组件与 hooks。 
- 典型调用方是 Studio 前端子应用（如工作台 / 编辑器等），在这些应用中统一挂载：
  - 登录态遮罩与异常提示：RequireAuthContainer、LoadingContainer。
  - 账号信息面板：UserInfoPanel。
  - 账号设置弹窗与 Tab 容器：useAccountSettings。
  - 退出登录逻辑：useLogout。
- 「业务逻辑」（鉴权、用户信息拉取/更新、登出等）全部来自其他 workspace 包（如 @coze-foundation/account-adapter、@coze-studio/user-store、@coze-arch/bot-api 等），本包只负责 UI 组织和交互编排。

## 2. 目录结构与架构概览

源码根目录在 src：

- src/index.ts
  - 出口统一 re-export：
    - useLogout
    - RequireAuthContainer
    - LoadingContainer
    - UserInfoPanel
    - useAccountSettings
  - 新增对外能力时，务必在此集中导出以保持对外 API 稳定。

- src/components/
  - loading-container.tsx
    - 提供全屏加载中容器，使用 @coze-arch/bot-semi 的 Spin 组件，默认占满父容器（w-full h-full flex items-center justify-center）。
    - 依赖外层容器约定：通常覆盖在页面主要区域，CSS 通常配合绝对定位蒙层使用。
  - require-auth-container/
    - index.tsx
      - 暴露 RequireAuthContainer 组件，用于在需要登录的区域外层包裹一层「登录检测 + loading + 错误态」蒙层。
      - 内部 LoginCheckMask 利用来自 @coze-foundation/account-adapter 的 useLoginStatus / useHasError / checkLogin：
        - needLogin && hasError：展示错误文案 + Retry 按钮，点击触发 checkLogin。
        - needLogin && !loginOptional && !logined：展示 LoadingContainer（等待登录状态确认）。
        - 其他情况：不渲染任何蒙层，直接展示 children。
  - user-info-panel/
    - index.tsx
      - UserInfoPanel：账号个人信息编辑主面板，包括用户名、昵称、邮箱、密码、语言等字段，以及头像上传。
      - 强依赖 @coze-studio/user-store 提供的 userStoreService.useUserInfo() 获取当前用户，统一从 userInfo 中派生本地 state（nickname, username, avatar, lang 等）。
      - 所有变更行为通过 @coze-foundation/account-adapter 暴露的 passportApi 以及 @coze-arch/bot-api 的 DeveloperApi.UpdateUserProfileCheck 完成。
      - 埋点通过 @coze-arch/report-events 的 createReportEvent + REPORT_EVENTS.* 实现，分别记录更新开始/成功/失败原因。
      - 通过 @coze-arch/bot-semi 的 Form 与 @coze-arch/coze-design 的 Input/Select/Toast 组合实现表单 UI 和反馈。
      - 使用 index.module.less + classNames 组合 Tailwind 类和本地样式。
    - password-field.tsx, user-info-field.tsx, username-input/
      - 这些文件封装了具体的字段展示与编辑交互，是 UserInfoPanel 的 UI 颗粒度子组件，遵循「展示 + 内嵌编辑 entry + 保存/取消回调」模式。

- src/hooks/
  - logout.tsx
    - useLogout Hook：返回 { open, close, node }，其中 node 是一个 Modal JSX 元素，open/close 控制其可见性。
    - Modal 来自 @coze-arch/coze-design，文案全部通过 I18n.t() 获取（log_out_desc、basic_log_out、Cancel）。
    - 点击确认时调用 @coze-foundation/account-adapter 提供的 logout()，成功后跳转到根路径 '/'（通过 react-router-dom 的 useNavigate）。
    - 典型用法：
      - const { node, open } = useLogout();
      - 页面布局中渲染 {node}，退出按钮 onClick 调用 open()。
  - use-account-settings/
    - use-modal.tsx
      - useModal Hook：对 @coze-arch/coze-design/Modal 的简单封装，将 ModalProps（不含 visible）与内部 visible state 绑定，返回 { modal, open, close }。
      - modal(inner) 负责根据 visible 渲染 Modal + children，供上层组合自定义内容。
    - index.tsx
      - useAccountSettings Hook：构造「账号设置」弹窗的 Tab 布局与内容区域。
      - 入参：{ tabs: Array<TabItem | 'divider'>; onClose?: () => void }。
      - tabs 支持 'divider' 特殊项，会在左侧 UITabBar 中渲染一条不可点击的分隔线；普通 TabItem 含 id / tabName / content(close?) => ReactElement。
      - 内部基于 useModal 创建一个居中、大尺寸、支持渐变 mask 的 Modal 外壳（样式来自 index.module.less）。
      - 返回：
        - node：包含 Modal 和当前激活 Tab 的内容；调用方应在顶层 JSX 中直接渲染。
        - open(tabId?)：打开弹窗，并可选指定默认选中的 tab id。
        - close()：关闭弹窗。

## 3. 关键数据流与跨包依赖

### 3.1 登录态与鉴权状态

- 鉴权信息不在本包内部维护，全部由 @coze-foundation/account-adapter + @coze-studio/user-store 提供：
  - useLoginStatus：返回 'logined' / 其他状态，用于 RequireAuthContainer 控制是否展示 LoadingContainer 及 children。
  - useHasError：用于判断最近一次登录状态检查是否失败。
  - checkLogin：手动触发一次登录状态检查，用于 Retry 场景。
- UserInfoPanel 中的用户信息（name、email、avatar_url、locale 等）来自 userStoreService.useUserInfo()，刷新机制：
  - 组件挂载与卸载时分别调用 refreshUserInfo()，保证进入和离开面板时用户信息最新。
  - 当保存成功时，不直接修改 store，而是依赖后台返回 + refreshUserInfo() 进行二次同步。

### 3.2 用户信息更新与校验

- 昵称、语言、密码、用户名等字段更新全部通过 passportApi：
  - updateUserProfile({ name }) / updateUserProfile({ locale }) / updateUserProfile({ user_unique_name })。
  - updatePassword({ password, email })。
- 用户名校验使用两层机制：
  - 本地 RegExp 校验：usernameRegExpValidate(value)，返回错误信息字符串或 undefined；如有本地错误，立即显示、取消后续远程校验。
  - 远程唯一性校验：
    - 利用 ahooks/useRequest + debounce（CHECK_USER_NAME_DEBOUNCE_TIME=1000ms）包装 DeveloperApi.UpdateUserProfileCheck。
    - onBefore / onSuccess / onError / onFinally 中配合 updateProfileCheckEvent 记录埋点，按服务端错误信息设置 userNameErrorInfo。

### 3.3 埋点与异常上报

- 通过 @coze-arch/report-events：
  - createReportEvent({ eventName: REPORT_EVENTS.editUserProfile }) -> updateProfileEvent。
  - createReportEvent({ eventName: REPORT_EVENTS.updateUserProfileCheck }) -> updateProfileCheckEvent。
- 所有对 passportApi / DeveloperApi 的调用前后都调用 .start() / .success() / .error({ error, reason }) 记录行为与失败信息。

### 3.4 UI 与国际化

- 视觉与交互组件主要来自：
  - @coze-arch/coze-design：Modal, Input, Select, Toast, Typography, Space, icons。
  - @coze-arch/bot-semi：Spin, Form, UITabBar, UIButton, Divider 等。
- 文案一律通过 @coze-arch/i18n 的 I18n.t(key) 获取，不在组件内部硬编码具体文案文本。
- 语言切换：
  - 将选中的语言写入 localStorage.i18next，en-US 映射为 en，其余保持原值。
  - 成功后通过 window.location.reload() 进行全局刷新，使 i18n 配置生效。

## 4. 开发与测试工作流

### 4.1 构建与类型配置

- 本包 TS 配置采用多 tsconfig 结构：
  - tsconfig.json
    - 仅作为 solution-level 配置，exclude: ["**/*"], references 指向 tsconfig.build.json 与 tsconfig.misc.json，方便 Rush/TS 增量编译。
  - tsconfig.build.json
    - extends: @coze-arch/ts-config/tsconfig.web.json。
    - compilerOptions：
      - rootDir: src, outDir: dist。
      - jsx: react-jsx, lib: [DOM, ESNext]。
      - module: ESNext, target: ES2020, moduleResolution: bundler。
      - tsBuildInfoFile: dist/tsconfig.build.tsbuildinfo。
    - include: ["src"], exclude: ["node_modules", "dist"]。
    - references：列出依赖 workspace 包的 tsconfig.build.json，确保 TS 项目引用链完整（account-adapter, bot-api, bot-http, i18n, user-store 等）。
  - tsconfig.misc.json
    - 用于测试/Storybook 相关 TS 校验，包含 __tests__/vitest.config.ts/stories 等。

- package.json 中 build 命令当前为 "build": "exit 0"，说明真实构建由上层 Rush / 构建工具统一处理：
  - 在子包内通常不单独执行 npm run build。
  - 统一由根目录脚本（如 rushx build 或上层构建 pipeline）触发。

### 4.2 测试

- 使用 Vitest 进行单元测试，配置文件为 vitest.config.ts：
  - 通过 @coze-arch/vitest-config 的 defineConfig({ dirname: __dirname, preset: 'web' }) 统一继承组织级默认配置（包含 jsdom 环境、别名等）。
- 常用命令：
  - npm test / npm run test：执行 vitest --run --passWithNoTests。
  - npm run test:cov：在 test 基础上附加 --coverage，使用 @vitest/coverage-v8。
- 测试约定：
  - 测试文件应放在 __tests__ 目录或与组件同级（遵循全局约定）；tsconfig.misc.json 已将 __tests__ 纳入 include。

### 4.3 Lint 与样式

- Lint：
  - npm run lint：eslint ./ --cache，配置来自 workspace 共享包 @coze-arch/eslint-config，需遵守已有规则（如 @coze-arch/max-line-per-function 等）。
- 样式：
  - 样式文件为 .module.less，配合 CSS Modules 使用；少量使用 Tailwind 类直接在 JSX 上添加（className="flex ..."）。
  - 组织级 stylelint 配置来自 @coze-arch/stylelint-config。

## 5. 项目特有模式与约定

### 5.1 Hook 返回模式：{ node, open, close }

- useLogout 与 useAccountSettings 均采用统一的 Hook 输出结构：
  - node：内部已经绑定状态的 JSX 片段（通常是 Modal），应当直接挂到页面 JSX 树中一次。
  - open：将内部 visible 设为 true 并执行必要逻辑（如可选切换 tab）。
  - close：关闭弹窗或对话框。
- 扩展新的弹窗 Hook 时，建议遵循此返回结构，以方便在页面中统一管理：
  - const { node, open } = useXxxModal(...);
  - return <>{node}<Button onClick={open} /></>。

### 5.2 登录态蒙层模式

- RequireAuthContainer 的使用模式：
  - 外层：<RequireAuthContainer needLogin loginOptional={false}> children... </RequireAuthContainer>。
  - 策略：
    - 有错误且需要登录 -> 显示 ErrorContainer（包含 Retry 按钮）。
    - 必须登录但当前未登录 -> 显示 LoadingContainer。
    - 其他情况 -> 不阻挡 children 渲染。
- 该模式在多个页面应统一复用，而不要自行复制 loginStatus 判断逻辑，以集中维护。

### 5.3 用户信息编辑的交互约定

- UserInfoPanel 对单字段编辑遵循以下流程：
  - 点击某字段进入编辑态，展示自定义输入组件（如 WrappedUsernameInput / WrappedInputWithCount / WrappedSelectInput / WrappedPasswordInput）。
  - onChange 仅修改本地 state；onSave 才发起接口调用（updateUserProfile / updatePassword）。
  - onCancel 统一调用 onUserInfoFieldCancel：刷新用户信息并重置错误状态。
  - 用户名字段特殊处理：编辑过程中实时本地校验 + 去抖远程校验；若本地/远程校验失败则不触发保存接口。

## 6. 集成与使用示例（高层视角）

以下仅给出模式，具体文件路径由上层应用决定：

- 登录态保护：
  - 在需要登录的区域外层包裹：
    - <RequireAuthContainer needLogin loginOptional={false}> main content </RequireAuthContainer>。

- 个人中心 / 账号面板：
  - 使用 useAccountSettings 生成多 Tab 的账号设置弹窗：
    - tabs 传入若干 TabItem，其中一个 Tab 内容为 <UserInfoPanel />。
    - 页面渲染 {node}，点击「设置」按钮时调用 open()。

- 退出登录：
  - 在导航栏或用户菜单中使用 useLogout：
    - const { node, open } = useLogout();
    - 渲染 {node}；菜单项 onClick 调用 open() 即可。

## 7. 开发注意事项与反模式

- 不要在本包内直接操作全局用户 store 或登录状态逻辑：
  - 一切与账号 / 鉴权相关的状态与请求，必须通过 @coze-foundation/account-adapter、@coze-studio/user-store、@coze-arch/bot-api 的既有接口完成。
- 不要在组件内硬编码文案或 HTTP 请求 URL：
  - 文案统一使用 I18n.t(key)。
  - 请求统一走已有的 passportApi / DeveloperApi 等封装。
- 修改 TS 引用关系时，务必同步更新 tsconfig.build.json 的 references：
  - 这是 Rush + TS 项目引用链正常编译的前提。
- 调整 UserInfoPanel 字段时：
  - 确保埋点逻辑（updateProfileEvent / updateProfileCheckEvent）仍然完整，并根据需要扩展 REPORT_EVENTS。
  - 若增加新字段，先确认对应的后台接口与 account-adapter 能力已存在，再在此包接入。

## 8. 项目流程与协作提示

- 分支 / 发布策略在仓库根级统一管理，本包本身不定义单独的发布流程；但需要注意：
  - package.json 版本号与 Rush 管理的版本需保持一致，由上层工具更新。
  - 新增导出时，请注意避免破坏现有对外 API 的兼容性；如需删除或重构组件，建议先在调用方完成迁移。
- 代码风格、Lint、测试策略遵循仓库统一规范：
  - 提交前至少保证 npm run lint 与 npm test 在此包通过。
