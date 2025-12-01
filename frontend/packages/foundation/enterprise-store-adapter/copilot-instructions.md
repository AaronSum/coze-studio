# @coze-foundation/enterprise-store-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/enterprise-store-adapter）中安全、高效地协作开发。

## 全局架构与定位

- 本子包是 Coze Studio 前端 monorepo 中的「企业信息状态层适配器」，位于 foundation 层，用于向上层应用暴露统一的企业态接口（hook + store + 工具函数）。
- 对外唯一入口为 src/index.ts，集中导出：
  - 常量：PERSONAL_ENTERPRISE_ID
  - Zustand store：useEnterpriseStore
  - Hook：useEnterpriseList / useCheckEnterpriseExist / useCurrentEnterpriseInfo / useCurrentEnterpriseId / useIsCurrentPersonalEnterprise / useCurrentEnterpriseRoles / useIsEnterpriseLevel / useIsTeamLevel / useIsCurrentEnterpriseInit
  - 工具方法：switchEnterprise / isPersonalEnterprise
- 当前开源版本不提供真实企业管理逻辑，所有与后端交互/状态修改相关的方法基本为空实现，仅保留类型与调用形态，方便未来闭源逻辑接入：
  - 多个文件头部注释均声明：open-source version does not provide enterprise management functions for the time being.
  - useEnterpriseStore 中的 action 函数全部为空实现；多个 hook 直接返回固定值或空数组。
- 数据流设计（目标形态，而非当前实现）：
  - 底层通过 @coze-arch/bot-api 提供的 pat_permission_api 类型描述企业实体与列表。
  - 企业列表、当前企业、企业存在性等集中保存在 Zustand store（src/stores/enterprise.ts）。
  - 业务侧通过导出的 hook 读取派生信息（企业列表、当前企业信息、角色、等级等），以及通过工具函数执行切企业等操作。
- 架构理据：
  - 用最小的 API 面向上层应用固化接口形状，以便开源版本保持与内部版本的「调用方式兼容」，即使开源实现是 no-op，也不会破坏上层代码结构。
  - 通过适配器封装企业相关状态，避免业务直接依赖具体 API 或本地存储实现。

## 目录结构与关键文件

- package.json：声明依赖、脚本与入口；main 指向 src/index.ts。
- src/constants.ts：定义 PERSONAL_ENTERPRISE_ID = 'personal'，用于标识个人企业。
- src/stores/enterprise.ts：
  - 使用 Zustand + devtools 创建 useEnterpriseStore，store key 为 botStudio.enterpriseStore。
  - defaultState：
    - isCurrentEnterpriseInit / isEnterpriseListInit / isEnterpriseExist 默认 true。
    - enterpriseId 默认 PERSONAL_ENTERPRISE_ID（个人企业）。
  - 依赖来自 @coze-arch/bot-api/pat_permission_api 的 GetEnterpriseResponseData / ListEnterpriseResponseData 类型。
  - 当前所有 action（setEnterprise、updateEnterpriseByImmer、setEnterpriseList、fetchEnterprise 等）都是空函数，fetchEnterprise 返回 void（同步 no-op）。
- src/hooks/use-enterprise-list.ts：
  - 基于 useEnterpriseStore 读取 enterpriseList 并返回 enterprise_info_list 数组；如果不存在则返回空数组。
  - 这是目前少数真正透出 store 状态的 hook。
- src/hooks/use-current-enterprise-info.ts：
  - 定义 CurrentEnterpriseInfoProps 类型 = GetEnterpriseResponseData & { organization_id?: string }。
  - useCurrentEnterpriseInfo 始终返回 null，占位实现。
  - useCurrentEnterpriseId 从 store 读 enterpriseId，是当前获取企业 ID 的唯一真实实现。
  - useIsCurrentPersonalEnterprise / useCurrentEnterpriseRoles / useIsEnterpriseLevel / useIsTeamLevel 分别固定返回 true/[]/false/false。
  - useIsCurrentEnterpriseInit 从 store 读取 isCurrentEnterpriseInit。
- src/hooks/use-check-enterprise-exist.ts：
  - 使用 zustand/react/shallow 的 useShallow，从 store 读取 isEnterpriseExist。
  - 暴露 checkEnterpriseExist（useCallback 包装，当前实现只 console.log）和 checkEnterpriseExistLoading（固定 false）。
- src/utils/switch-enterprise.ts：
  - switchEnterprise(enterpriseId: string) 返回 Promise.resolve()，不做任何实际切换，仅保留异步调用形态。
- src/utils/personal.ts：
  - isPersonalEnterprise(enterpriseId?: string) 基于 PERSONAL_ENTERPRISE_ID 做严格相等判断，是真实的工具函数实现。
- src/typings.d.ts：
  - 如存在，用于补充全局类型声明（例如 IS_DEV_MODE），AI 在编辑时需保持与 tsconfig 配置一致。
- vitest.config.ts / tsconfig*.json / eslint.config.js：沿用 monorepo 统一配置（@coze-arch/vitest-config、@coze-arch/ts-config、@coze-arch/eslint-config），不要在本包内随意发明新的构建/测试规则。

## 开发与运行流程

- 本包本身没有构建产物（scripts.build 为 `exit 0`），主要职责是向工作区其他包提供运行时 hook 和 store 类型。
- 常用脚本（在子包目录下用 rushx 或 pnpm/npx 调用）：
  - Lint：`rushx lint` 或在本目录执行 `pnpm lint`，实际命令为 `eslint ./ --cache`。
  - 单元测试：`rushx test`（vitest --run --passWithNoTests）。
  - 覆盖率：`rushx test:cov`（npm run test -- --coverage，对接 @vitest/coverage-v8）。
- 安装依赖：在 monorepo 根目录执行 `rush update`；不要在子包内直接 `npm install`。
- 本包没有独立的 dev / build 入口；所有运行场景都依赖上层应用（例如 @coze-studio/app）在浏览器中加载，并通过 workspace:* 方式引用该包。

## 依赖与集成点

- 状态管理：
  - 使用 zustand 作为核心 store 实现，并通过 zustand/middleware 的 devtools 集成 Redux DevTools。
  - devtools 的 enabled 依赖全局 IS_DEV_MODE（由上层环境注入），name 为 botStudio.enterpriseStore；在开发环境中可通过 DevTools 调试状态。
- 类型与 API：
  - @coze-arch/bot-api：提供 pat_permission_api 下企业/权限相关的响应类型，是未来真实企业逻辑的主要后端入口。
  - @coze-arch/idl、@coze-arch/bot-typings：参与接口类型生成与校验，不在本包中直接调用，仅通过类型依赖约束接口形状。
- 存储与环境：
  - @coze-foundation/local-storage：当前未在源码中直接使用，但为未来企业 ID 等本地持久化预留依赖。
- React 相关：
  - 所有 hook 假定运行在 React 18+ 环境内；package.json 将 react / react-dom 作为 peerDependencies。

## 项目约定与代码风格

- 空实现策略：
  - 绝大多数与后端和行为相关的逻辑刻意保持 no-op，仅保证类型与调用签名稳定。
  - 修改这些函数时，要优先保持 API 形状与注释中描述的语义兼容，避免破坏上层业务（即使目前没有真实调用也要假定存在）。
- 状态字段约定：
  - isCurrentEnterpriseInit / isEnterpriseListInit / isEnterpriseExist 表示「是否已完成初始化/检查」，默认值为 true，意味着开源实现视为已准备好。
  - enterpriseId 以 PERSONAL_ENTERPRISE_ID 作为兜底，保证上层逻辑即使没有企业数据也能稳定运行在「个人企业」模式。
- Hook 设计：
  - useEnterpriseList / useCurrentEnterpriseId / useIsCurrentEnterpriseInit 等返回值类型稳定，不依赖当前实现是否为 no-op。
  - 新增 hook 时，优先基于 useEnterpriseStore 派生数据，避免重复状态源。
- 日志与副作用：
  - 当前仅 useCheckEnterpriseExist 中存在 console.log，用于占位说明；避免在其他核心路径添加多余日志，以免污染宿主应用控制台。
- 类型与 ESLint：
  - 禁止在非必要场景使用 any；唯一例外是已显式用注释标记的返回 any[]。
  - 修改文件时保持现有 ESLint 配置（eslint.config.js）和 tsconfig 选项，尽量不在子包内新增局部 lint/ts 配置。

## 测试策略

- 测试框架：使用 Vitest + @testing-library/react / @testing-library/react-hooks（依赖已在 devDependencies 声明）。
- 现有测试（如 __tests__/hooks/*）主要用于验证 hook 的返回形状和默认值行为：
  - useEnterpriseList 返回空数组时的行为。
  - useCurrentEnterpriseId 与 defaultState.enterpriseId 的一致性。
  - useCheckEnterpriseExist 的默认 isEnterpriseExist / checkEnterpriseExistLoading 值等。
- 为新的 hook 或工具添加测试时：
  - 优先验证「返回值和副作用契约」而不是后端请求细节，因为本包定位为适配层。
  - 如需模拟 store 状态，使用 zustand 官方推荐的测试方式，确保不破坏其他测试用例的全局 store。

## 与仓库层面的约束与流程

- 本包受 monorepo 全局 Rush 配置约束：
  - 项目信息在 config/rush-project.json 中注册（例如 tags、reviewCategory 等）。
  - 参与 Rush 统一 lint / test 流程；CI 中通常会按 tag（如 team-studio, level-1）组合执行检查。
- 贡献流程（面向 AI agent 的约束）：
  - 避免在本包内引入新的第三方库；如确有需要，应保持与现有前端 infra 体系兼容（优先复用 @coze-arch/* 或 common 工具包）。
  - 不要修改 LICENSE、全局 README 等仓库级文件；仅在本子包范围内变更。
  - 如涉及 API 形状变更（例如改变导出的 hook 名称/签名），需要同时检查依赖本包的其他 workspace 包，确保不产生编译错误。

## 特殊/不寻常点总结

- 本包的最大特殊性在于：
  - 「接口完整，逻辑空实现」——它更像是一个稳定的 API 壳，用于保证上层业务在开源版本中可编译、可运行，但不暴露企业管理能力。
  - defaultState 将所有 init/存在性标志设置为 true，从而让上层逻辑认为企业环境已经就绪。
- 在实现新功能时，AI 需要特别注意：
  - 不要随意改变现有 hook 的默认行为（例如让 useIsCurrentPersonalEnterprise 改为动态逻辑），除非同步更新所有上游使用方并补足测试。
  - 如果需要落地真实企业逻辑，应将副作用与后端调用放在 adapter 内部，通过本包统一对外暴露，而不是让上层直接绕过 adapter 调用 @coze-arch/bot-api。
