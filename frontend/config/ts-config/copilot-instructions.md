# Copilot Instructions – `@coze-arch/ts-config`

## 1. 全局结构与定位

- 本包是整个 Coze Studio Monorepo 的 **统一 TypeScript 配置中心**，为所有前端 / Node / 库项目提供共享的 `tsconfig` 预设。
- 核心职责：
  - 暴露多种 `tsconfig.*.json` 预设：`tsconfig.web.json`, `tsconfig.node.json`, `tsconfig.base.json` 等。
  - 在仓库中实现 **类型检查行为的单一真相源**，保证 100+ 包在目标、模块解析、严格模式等方面一致。
- 典型下游用法（见 README.md）：
  - Web 应用：
    ```json
    {
      "extends": "@coze-arch/ts-config/tsconfig.web.json",
      "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src"
      },
      "include": ["src/**/*"],
      "exclude": ["node_modules", "dist"]
    }
    ```
  - Node 服务：
    ```json
    {
      "extends": "@coze-arch/ts-config/tsconfig.node.json",
      "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src"
      },
      "include": ["src/**/*"]
    }
    ```
  - 库 / 共享包：
    ```json
    {
      "extends": "@coze-arch/ts-config/tsconfig.base.json",
      "compilerOptions": {
        "declaration": true,
        "declarationMap": true,
        "outDir": "./dist"
      }
    }
    ```
- 结构设计动机：
  - 将“**环境差异**”（web / node / library）与“**团队约定的全局严格设置**”拆开：公共严格配置集中在本包，各项目只需选择合适的预设并做少量覆盖即可。

## 2. 开发工作流（build / test / debug）

- 安装与依赖声明（在任意下游包的 `package.json` 中）：
  ```json
  {
    "devDependencies": {
      "@coze-arch/ts-config": "workspace:*"
    }
  }
  ```
  然后在仓库根目录：
  ```bash
  rush update
  ```
- 本包自身：
  - 作为配置包，通常不包含复杂业务逻辑；关键是维护各个 `tsconfig.*.json` 文件及其内部结构。
  - 如有脚本（例如 `npm run build`），通常用于构建发布产物（如将 TS/JSON 源拷贝/处理到 `dist`），遵循整个仓库统一脚本风格（参考 CLAUDE.md 中的 Rush / npm 命令组织方式）。
- 仓库级别与本包相关的工作流（来自 CLAUDE.md）：
  - 构建全部前端包：
    ```bash
    rush build
    ```
  - 仅重建依赖本包的特定包（示例）：
    ```bash
    rush rebuild -o @coze-studio/app
    ```
  - 类型检查 / 测试：
    - 各子包通常使用 `tsc --build`、`vitest` 等；这些命令的行为都依赖于本包提供的 `tsconfig` 预设。
- Debug 类型问题时的建议：
  - 若某包类型检查结果与预期不符，优先检查：
    - 该包 `tsconfig.json` 的 `extends` 是否正确引用了本包的某个预设。
    - 是否在局部 `compilerOptions` 中覆盖了与全局约定冲突的字段（如 `strict`, `moduleResolution`, `target` 等）。
  - 对需要广泛调整的编译选项（例如修改 `target` 或 `module`），应先改本包，避免在下游到处复制粘贴。

## 3. 项目特有约定与模式

- 预设粒度：
  - `tsconfig.web.json`：
    - 面向 React Web 应用。
    - 启用 JSX（`react-jsx` runtime），库包含 `DOM` + `ES2022`。
    - 适配 Rspack/Rsbuild 等 Web bundler 的模块解析。
  - `tsconfig.node.json`：
    - 面向 Node.js 服务 / 工具。
    - 启用 Node 类型库，支持 CommonJS / ESModule 互操作。
  - `tsconfig.base.json`：
    - 面向通用库 / 共享包。
    - 更少环境假设，适合作为其它 tsconfig 的基础层。
- **严格模式默认开启**（见 README 中的公共编译选项示例）：
  - 包括但不限于：
    - `"strict": true`
    - `"noImplicitReturns": true`
    - `"noFallthroughCasesInSwitch": true`
    - `"noUncheckedIndexedAccess": true`
    - `"exactOptionalPropertyTypes": true`
    - `"skipLibCheck": true`
    - `"forceConsistentCasingInFileNames": true`
  - AI 生成 / 修改 TS 代码时必须满足这些约束，避免滥用 `any`，注意返回值完整性和可选属性精确性。
- Monorepo / Path Mapping 约定：
  - 支持路径别名和 Rush Monorepo 结构：
    - 示例（web 端）：
      ```json
      {
        "extends": "@coze-arch/ts-config/tsconfig.web.json",
        "compilerOptions": {
          "baseUrl": "./src",
          "paths": {
            "@/*": ["*"],
            "@components/*": ["components/*"]
          }
        }
      }
      ```
  - 推荐所有 Alias 规范通过 `compilerOptions.paths` 配合统一的 `baseUrl`，避免每个包各自为政。

## 4. 关键配置与外部依赖整合

- 与 Rush Monorepo 的整合：
  - 本包设计时假设依赖通过 `workspace:*` 管理（见 README 中的安装示例），以保证在 Rush 管理的多包环境下版本统一。
  - Project references：
    - 支持 TS 官方 Project References 模式（见 README 中 `references` 示例），用于多包之间的增量构建与类型复用：
      ```json
      {
        "extends": "@coze-arch/ts-config/tsconfig.web.json",
        "references": [
          { "path": "../shared-utils" },
          { "path": "../ui-components" }
        ],
        "compilerOptions": {
          "composite": true
        }
      }
      ```
- 与工具链的关系：
  - Rsbuild / Rspack、Vitest、ESLint 等工具都依赖 `tsconfig.json` 做解析：
    - 调整模块解析、`jsx`、`paths` 时，需要兼顾这些工具的行为。
  - 与 `@coze-arch/eslint-config` 之间：
    - TS 编译选项（如 `strict`, `moduleResolution`）应与 ESLint 的 parser/options 保持一致，避免“编译通过但 ESLint 报错”或反之。
- 运行时环境假设：
  - Web preset：
    - 默认目标为现代浏览器 + ES2022，适合 React 18 / Rspack 打包。
  - Node preset：
    - 目标 Node 版本匹配仓库整体 Node LTS（参考根 .nvmrc 与 CI 配置），避免使用尚未在运行环境支持的语法。

## 5. 项目流程与团队协作规范

- 变更策略：
  - 本包标记为 `level-1` & `core`，对整个前端栈影响极大。
  - 修改 `tsconfig.*.json` 时：
    - 尽量保持向后兼容（例如新增警告比直接降低目标或关闭严格模式更安全）。
    - 对潜在破坏性的更改（如修改 `module`, `target`, `moduleResolution`, `jsx`），在 PR 描述中明确列出影响范围和需要关注的包类型。
- 与测试策略的关系（参考 CLAUDE.md）：
  - Level 1 包要求较高的测试覆盖率；但本包主要是配置文件，测试更多体现在：
    - 下游包的 `tsc --build` 成功；
    - 各类项目（web/node/library）的类型检查表现符合预期。
- 提交 / 分支流程（沿用仓库规范）：
  - 使用 Rush 相关命令维护依赖与检查：
    - `rush lint`, `rush test`, `rush build` 等。
  - 使用约定式提交（`rush commit`）与团队标签（如 `team-arch`, `level-1`）标识变更性质。

## 6. 特殊点与注意事项

- **单点配置源**：
  - 所有前端 TS 配置建议统一从本包 `extends`，避免在子包中复制粘贴独立的 tsconfig 逻辑。
  - AI 在创建新包时，应优先引用本包预设，而不是硬写一份完整 tsconfig。
- **不要在下游随意“关严格”**：
  - 如果某个规则在全局层面确实过于严格，应通过修改本包（或添加额外预设）来调整，而不是在下游项目中手动将 `strict: false` 或大量设置为 `any`。
- **兼容性风险**：
  - 修改 `target` 或 `module` 可能影响：
    - 构建产物兼容性（老浏览器 / Node 版本）。
    - 打包工具（Rsbuild / Rspack）和测试框架的行为。
  - 大幅度升级 TypeScript 版本前，应确认与现有 `tsconfig` 选项的兼容性（例如某些选项在新版本中行为变化）。
- **AI 生成配置时的实践**：
  - 新 tsconfig 变体（例如专用 `tsconfig.test.json`）应优先：
    - `extends` 项目已有的 `tsconfig.json`；
    - 在 `compilerOptions` 中做最小必要差异（如关闭 `sourceMap`、排除测试文件等）。
  - 避免在下游包中添加与本包公共设置相矛盾的字段，除非有明确业务原因并在注释中解释。
