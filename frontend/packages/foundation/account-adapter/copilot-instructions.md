# Copilot Instructions for @coze-foundation/account-adapter

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/account-adapter）中安全、高效地协作开发。

## 1. 全局架构与职责边界
- 本子包是账号体系的“适配层”，主要在 account-base 的基础上：
  - 直接 re-export 账号状态 hooks、utils、类型（来自 @coze-foundation/account-base）；
  - 提供与具体登录实现有关的适配工具函数（utils）和 hooks（hooks）；
  - 暴露 passportApi（src/passport-api），封装上游 passport 相关 HTTP / SDK 调用。
- 入口文件为 src/index.ts：
  - 从 @coze-foundation/account-base 透出：getUserInfo、getLoginStatus、resetUserStore、setUserInfo、getUserLabel、useUserInfo、useLoginStatus、useAlterOnLogout、useHasError、useUserLabel、useUserAuthInfo、getUserAuthInfos、subscribeUserAuthInfos、useSyncLocalStorageUid、usernameRegExpValidate 以及 UserInfo、LoginStatus 类型。
  - 从本包 utils 透出：refreshUserInfo、logout、checkLogin、connector2Redirect。
  - 从本包 hooks 透出：useCheckLogin。
  - 从 src/passport-api 透出：passportApi。
- 设计上，本包不直接维护自己的 Zustand store 或独立状态，而是完全复用 account-base 中的 user store；本包聚焦“如何与实际登录/鉴权后端交互，并把结果写入 account-base 提供的 store”。

## 2. 关键数据流与调用链（在本包视角）
- 登录态检查高层封装：
  - useCheckLogin（src/hooks）是对 account-base 中 useCheckLoginBase 的应用层封装：
    - 内部会注入本包实现的 checkLogin（utils）和 goLogin（通常依赖 react-router-dom 进行跳转）。
    - 调用方式一般为：在 App 或路由守卫组件中直接使用 useCheckLogin(needLogin: boolean)，无需在上层重复拼装 checkLoginImpl / goLogin。
  - checkLogin（src/utils/index.ts）：
    - 使用 passportApi 调用实际的“检查当前用户是否已登录/获取用户信息”的接口；
    - 将返回的 userInfo 传入 account-base 的 refreshUserInfoBase / setUserInfo，驱动 user store 更新；
    - 在发生未登录 / token 失效时返回对应状态，交由 useCheckLogin / account-base 决定是否跳转登录页。
- 刷新用户信息与登出：
  - refreshUserInfo（utils）：复用 account-base 暴露的 refreshUserInfoBase，底层依赖本包的 checkLogin（以及 passportApi 提供的用户信息接口）；
  - logout（utils）：
    - 使用 passportApi 执行登出（如调用 /logout、清空 cookie / token 等）；
    - 调用 account-base 的 logoutBase / resetUserStore，清理本地 user store；
    - 根据需要调用路由跳转（例如回到登录页或首页）。
- 第三方/Connector 跳转：
  - connector2Redirect（utils）：
    - 基于 account-base 中定义的 Connector2Redirect/OAuth2RedirectConfig 类型；
    - 将账号/空间等业务的 connector 信息转换成实际的跳转链接（例如 OAuth2 授权页、绑定页面等）；
    - 一般提供给 space-bot、account-ui-adapter、global-adapter 等上层包使用，用于构造“去绑定/去授权”按钮点击行为。
- passportApi（src/passport-api）：
  - 封装与账号/登录相关的后端接口（如获取当前用户、登录、登出、connector 管理等）；
  - 统一放在一个对象中，方便在 utils / hooks 中注入或 mock；
  - 其他包也可以直接使用 passportApi，但推荐优先通过本包提供的更高层封装（checkLogin、logout 等），减少重复逻辑。

## 3. 开发与测试工作流
- 本包为基础适配层，一般不单独启动 dev server：
  - package.json 中 dev / build 脚本目前为 `exit 0`，真实构建由 monorepo 顶层（Rush + Rsbuild）统一管理；
  - 该包主要通过被 apps（如 frontend/apps/coze-studio）或其他 packages（account-ui-adapter、global-adapter 等）依赖来完成端到端调试。
- 本包本地开发常用命令：
  - 安装依赖：在仓库根目录执行 `rush update`；
  - Lint：在 frontend/ 下执行 `rushx lint --to @coze-foundation/account-adapter`（或在本包目录运行 `npm run lint`，调用 eslint.config.js，preset 为 web）；
  - 测试：
    - `npm run test`：使用 vitest（配置见 vitest.config.ts，preset 为 web）；
    - `npm run test:cov`：在 test 基础上开启 coverage；
    - 测试入口通过 __tests__/setup-vitest.ts 做环境初始化（如 polyfill、mock browser 全局变量等）。
- 建议的调试方式：
  - 通过依赖本包的上层 UI 包进行集成调试，例如：
    - foundation/account-ui-adapter（登录页面、账号管理页面）；
    - foundation/global-adapter（全局初始化流程 / use-app-init）;
    - apps/coze-studio（实际产品应用）。
  - 问题排查时，可以：
    - 在上层应用中查看 useLoginStatus / useUserInfo 的行为；
    - 结合 network 面板观察 passportApi 对应的请求与响应。

## 4. 项目特有约定与模式
- 与 account-base 的分层约定：
  - account-base 负责“账号状态与通用业务逻辑”（user store、hooks、utils）；
  - account-adapter 负责“与具体后端/路由实现绑定”的部分：
    - 把 passport 接口、router 跳转等注入到 account-base 的 Base hooks/factory 中；
    - 任何涉及实际 HTTP 调用或 URL 构造的逻辑，应放在本包的 utils / passport-api 中，而不是放回 account-base。
- re-export 策略：
  - 对于 account-base 中的导出，本包只做“直通 re-export”，不做二次封装（保持类型与行为一致）；
  - 本包新增的 API（如 useCheckLogin、connector2Redirect 等）需要在 src/index.ts 统一导出，方便上层应用只依赖 @coze-foundation/account-adapter 即可完成账号集成。
- 路由与跳转约定：
  - 本包依赖 react-router-dom（见 package.json），用于实现 goLogin / redirect 等能力；
  - 具体路由路径（如 /login、/passport/bind 等）不在本包硬编码，而是由调用方或配置注入：
    - AI 助手在添加新逻辑时，应尽量通过参数或配置对象传入路由路径，而不是写死常量。
- API 调用封装习惯：
  - 对账号相关后端接口，优先在 src/passport-api 下建模块封装（例如 passportApi.getCurrentUser、passportApi.logout 等）；
  - utils / hooks 只依赖 passportApi 暴露的接口，不直接拼接 URL / fetch；
  - 测试时可通过替换/mocking passportApi 来解耦真实后端。

## 5. 与其他模块的集成关系
- 与 @coze-foundation/account-base：
  - 本包几乎所有导出的账号状态与类型都来自 account-base；
  - 本包负责把“如何从后端拿到用户信息/如何登出/如何处理 connector”注入给 account-base 的 Base 逻辑；
  - account-ui-adapter / global-adapter / foundation-sdk 等上层模块推荐只依赖 account-adapter，而不是同时依赖 account-base + passport SDK。
- 与 @coze-studio/api-schema：
  - package.json 中依赖 @coze-studio/api-schema，用于类型/IDL 定义账号相关接口参数与返回值；
  - 在扩展 passportApi 或 utils 时，优先引用 api-schema 中已有的 TS 类型，保持与后端契约对齐。
- 与上层消费方：
  - foundation/account-ui-adapter：用于登录页面、账号设置页等 UI，主要消费本包的 useCheckLogin、connector2Redirect、passportApi；
  - foundation/global / global-adapter：在全局初始化阶段通过本包触发登录态检查与多 Tab 处理；
  - apps/coze-studio：最终产品应用，依赖本包完成统一的账号体验（登录、登出、connector 管理等）。
- 与空间/connector 相关模块：
  - agent-ide/space-bot、data/knowledge-*** 等包中，会通过 connector2Redirect / passportApi 完成与账号/空间绑定相关的跳转；
  - 修改 connector2Redirect 或 passportApi 时，要注意对这些调用方行为的影响（例如 query 参数变化、路径更改）。

## 6. 代码风格与质量约束
- Lint & 风格：
  - 使用 @coze-arch/eslint-config，preset 为 web，配置在 eslint.config.js 中；
  - 默认忽略 src/**/__tests__/** 中的 lint，测试代码风格相对宽松；
  - 新增源码需满足 ESLint 规则（包括 import 顺序、未使用变量、React hooks 规则等）。
- TypeScript 配置：
  - tsconfig.json / tsconfig.build.json / tsconfig.misc.json 由 monorepo 统一管理，extends @coze-arch/ts-config；
  - 开发时应保持严格类型（尽量不用 any），接口类型优先从 api-schema / account-base 导入。
- 测试配置：
  - vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig，preset: 'web'；
  - test.setup 统一在 __tests__/setup-vitest.ts 中管理，避免在每个测试文件重复初始化逻辑。

## 7. AI 编程助手使用建议
- 在本包内新增或修改逻辑时优先遵循：
  - “状态在 account-base，适配在 account-adapter”的分层：不要在本包建立新的独立账号 store；
  - 所有与后端交互的账号接口先考虑是否应集中到 passportApi，再在 utils/hooks 中消费；
  - 面向上层应用暴露的 API 应集中在 src/index.ts。
- 典型任务落点建议：
  - 新增登录相关 API 封装：在 src/passport-api 下增加方法，并在 src/utils/index.ts 中封装为高层函数（例如 resetPassword、bindEmail 等）；
  - 扩展登录流程：在 hooks/useCheckLogin 或 utils/checkLogin 中调整逻辑，但保持与 account-base 的接口契约不变（返回结果结构、异常处理方式）；
  - 新增 connector 跳转能力：扩展 connector2Redirect，注意兼容旧调用（例如通过可选参数、默认值实现）。
- 变更完成后建议执行：
  - 在包目录运行 `npm run lint` 与 `npm run test`；
  - 若改动影响上层应用（比如登录跳转地址、connector 参数），需要在相关 app 中手动验证一次登录/登出/绑定流程。
