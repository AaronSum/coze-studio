# Copilot Instructions for @coze-arch/bot-typings

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-typings）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本子包路径：frontend/packages/arch/bot-typings，对应 npm 包名 `@coze-arch/bot-typings`，标记为 team-arch / level-1。
- 职责：提供 Coze Studio 前端各子包共享的 TypeScript 类型定义，属于“纯类型、零运行时”的基础设施。
- 被广泛通过 `/// <reference types='@coze-arch/bot-typings' />` 或 `import` 方式引用，是前端工程的类型核心之一，修改需格外谨慎。

## 2. 全局架构与主要模块
- 包整体为 d.ts/ts 类型声明集合，不产出可执行 JS：
  - src/index.d.ts
    - 入口声明文件。
    - 使用三方引用：`./data_item`、`./navigator`、`./window` 以及 `@coze-arch/bot-env/typings`。
    - 声明资源模块：`*.jpeg` / `*.jpg` / `*.webp` / `*.gif` / `*.png` / `*.less` / `*.css` / `*.svg`，为 React & bundler 提供导入类型（特别是 SVG 的 `ReactComponent` + 默认导出）。
  - src/common.ts
    - 导出通用类型：`BotPageFromEnum`（机器人详情来源枚举）、`Obj`、`Expand<T>`, `PartialRequired<T,K>` 等，用于前端共享的类型工具。
  - src/teamspace.ts
    - 导出 `DynamicParams`：团队空间 / 多业务路由的动态参数集合，是许多路由与上下文的基础类型。
  - src/window.d.ts
    - 扩展全局 `Window`：IDE 插件卸载、Monaco、抖音/TT 小程序接口（`tt.miniProgram`）、Coze 容器 `__cozeapp__`、以及 `process.env` 形态。
  - src/navigator.d.ts
    - 扩展全局 `Navigator`：增加 `standalone: boolean` 字段，用于 PWA / 独立运行环境检测。
  - src/data_item.d.ts
    - 用户信息、鉴权、OAuth 等相关的大量接口/类型（从 README 可知），通常在其它前端包中通过 `DataItem.*` 访问。
- 结构设计要点：
  - 将“跨包共享的环境/资源/用户/路由类型”集中在一个可重用的 typings 包中，便于多应用 & 多 adapter 协同。
  - 与 `@coze-arch/bot-env`、`@coze-arch/ts-config` 等基础设施组合，形成统一的类型环境。

## 3. 构建、测试与日常开发流程
- package.json 脚本：
  - `build`: `exit 0`
    - 明确标识“无实际构建步骤”；Rush 的构建阶段对该包来说是空操作。
  - `lint`: `eslint ./`
    - 使用工作区统一 ESLint 配置（`@coze-arch/eslint-config`）。
- TypeScript 工程配置：
  - tsconfig.json
    - `composite: true`，启用 TS project references。
    - `references` 指向 `tsconfig.build.json` 与 `tsconfig.misc.json`，自身 `exclude: ["**/*"]`，主要作为 references 聚合入口。
  - tsconfig.build.json
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`。
    - `rootDir: ./src`，`outDir: ./dist`。
    - `include: ["src"]`。
    - `references` 指向：`../bot-env/tsconfig.build.json`、`../../../config/eslint-config/tsconfig.build.json`、`../../../config/ts-config/tsconfig.build.json`，确保依赖项目先构建。
  - tsconfig.misc.json
    - 用于测试/配置文件（如 `__tests__`、`vitest.config.ts`）的工程设置，当前仓库中可能尚未实际使用，但约定保留。
- 在 Rush / 前端整体项目中的典型操作：
  - 安装依赖（在仓库根目录）：`rush install` 或 `rush update`。
  - 单包 lint（在本子包目录）：`pnpm lint` 或 `rushx lint`（视 Rush 配置而定）。
  - 构建全量前端：在 frontend 根或 apps 中运行对应 dev/build 命令时，这个包只参与 TS 类型检查，不产出 runtime 逻辑。

## 4. 项目特有约定与模式
- 纯类型包约定：
  - 不引入任何运行时依赖；package.json 的 `dependencies` 为空，所有依赖都在 `devDependencies` 中。
  - `main` 与 `types` 都指向 `src/index.d.ts`，`exports`/`typesVersions` 仅用来指导 TS/Node 的解析而非运行时加载。
  - `build` 永远为 no-op，如需生成 `.d.ts` 或兼容发布流程，应在其它层面处理（例如由 tsbuild/打包工具统一处理）。
- 模块解析约定：
  - `exports`：
    - `".": "./src/index.d.ts"` 作为整体入口（side-effect 型引用：`import '@coze-arch/bot-typings';`）。
    - `"./common": "./src/common.ts"`，`"./teamspace": "./src/teamspace.ts"` 提供按需导入能力。
  - `typesVersions`：为 TS 提供版本化解析映射，使 `import '@coze-arch/bot-typings/common'` 等在不同 TS 版本下兼容。
- 全局扩展策略：
  - 使用 `declare module '*.xxx'` / 扩展 `Window` / `Navigator` / `process.env`，统一在该包维护，而不是散落各个应用中。
  - 与 `@coze-arch/bot-env/typings` 配合，构成完整的前端运行环境类型（环境变量、运行容器、微前端等）。
- 命名与注释风格：
  - 保持英文注释为主，个别字段附中文说明（如 `/** social scene */`）。
  - 类型/枚举命名多为业务语义化（如 `BotPageFromEnum`, `DynamicParams`, `UserInfo`, `AuthLoginParams` 等），不要引入与业务无关的通用名称，避免冲突。

## 5. 与其他子包 / 外部系统的集成
- 与前端其它包：
  - 多个 package 下的 `typings.d.ts` / `global.d.ts` 会通过：
    - `/// <reference types='@coze-arch/bot-typings' />`
    - 或 `import {...} from '@coze-arch/bot-typings/common'`
    - 来复用本包类型；因此：
      - 修改 `DynamicParams` 字段、`UserInfo` 结构、`BotPageFromEnum` 等，极可能影响大量调用点，需要全仓 lint/构建验证。
- 与 `@coze-arch/bot-env`：
  - `src/index.d.ts` 中 `/// <reference types='@coze-arch/bot-env/typings' />` 说明：
    - 本包依赖 bot-env 中定义的一些环境/常量全局类型；
    - 在添加新的全局变量类型时，应优先判断属于“环境变量”还是“前端运行容器”，选择在 bot-env 或 bot-typings 中扩展，保持职责清晰。
- 与打包工具 / 资源系统：
  - 声明的 `*.less` / `*.css` / `*.svg` 模块类型，需要与 rsbuild / webpack 的实际 loader 行为吻合：
    - SVG 默认导出 `any`，并额外暴露 `ReactComponent`，用于 `import { ReactComponent as Icon } from 'xxx.svg'` 模式。
    - 样式导入形态统一为 `{ [key: string]: string }`，符合 CSS Modules 习惯。

## 6. 修改与扩展时的注意事项
- 通用原则：
  - 因为依赖面非常广，任何变更都应视为“breaking risk”，即使是看似小的字段可选性调整。
  - 严禁引入真实运行时代码（如函数实现、import React 之后直接调用等）；仅允许声明语句。
- 添加新类型的推荐流程：
  1. 判断类型归属：
     - 资源 / 全局接口 / 用户数据 / 鉴权 / 路由参数等，才适合放入本包；与具体 UI 组件或业务模块强耦合的类型应留在对应 package。
  2. 选择文件：
     - 通用工具：放在 src/common.ts，并从该文件导出。
     - 路由 & 团队空间：扩展 src/teamspace.ts。
     - 全局对象：扩展 src/window.d.ts / src/navigator.d.ts / src/data_item.d.ts。
  3. 如需新增子入口：更新 package.json 的 `exports` 与 `typesVersions`，并在 README 中补充简要说明。
- 变更现有类型时：
  - 尽量通过新字段替代，而不是直接改动旧字段类型（例如将 `x: string` 改为 `x?: string | null` 会产生大量编译影响）。
  - 如果是为了修复服务端声明错误（典型场景），优先使用 `PartialRequired` 等工具类型在消费侧修正，而不是直接修改底层来源类型。

## 7. 项目流程与协作规范（针对本子包）
- 代码风格：
  - 遵从仓库统一 ESLint / TSConfig 规则；尽量不在局部禁用规则，已有 `eslint-disable` 注释保持最小范围。
- 分支与提交（推断自整体仓库）：
  - 依赖 Rush monorepo 工作流，通常通过 feature 分支修改后合并；在涉及此包的变更时，commit message 要清楚描述影响面（例如“typing: add DynamicParams.project_id”）。
- 验证步骤：
  - 至少在 frontend 范围内执行一次 lint / 构建（或运行受影响应用的 `rushx dev` / `rushx build`），确认无 TS 报错。

## 8. 本包的特殊点与坑位提示
- `build` 为 no-op：
  - 某些自动化脚本可能假设“所有包 build 后会产出 dist”，但本包不会；在新增脚本/工具时要考虑这一点。
- 全局声明的易踩坑：
  - `interface Window` / `interface Navigator` 扩展是全局合并的，重复声明或字段类型不一致会引起冲突；新增字段时保持结构简单，并避免与标准 DOM 类型的字段名冲突。
- data_item.d.ts 体积可能较大：
  - 编辑/格式化时注意不要意外大幅改动结构；如需大规模重构，建议拆分为多个小 PR 并配合全仓构建验证。

以上约定旨在让 AI 编程助手在编辑 @coze-arch/bot-typings 时，既能快速定位正确的修改位置，又能控制类型变更的影响范围，避免对整个前端仓库造成难以预期的破坏。