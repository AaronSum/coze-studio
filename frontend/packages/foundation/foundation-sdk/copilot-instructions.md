# foundation-sdk 子包开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/foundation-sdk）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本子包是「基座 SDK 适配层」，主要作用是：
  - 复用 @coze-arch/foundation-sdk 中定义的类型 / 能力约定（"规范"）。
  - 将这些抽象能力落地到具体实现：账号体系、空间（space）数据、主题等。
  - 向上游业务暴露一个稳定、简单的 API 面（统一从本包引入）。
- 核心入口在 src/index.ts：
  - 暴露 useCurrentTheme、用户相关查询 & hooks、空间查询 useSpace。
  - 直接 re-export 布局组件 BackButton、SideSheetMenu（来自 @coze-foundation/layout）。
- 三个主要实现模块：
  - src/passport.ts：与登录登出、头像上传等「账号通行证」相关的 SDK 实现。
  - src/user.ts：用户及其登录状态、鉴权信息相关的同步 API 和 React hooks。
  - src/space.ts：基于 space-store 的空间数据读取封装。
- 数据流整体模式：
  - 类型与接口定义由 @coze-arch/foundation-sdk、@coze-arch/bot-api 提供（偏协议层）。
  - 真实数据与副作用由 @coze-foundation/account-adapter、@coze-foundation/space-store 等提供（偏实现层）。
  - 本包做的是「类型对齐 + API 归一化 + 对外导出」。

## 2. 源码结构总览

- package.json
  - main 指向 src/index.ts，scripts：
    - build: "exit 0"（当前构建由上层 monorepo 统一处理，本包本地不做独立构建）。
    - lint: eslint ./ --cache
    - test: vitest --run --passWithNoTests
    - test:cov: npm run test -- --coverage
  - dependencies：
    - @coze-arch/foundation-sdk：提供抽象 SDK 类型定义。
    - @coze-arch/coze-design：UI 设计系统，当前用于 useTheme。
    - @coze-foundation/account-adapter：账号相关适配器，提供实际实现（登录、用户信息等）。
    - @coze-foundation/layout：基础布局组件（BackButton、SideSheetMenu）。
    - @coze-foundation/space-store：空间（space）状态管理和 hooks。
- src/index.ts
  - useCurrentTheme：
    - 引入类型：type useCurrentTheme as useCurrentThemeOfSDK from @coze-arch/foundation-sdk。
    - 实现：基于 useTheme().theme（来自 @coze-arch/coze-design）。
    - 使用 typeof ... 保证导出签名与基座 SDK 对齐。
  - 用户相关导出统一从 ./user re-export。
  - passport 能力（logoutOnly、uploadAvatar）从 ./passport re-export。
  - 导出 BackButton、SideSheetMenu（直接透传 @coze-foundation/layout）。
  - 导出 useSpace（来自 ./space）。
- src/passport.ts
  - 从 @coze-arch/foundation-sdk 引入 logoutOnly、uploadAvatar 的类型别名。
  - 从 @coze-foundation/account-adapter 引入具体实现：logout、passportApi。
  - logoutOnly：
    - 直接使用 account-adapter 的 logout 实现，并通过 `satisfies typeof logoutOnlyOfSdk` 校验签名。
  - uploadAvatar：
    - 作为强类型包装：`(avatar: File) => passportApi.uploadAvatar({ avatar })`。
- src/user.ts
  - 从 @coze-arch/foundation-sdk 引入一整套用户相关 API 类型：
    - refreshUserInfo, getIsSettled, getIsLogined, getUserInfo,
      useIsSettled, useIsLogined, useUserInfo,
      getLoginStatus, useLoginStatus,
      getUserAuthInfos, useUserAuthInfo, useUserLabel,
      subscribeUserAuthInfos。
  - 从 @coze-foundation/account-adapter 引入实际实现：
    - refreshUserInfoImpl, getLoginStatusImpl, useLoginStatusImpl,
      getUserInfoImpl, useUserInfoImpl, getUserAuthInfosImpl,
      useUserAuthInfoImpl, useUserLabelImpl, subscribeUserAuthInfosImpl。
  - getIsSettled / getIsLogined / useIsSettled / useIsLogined 标记为 @deprecated：
    - 逻辑均基于 getLoginStatus / useLoginStatus 派生（"settling" / "logined" 枚举判断）。
    - 说明新代码应直接使用 getLoginStatus / useLoginStatus，而不要再新增对旧 API 的依赖。
  - 其他导出均直接赋值并通过 satisfies 约束签名：
    - getUserInfo, getUserAuthInfos, useUserInfo,
      useUserAuthInfo, useUserLabel, subscribeUserAuthInfos,
      refreshUserInfo, useLoginStatus, getLoginStatus。
- src/space.ts
  - 从 @coze-arch/bot-api/developer_api 引入 BotSpace 类型。
  - 从 @coze-foundation/space-store 引入 useSpace（命名为 useInternalSpace）。
  - 对外导出 useSpace(spaceId: string): BotSpace | undefined：
    - 内部调用 useInternalSpace(spaceId)，只返回其中的 space 字段。
    - 对上层隐藏具体 state 结构，仅暴露 BotSpace 概念。
- __tests__/index.test.ts
  - 当前仅包含占位测试（expect(1).toBe(1)）。
  - 实际业务测试尚未补齐，新代码需要按项目习惯在 __tests__ 下新增对应测试文件。
- 配置文件
  - vitest.config.ts：使用 @coze-arch/vitest-config 的 defineConfig，preset 为 node。
  - tsconfig.json：
    - composite: true，启用 TypeScript project references。
    - references 指向 tsconfig.build.json、tsconfig.misc.json（由 monorepo 统一管理）。
    - exclude: ["**/*"]，顶层配置只做引用，不参与编译细节。
  - eslint.config.js：使用 @coze-arch/eslint-config 的 defineConfig，preset 为 node。

## 3. 开发工作流（构建 / 测试 / 调试）

> 注意：本包运行在 Rush monorepo 之内，下述命令通常由 monorepo 顶层脚本统一调起；这里只记录在本子包下常用的直接命令。

- 安装依赖
  - 在仓库根目录执行：
    - `rush update`
- 本包相关命令（在 frontend/packages/foundation/foundation-sdk 内）：
  - 测试：
    - `npm test` 或 `pnpm test`（具体包管理器取决于 monorepo 约定，但脚本统一为 `vitest --run --passWithNoTests`）。
    - 覆盖率：`npm run test:cov`。
  - Lint：
    - `npm run lint`，基于 @coze-arch/eslint-config 的 node preset。
  - 构建：
    - `npm run build` 当前只是 `exit 0`，实际打包由上层构建体系处理（如 rsbuild / bundler）。
- 调试建议
  - 由于本包大部分只是对其他 adapter 的薄封装，调试时建议：
    - 在上层应用（如 frontend/apps/coze-studio）中使用这些导出函数 / hooks 观察行为。
    - 如果需要单独验证逻辑，可在 __tests__ 中通过 Vitest 对这些导出做单元测试，使用 jest 风格断言。

## 4. 项目特定约定与模式

- 「类型约束优先」模式
  - 本包大量使用 `satisfies typeof XxxOfSdk`，目的：
    - 确保导出的实现与 @coze-arch/foundation-sdk 中的类型签名完全一致。
    - 如果基座 SDK 升级导致签名变化，编译期会直接报错，提醒同步调整。
  - AI 助手在新增导出或修改导出实现时，应优先：
    - 从 @coze-arch/foundation-sdk 导入对应类型。
    - 用 `const impl = ... satisfies typeof XxxOfSdk` 这种模式收口。
- 「适配层不持有业务状态」
  - 本包不直接维护任何全局 state 或 React context，仅调用：
    - @coze-foundation/account-adapter 提供的 hooks / 函数。
    - @coze-foundation/space-store 提供的 hooks。
  - 任何需要状态存储、缓存、订阅的逻辑，应继续放在对应 adapter / store 包中，而不是在本包新增。
- 「弃用 API 的过渡处理」
  - getIsSettled / getIsLogined / useIsSettled / useIsLogined 均带有 JSDoc `@deprecated`。
  - 它们内部统一通过 getLoginStatus / useLoginStatus 派生布尔值。
  - 新增功能：
    - 不要再新引入对这些 deprecated API 的依赖。
    - 如需布尔语义，请直接在业务侧基于 getLoginStatus / useLoginStatus 做判断。
- 「空间 API 的最小暴露」
  - useSpace 仅返回 BotSpace | undefined，不透出内部 store 结构或其他元信息。
  - 如果后续需要更多空间相关信息，建议先升级 @coze-arch/bot-api 中的类型约定，再在本包做最小适配。
- 命名约定
  - 对于从 adapter 引入的实现，统一使用 XxxImpl 命名（如 getUserInfoImpl、useLoginStatusImpl）。
  - 对外导出的名称与 @coze-arch/foundation-sdk 接口名称一致，保持调用方无缝切换。

## 5. 外部依赖与集成细节

- @coze-arch/foundation-sdk
  - 定义了本包应当实现的能力与类型签名（如 logoutOnly、uploadAvatar、useCurrentTheme、用户 / 登录状态 API 等）。
  - 本包通过 `import type ...` 方式依赖这些声明，避免编译时循环依赖。
- @coze-arch/coze-design
  - 提供 UI 设计系统，包括 useTheme hook。
  - useCurrentTheme 的实现依赖 useTheme().theme，返回值应符合基座 SDK 对主题的类型定义。
- @coze-foundation/account-adapter
  - 对接后端账号体系的适配层，负责：
    - 登录状态管理（getLoginStatus / useLoginStatus）。
    - 用户信息拉取与订阅（getUserInfo / useUserInfo / refreshUserInfo 等）。
    - 用户鉴权信息（getUserAuthInfos / useUserAuthInfo / subscribeUserAuthInfos）。
    - 用户标签（useUserLabel）。
    - passportApi.uploadAvatar 等通行证相关接口。
  - 本包只负责：
    - 复用其实现。
    - 把 API 名称及签名对齐到 @coze-arch/foundation-sdk 的约定。
- @coze-foundation/layout
  - 提供通用布局组件 BackButton、SideSheetMenu。
  - 本包只是 re-export，使上层只依赖 @coze-foundation/foundation-sdk 即可获取常用布局能力。
- @coze-foundation/space-store
  - 包含 useSpace 及空间相关 state 管理。
  - 本包的 useSpace 对其做了最小包装，只暴露 BotSpace | undefined。
- @coze-arch/bot-api
  - developer_api 中定义了 BotSpace 等类型，是空间相关数据的统一协议。

## 6. 团队开发流程与规范（从现有文件推断）

- 代码风格
  - 使用 @coze-arch/eslint-config 管理 ESLint 规则，preset 为 node。
  - TypeScript 工程采用 project references，由顶层 tsconfig.build.json 控制具体编译选项。
- 测试规范
  - 使用 Vitest，配置封装在 @coze-arch/vitest-config 中，preset 为 node：
    - 测试文件当前放在 __tests__ 目录。
    - 测试框架语法与 Jest 基本一致（describe / it / expect）。
  - 目前仅有占位测试，新增功能时应在 __tests__ 下增加与导出 API 对应的测试。
- 版本与发布
  - 版本号由 monorepo 统一管理（package.json version: 0.0.1，真实发布流程在仓库其他位置）。
  - 本包作为 "foundation" 层组件，通常在下游大量使用，修改需谨慎，尽量保持 API 向后兼容。

## 7. 对 AI 助手的具体协作建议

> 以下为在本子包内进行修改 / 扩展时，AI 编程助手需要遵守的「操作性」规则。

- 修改 / 新增导出时：
  - 必须从 @coze-arch/foundation-sdk 引入对应类型，并使用 `satisfies typeof XxxOfSdk` 做最终赋值校验。
  - 不要在本包新增额外的全局状态或副作用逻辑，所有真实数据访问应继续通过现有 adapter（account-adapter / space-store 等）。
- 处理登录状态相关逻辑时：
  - 新代码优先使用 getLoginStatus / useLoginStatus，而不是旧的 getIsLogined / useIsLogined 族。
  - 如要维护兼容性，可在本包继续提供向后兼容的包装，但必须添加 @deprecated 注释说明迁移方向。
- 处理空间（space）相关逻辑时：
  - 保持 useSpace 的返回类型为 BotSpace | undefined，不要在返回值中混入 store 细节。
  - 如确有需要暴露更多字段，先确认 @coze-arch/bot-api 中是否已有对应类型定义，再在本包对齐。
- 引入新依赖前：
  - 优先复用 monorepo 中已有的 adapter / 工具包。
  - 仅在确认无合适现有包时，才考虑新增依赖，并应遵守仓库级别的依赖管理规范（参考 frontend/disallowed_3rd_libraries.json 等）。
- 更新测试：
  - 对新增或修改的导出，建议在 __tests__/index.test.ts 或新增测试文件中补充相应用例。
  - 使用 Vitest 的 describe / it / expect 结构，保持与当前占位测试风格一致。

以上信息均基于当前仓库内容提取，如上游 adapter / 基座 SDK 有更新，需同步检查本包是否仍然满足类型约定与行为预期。