# Copilot Instructions for @coze-arch/pkg-root-webpack-plugin

本说明用于指导 AI 编程助手在本子包（frontend/infra/plugins/pkg-root-webpack-plugin）中安全、高效地协作开发。

## 1. 子包作用与全局架构定位

- 本包是 Coze Studio 前端 monorepo 的一个 infra 级插件，主要用于在 Webpack 中支持 `@` 作为多包根目录的别名解析（pkg-root 功能）。
- 实际的路径解析能力由依赖包 `@coze-arch/pkg-root-webpack-plugin-origin` 提供；本包在其基础上做“在 Rush monorepo 场景下的封装与缺省配置”。
- 通过 `@rushstack/rush-sdk` 读取顶层 `rush.json`，收集所有项目的 `projectFolder` 列表，并注入为插件的 `packagesDirs`，从而在整个 monorepo 范围内统一处理 `@` 引用。
- 出于性能与隔离考虑，本包只负责“如何从 Rush 配置中推导 packages 目录 + 设定默认 alias root”，不直接感知各业务 app 的构建逻辑；各 app 在自身 webpack 配置中引用本插件即可享受统一行为。

## 2. 核心实现与数据流

- 核心实现位于：[frontend/infra/plugins/pkg-root-webpack-plugin/src/index.ts](frontend/infra/plugins/pkg-root-webpack-plugin/src/index.ts)
  - 使用 `RushConfiguration.loadFromDefaultLocation({})` 懒加载 monorepo 的 Rush 配置：
    - 通过闭包缓存 `rushConfig`，避免多次 IO / 解析：`getRushConfiguration()`。
    - 从 `rushConfig.projects` 中提取 `projectFolder` 形成 `rushJsonPackagesDir` 数组。
  - 引入原始实现：`import OriginPkgRootWebpackPlugin from '@coze-arch/pkg-root-webpack-plugin-origin';`
  - 定义轻量封装类 `PkgRootWebpackPlugin extends OriginPkgRootWebpackPlugin`，在构造函数中：
    - 使用 `Object.assign({}, options || {}, { root: '@', packagesDirs: rushJsonPackagesDir, excludeFolders: [] })` 生成最终配置：
      - `root: '@'`：统一规定使用 `@` 作为“包根”别名前缀。
      - `packagesDirs: rushJsonPackagesDir`：将 Rush 工程中所有 package 根目录交给底层插件做解析。
      - `excludeFolders: []`：目前不做排除过滤（原注释中有过滤 apps/* 的意图，当前被注释掉）。
    - 调用 `super(mergedOptions)` 将合并后的选项传给底层插件。
  - 导出形式：
    - `export default PkgRootWebpackPlugin;`
    - `export { PkgRootWebpackPlugin };`
- 数据流总结：
  - 运行时 → 读取 monorepo 级 Rush 配置 → 生成 packages 根目录列表 → 作为参数传入原始 pkg-root webpack 插件 → Webpack 在解析 `@/...` 路径时按配置查找对应包目录。

## 3. 构建、测试与开发工作流

- 所有脚本在本子包根目录执行，依赖 Rush/Yarn/NPM 的 workspace 管理：
  - 构建：
    - `npm run build`
    - 实际执行：`tsc -b ./tsconfig.build.json --force`
    - 输出产物位于 [frontend/infra/plugins/pkg-root-webpack-plugin/lib](frontend/infra/plugins/pkg-root-webpack-plugin/lib)，入口为 `lib/index.js` / `lib/index.d.ts`（由 `package.json` 的 `main`/`types` 指定）。
  - 开发（watch 编译）：
    - `npm run dev`
    - `tsc -w` 持续监视 TypeScript 源码变化，仅做类型编译，不负责打包。
  - Lint：
    - `npm run lint`
    - 调用本子包的 ESLint 配置：[frontend/infra/plugins/pkg-root-webpack-plugin/eslint.config.js](frontend/infra/plugins/pkg-root-webpack-plugin/eslint.config.js)，基于 `@coze-arch/eslint-config`。
  - 测试：
    - `npm run test`：使用 Vitest 单次运行，`--passWithNoTests` 允许无测试文件时通过。
    - `npm run test:cov`：在 `test` 命令基础上开启覆盖率统计。
    - 测试配置见：[frontend/infra/plugins/pkg-root-webpack-plugin/vitest.config.ts](frontend/infra/plugins/pkg-root-webpack-plugin/vitest.config.ts)：
      - 基于 `@coze-arch/vitest-config` 的 `defineConfig`。
      - `preset: 'node'`，运行环境为 Node。
      - `testTimeout: 30000`，开启 `globals: true`，`mockReset: false`。
      - 覆盖率 provider 为 `v8`，排除 `.eslintrc.js`、`lib` 及 `defaultExclude` 集合。
- 在 monorepo 级依赖安装/更新：
  - 使用 Rush：
    - `rush update`：安装或更新整个仓库依赖（参见根目录 [rush.json](rush.json) 及 monorepo 说明）。
  - 其他前端工具（如 webpack、babel、vitest）均通过 `devDependencies` 按版本锁定，不建议在子包内随意升降级，需遵守整体前端 infra 策略。

## 4. 项目特有的约定与代码风格

- 语言与编译：
  - 源码全部使用 TypeScript，主入口位于 [frontend/infra/plugins/pkg-root-webpack-plugin/src/index.ts](frontend/infra/plugins/pkg-root-webpack-plugin/src/index.ts)。
  - 构建采用独立的 `tsconfig.build.json`，与常规 `tsconfig.json` 区分开发/构建需求；还有 `tsconfig.misc.json` 用于额外工具/编辑器场景。
- ESLint 规则：
  - 基本配置由 `@coze-arch/eslint-config` 提供，在 [frontend/infra/plugins/pkg-root-webpack-plugin/eslint.config.js](frontend/infra/plugins/pkg-root-webpack-plugin/eslint.config.js) 中通过 `defineConfig({ preset: 'node', packageRoot: __dirname, ... })` 使用。
  - 对 `__tests__/**` 目录有专门 overrides：
    - 关闭包作者校验：`@coze-arch/package-require-author: off`。
    - 关闭文件名大小写强约束：`unicorn/filename-case: off`。
    - 放宽部分 TypeScript 规则：`no-explicit-any`、`consistent-type-assertions`、`no-non-null-assertion` 关闭，用于测试场景的灵活性。
- 插件配置约定：
  - `root` 默认固定为 `'@'`，除非有非常明确的需求，不建议在使用方覆写为其他符号，以避免跨工程约定不一致。
  - `packagesDirs` 来自 Rush 的 `projectFolder` 列表，使用方通常不需要传入；若手动传入，会与默认值合并/覆盖，因此在二次封装时需要留意 `Object.assign` 的合并顺序（后者覆盖前者）。
  - `excludeFolders` 当前为 `[]`，如需要排除某些路径（例如临时或实验性 app），建议在这里配置，而不是在下游 webpack alias 中再做手工过滤。
- 命名与导出：
  - 类命名固定为 `PkgRootWebpackPlugin`；默认导出 + 命名导出并存，避免破坏已有引用方式（`import PkgRootWebpackPlugin from ...` 或 `import { PkgRootWebpackPlugin } from ...`）。

## 5. 与外部组件及依赖的集成细节

- `@rushstack/rush-sdk`：
  - 本包依赖其 `RushConfiguration` 类以读取 monorepo 的 Rush 配置文件：
    - 使用 `RushConfiguration.loadFromDefaultLocation({})`，即从当前工作目录向上查找 `rush.json`。
    - 因为调用点在构造函数内部，且通过闭包缓存，因此在同一 Node 进程中多次实例化插件时不会重复读取磁盘。
  - 任何改动 Rush 相关逻辑前，应确认：
    - 当前工作目录是否总是位于 monorepo 根或其子目录。
    - 插件使用场景（如在独立测试环境或其它工具内调用）是否仍能成功定位 `rush.json`。
- `@coze-arch/pkg-root-webpack-plugin-origin`：
  - 通过 `npm:` 形式的别名依赖于 NPM 发布版 `@coze-arch/pkg-root-webpack-plugin@1.0.0-alpha.48aa2e`。
  - 本包仅作为“Rush 感知层”封装，并不重写底层解析算法。
  - 任何对外 API 行为（如 webpack 插件 hooks、alias 解析方式）需参考该 origin 包的实现与说明，本子包需要保证传入参数兼容其版本约束。
- Webpack 集成（使用方视角）：
  - 使用方项目在 webpack 配置中：
    - `const PkgRootWebpackPlugin = require('@coze-arch/pkg-root-webpack-plugin').default` 或使用 ES import。
    - 在 `plugins` 中实例化：`new PkgRootWebpackPlugin({ /* 可选覆盖项 */ })`。
  - 若需要定制：
    - 可按需传入部分 options（如自定义 `excludeFolders`），会与默认值合并；注意不要直接移除必须字段（如 `packagesDirs`）。
- 测试/工具链：
  - Vitest 配置基于内部统一封装 `@coze-arch/vitest-config`；如需新增测试，请按照该封装的约定（目录结构、命名规则）编写，以保持与其他子包一致。

## 6. 仓库流程、分支与发布（与本子包相关的部分）

- 分支与提交规范：
  - 本子包遵循整个仓库统一的 Git/分支策略与提交规范，具体规则见根仓库的贡献文档（如 [CONTRIBUTING.md](CONTRIBUTING.md)）。
  - 在对 infra 级包（如本插件）做改动前，优先考虑其对所有下游 apps 的影响，并在 PR 描述中清晰说明行为变更及兼容性。
- 依赖与版本管理：
  - 通过 Rush 管理 workspace 中的所有 package 版本和依赖安装；不建议在单个子包内直接运行 `npm install <pkg>` 改动 lockfile，而应按照 monorepo 的约定流程操作（例如通过 rush/变更集等机制）。
  - 本包自身版本号在 `package.json` 中维护，与 origin 包版本存在映射关系；在升级 origin 包版本或对外行为发生变化时，应同步调整并在 CHANGELOG 或 PR 描述中记录。
- 发布与消费：
  - 本包对外以 `@coze-arch/pkg-root-webpack-plugin` 名称提供给 monorepo 内其他前端项目使用，通常通过 `workspace:*` 引用。
  - 发布/发布前验证流程依赖仓库级 CI/CD 配置（不在本子包内定义），包括：构建、lint、测试、可能的覆盖率门槛等。

## 7. 该子包的特殊点与注意事项

- 强依赖 Rush 环境：
  - 插件默认假设当前工程运行在一个 Rush 管理的 monorepo 中；如果在非 Rush 环境独立使用，本包的 `RushConfiguration.loadFromDefaultLocation` 可能抛错，需额外处理（例如在调用前做环境校验）。
- 懒加载 + 缓存 Rush 配置：
  - `getRushConfiguration` 使用闭包缓存 `rushConfig`，在长生命周期的进程（如 webpack dev server）中只会解析一次；对测试或脚本而言，这一行为会影响“重新加载 Rush 配置”的能力，若你在测试中需要不同 Rush 配置，需要考虑 mock 或重置缓存。
- 默认不排除任何 packages：
  - `excludeFolders: []` 意味着 monorepo 内所有项目都会被纳入 `@` 解析范围；这在极大工程中可能带来额外的查找开销。
  - 源码中存在一行被注释掉的过滤逻辑（排除 `/apps/`），说明曾考虑过只对部分 package 生效；在修改此行为前，需要评估：
    - 现有 app 是否依赖对 `apps/*` 的支持；
    - 构建/解析性能是否有瓶颈需要优化。
- 双导出形式需保持：
  - 由于历史原因（或对外使用方式），本包既提供 default export 也提供 named export；在重构时不要删除其中任意一种，避免破坏已有调用方。

## 8. 面向 AI 助手的具体协作建议

- 修改 `src/index.ts` 时：
  - 保持 `getRushConfiguration` 的懒加载 + 缓存模式，除非确有强需求需要可变 Rush 配置，并同时补充测试。
  - 对于新增选项，应优先考虑与 origin 插件的兼容性，并在构造函数中通过 `Object.assign` 的顺序明确“用户配置是否覆盖默认值”。
- 新增测试时：
  - 将测试文件放在 `__tests__` 目录下，以便享受特定 ESLint 宽松规则。
  - 利用 Vitest 提供的 `globals: true`（如 `describe`、`it`、`expect` 全局可用），无需手动 import。
- 若需要支持非 Rush 环境：
  - 在实现中应显式判断 Rush 配置是否能加载成功，如失败则给予明确错误信息或提供降级行为，而不是让底层异常直接冒泡导致难以排查的问题。
