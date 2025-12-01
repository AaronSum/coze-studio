# global-adapter 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/global-adapter）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本子包提供「应用全局初始化与布局组合」能力，主要导出自 src/index.tsx：
  - GlobalLayout：应用级布局与全局 Provider 组合容器（国际化、主题、浏览器兼容提示等）。
  - useAppInit：供上层应用在入口处执行的初始化 Hook（文件当前通过路径导出，但实现可能在其他分支或后续补齐，修改时注意与调用方约定）。
  - useHasSider：根据路由配置与登录态计算当前页面是否展示侧边栏。
  - AccountDropdown、useAccountSettings：头部/页脚账号下拉菜单与账户设置弹层的适配封装。
- 本包不直接承载业务数据，只负责：
  - 串联其它基础包（account、layout、global、i18n、foundation-sdk 等）。
  - 组合公共 UI 与路由权限逻辑，形成可在多个应用中复用的「全局壳层」。
- 关键组件/Hook 结构：
  - src/components/global-layout/index.tsx：GlobalLayout，负责注入 I18nProvider、主题/Locale Provider、BrowserUpgradeWrap，并挂载 GlobalLayoutComposed 和 React Router 的 Outlet。
  - src/components/global-layout-composed/index.tsx：GlobalLayoutComposed，负责具体的导航栏、侧边栏、页脚 AccountDropdown、创建 Bot 按钮、文档入口等。
  - src/components/global-layout-composed/hooks/use-has-sider.ts：useHasSider，基于路由配置和登录态控制是否展示侧边栏，支持 page_mode=modal 全屏模式。
  - src/components/account-dropdown/*：账号下拉菜单整体（AccountDropdown）和内部菜单项（UserInfoMenu、useAccountSettings 等）。
  - src/typings.d.ts：提供本包内可能使用到的全局类型声明（如存在时）。

## 2. 关键依赖与数据流

- 路由与页面结构：
  - 使用 react-router-dom：
    - GlobalLayout 内部通过 Outlet 渲染子路由页面。
    - GlobalLayoutComposed 通过 useParams 读取 space_id，用于 createBotAction 的 currentSpaceId。
    - useHasSider 使用 useLocation 读取 URL query，识别 page_mode=modal 全屏模式。
- 国际化与语言切换：
  - 依赖 @coze-arch/i18n：
    - I18nProvider 注入全局 i18n 实例 I18n。
    - GlobalLayout 根据用户 locale 与浏览器语言设置 I18n.setLang，并写入 localStorage.i18next。
  - 依赖 @coze-arch/coze-design 的本地化资源：zh_CN、en_US 以及 CDLocaleProvider。
  - 依赖 @coze-arch/bot-semi 的 LocaleProvider 保证 Semi 组件语言一致。
  - 历史兼容逻辑：当 userInfo.locale === 'en-US' 时，内部 I18n 使用 'en'。
- 主题与浏览器兼容：
  - ThemeProvider（来自 @coze-arch/coze-design）：
    - defaultTheme="light"。
    - changeSemiTheme=true，统一 Semi 组件主题。
    - changeBySystem={IS_BOE}，BOE 环境下跟随系统主题（依赖上层提供全局常量 IS_BOE）。
  - BrowserUpgradeWrap（@coze-foundation/browser-upgrade-banner）：在旧浏览器环境下展示升级提示。
- 用户与权限：
  - useUserInfo、useIsLogined、useUserLabel 来自 @coze-arch/foundation-sdk：
    - GlobalLayout 使用 useUserInfo 决定当前语言和是否执行 i18n 切换。
    - useHasSider 使用 useIsLogined 决定在可未登录访问页面时是否隐藏侧边栏。
    - UserInfoMenu 使用 useUserInfo/useUserLabel 展示头像、身份徽章与跳转链接。
  - RequireAuthContainer 来自 @coze-foundation/account-ui-adapter：
    - GlobalLayoutComposed 外包一层，基于当前路由 config.requireAuth/requireAuthOptional 控制是否需要登录、是否可选登录。
- 导航与业务入口：
  - useRouteConfig（@coze-arch/bot-hooks）：
    - 提供当前路由的 requireAuth、requireAuthOptional、hasSider、pageModeByQuery 等配置。
    - useHasSider 和 GlobalLayoutComposed 都依赖此配置决定布局行为。
  - useCreateBotAction（@coze-foundation/global）：
    - 提供 createBot 函数与 createBotModal 组件，在 GlobalLayoutComposed 中用于顶部「创建 Agent」按钮和对应弹层。
  - 导航菜单：
    - Workspace：path '/space'，IconCozWorkspace / IconCozWorkspaceFill。
    - Store/Explore：path '/explore'，IconCozCompass / IconCozCompassFill。
    - 文档快捷入口：点击 extras 中 IconCozDocument 调用 window.open('https://www.coze.cn/open/docs/guides')。
- 账号下拉与设置：
  - GlobalLayoutAccountDropdown（@coze-foundation/layout）：包裹 Dropdown + 用户信息展示。
  - useLogout（@coze-foundation/account-ui-adapter）：返回 logoutModal 和 openLogoutModal，用于退出登录。
  - useAccountSettings（本包组件 + @coze-foundation/account-ui-base）：
    - 内部调用 useBaseAccountSettings，传入 tabs：
      - account：UserInfoPanel（个人信息）。
      - api-auth：PatBody（来自 @coze-studio/open-auth，API Token 管理）。

## 3. 开发与测试工作流（子包视角）

- 构建：
  - package.json 中 build 脚本为 "build": "exit 0"，说明本包自身不执行独立构建逻辑，构建工作通常由上层应用或统一构建系统（Rsbuild / Rush）完成。
  - 若需要增补构建逻辑，应遵循 frontend/config/rsbuild-config 与 monorepo 的统一约定，避免在本包内引入独立打包流程。
- Lint：
  - 执行：在 frontend 根目录下使用 Rush 或在子包目录直接运行：
    - npm run lint
  - 配置：
    - eslint.config.js 继承 @coze-arch/eslint-config。
    - .stylelintrc.js 使用 @coze-arch/stylelint-config，控制样式相关规范。
- 测试：
  - 测试框架：Vitest（通过 @coze-arch/vitest-config 统一配置）。
  - 脚本：
    - npm test / npm run test：vitest --run --passWithNoTests。
    - npm run test:cov：带覆盖率。
  - 约定：
    - 新增组件或 Hook 时，如果涉及逻辑分支（权限、语言、路由模式）或与外部 SDK 交互，优先为这些逻辑编写单元测试，保证回归稳定。

## 4. 项目内特有约定与模式

- 路由配置驱动布局：
  - useRouteConfig 是布局行为的单一信息源：
    - requireAuth / requireAuthOptional：控制 RequireAuthContainer 行为。
    - hasSider：决定是否默认展示侧边栏。
    - pageModeByQuery：配合 URL 中的 page_mode 参数，优先控制是否进入「modal 全屏」模式。
  - useHasSider 的判定顺序：
    1. 如果 config.pageModeByQuery 为 true 且 page_mode === 'modal'，强制无侧边栏。
    2. 计算 notCheckLoginPage：当 (requireAuth && requireAuthOptional) 或 !requireAuth 为 true 时表示「可未登录访问页面」。
    3. 如果 config.hasSider && notCheckLoginPage && !isLogined，则隐藏侧边栏（未登录但页面可访问时）。
    4. 其他情况返回 !!config.hasSider。
  - 修改路由相关逻辑时，应优先通过路由配置扩展而非在组件内部硬编码路径或条件。
- 国际化与本地存储：
  - 语言切换逻辑包含对 localStorage.i18next 的写入，以及调用 I18n.setLang 后强制刷新（useUpdate）。
  - 修改语言策略时需保持对 I18n、CDLocaleProvider、LocaleProvider 三者的一致性；避免只改其一导致组件语言不一致。
- 用户信息展示与交互：
  - UserInfoMenu 使用 CozAvatar + Badge + Tooltip 组合展示用户与标签信息：
    - userLabel.icon_url 显示为角标头像，点击时如果存在 jump_link 则 window.open 新窗口。
    - userUniqueName 显示为 @user_unique_name 的形式。
  - 如需增加更多用户相关信息，建议复用现有 Coze Design 组件，并保持菜单项高度一致、溢出文本使用 Typography.Text 的 ellipsis 配置。
- 常量与环境：
  - IS_BOE 由上层注入（通常为全局常量或 DefinePlugin 注入），本包只负责使用，不应在此定义其值。
  - 新增依赖时优先通过 workspace:* 的方式引用已有包，保持 monorepo 一致性。

## 5. 与外部模块的集成要点

- @coze-foundation/layout：
  - GlobalLayout、GlobalLayoutAccountDropdown 等组件在本包只做简单组合，不修改内部实现。
  - 扩展布局行为（新增 header actions、menus、extras、footer）时，应通过 props 传值，而不是在本包内复制 layout 实现。
- @coze-arch/foundation-sdk：
  - useUserInfo/ useIsLogined/ useUserLabel 等 Hook 是用户与会话信息唯一来源。
  - 避免在本包内直接访问 localStorage/cookie 获取用户信息，统一通过 SDK。
- @coze-foundation/account-ui-adapter 与 @coze-foundation/account-ui-base：
  - RequireAuthContainer：处理未登录跳转、登录可选等逻辑。
  - useAccountSettings + UserInfoPanel：负责账号信息维护界面，调用时只关注 tabs 结构与文案。
- @coze-studio/open-auth：
  - PatBody：用于 API 授权（Personal Access Token）管理界面，在账号设置中作为一个 Tab 内容使用。
  - 调整布局时不要改变 PatBody 的交互语义，只可调整其所处容器样式。
- @coze-arch/coze-design：
  - Icon 系列（IconCozPlusCircle 等）用于导航和按钮图标；
  - Dropdown、Badge、Space、Typography、Tooltip 用于统一 UI 风格与交互行为。

## 6. 开发流程与协作规范（本包层面）

- 分支与提交：
  - 遵循仓库整体流程（参考仓库根部 README / CONTRIBUTING），本包未再定义额外分支策略。
  - 在修改本包时，建议：
    - 将变更范围控制在 global-adapter 及紧邻依赖；
    - 如果需要跨包修改（如 layout、account-adapter 等），优先拆分为独立 PR 或在描述中明确依赖关系。
- 变更评估：
  - 涉及以下内容时需要特别谨慎：
    - 语言/Locale 相关逻辑（可能影响所有页面文案）。
    - useHasSider 判定规则（可能影响布局体验）。
    - RequireAuthContainer 使用方式（可能影响登录拦截）。
  - 对此类变更，应补充或更新对应测试用例，并在上层应用（如 apps/coze-studio）实际跑一遍主流程验证。

## 7. 对 AI 助手的具体建议

- 在本包内增加/修改代码时：
  - 保持入口导出稳定：src/index.tsx 的导出名称应视为公共 API，变更需同步上层调用方。
  - 避免在本包中引入全局状态管理（如 Zustand store），尽量通过已有 foundation/global-store 或 UserInfo / RouteConfig Hook 获取信息。
  - 任何与用户、权限、路由相关的新逻辑，优先基于现有 Hook（useUserInfo、useIsLogined、useRouteConfig 等）扩展，而非重复造轮子。
- 编写测试时：
  - 使用 Vitest + React Testing Library，重点覆盖：
    - useHasSider 在不同路由配置、登录态、page_mode 组合下的返回值。
    - GlobalLayout 在不同 locale 下正确选择 I18n/LocaleProvider 语言。
    - AccountDropdown 的菜单点击行为（打开账号设置、API 授权、退出登录）。

以上内容应足以让 AI 编程助手在本子包内进行安全且上下文一致的开发工作。