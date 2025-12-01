# @coze-agent-ide/bot-creator-context 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/context）中安全、高效地协作开发。

## 全局架构与职责划分
- 本包是 agent-ide 体系下的一个 **React Context 子包**，用于为「Bot 创建 / 配置」相关页面提供上下文（当前场景等）。
- 核心实现集中在 [src/index.tsx](src/index.tsx)：
  - 定义枚举 `BotCreatorScene`，当前包含 `Bot` 与 `DouyinBot` 两种场景。
  - 通过 `createContext` 创建 `BotCreatorContext`，约定上下文形态为 `{ scene: BotCreatorScene | undefined }`。
  - 默认值中的 `scene` 设为 `BotCreatorScene.Bot`，因此在未显式传值时会退回通用 bot 场景。
  - 暴露 `BotCreatorProvider`（直接使用 `BotCreatorContext.Provider`）以及 hook `useBotCreatorContext` 供外部消费。
- 本包**不包含 UI 组件和路由逻辑**，仅负责：
  - 统一管理「Bot 创建场景」的类型与上下文形状。
  - 为上层应用（如 coze-studio / agent-ide 各子包）提供稳定的上下文消费接口。
- Storybook 配置位于 [.storybook](.storybook)，主要用于本包在设计体系中的独立调试 / 展示，默认 stories 路径为 `../stories`（当前子包中暂无 stories 目录，可在需要时新增）。

## 关键开发工作流（构建 / 测试 / 调试）
- 包级脚本定义在 [package.json](package.json)：
  - `build`: 当前实现为 `exit 0`，即占位命令，不真正产出构建结果；构建通常由上层 Rush / 通用构建管线负责。
  - `lint`: `eslint ./ --cache`，使用 monorepo 公共 eslint 配置（`@coze-arch/eslint-config`），preset 为 `web`，额外规则见 [eslint.config.js](eslint.config.js)。
  - `test`: `vitest --run --passWithNoTests`，使用公共 Vitest 配置预设（`@coze-arch/vitest-config`），详细见 [vitest.config.ts](vitest.config.ts)。
  - `test:cov`: 在 `test` 的基础上追加 `--coverage`，产出覆盖率报告，输出目录由 Rush 配置声明。
- Rush 相关配置：
  - [config/rush-project.json](config/rush-project.json) 声明了与 Rush operation 关联的输出目录：
    - `operationName: "test:cov"` 对应 `outputFolderNames: ["coverage"]`。
    - `operationName: "ts-check"` 对应 `outputFolderNames: ["./dist"]`。
  - 在 monorepo 顶层通常通过 `rushx test` / `rushx test:cov` / `rushx ts-check` 触发本包脚本（具体命令以仓库顶层配置为准）。
- TypeScript 构建 / 校验：
  - [tsconfig.json](tsconfig.json) 仅做 references 聚合与 composite 工程声明；实际编译配置位于 [tsconfig.build.json](tsconfig.build.json)。
  - `tsconfig.build.json` 基于 `@coze-arch/ts-config/tsconfig.web.json` 扩展，目标为浏览器（`lib: ["DOM", "ESNext"]`, `module: "ESNext"`, `target: "ES2020"`）。
  - `rootDir: src`, `outDir: dist`，TS build info 存放在 `dist/tsconfig.build.tsbuildinfo`。
- 本地 Storybook 调试：
  - [.storybook/main.js](.storybook/main.js) 配置 `@storybook/react-vite` 与 `vite-plugin-svgr`，支持在 stories 中直接以组件方式引入 SVG。
  - [.storybook/preview.js](.storybook/preview.js) 配置 actions / controls 的基础参数。
  - 若需要运行，请在本包目录安装依赖后，参考仓库顶层或类似子包中的 `storybook`/`dev` 脚本。

## 项目特有约定与模式
- **Context 形状与默认值**：
  - Context 类型固定为 `{ scene: BotCreatorScene | undefined }`，请保持属性命名与语义一致，不要在不必要的情况下向该对象添加其他字段；若需扩展，请评估对所有消费方的影响后再进行。
  - 默认值 `scene: BotCreatorScene.Bot` 体现「缺省为通用 Bot 创建场景」的业务约定；修改默认值属于行为变更，应谨慎评估。
- **hook 使用约束**：
  - `useBotCreatorContext` 内部会：
    - 通过 `useContext` 读取 `BotCreatorContext`；
    - 若 `context` 不存在则抛出错误：`useBotCreatorContext must be used within a BotCreatorProvider`。
  - 编写新代码时，应：
    - 仅在已被 `BotCreatorProvider` 包裹的子树中调用该 hook；
    - 单元测试中构造最小 Provider 包裹来覆盖相关逻辑。
- **枚举扩展约定**：
  - 新增 Bot 场景时，只能在 [src/index.tsx](src/index.tsx) 中扩展 `BotCreatorScene` 枚举；
  - 同时应在使用该枚举的上下文消费方（其他包内）显式处理新 case，避免因 `switch` 漏分支导致的静默 bug。
- **跨包依赖模式**：
  - 本包的类型与工具依赖（`@coze-arch/*`）通过 workspace 协议统一管理，不在本包锁具体版本；
  - 在修改 TS / 测试配置行为时，应优先查看对应的 infra/config 包（如 `frontend/config/ts-config`、`frontend/config/vitest-config`），保持一致性。

## 外部依赖与集成细节
- NPM 依赖：
  - `react`, `react-dom`: 通过 peerDependencies + devDependencies 管理，版本约束为 `>=18.2.0` / `~18.2.0`，与整个 monorepo 统一。
  - `classnames`: 目前虽声明为依赖，但本包代码中暂未使用；未来如引入 className 组合逻辑可直接使用该库。
- 工具链与内部基础设施：
  - ESLint: 通过 [eslint.config.js](eslint.config.js) 使用 `@coze-arch/eslint-config` 的 `web` preset；新增规则时应遵循 monorepo 统一规范，不在本包做大规模自定义。
  - Vitest: 通过 [vitest.config.ts](vitest.config.ts) 使用 `@coze-arch/vitest-config` 的 `web` preset，自动拉取 Jest DOM、React Testing Library 等测试工具的统一配置。
  - Storybook + Vite: [.storybook/main.js](.storybook/main.js) 使用 `viteFinal` 合并 SVGR 插件，确保 SVG 能以组件方式在 Storybook 中渲染。

## 项目流程与协作规范
- 分支 / 提交流程：
  - 以仓库整体流程为准（通常采用 feature 分支 + MR/PR 审核）；在本包修改时：
    - 保持变更原子化，避免在一个提交内同时修改多个无关子包；
    - 若涉及 API 变更（如 `BotCreatorScene` 枚举新增值），在提交信息与 MR 描述中明确说明影响范围。
- 测试与质量门禁：
  - 新增或修改导出的 Context API 时：
    - 建议在 [__tests__](__tests__) 中增加对应用例（目前目录仅有 `.gitkeep`，可以自由创建测试文件）。
    - 至少运行 `rushx test --to @coze-agent-ide/bot-creator-context` 或等效命令（具体看 monorepo 脚本）确保通过。
  - 对需要覆盖率要求的变更，可运行 `rushx test:cov --to @coze-agent-ide/bot-creator-context` 或等效命令，查看 `coverage` 结果。

## 不寻常 / 需要特别注意的点
- **build 脚本为占位**：
  - `npm run build` 当前只是 `exit 0`，真正的打包/构建可能由上层统一脚本完成；若你需要为该包产出可发布构建（如 UMD/ESM bundle），需要先在 monorepo 层面确认标准做法，再在本包中接入，以避免与其他子包不一致。
- **Context 默认值与空检查可能有迷惑性**：
  - `createContext` 调用时已经传入默认值，因此理论上 `useContext(BotCreatorContext)` 不会返回 `undefined`；
  - 但 `useBotCreatorContext` 仍保留了「未包裹 Provider 时抛错」的保护逻辑，这是一种防御性模式：
    - 如未来将默认值改为 `undefined`，该检查会立刻暴露问题；
    - 编写新代码时不要依赖「即使不包 Provider 也能工作」的假设。
- **Storybook 目录结构预留但未使用**：
  - `.storybook` 已配置，但 `stories` 目录暂未存在；
  - 若新增 stories，应遵循 `../stories/**/*.stories.tsx` / `*.mdx` 的路径约定，以便配置自动生效。

## 针对 AI 助手的具体建议
- 修改或扩展 `BotCreatorScene` 时：
  - 同步更新所有使用该枚举的 switch/判断逻辑（即便不在本包内），避免遗漏分支。
  - 如变更影响到默认场景，请在 MR 描述中明确提醒人工审查者。
- 在本包增加新导出（hook、工具函数等）时：
  - 放置在 [src/index.tsx](src/index.tsx) 或新增模块文件，并通过 index 统一 re-export，保持对外 API 集中。
  - 注意维持 API 向后兼容，避免对现有调用点产生破坏性变更，除非有充分理由且同步修改所有调用方。
- 自动重构 / 批量修改前：
  - 优先阅读 [eslint.config.js](eslint.config.js)、[tsconfig.build.json](tsconfig.build.json)、[vitest.config.ts](vitest.config.ts)，确保不违反全局配置与共享约定。
