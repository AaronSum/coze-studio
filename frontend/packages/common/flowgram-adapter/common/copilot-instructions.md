# 本说明用于指导 AI 编程助手在本子包（frontend/packages/common/flowgram-adapter/common）中安全、高效地协作开发。

概述：本子包仅做 Flowgram 核心库的适配和复用，其他组件不应直接绕过这里去引用 `@flowgram.ai/*`。

## 全局架构
- `@flowgram-adapter/common` 只包含一个入口 [src/index.ts](frontend/packages/common/flowgram-adapter/common/src/index.ts#L1-L68)，通过 `reflect-metadata` 初始化再原封不动地 re-export 了 `@flowgram.ai/reactive`、`@flowgram.ai/utils`、`@flowgram.ai/history` 和 `@flowgram.ai/command` 的 API，让团队其余包都通过统一的 `@flowgram-adapter/common` 语义感知 Flowgram 服务。
- 聚合的函数/类型在使用端按需导入，所有的依赖都在此处固定为 `0.1.28`（参见 [package.json](frontend/packages/common/flowgram-adapter/common/package.json#L1-L51)），以避免不同包之间版本漂移。
- 本子包位于 `frontend/packages/common`，属于通用组件层，置于整体前端架构的 Common 分支，整体架构参考 [frontend/README.md](frontend/README.md#L1-L45) 的 monorepo 分区说明。
- 由于没有额外的业务逻辑，所有对 Flowgram 的扩展点都在 re-export 出去之后的消费者包中，在这里只需保证接口干净且依赖一致即可。

## 关键构建/测试/调试流程
- 根目录保持 Node ≥21、PNPM 8.15.8、Rush 5.147.1 的组合，首次协作/更新依赖请执行 [frontend/README.md](frontend/README.md#L47-L78) 中的 `rush install` 及 `rush update`。
- 封装的脚本只能被 `rushx` 调用：`rushx lint`、`rushx test`、`rushx test:cov` 通过 [`package.json` scripts](frontend/packages/common/flowgram-adapter/common/package.json#L14-L25) 触发 ESLint+Vitest，`test:cov` 由 Rush 的 `operationSettings` 自动收集 [`config/rush-project.json`](frontend/packages/common/flowgram-adapter/common/config/rush-project.json#L1-L12) 产出 `coverage` 文件夹。
- `ts-check` 也是通过同一配置声明的 Rush operation（同一个 `config/rush-project.json`），会把 `tsc` 的输出写到 `./dist`，所以在修改依赖或 tsconfig 后先跑 `rushx ts-check`（Rush 会帮忙拉起，把输出写到当前 `dist` 目录）。
- 单元测试以 Vitest 运行，具体 preset 和 web 环境由 [vitest.config.ts](frontend/packages/common/flowgram-adapter/common/vitest.config.ts#L1-L22) 里引用的 `@coze-arch/vitest-config` 统一管理，故不需要额外的环境配置；测试调试时可在该配置上使用 `vitest --run` 或 `vitest --watch`。
- `build` 脚本本质上是 `exit 0`（见 `package.json`），因此不会生成产物；依赖编译/打包时依赖消费端的构建流程，比如 `rushx build` 会在上层应用中触发真正的打包器。

## 项目约定与模式
- ESLint 继承自 `@coze-arch/eslint-config`，在[`eslint.config.js`](frontend/packages/common/flowgram-adapter/common/eslint.config.js#L1-L12) 中关闭了几个严格规则（`no-cond-assign`, `no-non-null-assertion`, `no-explicit-any`, `max-params`），保持与现有 Flowgram 类型一致。
- Stylelint 也直接继承 [`@coze-arch/stylelint-config`](frontend/packages/common/flowgram-adapter/common/.stylelintrc.js#L1-L5) 并不附加规则，因为本包没有样式文件。
- TypeScript 配置通过 `tsconfig.json` 引用 [`tsconfig.build.json`](frontend/packages/common/flowgram-adapter/common/tsconfig.build.json#L1-L32) 和 [`tsconfig.misc.json`](frontend/packages/common/flowgram-adapter/common/tsconfig.misc.json#L1-L23)，后者包含测试/故事/工具文件，前者只编译 `src` 并引用了 `@coze-arch/ts-config` 定义的共享选项，确保所有 `@flowgram` API 都在 `ESNext` 模块中保持 `isolatedModules`。
- `tsconfig.json` 默认 `exclude` 了所有文件，只有在 `references` 中的子配置才实际生效（避免 Rush 的 `tsc --build` 递归重复），所以在新增辅助目录时需要同时在 Build/Misc 中添加路径。
- 包体非常轻量：`files` 只暴露 `src`（还有占位的 `bin` 目录，当前未使用），所有导出直接来自 Flowgram，变更时基本只需同步 `import` 列表和外部依赖的版本。

## 重要集成组件
- `reflect-metadata` 在 [src/index.ts](frontend/packages/common/flowgram-adapter/common/src/index.ts#L1-L68) 首行引入，确保 Flowgram 的装饰器/依赖注入在整个前端里保持一致；不要删掉，否则历史/命令系统的元数据无法读取。
- `useObserve` 和 `ReactiveState` 直接从 `@flowgram.ai/reactive` 暴露，供其他模块共享响应式 API，减少重复依赖版本管理（同一行可查阅上文的 `src/index.ts`）。
- 大量基础类型/工具（`Rectangle`、`domUtils`、`DisposableCollection`、`CancellationTokenSource`、`compose` 等）来自 `@flowgram.ai/utils`，该包在 `src/index.ts` 中一并导出以便任何依赖方直接使用，而不再单独依赖 `@flowgram.ai/utils`。
- `HistoryService`、`OperationService` 和 `createHistoryPlugin` 从 `@flowgram.ai/history` 导出，作为命令/历史系统的核心服务，确保所有 Flowgram 适配器都能在同一逻辑上下文中维护撤销/重做状态。
- `CommandService`、`CommandContribution`、`CommandRegistryFactory` 等命令总线构件源自 `@flowgram.ai/command`，在 `src/index.ts` 月下共享，为 automation/command 模块提供一致的注册/执行方式。

## 过程规范与协作
- Git 分支维持 [git-flow](https://nvie.com/posts/a-successful-git-branching-model/)（FDD）架构，所有 PR 按照 [CONTRIBUTING.md](CONTRIBUTING.md#L1-L42) 中的指南提交，提交信息需遵循 Angular 风格以便自动生成 Release Notes。
- 整个前端仓库以 Rush/PNPM 管理，切勿直接用 `npm install`；在拉取分支后先运行 `rush install`/`rush update`（参见 [frontend/README.md](frontend/README.md#L47-L78)）再开发，该子包才能正确解析 worpspace::packages 的依赖。
- Code review 前必须运行 `rushx lint` 和 `rushx test`（必要时加 `rushx test:cov` 看 coverage），且 `rushx lint` 使用缓存，修改规则后可加 `--no-cache` 运行以验证配置。
- 本包不会单独部署；变更会随着消费端一起上线，因此非功能改动（例如更新版本号或导出名）只需要 Rush 的 `build`/`test` 通过即可。

## 特殊/异常特点
- `build` 脚本只是 `exit 0`（[package.json](frontend/packages/common/flowgram-adapter/common/package.json#L14-L19)），说明本包不负责打包。要检查 TypeScript 类型或生成声明文件必须依赖 Rush 的 `ts-check` 操作。
- 由于 `src/index.ts` 没有业务逻辑，添加新 API 仅需同步 Flowgram 源包的导出列表，并在 `dependencies` 中锁定正确版本，一旦后端 Flowgram 升级，先在此处对照更新版本号再同步到所有消费者。
- 目录结构无额外模块；如果需要增加辅助脚本（比如 `tests/utils`），必须在 [`tsconfig.misc.json`](frontend/packages/common/flowgram-adapter/common/tsconfig.misc.json#L1-L23) 里 `include` 它，避免被 `tsconfig.json` 的 `exclude` 阻止。