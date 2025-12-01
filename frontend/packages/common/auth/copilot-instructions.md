# @coze-common/auth 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/auth）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包提供「空间 Space」和「项目 Project」两类权限控制的前端逻辑，面向 React 环境下的业务应用复用统一的权限模型。
- 入口文件为 src/index.ts，对外暴露两组 Hook 与枚举：
  - 空间相关：useSpaceAuth、useSpaceRole、useSpaceAuthStore、useDestorySpace、ESpacePermisson、SpaceRoleType。
  - 项目相关：useProjectAuth、useProjectRole、useProjectAuthStore、useDestoryProject、EProjectPermission、ProjectRoleType。
- 权限判定整体流程：
  - 依赖外部 SDK（@coze-arch/foundation-sdk 的 useSpace、@coze-arch/idl/developer_api 中的 SpaceRoleType / SpaceType 等）提供的空间/项目元信息与角色定义。
  - 使用 Zustand（src/space/store.ts、src/project/store.ts）维护「多空间、多项目」的角色缓存与就绪状态 isReady。
  - 通过 calc-permission.ts 中的权限映射表，将角色列表与业务权限点（ESpacePermisson / EProjectPermission）对应，最终返回布尔值。
- 数据流示意：
  - 外部组件 → 调用 use*Auth Hook → 内部通过 use*Role 读取角色（来自 Zustand store + 外部 useSpace 等）→ 调用 calcPermission → 返回是否具备某个权限点。
  - 空间 / 项目组件卸载时，通过 useDestorySpace / useDestoryProject 清理对应 ID 的缓存，避免多空间/多项目切换导致的脏数据。

## 目录结构与关键模块

- src/index.ts
  - 聚合导出所有公共 API，请在新增导出时保持 API 命名和分类（space / project）的一致性。
- src/space/
  - constants.ts：
    - 定义空间维度的权限点枚举 ESpacePermisson（更新、删除、成员管理、退出、API 管理等）。
    - 从 @coze-arch/idl/developer_api 重新导出 SpaceRoleType，作为本包对空间角色的标准类型入口。
  - store.ts：
    - useSpaceAuthStore：Zustand store，state = { roles: Record<spaceId, SpaceRoleType[]>; isReady: Record<spaceId, boolean>; }。
    - action：setRoles、setIsReady、destory。
    - 使用 devtools 中间件并依赖全局常量 IS_DEV_MODE 控制调试开关，store 名称为 botStudio.spaceAuthStore。
  - calc-permission.ts：
    - 定义 permissionMap：SpaceRoleType → ESpacePermisson[]，通过简单遍历 roles 判断是否包含某权限点。
    - 仅处理空间角色与空间权限之间的映射，不做任何远程请求。
  - use-space-role.ts：
    - 通过 @coze-arch/foundation-sdk 的 useSpace(spaceId) 获取空间信息。
    - 若空间不存在或未拉取完成，则抛出错误，提示必须在空间列表拉取后使用。
    - 通过 useSpaceAuthStore + useShallow 只订阅当前 spaceId 的 isReady 与 role，未就绪或无角色时抛出明确错误信息。
  - use-space-auth.ts：
    - 包装 useSpaceRole 与 calcPermission，对外提供 useSpaceAuth(key, spaceId) → boolean。
  - use-destory-space.ts：
    - React Hook，内部调用 useEffect 注册组件卸载回调，卸载时执行 store.destory(spaceId) 清空对应空间的数据。
- src/project/
  - constants.ts：
    - ProjectRoleType：目前仅 Owner / Editor（注明 TODO：后续替换为 IDL 输出的项目角色类型）。
    - EProjectPermission：定义项目维度的权限点（查看、编辑信息、删除、发布、资源创建/复制、项目复制、调试运行、协作者管理、回滚等）。
  - store.ts：
    - useProjectAuthStore：与空间 store 模式相同，key 由 spaceId 换为 projectId，isReady 语义保持一致。
  - calc-permission.ts：
    - 同时考虑 spaceType（SpaceType.Personal / Team）、projectRoles、spaceRoles 三者：
      - 个人空间：使用 personalSpacePermission 常量数组，给出个人空间下的完整权限集合。
      - 团队空间：先根据项目角色 projectRolePermissionMapOfTeamSpace 判定，如果不满足再根据空间角色 spaceRolePermissionMapOfTeamSpace 判定。
    - 默认 SpaceRoleType.Default 不具备任何项目权限。
  - use-project-role.ts：
    - 仅从 useProjectAuthStore 中读取指定 projectId 的 isReady 与 roles，未就绪时抛出错误提醒必须在 useInitProjectRole 完成后使用。
  - use-project-auth.ts：
    - 依赖 useSpace(spaceId) 获得 spaceType，并强制要求空间列表已拉取，未拉取将抛出错误。
    - 同时获取 spaceRoles（通过 space/use-space-role.ts）与 projectRoles，再调用项目维度 calcPermission。
  - use-destory-project.ts：
    - 与 useDestorySpace 类似，在组件卸载时清理项目维度的 store 数据。
- __tests__/
  - 目前仅存在目录，暂无具体测试文件；新加逻辑应尽量补充 Vitest 测试。

## 构建、测试与开发工作流

- 本子包为 Rush monorepo 中的一个 workspace 包，依赖上层 Rush 工具链统一管理。
- 子包级别脚本（在 frontend/packages/common/auth 下）：
  - 构建：npm run build
    - 当前实现仅为占位（exit 0），真实构建通常由上层工具（如 rsbuild / bundler）在应用层统一执行。
  - 测试：npm test 或 npm run test
    - 使用 vitest --run --passWithNoTests，配置文件为 vitest.config.ts（依赖 @coze-arch/vitest-config）。
    - 覆盖率：npm run test:cov 触发 vitest coverage-v8。
  - Lint：npm run lint
    - 调用 eslint ./ --cache，配置继承自 monorepo 的 @coze-arch/eslint-config，具体规则在根配置中统一维护。
- 在 monorepo 根或 frontend 根常见工作流（供 AI 在需要时调用）：
  - 安装依赖：rush update。
  - 执行本包相关命令时，优先通过 rushx（若在 rush.json 中注册）或在子包目录直接使用 npm scripts。

## 项目特定约定与模式

- 状态管理：
  - 统一使用 Zustand + devtools，中间件配置需保持 enabled: IS_DEV_MODE、name 前缀为 botStudio.*，便于在 DevTools 中区分不同 store。
  - Store 结构设计为 roles 与 isReady 分离，外部 Hook 只有在 isReady === true 时才允许使用角色数据，避免「还未初始化就读取」的竞态问题。
- Hook 使用契约：
  - useSpaceRole / useSpaceAuth / useProjectRole / useProjectAuth **都假定调用前已经完成相应的初始化 Hook**（如 useInitSpaceRole、useInitProjectRole），否则会通过抛出 Error 的方式显式提示时序问题。
  - 依赖 @coze-arch/foundation-sdk 的 useSpace，在 space 信息未就绪时同样会抛错；AI 在接入这些 Hook 时应确保外部组件树中已经挂载好负责拉取空间/项目列表的 Provider 与初始化逻辑。
- 错误处理风格：
  - 对于「调用时机不正确」这类逻辑错误，倾向于直接抛出人类可读的 Error 文本，而不是静默返回 false；新增 Hook 时应保持这种风格，帮助上层开发者及时发现错误使用方式。
- 命名与导出：
  - 空间维度统一前缀 Space / space，项目维度统一前缀 Project / project；销毁相关 Hook 统一拼写 useDestorySpace / useDestoryProject（即便存在拼写问题，也需保持与现有 API 一致）。
  - 对外 API 统一从 src/index.ts 聚合导出，避免业务代码直接引用内部文件路径。
- 权限映射：
  - 权限点枚举（ESpacePermisson / EProjectPermission）在本包内定义，角色枚举则尽量从 IDL 包导出，以保证前后端/多端协议一致。
  - 权限逻辑全部在本地内存计算，不做异步请求，便于测试和复用；AI 在修改权限表时需保持「仅数据表变更，不引入副作用」。

## 外部依赖与集成要点

- 核心外部依赖：
  - @coze-arch/foundation-sdk
    - 提供 useSpace(spaceId) 等 Hook，用于获取空间信息（包含 space_type 等关键字段）。
  - @coze-arch/idl & @coze-arch/bot-typings
    - 暴露 SpaceRoleType、SpaceType 等类型枚举，保障与后端协议一致。
  - Zustand 与 zustand/middleware、zustand/react/shallow
    - 用于构建 store，并保证选择器订阅的性能；使用 useShallow 时注意保持 selector 返回对象结构稳定。
  - React 18 Hooks
    - useEffect 在销毁 Hook 中的使用遵循标准 React 生命周期。
- 工具与基础设施：
  - @coze-arch/logger / @coze-arch/report-events
    - 目前本包未直接使用，但作为 monorepo 常见依赖，后续若引入日志或埋点，应优先复用这些工具而非自行实现。

## 开发生命周期与协作规范

- 分支与发布：
  - 具体分支策略在 monorepo 根（如 CONTRIBUTING.md、README 等）统一约定；本包本身不包含独立的发布脚本，由 Rush workspace 管理版本与发布。
- 代码风格：
  - 保持与现有文件一致的头部版权声明与 Apache-2.0 License 说明。
  - 遵循 TypeScript 严格类型约束，优先显式声明接口与枚举，不在权限相关逻辑中使用 any。
- 变更建议：
  - 若需扩展权限点或角色映射，优先在 constants.ts 中新增或调整枚举，再在 calc-permission.ts 中维护映射表，保持逻辑集中。
  - 新增 Hook 时，应：
    - 放置在对应空间/项目目录下。
    - 在 index.ts 中导出。
    - 为其约束的「调用时机」写清楚错误信息，并在必要时补充测试。

## 不寻常与易踩坑点

- 命名中的 destory：
  - useDestorySpace / useDestoryProject 以及 store.destory 方法均存在拼写错误，但已作为对外 API 形成事实标准，不建议随意更名；若要重命名，需要提供兼容导出或迁移方案。
- 依赖的全局常量 IS_DEV_MODE：
  - 来自上层构建环境（通常由 bundler/DefinePlugin 注入），用于控制 Zustand devtools 是否启用；在测试或 Node 环境下若缺失，需确保构建工具会注入或在测试配置中做 shim。
- Hook 的「必须在列表拉取后使用」约束：
  - useSpaceRole 与 useProjectRole 在 isReady 为 false 时会直接抛错，这对组件调用顺序与渲染时机有严格要求；AI 在改动或新接入时，需要显式确认「初始化完成 → 再调用权限 Hook」。
  - 错误文案中提到的 useInitSpaceRole / useInitProjectRole 并不在本包内实现，而是由上层业务提供，文案仅作为使用指引。