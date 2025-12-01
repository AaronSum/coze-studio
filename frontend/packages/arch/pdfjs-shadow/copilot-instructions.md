# @coze-arch/pdfjs-shadow 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/pdfjs-shadow）中安全、高效地协作开发。

## 1. 子包角色与整体架构

- 本包是对 `pdfjs-dist` 的“影子封装（shadow copy）”，只面向 Coze 内部消费，用于：
  - 收敛对 `pdfjs-dist` 的依赖与版本；
  - 统一 worker 脚本与 `cmaps` 静态资源的 URL 生成逻辑；
  - 在打包阶段重编译 pdf.js worker，补充 polyfill，保证在 bot 等运行环境中的兼容性。
- 运行时导出入口为 [src/index.ts](src/index.ts)：
  - 直接 re-export `pdfjs-dist` 的核心渲染能力：`getDocument`、`PDFDocumentProxy`、`PDFPageProxy`、`PageViewport`；
  - 暴露 pdf.js 文本相关类型：`TextContent`、`TextItem`；
  - 暴露本包自定义工具函数：`generatePdfAssetsUrl`、`initPdfJsWorker`。
- 重要运行时模块：
  - [src/generate-assets.ts](src/generate-assets.ts)：根据 `REGION` 和包名生成 CDN 上的 worker/cmaps 资源 URL，是所有外部环境感知逻辑的核心。
  - [src/init-pdfjs-dist.ts](src/init-pdfjs-dist.ts)：封装对 `GlobalWorkerOptions.workerSrc` 的初始化，避免多处重复设置。
  - [src/global.d.ts](src/global.d.ts)：
    - 引入 `pdfjs-dist` 类型定义；
    - 声明 worker 相关模块（`pdf.worker.mjs`、`pdf.worker.entry.js`）；
    - 声明全局常量 `REGION: 'cn' | 'sg' | 'va'`，供运行时代码与测试使用。
- 构建期脚本集中在 [scripts/](scripts)：
  - [scripts/build.ts](scripts/build.ts)：同时调用 `buildAssets()` 与 `buildWorker()`，生成发布到 `lib/` 目录的静态资源。
  - [scripts/build-assets.ts](scripts/build-assets.ts)：从 `pdfjs-dist/cmaps` 复制字体映射资源到本包 `lib/cmaps/`。
  - [scripts/build-worker.ts](scripts/build-worker.ts)：使用 `esbuild` 打包 pdf.js worker，并注入 `core-js/proposals/promise-with-resolvers` polyfill，输出为 `lib/worker.js`。
  - [scripts/const.ts](scripts/const.ts)：统一约定输出目录 `OUTPUT_DIR`（指向 `lib/`）。

## 2. 数据与控制流

- 典型使用流程（调用侧视角）：
  1. 业务引入本包的 `initPdfJsWorker` 并在使用 pdf.js 前调用一次：
     - 内部在 `GlobalWorkerOptions.workerSrc` 为空时调用 `generatePdfAssetsUrl('pdf.worker')`；
     - 避免重复初始化，第二次调用不会产生副作用。
  2. 业务通过 re-export 的 `getDocument()` 加载 PDF 文档，并使用导出的类型进行类型标注。
- 资源 URL 生成流程：
  - `generatePdfAssetsUrl(assets)`：
    - 从 `package.json` 读取 `name`，并去除作用域前缀 `@` 以构造 CDN 路径。
    - `assets` 只能是 `'cmaps' | 'pdf.worker'`，否则会抛出带中文提示的错误（这一约束被测试覆盖）。
    - 根据全局常量 `REGION` 决定 CDN 域名：
      - `REGION === 'cn'` → `lf-cdn.coze.cn/obj/unpkg`；
      - 其他（当前测试只覆盖 `va`）→ `sf-cdn.coze.com/obj/unpkg-va`。
    - 拼出最终 URL：`//{domain}/{onlinePkgName}/{DEFAULT_VERSION}/{assetsUrl}`，其中 `DEFAULT_VERSION` 是脚本维护的、已经在 bnpm 发布的版本号。
- 构建期流程：
  - `npm run build`：
    1. `tsc -b tsconfig.build.json` 先编译 TypeScript 源码；
    2. 使用 `sucrase/register` 运行 [scripts/build.ts](scripts/build.ts)，进一步生成 `lib/cmaps/` 和 `lib/worker.js`；
    3. 最终 `botPublishConfig.main` 指向 `lib/worker.js`，供上层 bot/前端构建系统引用。

## 3. 构建、测试与调试

### 3.1 本地开发依赖

- 依赖集中在 [package.json](package.json)：
  - `pdfjs-dist@4.3.136`：上游 pdf.js 发行版；
  - `core-js` 与 `esbuild`：用于构建带 polyfill 的 worker 脚本；
  - 内部统一配置包：`@coze-arch/eslint-config`、`@coze-arch/ts-config`、`@coze-arch/vitest-config` 等。
- TypeScript 配置：
  - [tsconfig.build.json](tsconfig.build.json) 继承内部 `tsconfig.web.json`，`rootDir` 指向当前包、`outDir` 为 `dist`（仅用于 TS 编译的中间产物）；
  - [tsconfig.json](tsconfig.json) 仅做 project references 聚合（`tsc -b` 入口），不直接参与运行时构建逻辑；
  - 全局类型与 `REGION`/worker 模块声明在 [src/global.d.ts](src/global.d.ts) 中，需要在新增文件时保证 TS 能正确拾取（通常无需额外配置）。

### 3.2 常用命令

- 构建：
  - `npm run build`
    - 先执行 TypeScript 多项目编译（`tsc -b tsconfig.build.json`）；
    - 再执行 Node 脚本 [scripts/build.ts](scripts/build.ts)，并使用 `esbuild` + `core-js` 构建 worker 与复制 `cmaps` 到 `lib/`。
- 测试：
  - `npm test` / `npm run test`：
    - 通过 [vitest.config.ts](vitest.config.ts) 使用内部 `@coze-arch/vitest-config` 预设（web 环境）；
    - 主要测试文件：
      - [__tests__/index.test.ts](__tests__/index.test.ts)：验证入口导出的函数/类型是否存在；
      - [__tests__/init-pdfjs-dist.test.ts](__tests__/init-pdfjs-dist.test.ts)：验证 `initPdfJsWorker` 在不同 `workerSrc` 状态下的行为；
      - [__tests__/generate-assets.test.ts](__tests__/generate-assets.test.ts)：覆盖 `generatePdfAssetsUrl` 在 `REGION` 不同取值下的 URL 生成与异常分支。
  - `npm run test:cov`：在上述基础上开启 coverage。
- Lint：
  - `npm run lint`：使用 [eslint.config.js](eslint.config.js) 中的内部 web 预设；
  - 明确关闭 `@coze-arch/package-disallow-deps` 规则，以允许此包依赖非标准内部依赖（如 `pdfjs-dist`、`core-js` 等）。

### 3.3 调试建议

- 若需要本地验证生成的资源：
  - 运行 `npm run build` 后检查 `lib/cmaps/` 与 `lib/worker.js` 是否存在且体积合理；
  - 在上层应用中通过替换 `REGION`、或直接在 Node REPL/测试中给 `global.REGION` 赋值来验证不同 CDN URL。
- 对 `generatePdfAssetsUrl` 的改动务必同时更新：
  - 单元测试中对 URL 片段与错误消息的断言；
  - `DEFAULT_VERSION` 的含义：代表已经在 bnpm 上存在的可用版本，修改前需确认发布流程。

## 4. 项目特有约定与模式

- **对外只暴露最小稳定接口**：
  - 外部调用方只应依赖 [src/index.ts](src/index.ts) 导出的符号；
  - 新增对 `pdfjs-dist` 的包装，优先选择在 `index.ts` 中统一 re-export 或通过新的 helper 暴露；避免在外部直接引用 `pdfjs-dist`。
- **全局环境变量 REGION 的使用**：
  - 在实现代码中直接读取 `REGION` 常量（由构建/运行环境注入），不要再引入其他配置源来决定 CDN 域名；
  - 单元测试通过修改 `global.REGION` 来模拟不同区域，这是约定好的测试模式，扩展时应沿用。
- **资源路径与结构稳定性**：
  - `generatePdfAssetsUrl` 只允许 `'cmaps'` 和 `'pdf.worker'` 两种类型；
  - 输出路径约定：
    - `cmaps` → `lib/cmaps/`；
    - worker → `lib/worker.js`；
  - 若需要支持新的资源类型，应：
    - 在 [scripts/build-assets.ts](scripts/build-assets.ts) 或新脚本中保证资源实际产出；
    - 在 [src/generate-assets.ts](src/generate-assets.ts) 中新增分支，并同步补充测试用例。
- **Worker 构建策略**：
  - 使用 `esbuild` 的 `stdin` + `bundle` 模式构建一个单文件 worker；
  - 强制 `platform: 'node'` + `target: ['chrome85']`，以适配当前运行环境（包含 bot 和旧版浏览器）；
  - 禁止直接将 `pdfjs-dist` 的 worker 入口暴露给上层应用，上层只能通过 `generatePdfAssetsUrl('pdf.worker')` 生成的 CDN 链接或由环境自动注入的脚本路径使用。

## 5. 与外部系统和上游库的集成

- **pdfjs-dist 集成细节**：
  - `pdfjs-dist` 版本锁定为 `4.3.136`，如需升级需验证：
    - worker 输出格式是否仍兼容当前 `esbuild` 打包方案；
    - `GlobalWorkerOptions` 行为是否有变更；
    - `cmaps` 目录结构是否变化（影响 [scripts/build-assets.ts](scripts/build-assets.ts)）。
- **CDN 与发布体系**：
  - URL 中的 `{DEFAULT_VERSION}` 必须与实际发布到 CDN 的版本一致；
  - CDN 域名与 bucket 格式是既定事实：
    - 中国区：`lf-cdn.coze.cn/obj/unpkg`；
    - 国际区：`sf-cdn.coze.com/obj/unpkg-va`；
  - 任何对 URL 结构或域名的修改，都可能影响线上 PDF 渲染，需要在更高层面做灰度与回滚策略，AI 助手不应擅自更改。
- **上层 bot/前端系统**：
  - 通过 `botPublishConfig.main: lib/worker.js` 接入 bot 构建流水线；
  - 默认假设 worker 和脚本资源最终会部署到上述 CDN 路径下，并由 `generatePdfAssetsUrl` 生成访问地址。

## 6. 贡献与流程约定

- 本包遵循仓库统一的开源与代码风格：
  - 所有源码文件均带有 Apache-2.0 版权头；
  - ESLint/Vitest/TSConfig 统一使用 `@coze-arch/*` 内部预设。
- 在修改本包时的推荐流程（供 AI 助手遵守）：
  1. 保持对外 API（[src/index.ts](src/index.ts) 导出符号）的向后兼容性，如需破坏性变更应在上层应用同步调整。
  2. 对 `generatePdfAssetsUrl`、`initPdfJsWorker` 或构建脚本的改动，必须补充或更新对应的单元测试，保证不同区域/状态分支仍然覆盖。
  3. 运行 `npm run lint && npm test`，确保本子包在独立环境下无报错再交由上层流水线。
- 分支策略与发布流程在根仓库统一管理，本说明不重复定义；AI 助手在本子包内只需遵守上述接口与行为约定，避免修改仓库级配置（如根 `rush.json`、全局脚本等），仅在有明确指令时才跨子包调整。