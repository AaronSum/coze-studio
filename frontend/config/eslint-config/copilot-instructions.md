# Copilot Instructions for `@coze-arch/eslint-config`

## 1. 全局结构与角色定位

- 本包是整个前端 Monorepo 的 **统一 ESLint 配置中心**，为各种项目（Web、Node、库）暴露一套标准化的 lint 规则。
- 入口：
  - 源码目录：src（通常包含 index.ts / `defineConfig` 实现等）。
  - 对外文档：README.md。
- 使用方式（下游项目）：
  - 在各子包根目录创建 eslint.config.js：
    ```js
    const { defineConfig } = require('@coze-arch/eslint-config');

    module.exports = defineConfig({
      packageRoot: __dirname,
      preset: 'web', // 'web' | 'node' | 'base'
    });
    ```
  - `defineConfig` 会根据 `preset` 拼装规则集，并注入 `packageRoot` 相关的解析配置（例如 monorepo import 解析、忽略列表等）。
- 结构性原则：
  - **preset 驱动**：将规则按运行环境（web / node / base）拆分，便于在 Monorepo 中按包角色选择不同强度的规则。
  - **“配置即代码”**：所有规则通过 TypeScript / JS 代码组合，而不是到处复制 `.eslintrc`，降低重复和漂移风险。

## 2. 关键开发工作流（build / test / debug）

- 本包本身是一个 **配置库**，典型使用流程：
  - 安装 & 更新：
    ```bash
    pnpm add @coze-arch/eslint-config --save-dev
    rush update
    ```
  - 在任意下游包中执行 ESLint：
    ```bash
    # 直接用 eslint
    npx eslint ./src

    # 或使用 README 中提到的 reslint 别名（如果在 package.json 中配置了）
    npx reslint ./src
    ```
- 本包自身的构建 / 测试（推断自整个仓库惯例，保持最小假设）：
  - 常见脚本命名遵循仓库统一规范，通常包括：
    - `npm run build`：构建发布产物（供 Node 端 `require('@coze-arch/eslint-config')` 使用）。
    - `npm run test`（如存在）：验证内部工具逻辑（例如规则组合函数、路径解析工具）。
  - 在根目录使用 Rush 统一操作：
    ```bash
    # 构建全部包
    rush build

    # 仅重建当前包（示例）
    rush rebuild -o @coze-arch/eslint-config
    ```
- Debug 建议：
  - 如果修改了规则导致某些包 lint 异常：
    - 在目标包里运行 `npx eslint <文件>`，结合 `--debug` 查看 ESLint 加载的配置。
    - 检查该包的 eslint.config.js 是否正确设置了 `packageRoot` 与 `preset`。
  - 如需快速验证规则，可在本包增加一个临时 fixture 目录（不建议提交），手动跑 ESLint 验证。

## 3. 项目特有的约定与模式

- **Preset 约定**（来自 README）：
  - `preset: 'web'`：
    - 面向 React Web 应用。
    - 启用 React / React Hooks 规则、浏览器 globals。
    - 集成 `eslint-plugin-risxss` 做 XSS 安全校验。
    - 包含“受限导入规则”以保证前端架构边界（例如禁止跨层级依赖）。
  - `preset: 'node'`：
    - 面向 Node.js / 工具脚本。
    - 开启 Node 环境、Node 安全相关插件。
    - 更宽松的浏览器相关规则（通常关闭）。
  - `preset: 'base'`：
    - 面向库 / 共享模块。
    - 聚焦 JS/TS 基础质量、import 解析、基础 best practice。
- **增强配置接口**：
  - `defineConfig(config: EnhanceESLintConfig)` 是唯一入口。
  - `EnhanceESLintConfig` 额外字段（相对标准 ESLintConfig）：
    - `packageRoot: string`：必须，指定当前包根目录，供 ignore / import 解析等逻辑使用。
    - `preset: 'web' | 'node' | 'base'`：环境选择。
    - `overrides?: ESLintConfig[]`：允许按文件模式覆写规则（如测试文件放宽 `max-lines`）。
    - `ignores?: string[]`：项目自定义忽略列表。
    - `rules?: Linter.RulesRecord`：增量覆盖或补充规则。
    - `settings?: any`：透传到 ESLint `settings` 字段，用于 import 解析、React 版本声明等。
- **Monorepo 感知**：
  - README 明确提到 “Workspace-aware”：
    - 规则/配置内部会考虑 Rush Monorepo 结构，为内部包 import 提供合理的 `import/resolver` 配置，避免误报 “未解析的模块”。
  - 下游包只需正确设置 `packageRoot`，无需每个包手动配置复杂的 `settings.import/resolver`。

## 4. 关键组件与外部依赖整合

- 主要对接对象是 **ESLint 及其插件生态**：
  - TypeScript：通过 `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` 支持高级 TS 规则。
  - React：加载 React / Hooks 相关 plugin，确保 hooks 依赖数组、组件命名、JSX 可访问性等。
  - 安全：
    - Web 端通过 `eslint-plugin-risxss` 做 XSS 相关检查。
    - Node 端通过安全插件（如 `eslint-plugin-security` 或类似）规避常见安全坑位。
  - Prettier：
    - 通过 `eslint-config-prettier` + Prettier 本体，实现“ESLint 管风格冲突禁用 + Prettier 控制代码格式”。
    - 用户可直接使用 `npx prettier --write ./src` 执行格式化，且与 ESLint 兼容。
- 与 Rush / Monorepo 的结合：
  - 在 README.md 与 CLAUDE.md 中，整个仓库强调：
    - 不在根目录直接 `npm install`，统一用 `rush update` 维护依赖。
    - Lint 全仓库使用 `rush lint` / `rush lint-staged` 等命令。
  - 本包要保持对 Rush 结构的兼容性：
    - 不要硬编码 `node_modules` 路径，应通过 `packageRoot` 和 ESLint 官方机制解析依赖。
- 与其它配置包的关系：
  - 本包是 eslint 规则中心，旁边还有类似：
    - ts-config (`@coze-arch/ts-config`)
    - vitest-config (`@coze-arch/vitest-config`)
    - tailwind-config, postcss-config 等
  - 这些配置包共同构成前端工程的一致性基础设施：TS/ESLint/Vitest/Tailwind 都统一由 `@coze-arch/*` 提供。

## 5. 项目流程与协作规范（与全仓库保持一致）

- 版本管理与提交流程（参考根目录 CLAUDE.md）：
  - 使用 Rush 统一管理依赖和构建；变更此包规则会影响大量下游包，需谨慎。
  - 提交前通常会跑：
    - `rush lint-staged`（在仓库层预检查变更）。
    - 针对受影响较大的范围可跑 `rush lint` 或 `rush test`。
- 变更 eslint 规则时的协作建议：
  - 尽量在小范围下游包内先验证规则，再逐步推广。
  - 对有破坏性的规则调整（如从 `warn` 升级为 `error`），在 PR 描述中清晰说明“影响面”（可能影响的 tag / level，如 `team-arch`, `level-1` 观测到的范围）。
  - 若需支持新的环境类型（例如 `preset: 'cli'`），保持向后兼容：不要破坏既有 `'web' | 'node' | 'base'` preset 行为。

## 6. 本包的特殊点 / 注意事项

- 这是 **全仓库 ESLint 行为的单一真相源头**：
  - 任何规则修改都可能在 100+ 包里暴露出新的 lint 报错。
  - AI 修改规则时，应优先：
    - 添加 **更细粒度的 override**（例如只放宽测试文件），而不是在全局 preset 中大面积放宽。
- 与安全 / 架构密切相关：
  - Web preset 中的 XSS / import 限制规则是重要防线，不要随意关闭。
  - 架构类规则（限制低层依赖高层、禁止跨 team 乱 import）通常编码在这里，修改前要确认具体约束逻辑。
- 与 Prettier 一致性：
  - 避免在此包中引入与 Prettier 冲突的风格类规则（例如强制某种缩进但 Prettier 配置另有规定）。
  - 若必须启用某些风格 lint 规则，需确保与整个仓库现有 Prettier 配置一致。
- AI 生成代码 / 修改脚本时应遵守：
  - 使用 `defineConfig` 作为唯一入口，不要在下游项目手写原始 `ESLintConfig` 对象。
  - 在新包的 eslint.config.js 中，总是显式设置：
    - `packageRoot: __dirname`
    - 合适的 `preset`
  - 对于基础 infra 包（如 `frontend/infra/*`），优先考虑 `preset: 'node'` 或 `preset: 'base'`，而不是 `web`。
