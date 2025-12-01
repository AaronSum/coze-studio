# @coze-workflow/base-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/adapter/base）中安全、高效地协作开发。

## 1. 子包定位与整体角色

- 本包 npm 名称为 @coze-workflow/base-adapter，位于 Rush 前端单仓的 workflow 体系下，用于为上层工作流产品提供「基础适配层」。
- 源码入口为 [src/index.tsx](src/index.tsx)，当前只做了一层 re-export：
  - 从 [src/utils](src/utils) 暴露 getEnabledNodeTypes、getUploadCDNAsset 等工具函数。
  - 从 hooks 目录暴露 useSupportImageflowNodesQuery（如果目录存在于其他分支/后续提交中）。
- 本包依赖核心能力包 @coze-workflow/base（workspace:*），自身主要承担「对外统一 API / 适配层」职责，而非业务实现主体。

## 2. 目录结构与架构要点

核心结构（省略无关文件/依赖缓存）：

- 根目录
  - [package.json](package.json)：脚本、依赖声明（仅依赖 @coze-workflow/base 作为核心运行时）。
  - [README.md](README.md)：说明这是一个 React 组件 + Storybook 模板型子包，支持 ESM / UMD 构建。
  - [eslint.config.js](eslint.config.js)：使用 @coze-arch/eslint-config，preset 为 web，代表本包走统一前端代码规范。
  - [vitest.config.ts](vitest.config.ts)：通过 @coze-arch/vitest-config.defineConfig，preset 为 web，测试环境按统一标准配置。
  - [tsconfig.json](tsconfig.json)：仅做 references 聚合，真实编译配置位于 tsconfig.build.json / tsconfig.misc.json 中，由 monorepo 统一管理。
  - [.storybook](.storybook)、stories、__tests__：分别承载 Storybook 配置、示例与单测。
- src 目录
  - [src/index.tsx](src/index.tsx)：对外公共导出入口。
  - [src/utils](src/utils)：聚合导出 getEnabledNodeTypes、getUploadCDNAsset 等与 workflow/base 协作的工具函数，真正业务细节在同目录下的实现文件中（如 get-enabled-node-types.ts）。
  - [src/typings.d.ts](src/typings.d.ts)：放置本包特有的全局类型补充（如果存在）。

架构意图：

- workflow 领域的「核心模型与逻辑」位于 @coze-workflow/base 中，本包负责提供更贴近上层应用/其他前端包使用的适配 API（通常为 hooks、工具函数或 React 包装）。
- 所有新的对外能力应通过 src/index.tsx 统一出口，避免分散导出导致依赖方难以管理。

## 3. 开发与构建 / 测试流程

### 3.1 依赖安装与初始化

- 在仓库根目录执行 Rush 初始化：
  - 安装依赖：`rush update`
  - 如果只想就近安装前端依赖，也可以使用仓库脚本 [scripts/setup_fe.sh](scripts/setup_fe.sh)（仅在需要时参考，默认由 Rush 管理）。

### 3.2 本包常用脚本

在子包目录 frontend/packages/workflow/adapter/base 下：

- `npm run lint`
  - 使用 @coze-arch/eslint-config + preset:web，对整个包进行 ESLint 检查。
  - 若增加新接口/工具，请确保通过 lint；避免添加与统一规则冲突的自定义配置。
- `npm run test`
  - 通过 Vitest 跑单测，配置由 [vitest.config.ts](vitest.config.ts) 与 @coze-arch/vitest-config 统一管理。
  - 默认 `--passWithNoTests`，即便没有测试文件也会通过，因此 AI 在新增关键逻辑时，应同时补充 __tests__ 下的用例。
- `npm run test:cov`
  - 在 test 基础上增加覆盖率统计（@vitest/coverage-v8）。
- `npm run build`
  - 当前脚本为 `exit 0`，表示本包构建由上层工具（如 Rush 统一构建或其他 bundler）接管，本地执行不会真正编译输出。
  - AI 不应在本包单独引入私有构建链路，如需修改构建行为，应遵循 monorepo 统一方案并修改对应 rsbuild/rollup/vite 配置包，而不是在此包内自建。

## 4. 代码风格与项目约定

- TypeScript & React
  - devDependencies 中包含 react/react-dom 18.x，但作为 peerDependencies 要求 >=18.2.0，表示本包是「库型」而非独立应用，不应在此包中创建应用级入口（如 ReactDOM.render）。
  - 类型配置由 @coze-arch/ts-config 统一提供，AI 在新增 tsconfig 片段时需保持最小化、避免覆盖全局配置。
- Lint & Style
  - JS/TS 使用 @coze-arch/eslint-config，preset:web，统一风格；不要在本包内关闭核心规则。
  - 样式相关由 @coze-arch/stylelint-config 管理，如新增样式文件需遵循已有配置（见根目录 .stylelintrc.js）。
- 测试
  - 使用 Vitest + @testing-library 生态（react / jest-dom / react-hooks），编写测试时优先走「黑盒行为」而非内部实现细节。
  - 测试文件建议放置在 __tests__ 目录，命名与被测模块对应。
- 导出约定
  - 所有对外能力统一从 [src/index.tsx](src/index.tsx) 导出，避免直接从内部路径 import（如 src/utils/...），否则未来重构时会导致大量调用方破坏。
  - 工具函数集中在 [src/utils](src/utils) 下，通过 [src/utils/index.ts](src/utils/index.ts) 做二次聚合，然后再从 index.tsx 统一导出。

## 5. 与其他子包及外部依赖的集成

- 与 @coze-workflow/base 的关系
  - 本包通过依赖 @coze-workflow/base 复用工作流核心模型、节点定义、运行时工具等；
  - getEnabledNodeTypes / getUploadCDNAsset 等适配函数通常会：
    - 接收 @coze-workflow/base 暴露的配置/运行时对象；
    - 进行额外过滤、兼容或 UI 层映射；
    - 将结果返回给上层 UI/适配包使用。
  - 在修改这些函数时，应假设调用方是「其他前端子包或 IDE/Studio UI」，而不是直接终端用户。
- 与测试/工具链包
  - @coze-arch/vitest-config：统一 Vitest 配置，preset:web，封装了 jsdom 环境、别名、快照等通用配置；AI 修改测试配置时，应优先通过该包的选项扩展，而不是手写底层 Vitest 配置。
  - @coze-arch/ts-config / eslint-config / stylelint-config：提供统一基础配置，避免在子包内复制或偏离主流风格。
- 与 React/DOM
  - 由于本包定位为「适配层库」，通常不会直接挂载到 DOM，而是导出 hooks、工具或无副作用的组件/函数。
  - 若未来需要添加 React 组件，应保持「纯渲染 + 通过 props 接入上层状态」，避免在此包持久化全局状态。

## 6. 开发流程与协作规范

- 分支与提交（遵循仓库统一规范）
  - 一般在主仓层面使用 feature 分支 + PR 流程，此子包不单独维护分支策略；
  - 在修改公共 API（如新增/删除 index.tsx 导出的函数）时，需要：
    - 搜索整仓引用（建议使用 VSCode 全局搜索或 monorepo 提供的 IDE 工具）；
    - 确认没有破坏其他包使用方式，必要时同步调整调用方。
- Storybook / 文档
  - 若为本包新增 UI/组件能力，优先补充 stories 以便交互预览；
  - README 中的「项目模板」描述表明此包经常被当作脚手架/基线来复制，因此新增约定要保持通用性，避免写入过于业务化的语义。

## 7. 对 AI 编程助手的具体建议

- 在本包内做改动时，优先遵循以下步骤：
  1. 若要新增对外能力：先在 src/utils 或 hooks 中实现，再通过 src/index.tsx 统一导出；
  2. 为新增的关键逻辑编写对应单测（__tests__）和必要的类型定义（typings.d.ts）；
  3. 运行 `npm run lint` 与 `npm run test` 确保通过；
  4. 如涉及 @coze-workflow/base 的结构变更，确认其在其他 workflow-* 子包中的调用不会被破坏。
- 不要在此包内：
  - 引入与 monorepo 不一致的构建工具或测试框架；
  - 直接依赖具体运行环境（如浏览器全局变量）而不通过上层注入；
  - 新增跨包的硬编码路径或强耦合逻辑，应通过公共基础包实现通用能力。
