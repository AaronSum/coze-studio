# account-ui-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/account-ui-adapter）中安全、高效地协作开发。

## 全局架构与职责边界

- 子包定位：本包提供账号登录相关的 UI 适配层，面向上层应用暴露统一的登录页组件和账号 UI 能力封装。
- 对外导出：在 src/index.ts 中统一 re-export：
  - 从 @coze-foundation/account-ui-base 透出 useLogout、RequireAuthContainer 等基础能力。
  - 本包自有的 LoginPage 组件（src/pages/login-page）。
- 依赖关系：
  - 账号领域：依赖 @coze-foundation/account-adapter 提供登录状态管理、UserInfo 类型和 setUserInfo 等方法，是登录成功后的状态入口。
  - 接口层：依赖 @coze-studio/api-schema 中 passport 命名空间发起登录/注册请求。
  - UI 与布局：依赖 @coze-arch/coze-design（Form、Button）、@coze-arch/bot-semi（SignFrame、SignPanel）、@coze-studio/components/coze-brand（品牌区），组成完整登录页布局。
  - 国际化：依赖 @coze-arch/i18n 提供 I18n.t 文案；文案 key 需在上层国际化配置中补全。
  - 路由：依赖 react-router-dom 的 useNavigate，在登录成功后重定向到应用根路径 '/'.
- 数据流简述：
  - LoginPage 维护 email/password 本地状态，并通过 useLoginService 调用后端 passport 接口。
  - useLoginService 在成功时调用 setUserInfo 写入账号领域状态；useLoginStatus 监听登录态并在 "logined" 时触发路由跳转。
  - 组件内部不开启复杂状态管理，主要承担表单校验、按钮禁用与 loading 联动等 UI 层逻辑。

## 目录结构与关键文件

- 根目录
  - package.json：包名、依赖和脚本入口，exports 映射 '.' -> src/index.ts，'./login-page' -> src/pages/login-page/index.tsx。
  - tsconfig.json / tsconfig.build.json / tsconfig.misc.json：TypeScript 编译与引用配置，由仓库统一 ts-config 继承；一般不在本包内大改，只补充必要路径或类型引用。
  - eslint.config.js / .stylelintrc.js / vitest.config.ts：统一接入 monorepo 的 lint 与测试预设，尽量遵循已有配置风格。
- src/index.ts
  - 作为对外唯一主入口，集中导出 hooks 与组件。
  - 新增导出时，应保持 API 简洁稳定，避免大量内部实现细节泄露；复杂场景可通过新的适配层组件/Hook 暴露。
- src/pages/login-page/
  - index.tsx：核心 LoginPage 组件，实现 UI、表单校验和交互行为，是本包目前最重要的页面。
  - service.ts：useLoginService Hook，封装邮箱登录/注册逻辑与登录态路由跳转，是登录流程的业务适配层。
  - favicon.tsx 与 png 资源：登录页品牌图标视图，与产品视觉统一，除非有需求调整，不应随意修改尺寸与样式类名。

## 构建、测试与调试流程

- 安装依赖与初始化（仓库级）：
  - 在仓库根目录运行：rush install 或 rush update。
- 本包脚本（在 frontend/packages/foundation/account-ui-adapter 下）：
  - lint：npm run lint
  - test：npm test 或 npm run test（使用 vitest，配置见 vitest.config.ts）
  - test:cov：npm run test:cov（启用 @vitest/coverage-v8）
  - build：当前脚本为 "exit 0"，说明本包暂未单独产出构建制品，仅作为源代码与类型的 workspace 依赖被上游应用消费。
- 在应用中联调：
  - 主应用位于 frontend/apps/coze-studio，可通过 rushx dev 启动，然后在应用路由中引入本包导出的 LoginPage 或 RequireAuthContainer 进行联调。
  - LoginPage 依赖 react-router-dom 上下文（useNavigate），因此在独立 Storybook / 单测环境中需包裹 Router 或使用 MemoryRouter。

## 项目内约定与模式

- UI 风格与类名：
  - 使用 Tailwind 风格原子类（例如 w-[600px]、pt-[96px]）与项目自定义类（coze-fg-plug、coz-stroke-plus）组合，避免在组件内部写内联样式。
  - 登录页主布局通过 SignFrame + SignPanel 组合提供统一容器，内部再使用 flex 布局分配内容区域。
- 表单与校验：
  - 使用 @coze-arch/coze-design 的 Form 组件：
    - 通过 onErrorChange 回调接收字段错误对象，并在存在错误时将 hasError 置为 true，从而禁用提交按钮。
    - 字段规则使用 rules 配置；邮箱校验采用简单正则 /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 并共享同一文案 key。
  - 按钮禁用策略：只要 email/password 任一为空、或 hasError 为 true、或另一个请求在 loading，即禁用对应操作按钮，防止并发和错误输入。
- 登录流程模式：
  - useLoginService 将登录和注册都封装为 useRequest(manual: true) 调用：
    - 请求函数内使用 passport.* API（PassportWebEmailLoginPost / PassportWebEmailRegisterV2Post）。
    - onSuccess 中统一调用 setUserInfo 写入全局用户信息，避免在 UI 组件里直接操作账号状态。
  - 登录态监听：通过 useLoginStatus 获取状态；当状态为 "logined" 时，useEffect 中调用 navigate('/') 进行跳转。
  - 若新增登录方式（例如第三方 OAuth），建议在 service.ts 中新增对应 Hook 或在 useLoginService 内扩展，而不要将网络调用散落在 UI 组件里。
- 国际化约定：
  - 所有文案使用 I18n.t(key) 获取；不要在组件中硬编码可见文本。
  - 新增文案必须遵循已有命名风格（如 open_source_login_*、login_button_text、register 等），并确保上游 i18n 资源中补充对应多语言。
- 测试约定：
  - 使用 vitest + @testing-library/react 进行组件测试，@testing-library/react-hooks 用于 Hook 测试。
  - DOM 查询应优先使用 data-testid（如 login.input.email、login.button.login），这些 id 已在 LoginPage 中预置，新增元素时保持类似命名风格。

## 重要依赖与集成细节

- @coze-foundation/account-adapter：
  - 提供 UserInfo 类型、setUserInfo、useLoginStatus 等账号状态相关 API。
  - 本包不直接操作存储介质（如 localStorage / cookie），而是通过该适配层写入用户信息，保持跨子包一致的登录态管理。
- @coze-foundation/account-ui-base：
  - 提供 useLogout、RequireAuthContainer 等通用账号 UI 能力，本包直接 re-export，作为更高层使用入口。
  - 扩展账号 UI 能力时，优先考虑放在 base 包中，以避免 account-ui-adapter 与其它上下游产生强耦合。
- @coze-studio/api-schema：
  - passport 命名空间为统一的 API 调用入口；目前使用 PassportWebEmailLoginPost、PassportWebEmailRegisterV2Post。
  - 请求参数和返回数据结构由 IDL 生成，若字段发生变化，应先修改 IDL / 生成代码，再更新 service.ts。
- UI 相关依赖：
  - @coze-arch/coze-design：基于 Semi / 内部设计体系封装的组件库，这里主要用到 Form 与 Button，遵循其标准 props 习惯（如 rules、noLabel、loading、color 等）。
  - @coze-arch/bot-semi：SignFrame / SignPanel 用于统一登录页容器和背景样式；如需新增登录页变体，应尽量复用该容器组合，保持统一视觉体验。
  - @coze-studio/components：当前使用 CozeBrand 渲染品牌 Logo，传入 isOversea={IS_OVERSEA}，其中 IS_OVERSEA 来自全局环境变量，AI 助手在本包内不要定义该常量，仅假设其由上游注入。
- 路由环境：
  - useNavigate 依赖于 React Router v6 上下文；在单元测试或 Storybook 中使用 LoginPage 时，需要通过 MemoryRouter / BrowserRouter 包裹。
  - 登录成功后目标路径目前固定为 '/'，如未来需要可配置化，建议通过 props 或上层路由逻辑实现，而不是在组件内硬编码多个路径判断。

## 开发流程与协作规范

- 分支与提交（遵循仓库级规范）：
  - 本仓库整体采用 Rush 管理，分支与提交规范在根级 CONTRIBUTING.md 中说明；在本子包内开发时应保持小粒度改动，并配套测试或快照更新。
- 变更原则：
  - 避免在本包内新增与账号无关的通用 UI 或工具；此类能力应放入 common/components 或 foundation 等更合适的包中。
  - 对登录流程相关的 breaking change（如修改登录成功后的跳转策略、UserInfo 结构等）需要同步评估所有使用本包的上层应用和包。
- 新增功能建议：
  - 新增登录模式、提示信息、字段时，优先复用 service.ts 的调用结构和已有的表单校验模式。
  - 若需要扩展导出 API，请集中修改 src/index.ts，并在 README.md 中补充用法说明，保持对外文档与实现一致。

## 不寻常/需特别注意的点

- build 脚本为 "exit 0"：
  - 说明当前阶段本包仅作为源码/类型入口存在，由上游构建流程统一打包；AI 助手在调整构建逻辑前需先检查其它 foundation/* 包的惯例，避免破坏全局构建体系。
- TypeScript 配置：
  - tsconfig.json 将 "exclude": ["**/*"]，且通过 references 指向 tsconfig.build.json 与 tsconfig.misc.json，这属于 monorepo 的分层配置方案；不要简单删除 exclude 或大幅改写 references，应参考同层其他包做增量调整。
- 全局变量 IS_OVERSEA：
  - 在 LoginPage 中直接使用 IS_OVERSEA 传入 CozeBrand，这是由上层构建环境注入的全局变量；在本子包内不要重复声明或 mock 真实值，测试时可以通过 ts/webpack/vitest 配置提供替代实现。
- API 返回类型断言：
  - service.ts 中将 passport 返回值断言为 { data: UserInfo }，这是为兼容生成的 API 类型与账号适配层的统一 UserInfo 类型；若后续 IDL 结构变更，需要同步更新该断言和 account-adapter 内部定义，而不是在此处临时 patch。
