# @coze-studio/plugin-tool-columns-adapter — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/plugin-tool-columns-adapter）中安全、高效地协作开发。

## 全局架构与职责

- 本包是一个非常薄的 React hooks 适配层，封装对 @coze-studio/plugin-tool-columns 提供的 useGetToolColumns 的调用，供 Studio 场景按统一接口接入「插件工具列」能力。
- 源码极少，入口 [src/index.ts](frontend/packages/studio/plugin-tool-columns-adapter/src/index.ts) 仅 re-export 自定义 hook 及其类型：
  - useGetToolColumnsAdapter
  - UseGetToolColumnsAdapterProps
  - UseGetToolColumnsAdapterType
- 适配 hook 位于 [src/hooks/use-get-tool-columns-adapter.tsx](frontend/packages/studio/plugin-tool-columns-adapter/src/hooks/use-get-tool-columns-adapter.tsx)：
  - 对外暴露的 props 在 UseGetToolColumnsAdapterProps 中声明：在原始 UseGetToolColumnsProps 基础上新增 unlockPlugin、refreshPage 两个字段，并去掉 customRender；
  - 内部直接调用 @coze-studio/plugin-tool-columns 暴露的 useGetToolColumns(props)，当前仅从返回值中取出 getColumns 并作为返回对象的一部分暴露。
- 该包本身不包含 UI 组件、状态管理或网络逻辑，所有业务与渲染细节由 @coze-studio/plugin-tool-columns 处理，本包只负责在 Studio 代码中提供一个约束良好的接入签名。

## 构建与测试工作流

- 包管理与依赖：
  - 采用 Rush + pnpm 的 workspace 管理方式；依赖通过 workspace:* 与前端公共包共享（例如 @coze-arch/*、@coze-studio/plugin-tool-columns）。
  - 安装/更新整体依赖时在仓库根目录执行 rush update（详见 [frontend/README.md](frontend/README.md)）。
- package.json 中脚本（在本子包目录执行）：
  - build：当前实现为 exit 0，本包不单独产出构建产物；TS 编译和打包通常由上层应用或统一构建流程处理。
  - lint：eslint ./ --cache，规则由 [eslint.config.js](frontend/packages/studio/plugin-tool-columns-adapter/eslint.config.js) 以及 @coze-arch/eslint-config 提供。
  - test：vitest --run --passWithNoTests，配置来自 [vitest.config.ts](frontend/packages/studio/plugin-tool-columns-adapter/vitest.config.ts) 和 @coze-arch/vitest-config，当前没有实质用例也不会报错。
  - test:cov：npm run test -- --coverage，生成覆盖率统计。
- TypeScript 构建配置：
  - [tsconfig.build.json](frontend/packages/studio/plugin-tool-columns-adapter/tsconfig.build.json) 继承 @coze-arch/ts-config/tsconfig.web.json，rootDir = src、outDir = dist，开启 jsx: react-jsx、moduleResolution: bundler 等前端 web 预设。
  - references 显式依赖 arch/bot-typings、config 下的 eslint/stylelint/ts/vitest-config 以及兄弟包 plugin-tool-columns 的 tsconfig.build.json，用于 TS project references 与 Rush 增量构建；
  - 顶层 tsconfig.json/tsconfig.misc.json 仅用于编辑体验和非产出文件，保持与整个 monorepo 一致的类型环境。

## 代码约定与模式

- 技术栈：React 18 函数组件 + TypeScript；本包当前仅导出自定义 hook，不含 JSX 渲染逻辑，但 tsconfig 仍按 web/react 项目配置。
- 入口导出：
  - 所有对外能力必须从 [src/index.ts](frontend/packages/studio/plugin-tool-columns-adapter/src/index.ts) 导出；若未来新增 hook 或类型，也应统一在此聚合导出，避免调用方从内部路径引用。
- 适配层设计：
  - UseGetToolColumnsAdapterProps 通过 Omit<UseGetToolColumnsProps, 'customRender'> 排除底层 hook 的 customRender 属性，并额外增加 unlockPlugin、refreshPage 两个必填函数，用于 Studio 上层在调用时统一传入解锁和刷新逻辑。
  - UseGetToolColumnsAdapterType 描述了适配 hook 的签名：传入适配 props，返回值为 { reactNode?: ReactNode } & ReturnType<typeof useGetToolColumns>。当前实现仅返回 getColumns，但类型已经预留了 reactNode 字段，方便未来在不破坏签名的前提下扩展 UI 挂载能力。
  - useGetToolColumnsAdapter 内部直接调用 useGetToolColumns(props)，保持无副作用、无额外状态；扩展时建议继续保持“薄封装”特性，把复杂行为留在上游 plugin-tool-columns 包中实现。

## 与上游包的集成细节

- 与 @coze-studio/plugin-tool-columns：
  - 这是本包最重要的依赖，提供 useGetToolColumns hook 及 UseGetToolColumnsProps 类型；
  - @coze-studio/plugin-tool-columns 负责定义工具列的渲染、交互、权限、埋点等逻辑，本包只是根据 Studio 需要调整参数与返回值形状；
  - 在修改适配层前，应先查看 plugin-tool-columns 包的 copilot-instructions 和源码，确保理解其返回值结构（例如 getColumns、其他方法或渲染节点）。
- 与 arch/config 工具包：
  - @coze-arch/ts-config、eslint-config、stylelint-config、vitest-config 为 monorepo 提供统一的前端工程配置；
  - 本包仅在配置文件（tsconfig.build.json、eslint.config.js、vitest.config.ts 等）中引用它们，不应在业务代码中直接依赖这些包。

## 项目规范与协作建议

- 代码风格：
  - 遵循 @coze-arch/eslint-config 提供的 web 规则；新增代码时保持 import 顺序、分号、引号风格与现有文件一致。
  - 所有源码文件头部使用统一的 Apache-2.0 版权声明，新增文件时请参考现有 ts/tsx 文件复制相同头注释。
- 扩展适配能力时的注意点：
  - 若需要在适配层增加新的返回值（例如额外的 actions、状态或 reactNode），应优先在 UseGetToolColumnsAdapterType 中以可选属性形式扩展，并保持对现有调用方兼容；
  - unlockPlugin 与 refreshPage 目前在适配层未被使用，但作为 props 契约的一部分，未来可能传递给底层 hook 或用于组装 reactNode；修改这些字段的语义或必选性前，需要在整个 Studio 代码中搜索使用点并审慎评估影响。
- 依赖管理：
  - 新增依赖时，优先复用 monorepo 内已有版本（通过 workspace:*），避免在单个包中锁定独立版本；
  - 变更 @coze-studio/plugin-tool-columns 版本或 API 时，应同步更新本适配层的类型定义与实现逻辑，保持编译通过和运行时语义一致。

## 不寻常/需要特别注意的点

- build 脚本为 no-op：本包本身不会在 npm run build 时输出 JS/CSS 产物，构建完全由上层工程负责；不要在这里引入独立 bundler 或多余打包逻辑，以免与整体构建体系冲突。
- 超薄实现：当前 useGetToolColumnsAdapter 只返回 getColumns，看起来“什么都没做”，但其存在意义在于：
  - 固化 Studio 侧期望的 props/返回值签名，为未来在不修改上层调用代码的前提下演进底层实现留出空间；
  - 作为依赖注入和测试替身的挂载点（例如可以在测试环境中对该适配 hook 做单独 mock，而不直接耦合到底层实现）。
- 在未来演进中，应尽量保持本子包定位为「轻量适配层」，避免在此包内堆积复杂业务逻辑或 UI，使其仍然便于替换和测试。
