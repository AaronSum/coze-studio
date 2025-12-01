# @coze-arch/bot-studio-store 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-store）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包提供「Bot Studio 级别的全局状态层」，属于 frontend/packages/arch/ 体系中的底座基础设施之一，定位是为上层应用（如 coze-studio 前端）提供统一的 Store 能力，而非页面或业务组件。
- 核心出口位于 src/index.ts，统一 re-export 其他包与本地模块：
  - 通过 @coze-foundation/space-store 暴露空间相关的 React hooks：useSpaceStore、useSpace、useSpaceList（已标记为废弃，仅做兼容层）。
  - 通过本地 src/auth 暴露 useAuthStore，用于鉴权与用户会话相关状态管理。
  - 通过本地 src/utils 暴露 clearStorage（已标记废弃，存在持久化方案问题，仅保留兼容能力）。
  - 通过本地 src/space-gray 暴露 useSpaceGrayStore、TccKey，用于空间灰度 / 开关类配置的状态管理。
- 状态实现层技术栈：
  - 使用 zustand 作为状态容器，immer 作为不可变数据更新的辅助，localforage 作为持久化存储抽象，lodash-es 作为通用工具库。这些在实际 store 实现所在的依赖包中使用，本子包本身主要负责导出和部分工具逻辑。
- 架构设计要点：
  - 「arch」层包通常不直接承载复杂业务 UI，而是提供「能力层」：store、SDK、hooks、工具等。
  - 对外暴露 API 尽量稳定、兼容；当需要迁移到新的 SDK（如 @coze-arch/foundation-sdk）时，使用废弃标记进行过渡。

## 目录结构与关键模块

- src/index.ts
  - 本包唯一对外入口，所有新增公共 API 需在此聚合导出。
  - 废弃 API 需保持导出并添加清晰 JSDoc 注释说明迁移路径。
- src/auth/
  - 入口文件 index.tsx 暴露 useAuthStore。
  - 典型职责：登录状态、Token、用户信息、权限相关轻量状态；实现上通常会：
    - 使用 zustand 创建 store；
    - 可结合 localforage / localStorage 做登录信息缓存；
    - 与 @coze-arch/bot-api、@coze-arch/bot-error 等交互，发起鉴权相关请求并处理错误。
- src/space-gray/
  - 入口文件 index.ts 暴露 useSpaceGrayStore 与 TccKey。
  - 用于空间维度的灰度 / 开关控制，通常会：
    - 将远端灰度配置缓存到 store；
    - 提供按 key 查询 / 判定灰度状态的工具方法；
    - 与 @coze-arch/bot-flags、@coze-arch/report-events 等协同使用，控制实验/开关与上报。
- src/utils/get-storage.ts
  - 导出 clearStorage（被 index.ts 标记为废弃），通常与 localforage/localStorage 交互以清空本地持久化状态。
  - 当前已知设计问题：持久化方案不完善，未来推荐通过上层 foundation-sdk 或统一 storage 抽象来管理本地状态。
- 根目录文件
  - package.json：定义脚本与依赖，是确定构建/测试/运行方式的唯一来源；本包目前不做真正的 build，仅参与类型及运行时打包。
  - README.md：对外功能说明与导出 API 列表，可作为新增能力的对外文档入口。
  - vitest.config.ts / setup-vitest.ts：统一使用 @coze-arch/vitest-config 预设，约束测试运行环境为 web 场景，并支持统一的测试初始化逻辑。
  - eslint.config.js：复用 @coze-arch/eslint-config 中的 web 预设，对 DataItem 声明为全局变量以兼容业务场景。

## 开发工作流与常用命令

- 依赖安装与更新（在 monorepo 根目录执行）：
  - rush install：首次安装或初始化依赖。
  - rush update：根据 lock 文件更新依赖，确保与 monorepo 版本对齐。
- 子包内脚本（在 frontend/packages/arch/bot-store 下）：
  - 测试：
    - npm test 或 pnpm test：等价于 vitest --run --passWithNoTests。
    - npm run test:cov：在上述基础上开启 coverage 统计。
  - Lint：
    - npm run lint：运行 ESLint，开启缓存以提升本地迭代效率。
  - 构建：
    - npm run build：当前实现为 exit 0，仅用于满足 Rush / CI 对构建脚本存在性的要求，本子包真正的产出随应用打包流程走（Rsbuild + monorepo 打包）。
- 全局前端工作流（在 frontend/ 根目录）：
  - 参考 frontend/README.md：
    - 启动主应用：cd apps/coze-studio && npm run dev 或 rushx dev。
    - 构建主应用：cd apps/coze-studio && npm run build 或 rushx build。
  - 本子包通常不独立启动服务，而是在主应用运行时被消费；修改本子包代码后，需要重启或让 bundler 热更新生效。

## 项目约定与编码规范

- TypeScript 与类型约定
  - 全面使用 TypeScript，类型配置由 @coze-arch/ts-config 统一管理；本子包使用 tsconfig.json / tsconfig.build.json / tsconfig.misc.json 区分开发、构建与工具场景。
  - 公共类型声明通过 src/type.d.ts、src/data_item.d.ts 等文件提供，并在 ESLint 中设置为全局（如 DataItem）。
  - 向外暴露的类型应保持稳定，谨慎破坏性变更；新增导出类型时务必更新 README.md 的 API 列表。
- 状态管理模式
  - 统一基于 zustand，配合 immer 进行不可变更新，避免手写深拷贝逻辑。
  - 对需要持久化的 state，优先抽象为 storage 工具（如 get-storage.ts）或上层统一 storage 模块，而非在多个 store 内分散实现持久化逻辑。
  - 对外暴露的 hooks 应遵守「单一职责」原则：每个 hook 只关心一个 store 或一个领域的状态，避免在单个 hook 中混合多个 store 的逻辑。
- 废弃能力管理
  - 所有废弃 API 必须使用 JSDoc 的 @deprecated 标记，并在注释中提供推荐迁移路径（例如迁移到 @coze-arch/foundation-sdk）。
  - 在 index.ts 中保留导出，以兼容存量调用，但在 README.md、示例代码与新增 Feature 中不得再使用。
- 代码风格
  - ESLint 配置来自 @coze-arch/eslint-config，preset 为 web；不要在本包内覆盖全局通用规则，仅针对本包特例（如全局变量）做轻量补充。
  - 推荐遵循函数式风格处理状态变化，避免在 store 外部直接修改内部状态对象。

## 与其他子包和外部依赖的集成

- 与 @coze-foundation/space-store
  - 本子包当前将 space-store 的 hooks 直接透传导出，用于历史兼容。
  - 新功能建议直接依赖 foundation-sdk 或上层数据/SDK 包，而非继续扩展此透传层；如果必须扩展，请在 README.md 中明确标记为 legacy 或 bridge 角色。
- 与 @coze-arch/foundation-sdk
  - README.md 与 src/index.ts 中均提示部分 hooks 已迁移到 foundation-sdk，是未来主推的统一 SDK 层。
  - 当在本包中需要新增 SDK 相关能力时，应优先考虑在 foundation-sdk 内实现，再由本包根据需要是否透传导出。
- 与 @coze-arch/bot-api、@coze-arch/bot-error
  - useAuthStore 等 store 可能会依赖 bot-api 发起网络请求，依赖 bot-error 做统一错误封装与上报。
  - AI 助手在修改这类逻辑时，需遵守：
    - 不直接使用裸 fetch/axios，而是通过 bot-api 暴露的调用封装；
    - 错误处理统一走 bot-error 或上层 error boundary，不在 store 内吞掉错误。
- 与 @coze-arch/bot-flags、@coze-arch/report-events
  - space-gray 相关能力配合 bot-flags 控制开关、与 report-events 做埋点上报。
  - 修改灰度逻辑时需确保：
    - 不改变已有 key 的语义（TccKey）；
    - 灰度判定变化需要与埋点字段保持一致，否则可能影响分析结果。
- 与 @coze-arch/logger
  - 如在 store 内新增日志，请优先使用 logger 包而非 console.log，以便在不同环境下做统一日志收集与降噪处理。

## 测试策略与注意事项

- 测试框架
  - 使用 Vitest 作为单元测试框架，配置由 @coze-arch/vitest-config 统一管理，preset 为 web。
  - setup-vitest.ts 可用于：
    - 配置 jsdom 环境；
    - 注册测试全局变量/Mock；
    - 初始化通用测试工具（如 @testing-library/react-hooks）。
- 测试组织
  - 建议在 __tests__/ 或与源码同级的 *.test.ts(x) 中编写测试；本包已有 __tests__ 目录，可继续沿用。
  - 对于 store：
    - 重点测试状态变更逻辑、初始化状态、持久化读写、副作用（如调用 API 时的状态流转）；
    - 避免依赖真实后端，可通过 Mock bot-api 层来保证测试稳定性。
- 覆盖率
  - npm run test:cov 可以输出 coverage 报告；CI 或质量门槛通常由 monorepo 统一控制，本包内新增核心逻辑时推荐补充测试以维持整体覆盖率水平。

## 分支、提交与发布流程（与主仓库保持一致）

- 分支策略
  - 主仓库通常采用 main + 功能分支 模式；本子包不单独维护专用分支，所有更改通过全局分支合并。
  - 大改动建议按模块拆分为多次提交，每次只修改有限范围的包，方便 Code Review。
- 提交规范
  - 遵循主仓库的提交规范（可参考根目录 CONTRIBUTING.md），例如：
    - 使用语义化前缀（feat、fix、refactor、test 等）；
    - 提交信息中注明受影响的子包名（如 feat(bot-store): add space gray config）。
- 发布与版本
  - 包版本与发布由 Rush / monorepo 顶层流程统一管理，本子包自身不直接发布到 npm。
  - 当修改涉及对外 API 变更时，需要在 PR 中明确说明影响范围，并根据需要调整版本号类型（patch/minor/major），由维护者在发布阶段统一处理。

## 非常规 / 需要特别注意的点

- build 脚本仅作占位，不要在本包内实现独立的打包流程；如需修改构建，请在 frontend/config/rsbuild-config 或上层应用构建配置中处理。
- clearStorage 已被标记废弃：
  - 新代码不要再依赖该工具；
  - 如需清理本地持久化状态，应通过统一 storage 抽象或 foundation-sdk 提供的能力实现。
- useSpaceStore / useSpace / useSpaceList 已明确标记废弃：
  - 新增功能请优先使用 foundation-sdk；
  - 如果遗留代码必须调整，请保持导入路径不变，避免在一次重构中同时修改多个子包的导入方式，降低回滚成本。
- 本包处于「架构基础层」：
  - 修改任何导出 API、持久化逻辑、鉴权状态都会对多个上层应用产生级联影响；
  - AI 助手在进行重构或行为变更前，应优先选择向后兼容策略（新增 API + 标记旧 API 废弃），避免直接移除或修改现有签名。
