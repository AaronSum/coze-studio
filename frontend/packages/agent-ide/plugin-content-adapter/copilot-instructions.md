# @coze-agent-ide/plugin-content-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/plugin-content-adapter）中安全、高效地协作开发。

## 1. 子包定位与全局架构

- NPM 包名：`@coze-agent-ide/plugin-content-adapter`，位于 frontend/packages/agent-ide/plugin-content-adapter。
- 职责：作为 `@coze-agent-ide/plugin-content` 的**轻量适配层 / 再导出层**，对外统一暴露 Plugin Content 相关 React 组件与类型，方便其他工作区通过一个稳定入口接入。
- 当前实现非常精简：
  - 仅有一个源码文件 [src/index.ts](src/index.ts)，从 `@coze-agent-ide/plugin-content` re-export：
    - `PluginContent`
    - `PluginContentProps`
  - 不包含任何额外业务逻辑、状态管理或样式。
- 设计动机：
  - 将「Agent IDE 插件内容区」能力集中在 `@coze-agent-ide/plugin-content` 主包实现，本子包只负责在 agent-ide 领域内提供一个更语义化的依赖入口；未来如需为 Agent IDE 做专属包装或行为调整，可以在本子包中演进，而不破坏下游依赖关系。

## 2. 代码与导出约定

- 入口文件 [src/index.ts](src/index.ts)：
  - 仅做 re-export，不添加任何逻辑：
    - `export { PluginContent, type PluginContentProps } from '@coze-agent-ide/plugin-content';`
  - 若后续需要扩展 API，建议遵循以下顺序：
    - 优先在 `@coze-agent-ide/plugin-content` 中实现/扩展具体行为；
    - 在本子包内按需 re-export 新增能力；
    - 若确有 Agent IDE 特有包装（如埋点、上下文注入），在本子包创建新的组件/Hook，再在此入口统一导出。
- 由于当前 `package.json` 未配置 `exports` 字段，默认解析规则为：
  - 源码入口：`main: src/index.ts`；
  - 类型入口：TypeScript 通过 tsconfig + project references 解析到源码类型；
  - 打包产物路径由上层构建系统决定（见下文“构建与测试”）。
- 向外暴露能力时应保持命名与主包一致，避免混淆：例如不要在此包中重命名 `PluginContent`，而是保持原始导出名。

## 3. 构建、测试与本地开发流程

- 依赖管理：
  - 仓库使用 Rush + workspace 管理依赖，本子包依赖 `@coze-agent-ide/plugin-content` 与若干 arch 工具包：
    - 运行时依赖：
      - `@coze-agent-ide/plugin-content`: `workspace:*`
      - `classnames`: 仅被主包或未来扩展使用，本子包当前未直接使用。
    - 开发依赖：
      - `@coze-arch/eslint-config`、`@coze-arch/ts-config`、`@coze-arch/stylelint-config`、`@coze-arch/vitest-config` 等，用于统一 lint / TS / 测试配置。
  - 初始化常规步骤：在仓库根目录执行 `rush update`。

- NPM Scripts（在本子包目录下执行）：
  - `build`: `exit 0`
    - 当前为**占位命令**，不产生构建产物。真实打包在上层统一构建流程中完成（例如 Rush 的 ts-check / app 级 bundler），本子包只需保证 TS 能编译通过、导出正确。
  - `lint`: `eslint ./ --cache`
    - 使用 `eslint.config.js`（位于仓库其他位置）+ `@coze-arch/eslint-config` 的 web 预设。修改/新增 TS 文件时应确保此命令通过。
  - `test`: `vitest --run --passWithNoTests`
  - `test:cov`: `npm run test -- --coverage`
    - 测试配置在 [vitest.config.ts](vitest.config.ts)，通过 `@coze-arch/vitest-config.defineConfig` 设置 `preset: 'web'`，适配前端 React 组件测试环境。

- TypeScript 配置：
  - [tsconfig.build.json](tsconfig.build.json)：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，启用统一前端 TS 规范；
    - `rootDir: src`，`outDir: dist`，`jsx: react-jsx`，`module: ESNext`，`target: ES2020`，`moduleResolution: bundler`；
    - `references` 引用了 arch 相关配置包与 `../plugin-content/tsconfig.build.json`，用于 TypeScript project references 与 Rush 增量构建；
    - 开发时如需新增跨包类型引用，应同步更新 references，保证 `tsc --build` 能正确解析依赖顺序。

## 4. 与主包及外部系统的集成关系

- 与 `@coze-agent-ide/plugin-content`：
  - 本子包完全依赖该主包的实现：
    - 组件渲染逻辑（插件内容区布局、交互）在主包中实现；
    - 类型约束（`PluginContentProps`）同样在主包中维护。
  - 若需要理解组件行为或扩展功能，请到 [frontend/packages/agent-ide/plugin-content](../plugin-content) 中阅读源码与对应的 copilot-instructions，再在本子包选择是否暴露/包装相关能力。

- 与 React / 运行环境：
  - `peerDependencies` 要求：
    - `react >= 18.2.0`
    - `react-dom >= 18.2.0`
  - 使用方（例如 Agent IDE 应用）应保证在其运行环境中已安装兼容版本的 React/ReactDOM；本子包自身不会单独打包 React。

- 与工具链：
  - 测试、lint、TS 配置均委托给 `@coze-arch/*` 工具包，保证与整个前端 monorepo 的一致性；
  - 不应在本包内自定义额外的 Babel/Webpack/Vite/Rspack 配置，所有打包能力由上层应用或通用工具仓库统一管理。

## 5. 项目约定与开发注意事项

- 轻量适配层原则：
  - 本子包应尽量保持「薄」：
    - 不负责引入新的领域逻辑、全局状态或网络请求；
    - 主要用于 re-export、轻量包装（例如为 Agent IDE 注入额外上下文、统一埋点）以及未来的向后兼容层。
  - 如确有需要增加逻辑：
    - 建议新增组件/Hook 文件，而不是在 `src/index.ts` 内直接编写复杂逻辑；
    - 保持原有 re-export 能力不变，以免破坏现有使用方。

- 公共 API 变更：
  - 修改 re-export 列表（新增/移除导出）前，应在 monorepo 中全局搜索 `@coze-agent-ide/plugin-content-adapter` 的引用，评估影响范围；
  - 若是非向后兼容变更，应配合语义化版本号升级与相关文档更新（由 Rush/发布流程统一管理）。

- 版权与 License：
  - 所有源码文件头部使用 Apache-2.0 版权声明（参见 [src/index.ts](src/index.ts) 与 [vitest.config.ts](vitest.config.ts)）；新增文件时应保持一致。

## 6. 对 AI 助手的具体协作建议

- 若用户在本子包中请求修改组件行为或新增功能：
  - 优先定位到主实现包 `@coze-agent-ide/plugin-content`（frontend/packages/agent-ide/plugin-content），在该包中实现具体逻辑；
  - 然后在本子包：
    - 视情况更新 re-export；
    - 或新增 Agent IDE 专属包装组件，并在 `src/index.ts` 中导出。

- 若用户只在上层应用中通过本子包使用 `PluginContent`：
  - 在不需要特定 Agent IDE 适配时，可以直接保持当前 re-export 模式；
  - 调试 UI/交互问题应主要在 `@coze-agent-ide/plugin-content` 中进行，本子包只需保证导出路径正确。

- 不建议在本子包中：
  - 新增与插件内容无关的组件或工具函数（这类能力应归属更合适的领域包）；
  - 引入额外的第三方依赖，除非与适配职责紧密相关并得到团队确认。
