# bot-hooks-adapter 子包协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-hooks-adapter）中安全、高效地协作开发。

## 一、全局架构与设计意图

- 本子包 `@coze-arch/bot-hooks-adapter` 是 Bot Studio 前端的「适配层 hooks 库」，给上层应用提供统一的 React hooks API，对下游依赖（`@coze-arch/bot-hooks-base`、`@coze-arch/bot-utils` 等）做封装和轻量适配。
- 当前公开导出位于 [src/index.ts](src/index.ts)：
  - `useSetResponsiveBodyStyle`：负责根据响应式状态设置全局 `document.body` 的样式（通常用于移动端/窄屏布局下调整 body 高度、滚动行为、背景色等）。
  - `useIsResponsive`：对外暴露「当前是否处于响应式布局」的布尔状态，供页面、组件按需切换布局/交互逻辑。
- 目录结构（仅与本包强相关部分）：
  - [src/index.ts](src/index.ts)：包的统一导出入口，只做 re-export，不放业务逻辑。
  - [src/use-responsive.ts](src/use-responsive.ts)（推断）：实现 `useIsResponsive`，通常基于全局配置或窗口宽度监听，可能依赖 `bot-hooks-base` 中的通用 hook。
  - [src/use-responsive-body-style.ts](src/use-responsive-body-style.ts)（推断）：实现 `useSetResponsiveBodyStyle`，在 `useEffect` 中按响应式状态修改 body style，注意副作用清理。
  - [src/global.d.ts](src/global.d.ts)：补充本包运行环境下的全局类型（如 Window 扩展、样式模块声明等）。
- 设计要点：
  - 上层页面/组件只依赖本包和 `bot-hooks-base` 抽象，不直接感知更底层实现（如具体媒体查询逻辑、环境探测方式）。
  - hooks 尽量保持「无 UI 依赖 + 可单测」：只操作 DOM 或返回状态，不直接渲染组件；测试通过 Vitest + @coze-arch/vitest-config 完成。

## 二、开发与构建流程

- 包管理与工作区
  - 整体采用 Rush + pnpm 工作区管理，本包位于 `frontend/packages/arch/bot-hooks-adapter` 下，被 rush.json 注册。
  - 初始化依赖：在仓库根目录执行 `rush update`，统一安装/链接所有子包依赖。

- 本子包 NPM 脚本（见 [package.json](package.json)）：
  - `npm run build`
    - 当前实现为 `build: "exit 0"`，即占位脚本，仅用于通过 CI 检查，不执行真实打包。
    - 构建由上层统一打包系统负责（如 rsbuild/webpack），本包只暴露源码和类型。
  - `npm run lint`
    - 调用 `eslint ./ --cache`，规则来源于工作区共享配置 `@coze-arch/eslint-config` 和本包根目录的 [eslint.config.js](eslint.config.js)。
  - `npm run test`
    - 调用 `vitest --run --passWithNoTests`，配置在 [vitest.config.ts](vitest.config.ts)，使用 `@coze-arch/vitest-config` 统一测试预设。
  - `npm run test:cov`
    - 在 `npm run test` 基础上开启覆盖率统计，默认基于 `@vitest/coverage-v8`，覆盖规则同 vitest.config。

- 推荐工作流
  - 新增或修改 hooks 时：先在 src 下实现，再在 [src/index.ts](src/index.ts) 暴露导出，确保类型自动对齐。
  - 本地开发：通常与上层应用/Storybook 联调，通过依赖引用 `@coze-arch/bot-hooks-adapter`，本包本身不提供 dev 服务器脚本。
  - 提交前：至少执行 `npm run lint` 和 `npm run test`，保持无 ESLint/Vitest 报错。

## 三、项目约定与编码风格

- TypeScript 与模块约定
  - TypeScript 配置：
    - [tsconfig.json](tsconfig.json) 以引用形式组合 [tsconfig.build.json](tsconfig.build.json) 与 [tsconfig.misc.json](tsconfig.misc.json)，`compilerOptions.composite = true` 以支持增量编译和项目引用。
    - `exclude: ["**/*"]` 表示根 tsconfig 主要作为引用入口，实际编译范围由下级 tsconfig 决定，避免在 IDE 中重复/错误编译。
  - 包导出：
    - 在 [package.json](package.json) 中使用标准 `exports` 字段，将 `"."` 和部分子路径直接映射到 `src` 源文件，优先保证类型友好。
    - `typesVersions` 保证 `bot/use-tts-player`、`src/use-drag-and-paste-upload` 等子路径在 TS 解析时指向正确声明文件，即使构建产物尚未生成。

- React hooks 约定
  - hooks 命名以 `use` 开头，分别放在独立文件中（如 `use-responsive.ts`），与导出名保持一致，避免在一个文件内混杂多个不相关 hooks。
  - 副作用（如修改 `document.body.style`）必须：
    - 放在 `useEffect`/`useLayoutEffect` 中；
    - 提供清理逻辑，恢复原始值或合理的默认值，避免在页面卸载后影响其它模块。
  - 环境与容器假设：仅在浏览器环境运行；若可能在 SSR 中运行，需要在 hook 内对 `window` / `document` 做 `typeof window !== 'undefined'` 保护（遵循其它子包的一致写法）。

- 代码风格与 Lint
  - 使用 ESLint + TypeScript + React 统一规则，保持与其它 `@coze-arch/*` 子包一致。
  - 样式相关若有（如 styled-components），遵守根目录 [.stylelintrc.js](.stylelintrc.js) 与共享样式规则。
  - Vitest 配置中通过 `exclude: ['src/index.ts', 'src/global.d.ts', 'src/page-jump/config.ts']` 明确哪些文件不要求覆盖率：
    - index.ts 仅做导出；
    - 类型声明与纯配置文件也被排除在覆盖率之外。

## 四、重要依赖与集成方式

- 内部工作区依赖
  - `@coze-arch/bot-hooks-base`：基础 hooks 工具库，本包在实现响应式相关逻辑时应优先使用其中的通用工具/上下文（例如环境探测、事件订阅等），避免重复造轮子。
  - `@coze-arch/bot-utils`：通用工具集（如节流/防抖、DOM 工具、环境判断），适配层 hook 允许依赖其中的工具函数，但应避免引入与 UI 强耦合的逻辑。

- 测试与配置依赖
  - `@coze-arch/vitest-config`：统一 Vitest 配置来源，避免在本包中写大量测试样板代码。增加新测试时，只需遵循预设包含规则（`includeSource: ['./src']`）。
  - `@coze-arch/ts-config`、`@coze-arch/eslint-config`、`@coze-arch/stylelint-config`：分别提供 TS/ESLint/Stylelint 的基础规则，本包仅做少量补充配置。

- React 相关依赖
  - `react`、`react-dom` 既是 devDependency 也是 peerDependency（peer 要求 `>=18.2.0`）：
    - 上层应用负责实际安装与版本控制，本包仅在开发和测试时依赖具体版本。
  - 若在 hook 中依赖路由、styled-components 等，请优先通过上层注入或独立 adapter，避免本包与具体路由实现强耦合。

## 五、协作流程与规范

- 分支与提交
  - 分支策略遵循仓库统一规范（参考仓库根 README / CONTRIBUTING），本包没有额外的分支规则；在涉及多个子包改动时，建议一并在同一 feature 分支中提交，确保 Rush 变更可一次性验证。
  - 提交前确保：
    - 相关 hooks 已在上层调用处或测试中被覆盖；
    - `npm run lint` 与 `npm run test` 通过，避免破坏工作区内其它子包的联合检查。

- 变更影响评估
  - 因本包位于「适配层」，对上层调用方 API 的任何修改（签名变更、默认行为改变）都可能影响多个业务包：
    - 修改导出 hooks 的参数或返回值时，请同步搜索 `@coze-arch/bot-hooks-adapter` 的引用，评估所有调用点；
    - 非兼容变更应在变更描述/PR 中明确写出，并在必要时提供迁移说明。

## 六、特别注意点与反模式

- 不要在本包内引入与具体业务强绑定的逻辑，例如：
  - 某个特定 Bot 应用的路由路径、业务常量、埋点 key 等，这类内容应位于上层应用或更通用的基础包中。
- 避免在 hook 中直接访问全局单例状态（如 window 上挂载的任意对象），优先通过：
  - 依赖 `bot-hooks-base` 提供的上下文 hooks；
  - 将可变配置通过参数或 React Context 由上层注入。
- 若需要新增导出路径（如 `./bot/use-xxx`）：
  - 同时更新 [package.json](package.json) 中的 `exports` 与 `typesVersions`，保持运行时导入与 TS 类型解析的一致性；
  - 确保对应源码位于 `src` 下，并在 [src/index.ts](src/index.ts) 或专用入口文件中适当 re-export，统一管理对外 API。
