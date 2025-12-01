# copilot 使用说明 - @coze-foundation/layout

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/layout）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 本包为「基座框架布局 package」，为上层应用（如 Studio / Bot IDE 等）提供通用的页面骨架和账号区域 UI。
- 入口为 src/index.tsx，仅做导出聚合：
  - GlobalLayout：整体布局容器，负责侧边栏、响应式行为、移动端 SideSheet、移动端提示等。
  - SideSheetMenu：移动端打开侧边栏的按钮组件。
  - GlobalError：全局路由错误页，集成空间信息、Slardar 埋点以及跳转逻辑。
  - BackButton：通用返回按钮，接入上游 @coze-arch/foundation-sdk 的 BackButtonProps。
  - GlobalLayoutAccountDropdown：右上角账号下拉菜单，集成账号信息、菜单项与打点。
  - reportNavClick：布局内导航点击埋点工具函数（在 src/components/global-layout/utils.ts 中）。
- 关键子模块：
  - src/components/global-layout：全局布局实现，包括 Sider、Context、响应式 Hook、埋点工具等。
  - src/components/global-error：路由错误页（React Router + space-store + logger + i18n）。
  - src/components/account-dropdown：账号头像与下拉菜单。
  - src/components/back-button：简单包装 IconButton 的返回按钮。
  - src/components/side-sheet-menu.tsx：移动端侧边栏开关按钮。
  - src/store/bot-mobile：Zustand store，存储「移动端提示是否弹出过」等状态。
  - src/hooks/use-mobile-tips：统一的移动端使用提示弹窗 Hook。

结构设计的基本原则：
- 布局与内容解耦：GlobalLayout 只关心骨架与侧边栏开合，不关心具体业务内容（children 由上层路由传入）。
- 全局状态尽量通过上游 store / adapter 提供（如 @coze-foundation/space-store、@coze-foundation/account-adapter），本包只做 UI 与行为的绑定。
- 公共交互能力（移动端弹窗、全局错误处理）抽象为 hook + store，避免在业务包内重复实现。

## 2. 关键数据流与交互流程

### 2.1 GlobalLayout 与响应式侧边栏

- GlobalLayout 位于 src/components/global-layout/index.tsx：
  - 使用 useLayoutResponsive（在同目录 hooks.ts 内）计算 isResponsive（是否为移动端）以及 mobileTipsModal 节点。
  - 通过 useLocation 监听 pathname/search 变化，在路由切换或响应式状态变化时关闭 SideSheet，避免残留侧边栏。
  - 在 isResponsive=true 时，Sider 包裹在 SideSheet 中，并由 SideSheetMenu 触发打开；否则直接渲染 GlobalLayoutSider。
  - 使用 GlobalLayoutProvider（context.tsx）暴露 sideSheetVisible 与 setSideSheetVisible，使子组件和 SideSheetMenu 能控制侧边栏开关。

### 2.2 移动端提示弹窗

- useMobileTips（src/hooks/use-mobile-tips/index.tsx）：
  - 基于 @coze-arch/bot-semi 的 useUIModal 生成一个移动端友好的 Modal。
  - 返回 { open, close, node }，其中 node 需要在布局中挂载，open/close 用于控制弹窗。
- useSignMobileStore（src/store/bot-mobile/index.ts）：
  - 使用 zustand + devtools 创建 store，字段：mobileTips（是否已经弹出过）。
  - devtools 在 IS_DEV_MODE 时开启，name 固定为 'botStudio.signMobile'，方便调试。
- useLayoutResponsive（global-layout/hooks.ts）：
  - 综合窗口尺寸 / 设备信息判断 isResponsive。
  - 内部会结合 useMobileTips 与 useSignMobileStore，控制在合适的时机展示移动端提示弹窗，并通过 mobileTipsModal 返回给 GlobalLayout 渲染。

### 2.3 全局错误处理与跳转

- GlobalError（src/components/global-error/index.tsx）：
  - 使用 React Router 的 useRouteError 获取路由错误，并通过 useRouteErrorCatch（来自 @coze-arch/bot-error）上报/处理。
  - 判断 isCustomError(error) 时，从 error.ext.customGlobalErrorConfig 读取自定义标题/文案，覆盖默认文案。
  - 借助 @coze-foundation/space-store 提取当前 spaceId / getPersonalSpaceID，并根据 BaseEnum 和 useRouteConfig 的 menuKey 计算 fallback 跳转 URL：
    - base === BaseEnum.Space：优先当前空间 id，否则个人空间 id，再否则空间列表首个 id，最终拼为 /space/:id/:spaceApp；
    - 其他在 BaseEnum 中的 base：跳转到 /:base；
    - 无法识别时跳转到根路径 /。
  - 在遇到 React 懒加载错误（Minified React error #306）时，通过 window.location.href + escape(url) 强制整页刷新，否则使用 navigate(url)。
  - 通过 getSlardarInstance().config().sessionId 获取当前埋点 sessionId，并在错误页展示，便于排查问题。

### 2.4 账号下拉菜单与导航埋点

- GlobalLayoutAccountDropdown（src/components/account-dropdown/index.tsx）：
  - 通过 useUserInfo（@coze-foundation/account-adapter）获取当前用户信息；无用户信息时返回 null，不渲染入口。
  - 使用 @coze-arch/coze-design 的 Dropdown + Avatar + Badge 组合出右上角头像菜单。
  - 支持两类 menus：
    - 直接传入 ReactNode（通过 isReactNode 判断）时，原样渲染，适用于自定义复杂内容；
    - 传入 LayoutAccountMenuItem 时，渲染为 Dropdown.Item，并在 onClick 中：
      - 调用 reportNavClick(item.title) 记录导航点击；
      - 自动关闭下拉；
      - 执行 item.onClick()。
  - 可通过 visible + onVisibleChange 控制显隐，也可开启 disableVisibleChange 交由外部完全托管。

## 3. 开发与调试流程

### 3.1 本子包常用脚本

在 frontend/packages/foundation/layout 目录下：

- 安装依赖统一通过仓库根目录的 rush 流程：
  - 初始化依赖：rush update
- 本子包脚本来自 package.json：
  - 测试：npm test 或 npm run test
    - 使用 Vitest（配置在 vitest.config.ts，通过 @coze-arch/vitest-config 共享配置）。
  - 覆盖率：npm run test:cov
  - Lint：npm run lint（基于 eslint.config.js 与 @coze-arch/eslint-config）。
  - build：当前实现为 "build": "exit 0"，即构建占位，不在此包单独产出 bundle，上层通常通过统一构建工具（如 rsbuild/webpack）打包。

> 注意：README 中提到的 npm run dev / build 属于模板说明，本包实际未定义 dev 脚本，构建由更高层的应用负责。

### 3.2 运行环境依赖

- 本包依赖 React 18、React Router 6、Zustand 及内部 UI / 工具库：
  - @coze-arch/coze-design：统一 UI 组件库（Layout、SideSheet、IconButton 等）。
  - @coze-arch/bot-semi：半糖 UI 包装（Typography、UIButton、useUIModal）。
  - @coze-arch/bot-icons：图标集（IconArrowLeft、IconSideFoldOutlined 等）。
  - @coze-arch/bot-error：路由错误捕获与自定义错误类型。
  - @coze-arch/web-context：BaseEnum 等全局上下文枚举。
  - @coze-arch/logger：getSlardarInstance，提供日志 & 埋点能力。
  - @coze-arch/i18n：I18n.t 国际化函数，key 与文案由上游平台维护。
  - @coze-foundation/space-store：空间相关 store（space id、列表、getPersonalSpaceID 等）。
  - @coze-foundation/account-adapter：用户信息获取。

AI 编程助手在改动时应假定这些依赖在上层应用中已正确初始化（如 i18n、logger、space-store Provider 等），本包只使用它们提供的 Hook / 工具函数。

## 4. 代码风格与项目特有约定

- 语言与框架：
  - TypeScript + React 18 函数组件，优先使用 FC<Props> 类型别名。
  - 使用 React Router v6 的 Hook（useLocation、useNavigate、useRouteError）。
- 状态管理：
  - 轻量局部状态使用 useState / useEffect；
  - 可复用全局 UI 状态使用 zustand store（例如 useSignMobileStore），并通过 middleware.devtools 包装，配合 IS_DEV_MODE 做开发环境开关。
- 样式：
  - 统一使用 *.module.less + className 方式。
  - 常见 BEM/语义 class 写法：s.wrapper、s.content 等；也会搭配 Tailwind 风格的原子类（如 'flex items-center'）。
- 国际化：
  - 统一通过 I18n.t(key, params?, fallback) 调用，fallback 作为兜底英文文案，key 与多语言内容由上游平台配置。
  - 新增文案时，应按现有 key 命名风格扩展，如 errorpage_*/landing_mobile_* 等。
- 埋点与日志：
  - 导航点击：统一通过 reportNavClick(title) 记录。
  - 错误与会话：在 GlobalError 中展示 sessionId，仅作为 debug 信息，不参与业务逻辑判断。

## 5. 与其他子包的集成关系

- 账号与空间：
  - 依赖 @coze-foundation/account-adapter 提供 useUserInfo，获取 avatar_url 等用户信息进行展示；
  - 依赖 @coze-foundation/space-store：
    - useSpaceStore：获取当前空间 id、spaceList、getPersonalSpaceID 等；
    - useSpaceApp：获取当前应用标识（如 Bot / Studio），用于错误页文案与跳转路径。
- 布局挂载位置：
  - GlobalLayout 一般由应用级入口包（如 @coze-studio/app 或 Agent IDE 相关包）直接使用；
  - 本包不直接配置路由，只提供 Layout 和错误页，路由定义在上游。
- 设计系统与 UI：
  - 与 @coze-arch/coze-design、@coze-arch/bot-semi、@douyinfe/semi-illustrations 配合，构成统一的 UI 风格；
  - 调整 UI 时应优先利用这些组件库提供的属性，不在本包内重新造轮子。

## 6. 开发建议（面向 AI 编程助手）

在本子包中进行自动化改动时，请重点遵守以下约束：

- 保持公共接口稳定：
  - src/index.tsx 中导出的组件与函数视为公共 API，除非有明确迁移计划，否则不要随意重命名或删除导出。
  - 扩展时优先在内部组件/Hook 上加 props/参数，而不是改变现有参数含义。
- 避免越界承担上游职责：
  - 不在本包内创建或修改路由配置、空间/账号业务逻辑，仅消费上游提供的 Hook 与上下文。
  - 不在本包直接操作浏览器全局状态（localStorage / cookie 等），除非已有先例。
- 严格遵循现有模式：
  - 新增全局 UI 状态时，参考 src/store/bot-mobile 的写法（Zustand + devtools + IS_DEV_MODE）；
  - 新增布局相关组件时，优先放入 src/components/global-layout 或相邻目录，并通过 Context/Hook 进行解耦，而不是在页面内直接写死。
- 错误处理与埋点：
  - 如需扩展 GlobalError 行为，保持与 isCustomError / customGlobalErrorConfig 兼容；
  - 新增埋点调用时，尽量封装在 utils 中（如 reportNavClick），避免在 UI 组件中散落逻辑。

只要遵守以上约定，AI 编程助手即可在不破坏上游应用的前提下，对本子包进行安全的重构与功能扩展。
