# copilot-instructions (@coze-arch/vitest-config)

本说明用于指导 AI 编程助手在本子包（frontend/config/vitest-config）中安全、高效地协作开发。

## 1. 子包角色与全局架构概览

- 本子包是 Coze 前端 monorepo 中的「共享 Vitest 配置库」，为 Node 与 Web 项目统一提供测试配置。
- 对外只暴露一个入口：`src/index.js`，导出 `defineConfig`，供各应用在自己的 `vitest.config.ts` / `vitest.config.mts` 中调用。
- 核心配置流：
  - 调用方传入 `VitestConfig`（含 `dirname` 与 `preset` 等 Vitest 配置字段）。
  - `src/define-config.ts` 根据 `preset` 选择基础预设：`defaultVitestConfig`、`nodePreset` 或 `webPreset`。
  - 将基础预设与调用方的自定义 Vitest `UserConfig` 使用 `vitest/config` 的 `mergeConfig` 进行合并。
  - 若开启 `OtherConfig.fixSemi`，则在 `test.alias` 中注入一组 Semi Design 相关 alias 修复，并优先级地合并调用方自定义 alias。
- 预设职责划分：
  - `src/preset-default.ts`：定义所有 preset 共享的 Vitest/Vite 行为（TS 路径映射、coverage 默认、执行池策略等）。
  - `src/preset-node.ts`：当前直接复用 default 预设，预留未来 Node 场景定制点。
  - `src/preset-web.ts`：在 default 基础上增加 React 插件与 `happy-dom` 环境，服务 Web/React 组件测试场景。
- Sucrase 用于在 CJS 运行时直接加载 TS 源码：`src/index.js` 通过 `sucrase/register/ts` 注册，对外保持 CommonJS 接口形式，内部源码为 TS。

## 2. 目录结构与关键文件

- 根配置与元信息：
  - `package.json`：定义包名 `@coze-arch/vitest-config`，`main` 指向 `src/index.js`，`types` 指向 `src/define-config.ts`；脚本仅提供 `dev`、`lint`，无独立 build 流程（编译由使用方/工具链承担）。
  - `eslint.config.js`：本子包使用 monorepo 内共享 ESLint 配置（`@coze-arch/eslint-config`）。修改规则时需要兼顾整个 monorepo 风格。
  - `tsconfig.json` / `tsconfig.build.json`：限定 TS 编译目标、模块系统与路径解析，影响 `vite-tsconfig-paths` 插件行为。
  - `config/rush-project.json`：声明 Rush 工程设置（例如 `ts-check` 输出目录为 `dist`），配合顶层 `rush.json` 控制 CI/检查流程。
- 源码：`src/`
  - `src/index.js`
    - CJS 入口。
    - 注册 `sucrase` 以支持直接 require TS 文件。
    - `module.exports = { defineConfig }`，对外仅暴露一个配置工厂函数。
  - `src/define-config.ts`
    - 核心导出：`defineConfig(config: VitestConfig, otherConfig?: OtherConfig): UserConfig`。
    - `VitestConfig`：在 Vitest `UserConfig` 基础上增加：
      - `dirname: string`：调用方项目根目录（必须传入，否则直接抛错）。
      - `preset: 'default' | 'node' | 'web'`：决定基础预设。
    - `calBasePreset`：根据 `preset` 返回 `defaultVitestConfig` / `nodePreset` / `webPreset`。
    - `OtherConfig`：目前仅支持 `fixSemi: boolean`。开启后：
      - 将 `@douyinfe/semi-ui` 与 `@douyinfe/semi-foundation` 强制 alias 到其 `lib/es` 目录，规避其 `package.json` 导出配置在 Vitest 下的问题。
      - 将 `lottie-web` alias 到本包内的 `src/tsc-only.ts`，用于规避类型/运行时加载问题（占位实现）。
      - 若调用方 `userVitestConfig.test.alias` 为数组，则直接 concat；若为对象，则转为 `{ find, replacement }[]` 合并，保证原有 alias 仍然生效且后定义项在数组后面（即优先级靠后）。
    - 合并顺序：`mergeConfig(baseConfig, userVitestConfig)`，即调用方配置覆盖预设中的同名字段。
  - `src/preset-default.ts`
    - 引入 `vitest/config` 中的 `coverageConfigDefaults` 与 `UserConfig`。
    - 启用 `vite-tsconfig-paths` 插件，利用调用方项目的 `tsconfig` 做路径映射。
    - `resolve.mainFields = ['main', 'module', 'exports']`，优先选择 `main` 字段，解决部分包导出不一致的问题。
    - `server.hmr.port = undefined`，避免固定端口占用，兼容 monorepo 多服务。
    - `test` 默认配置：
      - `testTimeout = 10000` ms。
      - `pool = 'forks'`，`poolOptions.forks.maxForks = 32`、`minForks = 1`，提升大仓并行性能。
      - `sequence.hooks = 'parallel'`，恢复 hooks 并行行为（Vitest 2.0 之后默认为串行）。
      - `globals = true`，方便在测试中直接使用 Jest/ Vitest 全局 API。
      - `mockReset = false`，遵循现有仓内约定，不强制 reset 行为。
      - `silent = process.env.CI === 'true'`，在 CI 中减少噪音日志。
      - `coverage`：
        - `all = false`（由各子包逐步打开覆盖率门槛）。
        - `include = ['src/**/*.ts', 'src/**/*.tsx']`。
        - `exclude = coverageConfigDefaults.exclude`，使用 Vitest 默认排除规则。
        - `provider = 'v8'`，`reporter` 包括 `cobertura`、`text`、`html`、`clover`、`json`、`json-summary`。
  - `src/preset-node.ts`
    - 当前只是 `mergeConfig(defaultVitestConfig, {})`。
    - 作为 Node 场景扩展点，未来如需配置 Node 专属选项，应该在此文件中追加而不是直接改 default 预设。
  - `src/preset-web.ts`
    - 在 `defaultVitestConfig` 上追加：
      - `plugins: [react()]`，引入 `@vitejs/plugin-react` 以支持 JSX/TSX 及相关 HMR 行为。
      - `test.environment = 'happy-dom'`，进行 DOM/组件测试。
      - `test.framework.hmr = 'page'`，更贴近前端 HMR 体验。
  - `src/tsc-only.ts`
    - 仅作为 TypeScript 引用占位，实际实现可以是最小 mock，用于 alias 到 `lottie-web` 时避免真实依赖带来的复杂度。

## 3. 依赖与外部集成

- Vitest/Vite 生态：
  - 直接依赖 `vitest`、`@vitest/coverage-v8`、`vite-tsconfig-paths`、`@vitejs/plugin-react`。
  - 依赖 `happy-dom` 作为 web preset 的 test environment。
  - 基于 `vitest/config` 的官方 `mergeConfig`，因此配置合并语义与 Vitest/Vite 原生相同。
- Sucrase：
  - `sucrase/register/ts` 使本包可以在不预编译的前提下以 CJS 形式被 Node 直接 require。
  - 在修改 TS 源文件结构（尤其是路径别名）时，应注意保持 `src/index.js` require 路径的正确性。
- Semi Design 适配：
  - `fixSemi` 是本仓特有开关，用于修复 `@douyinfe/semi-*` 包在 Vitest/Vite 下的导出兼容性问题。
  - 若新增其它有类似 `exports` 配置问题的 UI 包，建议参考现有 alias 风格在 `define-config.ts` 中扩展，而不是在各子包手动写 alias。

## 4. 开发与常用工作流

> 注：本子包完全依赖 monorepo 顶层的 Rush/PNPM 管理，请优先从仓库根目录执行命令。

- 安装依赖（在仓库根目录）：
  - 使用 Rush：`rush update`。
- 本子包脚本：在根目录通过 Rush 调用，或在子包目录直接使用 npm：
  - Lint：
    - 推荐：在根目录执行 `rush lint`（会调用本包的 `npm run lint`）。
    - 单包：在 `frontend/config/vitest-config` 下执行 `npm run lint`。
  - Dev 模式：
    - `npm run dev` 实际执行 `npm run build -- -w`，该命令目前通常由顶层构建工具/脚本统一管理；在本子包手动执行仅在调试 sucrase/TS 行为时使用。
- 在下游项目中使用：
  - 安装依赖：在下游 `package.json` 的 `devDependencies` 中声明 `"@coze-arch/vitest-config": "workspace:*"` 后执行 `rush update`。
  - 创建 `vitest.config.ts`：
    - Node：
      - 指定 `preset: 'node'`，可自定义 `test.include`、`exclude` 等；注意若需要 DOM 环境请改用 `web` 预设或自行覆盖 `test.environment`。
    - Web/React：
      - 指定 `preset: 'web'`，在此基础上可添加 `test.setupFiles`、`test.include` 等。
    - Default：
      - 指定 `preset: 'default'`，用于无需 React 插件/DOM 的通用场景。
  - Semi 兼容：
    - 若项目依赖 Semi Design，并遇到 export / tree-shaking 相关问题，请在调用 `defineConfig` 时传入 `otherConfig: { fixSemi: true }`。

## 5. 项目约定与代码风格

- TypeScript/JavaScript：
  - 逻辑代码优先写在 TS 文件中（如 `define-config.ts`、各 preset），CJS 入口层保持最薄的一层 glue 代码（`index.js`）。
  - 类型定义通过 `types` 字段直接指向 TS 源文件，方便下游消费时获得完整类型信息。
- 配置合并策略：
  - 所有 preset 都应在 `src/preset-*.ts` 中实现，禁止在 `define-config.ts` 内写死 preset 细节，以保持职责清晰。
  - `defineConfig` 只负责：
    - 校验 `dirname`。
    - 决定 preset。
    - 组装/扩展 alias（含 fixSemi）。
    - 调用 `mergeConfig` 合并。
- Alias 约定：
  - 针对 `otherConfig.fixSemi` 内置 alias：
    - 使用 `find` 为正则或 string，`replacement` 为具体路径/包名。
    - 若需要在命令行或下游项目中覆盖这些 alias，应在下游的 `test.alias` 中追加相同 `find` 字段，依赖 Vitest 的 alias 匹配顺序覆盖行为。
- 环境变量：
  - `process.env.CI` 控制 `silent` 行为，仅限日志层面。
  - `process.env.VITE_CJS_IGNORE_WARNING = true` 在 `index.js` 中写死，抑制部分 Vite CJS 相关警告。

## 6. 变更注意事项与安全边界

- 兼容性要求：
  - 本包是多个前端/Node 子包共享的基础设施，更改任何默认配置（特别是 `defaultVitestConfig.test`、`webPreset`）都可能影响大量项目。
  - 在修改默认行为前，建议：
    - 先在一个或少量下游项目中局部试用（通过在下游局部覆盖配置）。
    - 与架构/测试负责人确认对 CI 耗时与覆盖率等指标的影响。
- 预设扩展：
  - 若需要新 preset（例如 `api`、`storybook` 等），应：
    - 在 `src/` 下新增 `preset-<name>.ts`。
    - 在 `define-config.ts` 的 `VitestConfig['preset']` union 中加入新值，并在 `calBasePreset` 中处理对应分支。
  - 保持 default preset 尽量「保守稳定」，把强场景化的行为放到专门 preset 中。
- Sucrase 使用：
  - 若未来决定引入正式打包流程（例如 rollup/tsup），要确保 CJS 入口与 TS 类型导出保持与当前一致，以避免破坏下游的 `require('@coze-arch/vitest-config')` 与类型导入。

## 7. 如何在本子包内协作

- 修改配置逻辑前：
  - 优先阅读 `README.md` 里的 API 说明与 preset 特性说明，保证对外契约不被破坏。
  - 检查是否已有下游项目依赖该行为（在 monorepo 搜索 `@coze-arch/vitest-config` 的使用方式）。
- 建议的开发步骤：
  - 在本子包中修改 TS 源代码（`src/*.ts`）。
  - 运行 `npm run lint` 保证代码风格和基础检查通过。
  - 在一个或多个下游项目中本地跑 `vitest` 以验证新配置行为。
- 分支与发布：
  - 分支策略、发布流程由 monorepo 顶层控制（参见仓库根目录的 `CONTRIBUTING.md` 和相关文档）；本子包本身不维护独立的版本发布脚本，版本号由 Rush/变更集统一管理。
