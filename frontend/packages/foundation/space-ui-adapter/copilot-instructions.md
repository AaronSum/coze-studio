# space-ui-adapter 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/space-ui-adapter）中安全、高效地协作开发。

## 一、子包角色与整体架构
- 定位：space-ui-adapter 是工作空间（Space）相关 UI 的「适配层」，主要负责在 Studio 应用中接入通用的 space-ui-base 能力，并对接空间状态 store、路由、副语言等工程基础设施。
- 对外导出点：见 src/index.tsx，统一从本包输出下列能力供上层应用使用：
  - Space 布局容器：SpaceLayout
  - 工作空间左侧子菜单：WorkspaceSubMenu
  - 初始化空间的 Hook：useInitSpace
  - 子模块枚举：SpaceSubModuleEnum
- 上游依赖：
  - @coze-foundation/space-ui-base：基础 workspace UI 能力（菜单容器、空间初始化逻辑等），本包在其之上做业务适配。
  - @coze-foundation/space-store：基于 Zustand 的空间状态（当前空间信息、空间列表、fetchSpaces 等）。
  - @coze-arch/coze-design：统一 UI 组件库（Space、Avatar、Typography、Empty、Icon* 等）。
  - @coze-arch/i18n：国际化文案系统，通过 I18n.t 获取多语言文案。
  - @coze-arch/bot-hooks：路由级 Hook（useRouteConfig），用于读取当前子菜单 key 等路由上下文。
- 运行时数据流（典型空间页面）：
  - 路由层通过 React Router v6 进入 workspace 相关路由，SpaceLayout 作为该路由的 layout 组件包裹子路由（Outlet）。
  - SpaceLayout 内部使用 useInitSpace 初始化当前 space 及空间列表数据；当不存在任何空间时，展示统一的 Empty 空状态。
  - WorkspaceSubMenu 读取空间 store 中的当前空间信息，拼装菜单配置（图标、文案、子模块 path），并委托给 space-ui-base 中的 WorkspaceSubMenu 组件实际渲染。

## 二、源码结构说明
- 根目录关键文件
  - package.json：
    - main: src/index.tsx
    - scripts：
      - build: 目前为 "exit 0"，真实打包由上层 Rsbuild / Rush 统一处理，本包不单独构建。
      - lint: eslint ./ --cache
      - test: vitest --run --passWithNoTests
      - test:cov: npm run test -- --coverage
    - dependencies：仅依赖 workspace 内部包和 React 生态，无额外构建脚本。
  - eslint.config.js：使用 @coze-arch/eslint-config，preset 为 web，确保与其他前端子包风格一致。
  - tsconfig.json：仅做 references 转发到 tsconfig.build.json 与 tsconfig.misc.json，具体编译配置由统一 ts-config 管理。
  - vitest.config.ts：通过 @coze-arch/vitest-config.defineConfig 使用 preset "web"，与整个前端仓库保持一致的测试环境。
- src 目录
  - src/index.tsx：包的公共导出入口；新增导出能力时务必在此聚合，保证外部只依赖此入口。
  - src/const.ts：
    - 定义 SpaceSubModuleEnum，枚举当前支持的子模块（develop、library）。
    - 与路由 path、菜单配置严格对应，新增子模块时需同时更新这里和 WorkspaceSubMenu。
  - src/hooks/use-init-space.ts：
    - 封装对 @coze-foundation/space-ui-base 中 useInitSpace 的调用，并注入本项目的空间 store：
      - fetchSpacesWithSpaceId：通过 useSpaceStore.getState().fetchSpaces(true) 拉取空间列表。
      - isReady：固定为 true，表示当前环境准备完毕。
    - 返回值直接透传 base hook，用于 SpaceLayout 等组件消费。
  - src/components/space-layout/index.tsx：
    - 作为 workspace 路由的布局容器，核心职责：
      - 从 URL params 中读取 space_id。
      - 调用 useInitSpace(space_id) 初始化空间状态。
      - 当 loading 结束且空间列表为空时，展示统一 Empty 态（包含插画和 i18n 文案）。
      - 否则渲染 <Outlet />，由子路由决定实际内容。
  - src/components/workspace-sub-menu/index.tsx：
    - 基于 space-ui-base 的 WorkspaceSubMenu 做一层业务包装：
      - 通过 useRouteConfig 读取当前子菜单 key，用于高亮当前菜单。
      - 通过 useSpaceStore 读取当前空间（name、icon_url 等），构造 headerNode。
      - 使用 @coze-arch/coze-design 的 IconCoz* 和 Space/Avatar/Typography 组件渲染菜单与头部。
      - 菜单项的 path 取自 SpaceSubModuleEnum，文案通过 I18n.t 获取；dataTestId 用于 E2E / 端到端测试。

## 三、开发与调试流程
- 安装依赖（在仓库根目录）
  - rush install 或 rush update
- 本包构建 / 引用方式
  - 本包不单独产出构建物，build 脚本为 no-op，依赖前端整体 Rsbuild 编译。
  - 在应用侧（例如 apps/coze-studio）通过 Rush workspace 引用："@coze-foundation/space-ui-adapter": "workspace:*"。
- 启动整体应用验证改动
  - 在 frontend 目录下：
    - 进入目标应用目录（如 apps/coze-studio），执行 npm run dev 或 rushx dev。
  - 路由进入 workspace 场景后，即可验证 SpaceLayout 和 WorkspaceSubMenu 的行为。
- 运行本包测试
  - 在本子包目录执行：
    - npm test：使用 Vitest 跑单测，--passWithNoTests 允许当前无测试文件。
    - npm run test:cov：在此基础上生成覆盖率。
  - 测试环境由 @coze-arch/vitest-config 统一注入，不需要在本包额外配置 jsdom 等。
- Lint
  - 在本子包目录执行 npm run lint，使用 monorepo 统一的 ESLint 规则（preset: web）。

## 四、项目特有约定与模式
- 空间初始化与数据读取约定
  - 空间列表与当前空间均来自 @coze-foundation/space-store，禁止在 UI 层直接发起请求或绕过 store。
  - 所有需要「确保空间已加载」的组件，应通过 useInitSpace 或其上游能力，而不是自行维护 loading 状态。
  - useInitSpace 的 fetchSpacesWithSpaceId 回调必须使用 useSpaceStore.getState() 访问 store，以保证与全局 Zustand store 一致。
- 子菜单与路由绑定模式
  - 子菜单 path 统一使用 SpaceSubModuleEnum 中的值，避免字符串散落在多处。
  - 当前子菜单高亮依赖 useRouteConfig 提供的 subMenuKey，新增子模块时需先在路由配置中注册对应 key，再在 WorkspaceSubMenu 中使用。
  - 菜单文案通过 I18n.t(label_key, {}, fallback) 获取，要求提供默认英文 fallback，避免缺失文案导致空白。
- UI 组件与样式约定
  - 所有 UI 组件应优先使用 @coze-arch/coze-design，避免直接引入其他 UI 库。
  - 样式侧统一采用 Tailwind 类名和项目自定义 token（如 coz-fg-primary、coz-mg-secondary-hovered 等），不要写内联 style。
  - 空状态组件统一使用 Empty + 插画 + i18n 文案，保持体验一致。
- 导出与公共 API
  - 对外只暴露 index.tsx 中导出的符号，如需新增组件/hook，先在各自目录实现，再在 index.tsx 聚合导出。
  - 避免从内部路径（如 src/components/...）被外部包直接引用，以免破坏封装。

## 五、与其他模块的集成关系
- 与 space-ui-base 的关系
  - space-ui-base 提供通用的 WorkspaceSubMenu、useInitSpace 等通用能力，本包在其之上：
    - 绑定 Coze Studio 侧的空间 store（useSpaceStore）。
    - 绑定 Studio 侧路由结构和子模块定义（SpaceSubModuleEnum）。
    - 实现符合 Studio 视觉规范的菜单图标与布局。
- 与 space-store 的关系
  - store 负责实际的数据获取与缓存（例如 fetchSpaces），本包只通过 hook/selector 使用，不处理请求细节。
  - useSpaceStore.getState().fetchSpaces(true) 中的 true 表示强制刷新空间列表，具体含义遵循 space-store 的实现。
- 与路由系统的关系
  - 依赖 React Router v6 的 Outlet 和 useParams：
    - SpaceLayout 必须被挂载在带有 space_id param 的路由层级下，否则 space_id 可能为 undefined。
  - 依赖 @coze-arch/bot-hooks 的 useRouteConfig 暴露的 subMenuKey，与上层路由配置紧密耦合，修改路由时需同步调整菜单 path 与 key 映射。

## 六、流程与协作规范
- 代码质量要求
  - 覆盖率门槛受 frontend/rushx-config.json 中 level-3 配置约束：当前整体 coverage 要求为 0，但仍建议为功能性改动补充基本单测。
  - 所有提交需通过 ESLint 和 TypeScript 编译，避免使用 any 等弱类型写法（遵循 monorepo ts-config 约束）。
- 分支与提交
  - 遵循仓库统一的 Git 流程（通常为 feature 分支 + PR），本子包无单独分支策略。
  - 建议在 PR 描述中明确列出：影响的路由、使用本包的应用、是否修改了公共导出 API（index.tsx）。
- 部署与发布
  - 包版本和发布由 Rush 管理，package.json 中的 version 仅作为占位。
  - 生产构建在应用层统一进行，本包无需单独配置打包脚本或输出目录。

## 七、常见改动场景指引
- 新增一个 workspace 子模块入口
  - 在 src/const.ts 中扩展 SpaceSubModuleEnum（例如 ANALYTICS = 'analytics'）。
  - 在 WorkspaceSubMenu 中增加对应菜单项：配置 icon、I18n key、path、dataTestId。
  - 在上层应用路由中为该子模块添加路由，并确保 useRouteConfig 能识别新的 subMenuKey。
- 调整空间空状态逻辑
  - 优先通过 useInitSpace 上游配置实现（如调整 isReady 或 fetchSpacesWithSpaceId 行为）。
  - 若仅需修改展示文案或插画，在 SpaceLayout 中修改 Empty 组件 props，并同步 i18n 配置。
