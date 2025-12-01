# @coze-arch/rsbuild-config 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/config/rsbuild-config）中安全、高效地协作开发。

## 全局架构与角色定位

- 本子包属于 Coze Studio monorepo 的「构建配置层」，为使用 Rsbuild/Rspack 的前端应用提供统一的构建配置与插件组合，而非业务 UI 组件库。
- 入口文件 [frontend/config/rsbuild-config/src/index.ts](frontend/config/rsbuild-config/src/index.ts) 导出 `defineConfig` 等工具，用于在上层 rsbuild.config.* 中生成最终的 Rsbuild 配置。
- 包本身不直接启动应用，也不包含路由或状态管理，而是被其他 app 或 packages 以依赖形式复用：
  - 统一 React/TSX/JSX 支持（`@rsbuild/plugin-react`）。
  - 统一 Less / Sass / SVG 处理（`@rsbuild/plugin-less` / `@rsbuild/plugin-sass` / `@rsbuild/plugin-svgr`）。
  - 集成 Semi UI 与主题能力（`@douyinfe/semi-rspack-plugin` + `@coze-arch/semi-theme-hand01`）。
  - 集成 Tailwind / PostCSS（`tailwindcss` + `postcss` + `postcss-nesting`）。
  - 与 monorepo 内部环境、资产对齐（`@coze-arch/bot-env`、`@coze-common/assets`、`@coze-arch/pkg-root-webpack-plugin` 等）。
- 本包需要兼容多个上游应用，因此配置应保持「可组合、可扩展」，不要为某个具体应用硬编码特殊逻辑。

## 目录结构与关键文件

- [frontend/config/rsbuild-config/package.json](frontend/config/rsbuild-config/package.json)
  - `main`: `src/index.ts` 为唯一入口。
  - `scripts`：
    - `build`: `exit 0`，本包本身不生成构建产物，真实构建发生在引用方应用。
    - `lint`: `eslint ./ --cache`，使用 monorepo 公共 ESLint 配置。
    - `test`: `vitest --run --passWithNoTests`，单元测试通过 Vitest 运行。
    - `test:cov`: 运行测试并生成覆盖率报告。
  - `dependencies`：集中定义 Rsbuild 及相关插件、样式工具和内部依赖，是理解本包能力边界的核心。
- [frontend/config/rsbuild-config/src/index.ts](frontend/config/rsbuild-config/src/index.ts)
  - 导出 `defineConfig(options: Partial<RsbuildConfig>)`，对外暴露统一的 Rsbuild 配置工厂。
  - 内部主要职责：
    - 从 `GLOBAL_ENVS` 生成 `source.define`，自动处理字符串加双引号的 Rspack 约束（`getDefine`）。
    - 定义 `overrideBrowserslist`，用于 `output.overrideBrowserslist`，保障浏览器兼容范围一致。
    - 通过 `generateCdnPrefix()` 从 `process.env.CDN_INNER_CN` 与 `process.env.CDN_PATH_PREFIX` 推导 `assetPrefix`（CDN 前缀）。
    - 解析 `@coze-common/assets` 与 `@coze-arch/semi-theme-hand01` 的安装目录，用于 Less 全局变量和 Semi 主题路径。
    - 统一配置 `plugins`、`output`、`source` 与 `tools`（postcss / rspack）等，最后通过 `mergeRsbuildConfig(config, options)` 与调用方配置合并。
- [frontend/config/rsbuild-config/config/rush-project.json](frontend/config/rsbuild-config/config/rush-project.json)
  - Rush 子项目描述文件，控制在 monorepo 中的项目注册及命令集，一般无需 AI 修改。
- [frontend/config/rsbuild-config/vitest.config.ts](frontend/config/rsbuild-config/vitest.config.ts)
  - 使用 `@coze-arch/vitest-config` 的 `defineConfig`，`preset: 'node'`，`dirname: __dirname`，与其他子包保持一致的测试约定。
- [frontend/config/rsbuild-config/tsconfig.json](frontend/config/rsbuild-config/tsconfig.json)
  - 仅声明 `references`（指向 `tsconfig.build.json` 与 `tsconfig.misc.json`）和 `composite: true`，以参与 monorepo 级 TypeScript project references。
  - 调整编译行为时，应优先修改 `tsconfig.build.json` / `tsconfig.misc.json`，并遵循 `@coze-arch/ts-config` 的统一规范。
- [frontend/config/rsbuild-config/eslint.config.js](frontend/config/rsbuild-config/eslint.config.js)
  - 复用 `@coze-arch/eslint-config`，可以在此针对本包加少量 overrides，但原则上不破坏全局规范。

## 关键配置与数据流

- `getDefine` 与 `GLOBAL_ENVS`
  - 从 `@coze-arch/bot-env` 引入 `GLOBAL_ENVS`，通过 `getDefine()` 转换为 Rspack 的 `define` 字段：
    - 字符串值会被包上一层双引号，满足 Rspack 期望的「字符串常量」格式。
    - 其他类型值会原样透传。
  - 修改 `GLOBAL_ENVS` 相关逻辑时要注意：所有使用 Rsbuild 的前端应用都会受到影响。
- CDN 与资源前缀
  - `generateCdnPrefix()` 根据 `process.env.CDN_INNER_CN` 和 `process.env.CDN_PATH_PREFIX` 生成资源前缀；若未配置则退回 `'/'`。
  - 该结果用于 `output.assetPrefix`，影响所有静态资源的加载路径，是部署/CDN 集成的关键点。
- 样式与浏览器兼容
  - `overrideBrowserslist` 为一组固定的浏览器版本范围，在 `output.overrideBrowserslist` 中使用，影响构建时的 polyfill/编译目标。
  - `pluginLess`：通过 `lessLoaderOptions.additionalData` 注入来自 `@coze-common/assets` 的 `style/variables.less`，实现全局样式变量共享；修改路径时需确认该文件在所有环境下都存在。
  - `pluginSass`：设置 `sassOptions.silenceDeprecations` 以抑制部分 Sass 弃用警告，避免污染构建日志。
- `tools.postcss`
  - 使用 `tailwindcss/nesting` 搭配 `postcss-nesting` 处理嵌套语法：`require('tailwindcss/nesting')(require('postcss-nesting'))`。
  - 若需要修改 Tailwind 或 PostCSS 插件顺序，请遵循其他前端子包的相同模式，避免样式解析结果不一致。
- `tools.rspack`
  - 通过 `appendPlugins` 注入：
    - `PkgRootWebpackPlugin`：对 monorepo 包根目录进行特殊解析，保障 alias/loader 行为在 Rspack 环境中正确工作。
    - `SemiRspackPlugin`：配置 Semi UI 相关打包行为，并指定 `theme: '@coze-arch/semi-theme-hand01'`。
  - 不建议在这里新增与具体业务强耦合的 Rspack 插件。

## 开发与运行工作流

- 安装依赖
  - 在 monorepo 根目录执行 `rush update` 或项目脚本 `scripts/setup_fe.sh`，以确保 workspace:* 依赖正确链接。
- 本包构建
  - `npm run build` 当前是 no-op（`exit 0`），说明本包不生成独立构建产物。
  - 验证配置的推荐方式：在引用本包的 app 中跑其构建命令（通常是对应 app 下的 `rushx build` 或 README 中说明的脚本）。
- 测试
  - 在本子包目录执行：
    - `npm test`（调用 Vitest）。
    - 或 `npx vitest --run`。
  - 如需增加 ESM/DOM 环境测试，请在 [frontend/config/rsbuild-config/vitest.config.ts](frontend/config/rsbuild-config/vitest.config.ts) 中通过 `defineConfig` 传入 preset 或环境配置，而不是完全重写配置文件。
- Lint
  - 在本子包目录执行 `npm run lint`。
  - 对规则的个性化调整应尽量在 monorepo 公共配置中处理，避免本包成为风格特例。

## 项目特有约定与模式

- Rsbuild 配置工厂模式
  - `defineConfig(options)` 内部定义一份 `config: RsbuildConfig`，最后通过 `mergeRsbuildConfig(config, options)` 与调用方配置合并：
    - 本包负责「默认配置 + 全局约定」。
    - 调用方通过 `options` 注入自身特定需求（入口、路由、额外插件等）。
  - 新增能力时，应尽量通过扩展默认 `config` 或 `options` 形状来实现，而不要在内部直接读取调用方运行时信息。
- 端口与 DevServer
  - 统一使用 `port = 8080`（`dev.client.port` 与 `server.port` 一致），便于本地开发调试。
  - `dev.client` 中固定 `host: '127.0.0.1'`、`protocol: 'ws'`，如需改动需评估是否影响所有使用该配置的应用。
- `source.include`
  - 显式包含 `marked`、`@dagrejs`、`@tanstack` 等包的 ES2022 语法（私有方法），确保这些第三方包经过编译，避免在旧浏览器/环境下出错。
  - 新增类似第三方库时，应按此模式补充正则，避免编译遗漏。

## 版本、依赖与兼容性注意事项

- Rsbuild 及插件版本
  - 当前锁定在 `@rsbuild/core ~1.1.0` 系列，以及相应版本的官方插件；升级时需验证所有引用本包的应用是否能正常构建。
- UI/样式链路
  - Semi 主题包 `@coze-arch/semi-theme-hand01` 使用固定 alpha 版本；修改版本或主题名时需确认主题文件结构保持兼容。
  - Tailwind 版本为 `~3.3.3`，PostCSS 和 `postcss-nesting` 与之配套，变更时注意 PostCSS 插件兼容性。
- Node / TypeScript
  - `@types/node` 声明为 `^18`，TypeScript 为 `~5.8.2`；若统一在 monorepo 中升级 TypeScript，请同步检查本包的 tsconfig 和构建脚本是否仍然兼容。

## 协作流程与对 AI 助手的提示

- 变更影响面评估
  - 本包属于多应用共享的底层配置，任何改动都有可能影响多个前端项目：
    - 在修改 `defineConfig`、`getDefine`、CDN 相关逻辑或插件列表前，建议先全局搜索 `"@coze-arch/rsbuild-config"` 了解当前使用场景。
    - 尤其是删除/重命名导出或更改默认端口/assetPrefix 时，需要在 PR 描述中明确列出受影响应用。
- 提交流程与规范
  - 遵循 monorepo 根目录的贡献指南（如 [CONTRIBUTING.md](CONTRIBUTING.md)），在 feature 分支上进行修改，并通过 PR 合入主干。
  - 提交信息建议包含包名前缀，例如：`chore(rsbuild-config): tweak sass deprecations`、`feat(rsbuild-config): support new cdn prefix env`。
- 对 AI 助手的安全边界
  - 不要在本包中引入与具体业务/页面强耦合的依赖（如某个具体 app 的组件或 service）。
  - 不要在这里创建或导出完整的 Rsbuild/Rspack 实例，只保留「配置生成」职责。
  - 修改外部依赖版本、浏览器兼容范围、CDN 相关 env 时，应假设会影响生产环境部署流程，谨慎调整并在描述中注明原因。
