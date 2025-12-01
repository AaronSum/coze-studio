# Copilot Instructions for @coze-foundation/account-base

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/account-base）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本子包提供账号与登录状态相关的基础能力：Zustand 用户状态仓库、账号相关 hooks、以及配套的工具函数，不直接渲染 UI 组件。
- 入口文件为 src/index.ts，对外统一导出：
  - 类型：UserInfo、LoginStatus 以及 OAuth2RedirectConfig、Connector2Redirect（来自 src/types）。
  - 通用 hooks：useLoginStatus、useUserInfo、useHasError、useAlterOnLogout、useUserLabel、useUserAuthInfo、useSyncLocalStorageUid。
  - 通用 utils：getUserInfo、getUserLabel、getLoginStatus、resetUserStore、setUserInfo、getUserAuthInfos、subscribeUserAuthInfos、usernameRegExpValidate。
  - “Base” 层 hooks 与工具：useCheckLoginBase、refreshUserInfoBase、logoutBase、checkLoginBase，用于将具体业务登录实现注入进来。
- 状态流转核心在 src/store/user.ts：
  - 使用 zustand + subscribeWithSelector + devtools 创建 useUserStore。
  - state 字段：isSettled（是否完成登录态检查）、hasError（登录检查是否出错）、userInfo、userAuthInfos（权限列表）、userLabel。
  - action：reset、setIsSettled、setUserInfo、getUserAuthInfos。
  - 与后端交互依赖 @coze-arch/bot-api 的 DeveloperApi、PlaygroundApi。
- hooks 层（src/hooks）负责把 store 状态包装成 React hook 能力：
  - useLoginStatus / useUserInfo / useHasError / useUserLabel / useUserAuthInfo 直接从 useUserStore 做派生；
  - useAlterOnLogout 结合 ahooks 的 useDocumentVisibility 做多 Tab 登出检测；
  - useCheckLoginBase 负责初始化时检查登录、监听 UNAUTHORIZED 接口错误并触发 goLogin。
- utils 层（src/utils）提供非 React 环境使用的函数：
  - index.ts 以同步/订阅方式访问/监听 store 状态，并提供 usernameRegExpValidate；
  - factory.ts 抽象出刷新用户信息、登出、检测登录状态的基础逻辑，对外只接受调用方传入的实际 checkLogin/logout 实现。
- 类型层（src/types）定义 UserInfo、LoginStatus 等领域模型，passport.ts 补充 OAuth2 / Connector 相关跳转配置，用于与其他 passport / auth 适配层协作。

## 2. 关键数据流与调用链

- 登录态检查（基础流程）：
  - 外部业务在页面初始化时调用 useCheckLoginBase(needLogin, checkLoginImpl, goLogin)。
  - 首次渲染且 isSettled === false 时，useCheckLoginBase 内部调用 checkLoginBase(checkLoginImpl)。
  - checkLoginBase 调用调用方提供的 checkLoginImpl，期望返回 { userInfo?, hasError? }：
    - 若 hasError 为 true，则将 store.hasError 置为 true，isSettled 不会置为 true，页面可根据 useHasError 处理。
    - 若存在 userInfo，则通过 @coze-arch/logger 的 setUserInfoContext 写入日志上下文，并将 userInfo 存入 store，最后将 isSettled 置为 true。
  - 随后 useCheckLoginBase 根据 needLogin / isSettled / userInfo 是否存在决定是否立即 goLogin（重定向到登录页）。
  - 同时 useCheckLoginBase 注册 APIErrorEvent.UNAUTHORIZED 监听器：
    - 由 @coze-arch/bot-api 暴露的 handleAPIErrorEvent/ removeAPIErrorEvent 管理，当后续 Ajax 请求返回未授权时触发；
    - 触发时会 reset store 并在 needLogin 为 true 时调用 goLogin，且通过 fired 标记避免二次触发。
- 用户信息及标签获取：
  - useUserStore.setUserInfo 在写入 userInfo 时，如果 user_id_str 与之前不同，会触发内部的 fetchUserLabel：
    - 调用 PlaygroundApi.MGetUserBasicInfo({ user_ids: [id] })；
    - 从 res.id_user_info_map[id].user_label 中取出标签并写入 store.userLabel。
  - 调用方可通过 useUserLabel 或 getUserLabel 读取标签信息，用于 UI 展示或埋点。
- 用户权限列表获取：
  - store 中的 getUserAuthInfos 调用 DeveloperApi.GetUserAuthList()，将返回的 data 写入 userAuthInfos。
  - 外部代码可以：
    - 直接调用 getUserAuthInfos() 触发一次网络请求；
    - 使用 useUserAuthInfo() 读取最新权限列表；
    - 或使用 subscribeUserAuthInfos 注册 selector 级订阅，实现细粒度监听。
- 多 Tab 登出检测（useAlterOnLogout）：
  - 通过 ahooks.useDocumentVisibility 监听页面可见性，当从 hidden 返回到 visible 且当前登录状态为 logined 时：
    - 使用 useUserStore.getState().userInfo?.user_id_str 作为 lastUserId；
    - 在 effect cleanup 时对比 localStorage 中的 coze_current_uid，若不一致则触发传入的 alert 函数，以提示“账号已在其他页面退出/切换”。
  - 另一个 effect 监听 loginStatus 变化，一旦不再是 "settling"，就把当前 user_id_str 写入 localStorage，保持多 Tab 共享态。

## 3. 开发与测试工作流

- 本包主要作为基础库，被其他前端应用/子包消费，一般不单独启动 dev server。
- package.json 中脚本：
  - lint：`npm run lint` -> `eslint ./ --cache`，使用 monorepo 中的 @coze-arch/eslint-config；
  - test：`npm run test` -> `vitest --run --passWithNoTests`，测试配置由 @coze-arch/vitest-config 统一提供；
  - test:cov：`npm run test:cov` -> `npm run test -- --coverage`；
  - build/dev：当前为 `exit 0`，构建由顶层工具（Rsbuild/Rush pipeline）统一驱动。
- 在整个仓库中开发时：
  - 根目录执行 `rush install` / `rush update` 保证依赖完整；
  - 在 frontend/ 内可使用 `rushx test --to @coze-foundation/account-base` 或由 Rush 提供的局部命令运行测试（具体命令以 monorepo 级脚本为准）。
- 单包调试：
  - 建议通过依赖该包的上层应用（如 coze-studio app 或 foundation-sdk）进行端到端调试；
  - 若需要对 store / hooks 的行为做实验，可在 __tests__ 或临时 demo 组件中引入对应 hook/util，使用 Vitest + Testing Library 进行单元测试。

## 4. 项目特有约定与模式

- Zustand Store 约定：
  - 所有用户账号相关状态集中在 src/store/user.ts 的 useUserStore 中，禁止在外部创建重复的用户状态源；
  - 读写 store 有清晰分层：
    - React 组件/页面优先通过 hooks（src/hooks）访问；
    - 非 React 环境（如日志、工具库）通过 utils（src/utils）访问；
    - 订阅使用 subscribe(selector, listener) 形式，统一通过 subscribeUserAuthInfos 之类的包装暴露，避免滥用底层 subscribe。
- “Base” 工厂模式：
  - factory.ts / hooks/factory.ts 不直接依赖具体路由实现，只暴露：
    - checkLoginBase(checkLoginImpl)、refreshUserInfoBase(checkLogin)、logoutBase(logout)；
    - useCheckLoginBase(needLogin, checkLoginImpl, goLogin)。
  - 真实的登录逻辑（请求 passport、跳转到登录页等）必须由调用方通过参数注入，保持本包对上层应用的可复用性。
- 登录状态枚举 LoginStatus：
  - 约定有三个状态："settling"（检查中）、"logined"、"not_login"；
  - 所有需要根据登录态渲染的逻辑应优先使用 useLoginStatus / getLoginStatus，避免在各处自行推断。
- 用户名校验规则：
  - usernameRegExpValidate 使用 `/^[0-9A-Za-z_]+$/` 和最小长度 4；
  - 错误消息通过 @coze-arch/i18n 的 I18n.t 读取 `username_invalid_letter` / `username_too_short`，因此新增错误类型时需要先在 i18n 资源中补充 key。
- 日志上下文集成：
  - 登录成功后，由 checkLoginBase 调用 setUserInfoContext(userInfo)，将用户信息注入 @coze-arch/logger；
  - 修改登录流程时必须保证该调用仍然发生，以免影响链路追踪和问题排查。
- 环境约定：
  - useUserStore 创建时 devtools 的 enabled 依赖全局常量 IS_DEV_MODE（由上游构建环境注入）；
  - 依赖 @coze-arch/bot-api、@coze-arch/idl 等内部 SDK，这些模块在 Rush monorepo 中提供，不能独立于仓库外部使用。

## 5. 与其他模块的集成关系

- 与 @coze-arch/bot-api：
  - 在 store/user.ts 中使用 DeveloperApi.GetUserAuthList()、PlaygroundApi.MGetUserBasicInfo() 获取授权列表和用户基础信息；
  - 在 hooks/factory.ts 中使用 APIErrorEvent、handleAPIErrorEvent、removeAPIErrorEvent 监听接口未授权事件。
- 与 @coze-arch/i18n：
  - utils/index.ts 中通过 I18n.t 获取用户名校验相关文案；
  - 编写新校验逻辑或错误分支时，应继续通过 I18n 而非写死文案。
- 与 @coze-arch/logger：
  - utils/factory.ts 中使用 setUserInfoContext(userInfo) 设置日志上下文；
  - 不应在其他模块重复设置用户日志上下文，而是保持在登录流程中统一处理。
- 与 @coze-foundation/local-storage：
  - package.json 中列为依赖，但当前核心逻辑中多 Tab 检测直接使用浏览器原生 localStorage；
  - 若未来在其他代码中需要封装 localStorage 访问，请优先考虑通过 @coze-foundation/local-storage，以保持统一抽象。
- 与上层 UI/适配层：
  - account-adapter / account-ui-adapter / app 级代码通常会：
    - 注入 checkLoginImpl / goLogin，决定与实际登录页面、OAuth 流程的集成方式；
    - 使用 useLoginStatus / useCheckLoginBase 控制路由访问；
    - 使用 useUserInfo / useUserLabel / useUserAuthInfo 驱动 UI（头像、昵称、权限控制等）。

## 6. 协作与变更注意事项

- 修改 store 结构时：
  - 必须同步更新：defaultState、UserStoreState、相关 hooks 与 utils 的读/写逻辑；
  - 若新增字段来自后端接口，需要确认 @coze-arch/bot-api / @coze-arch/idl 中已有对应类型定义，并在调用端补充解析逻辑。
- 调整登录流程时：
  - 确认以下行为仍然成立：
    - 登录检查结束时 isSettled === true；
    - 登录成功时 userInfo 不为 null，且 setUserInfoContext 被调用；
    - 登录失败或未登录时，根据 needLogin 正确跳转到登录页；
    - UNAUTHORIZED 事件仍会触发重置 store 并在需要时跳转。
- 扩展 hooks / utils 时：
  - 新增的导出应从 src/index.ts 统一 re-export，保持对外 API 面稳定；
  - 优先遵循“React 中用 hooks、非 React 中用纯函数”的分层；
  - 不要在 hooks 内部直接发起与账号无关的网络请求，避免跨领域耦合。
- 测试约定：
  - hook 逻辑建议使用 @testing-library/react-hooks 或 React Testing Library 搭配 Vitest 进行测试；
  - store 行为可通过直接操作 useUserStore（setState/getState/subscribe）进行单元测试，避免依赖真实后端。

## 7. AI 编程助手使用建议

- 在本子包中新建功能时：
  - 先确认是否属于“账号/登录基础能力”；若是，则实现应位于 src/store、src/hooks、src/utils、src/types 中之一；
  - 扩展现有 store 字段 / hooks / utils，而不是在其他包中重新维护用户状态副本。
- 生成代码前应优先参考：
  - src/store/user.ts（状态结构与更新模式）；
  - src/hooks/index.ts 与 src/hooks/factory.ts（登录态相关 hooks 设计）；
  - src/utils/index.ts 与 src/utils/factory.ts（纯函数工具与登录流程抽象）。
- 变更完成后：
  - 运行 `npm run lint` 和 `npm run test`，确保通过；
  - 尽量保持对外导出的 API 向后兼容，如需破坏性改动，应在提交描述中明确说明。