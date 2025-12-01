# @coze-arch/load-remote-worker 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/load-remote-worker）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包是 Coze Studio 前端 monorepo 中的一个架构级工具包，功能非常聚焦：**为 Web Worker 提供远程脚本加载能力**。
- 核心能力由 [src/index.ts](src/index.ts) 暴露：
  - `RemoteWebWorker`：继承原生 `Worker` 的构造器包装，实现“脚本 URL 为远程地址时，通过 `importScripts`+`Blob URL` 间接加载脚本”。
  - `register(global: typeof globalThis)`：将 `global.Worker` 替换为 `RemoteWebWorker` 的 **全局打补丁入口（已标记 @deprecated）**。
- 数据/控制流：
  - 业务代码可以直接 `new RemoteWebWorker(url, options)`；
  - 或在启动时调用 `register(globalThis)`，之后业务仍用 `new Worker(url, options)`，但底层已换成 `RemoteWebWorker`。
- 设计动机：
  - 浏览器原生 `Worker` 仅接受同源或本地 URL；
  - 通过 `Blob` 包装一段脚本，在脚本内部调用 `importScripts` 拉取远程脚本，以绕过该限制；
  - 同时对 `importScripts` 做一次包装，把所有后续 `importScripts()` 的相对路径补全为基于首个远程脚本 URL 的绝对路径，兼容如 `@byted/uploader` 这类内部库的 Worker 调用习惯。

## 核心实现细节（src/index.ts）

- 远程 URL 判定逻辑：
  - 将 `scriptURL` 转成字符串 `url`；
  - 满足以下条件时视为“远程地址”，需要走 Blob+`importScripts` 路线：
    - `url.includes('://')`（看起来像一个绝对 URL）；
    - `!url.startsWith(location.origin)`（非当前站点同源）；
    - `!url.startsWith('blob:')`（避免对已有 Blob URL 再包一层）。
- 当判定为远程时：
  - 生成一个 `Blob`，内容大致为：
    - 重写 `importScripts`：对每个传入的 URL 执行 `new URL(u, "${url}")`，确保后续导入脚本以当前远程脚本为基准解析相对路径；
    - 最后调用 `importScripts("${url}")` 加载真正的远程脚本；
  - 通过 `URL.createObjectURL(blob)` 得到一个本地 Blob URL，将其作为 `super()` 的第一个参数传入原生 `Worker`。
- 当非远程时：
  - 直接将原始 `scriptURL` 交给 `Worker`，行为与原生一致。
- `register(global)` 的副作用：
  - 在非 `undefined` 的情况下执行 `global.Worker = RemoteWebWorker`；
  - 目前依然保留以兼容旧代码，但文件内注释明确说明“**请勿再新增调用**，后续应逐步迁移为显式使用 `RemoteWebWorker`”。

## 目录结构与配置说明

- [src/](src)
  - [index.ts](src/index.ts)：本包全部功能的实现与导出，都在这一文件中完成。
- [__tests__/](__tests__)
  - [index.test.ts](__tests__/index.test.ts)：`RemoteWebWorker` 与 `register` 的行为测试（若不存在，可按 monorepo 规范在此补充）。
  - [setup.ts](__tests__/setup.ts)：Vitest 测试环境的公共初始化逻辑，已在 [vitest.config.ts](vitest.config.ts) 中通过 `setupFiles` 注册。
- [config/rush-project.json](config/rush-project.json)
  - 定义 Rush 操作产物目录，如 `test:cov` 生成的 `coverage`、`ts-check` 生成的 `dist`，供 monorepo CI 使用。
- [config/rushx-config.json](config/rushx-config.json)
  - 配置本子包在代码覆盖率等指标上的基线要求，如 `incrementCoverage: 90`，供 RushX/自定义脚本读取。
- [vitest.config.ts](vitest.config.ts)
  - 从 `@coze-arch/vitest-config` 继承通用配置，`preset: 'web'` 表示按 Web 环境注入 DOM/浏览器全局；
  - `test.setupFiles` 指向 `./__tests__/setup.ts`，统一处理 polyfill、全局打补丁等测试前置工作。

## 开发与测试工作流

- 本包不单独构建：
  - [package.json](package.json) 中 `build` 脚本为 `exit 0`，说明生产构建统一在上层工具链处理，本子包本身仅维护源码与类型。
- 本地开发常用命令（在子包目录执行）：
  - `npm test` / `pnpm test` / `rushx test`：
    - 实际执行 `vitest --run --passWithNoTests`；
    - 若暂未编写测试文件，命令不会失败，但 monorepo 可能在覆盖率或质量检查环节有额外约束。
  - `npm run test:cov`：
    - 运行 `vitest` 并开启 `--coverage`（使用 `@vitest/coverage-v8`）；
    - 产出目录配置在 [config/rush-project.json](config/rush-project.json) 中，供 Rush 识别。
  - `npm run lint`：
    - 调用 `eslint ./ --cache`，规则来自 `@coze-arch/eslint-config`；
    - 写代码时尽量遵守 monorepo 通用风格，而不是重新定义本地规则。
- 在 monorepo 顶层：
  - 安装依赖：`rush update`；
  - 统一执行测试/检查：一般通过 `rush test`、`rush lint` 或封装脚本完成，本子包遵循 Rush 的 pipeline 即可。

## 项目约定与编码规范（本子包相关部分）

- 语言与工具栈：
  - TypeScript + Web 平台（浏览器环境），不依赖 Node 专有 API；
  - 测试使用 Vitest，并通过 `@coze-arch/vitest-config` 共享统一配置；
  - ESLint 使用 `@coze-arch/eslint-config`，无需在本包重复配置风格规则。
- Worker 使用规范：
  - **新增代码禁止直接使用原生 `Worker` 构造函数**：
    - 推荐直接 `new RemoteWebWorker(url, options)`；
    - 仅在极端兼容场景下暂时使用 `register(globalThis)`，并在注释中解释原因。
  - 如需在全局替换 `Worker`，请确保：
    - 在应用入口单点调用 `register(globalThis)`；
    - 测试中在 `__tests__/setup.ts` 中显式注册/重置，避免测试间相互污染。
- URL 与相对路径处理：
  - 远程 Worker 主脚本内部如再调用 `importScripts('./foo.js')`，会被包装逻辑自动转为 `new URL('./foo.js', originalUrl)`，因此：
    - 业务只需在远程脚本中使用相对路径即可；
    - 不需要在调用端手动拼接绝对路径，但要确保后端/静态资源服务对这些路径可达。

## 外部依赖与集成要点

- 浏览器运行时依赖：
  - 原生 `Worker`、`Blob`、`URL`、`location.origin`、`importScripts` 等 Web API；
  - 在非浏览器环境（如 Node、SSR）使用时：
    - 需要在上层测试/运行环境中自行提供 polyfill 或跳过相关逻辑；
    - 通常通过 Vitest 的 jsdom 环境或自定义 `setupFiles` 来 mock。
- 与内部库的适配：
  - 代码注释中提到 “Adapt worker calls to underlying libraries such as @byted/uploader”：
    - 表示远程 URL 的相对导入处理，是为兼容内部上传库等 worker 依赖设计的；
    - 修改 URL 处理逻辑时，务必考虑这些库的行为模式（如是否依赖 `importScripts` 相对路径）。

## 项目流程与协作规范

- 分支与发布（遵循 monorepo 统一流程）：
  - 本包不在自身目录维护版本发布脚本，版本号与发布由顶层 Rush/发布流水线统一管理；
  - 修改本包逻辑时，需确保：
    - 本包自身测试与 lint 通过；
    - 与其依赖的上层应用/包的集成测试不被破坏（通常由 CI 执行）。
- 代码变更建议：
  - 对 `RemoteWebWorker` 的行为变更属于 **高风险改动**，推荐：
    - 为每一种 URL 场景（同源 / 远程 / blob / 相对 importScripts）补充或更新单测；
    - 明确记录行为变化，尤其是对现有业务的潜在影响（例如 CDN 路径、跨域策略）。

## 特殊注意事项与陷阱

- 全局打补丁的副作用：
  - `register(globalThis)` 会改变全局 `Worker`，可能影响：
    - 其他第三方库中对 `Worker` 行为的假设；
    - 测试环境（如果未在 teardown 中复原）；
  - 如必须使用，请在调用处和测试里写明用途，并谨慎控制作用域。
- 安全与跨域：
  - 远程脚本的加载完全依赖浏览器的 CORS/同源策略；
  - 本包不会绕过浏览器安全模型，只是改变脚本的加载路径与解析方式；
  - 在调整逻辑时，避免引入对任意 URL 的自动信任或字符串插值漏洞。
- Blob URL 生命周期：
  - 当前实现没有显式调用 `URL.revokeObjectURL()`；
  - Worker 一旦终止，浏览器一般会自动回收，但在高频创建销毁 Worker 的场景下，如有内存压力问题，再评估是否在更高层统一管理 URL 生命周期。
