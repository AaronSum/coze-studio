# @coze-arch/eslint-plugin — Copilot Instructions

本文件用于指导 AI Coding Agent 在子包 `frontend/infra/eslint-plugin` 中高效工作。

---

## 1. 全局架构与职责

- 本子包是一个 **面向 Flow 应用的 ESLint 插件集合**，包含：
  - 核心代码质量与包管理规则（import、函数长度、错误处理等）；
  - 针对 Zustand 的状态管理最佳实践规则；
  - 用于 `package.json` 的 JSON Processor（处理器）。
- 运行时代码入口：
  - 主插件：`src/index.ts` / `src/index.js`
    - 暴露 `flowPreset`，包含：
      - `rules`: `no-deep-relative-import`、`max-line-per-function`、`package-*`、`tsx-no-leaked-render` 等；
      - `configs.recommended`: 默认推荐配置（含通用规则 + package.json 专用规则 + processor 绑定）；
      - `processors['json-processor']`: 指向 `src/processors/json.ts`。
  - Zustand 插件：`src/zustand/index.ts` / `src/zustand/index.js`
    - 同样通过 `flowPreset` 暴露 `rules` 与 `configs.recommended`，但命名空间为 `@coze-arch/zustand/*`。
- 包导出形式（见 `package.json`）：
  - `"." -> ./src/index.js` 作为主插件；
  - `"./zustand" -> ./src/zustand/index.js` 作为 Zustand 子插件；
  - 使用方式示例集中在 [frontend/infra/eslint-plugin/README.md](README.md)。
- 目录大致结构：
  - `src/index.ts`：主插件汇总规则、推荐配置与 processors；
  - `src/rules/*/`：每个子目录代表一条核心规则；
  - `src/processors/json.ts`：`package.json` 的 JSON Processor；
  - `src/zustand/index.ts`：Zustand 插件的规则与推荐配置；
  - `src/zustand/rules/*/`：Zustand 专用规则实现与测试。

**设计动机：**
- 将“通用前端/Flow 应用规则”和“Zustand 状态管理规则”拆分为两个插件入口，方便消费方按需引入；
- 通过 `flowPreset.configs.recommended` 集中定义推荐规则集，前端应用只需展开配置即可对齐团队规范；
- 通过 JSON Processor 专门处理 `package.json`，避免常规 JS/TS 规则错误应用在 JSON 上。

---

## 3. 规则与插件结构约定

### 3.1 主插件 `src/index.ts`

- 聚合并导出：
  - `flowPreset.rules`：映射到 `src/rules/*` 中的具体实现；
  - `flowPreset.configs.recommended`：
    - 第一段：面向所有文件的推荐规则；
    - 第二段：`files: ['package.json']`，并设置 `processor: '@coze-arch/json-processor'` 以及 `package-*` 规则；
  - `flowPreset.processors['json-processor']`：绑定到 `src/processors/json.ts` 导出的 JSON Processor。
- 推荐规则中包含注释（英文）解释意图：如
  - `no-deep-relative-import` 的 `max: 4`；
  - `max-line-per-function` 的上限 150 行；
  - 为何 `package.json` 上关闭 `prettier/prettier` 等。

### 3.2 Rule 目录约定（核心规则）

- 每条规则一个子目录，位于 [frontend/infra/eslint-plugin/src/rules](src/rules)：
  - 如 `no-deep-relative-import/`、`max-lines-per-function/`、`no-new-error/` 等；
- 内部通常包含：
  - 规则实现：`index.ts` 或同名 TS 文件；
  - 测试：`index.test.ts` 或类似文件；
- 规则在 `src/index.ts` 中以 `camelCaseRule` 形式导入后，统一挂到 `flowPreset.rules`。

新增规则时：
- 新建子目录 `src/rules/<rule-name>/`，实现 `RuleModule`；
- 在 `src/index.ts` 中导入并挂载；
- 如需要加入推荐配置，在 `flowPreset.configs.recommended` 中显式配置（并考虑是否仅作用于特定文件模式）。

### 3.3 JSON Processor 结构

- 文件： [frontend/infra/eslint-plugin/src/processors/json.ts](src/processors/json.ts)；
- 作为 `flowPreset.processors['json-processor']` 暴露；
- 在推荐配置中只对 `package.json` 生效：
  - `files: ['package.json']`；
  - `processor: '@coze-arch/json-processor'`；
  - 只应用 `package-*` 规则；
  - 显式关闭 `prettier/prettier` 以规避已知与 JSON 的兼容性问题。

修改 Processor 时要注意：
- 文件最终会被当成 JS AST 还是 JSON AST 解析？当前实现中有注释 TODO 指出未来会“直接解析 JSON”，Agent 不要将此 TODO 当作已实现特性；
- 任何行为变更都可能影响 monorepo 中所有 `package.json` 的 lint 行为，修改前建议同时查看根目录及其他包的 ESLint 配置引用方式。

### 3.4 Zustand 插件结构

- 入口： [frontend/infra/eslint-plugin/src/zustand/index.ts](src/zustand/index.ts)；
  - `rules`：`prefer-selector`、`prefer-shallow`、`store-name-convention`、`no-state-mutation` 等；
  - `configs.recommended`：
    - 各规则以 `@coze-arch/zustand/*` 命名空间启用。
- 规则实现目录： [frontend/infra/eslint-plugin/src/zustand/rules](src/zustand/rules)；
  - 每条规则对应一个 TS 文件/子目录，导出 `RuleModule`；
  - 示例规则：
    - `no-get-state-in-comp`：限制在组件中直接访问 `getState`；
    - `proper-store-typing`：约束 store 的类型定义；
    - `zustand-devtools-config`：约束 devtools 配置；
    - `zustand-prefer-middlewares`：推荐使用中间件等。
Zustand 插件是一个独立入口，消费时一般通过：

```ts
import zustandPlugin from '@coze-arch/eslint-plugin/zustand';
```

---

## 4. 测试模式与依赖集成
### 4.1 RuleTester 与工具依赖

- 规则测试通常使用 `@typescript-eslint/rule-tester`，类型定义来自 `@types/eslint`、`@typescript-eslint/utils` 等；
  - `@typescript-eslint/utils`：提供 `TSESLint.RuleModule`、AST 类型等工具；
  - `eslint-module-utils`：处理导入/模块解析；
  - `eslint-traverse`、`eslint-utils`：AST 遍历与通用工具；
  - `semver`：处理版本比较，主要服务于 package 规则；
- 开发依赖（`devDependencies`）：
  - `@typescript-eslint/eslint-plugin`、`@typescript-eslint/parser`：本项目自身使用的 TS lint 能力；
  - `@vitest/coverage-v8` + `vitest`：测试与覆盖率；
  - `eslint` + 一些插件（`import`、`react`、`unicorn`、`prettier`）仅用于开发自检，而非本插件对外暴露的内容。
**对 Agent 的要求：**
- 如需新增对 AST 的复杂操作，优先复用 `@typescript-eslint/utils`、`eslint-utils` 提供的工具，而不是手写 fragile 的 AST 访问逻辑；
- 涉及 package 语义（如版本比较、依赖合法性）时，优先使用 `semver`，不要自己实现解析逻辑。
### 4.2 测试实践约定

- README 中建议：
  - 为每个新规则新建对应的 `index.test.ts`，通过 ESLint `RuleTester` 编写 `valid` / `invalid` 用例；
- 当前 vitest 配置不会自动帮你创建测试，只负责运行；
- 建议（非强制）模式：
  - 每条规则一个测试文件，位于对应规则目录下；
  - 每个 invalid 用例明确指定 `errors`，保证错误消息和定位一致。

---

## 5. 工程流程与协作约定

> 全局流程（如 Git 分支策略、部署流程）在 monorepo 顶层文档中定义，这里只记录对本子包开发有直接影响的部分。

- 依赖管理：
  - 通过 Rush + pnpm 管理，新增依赖应遵循 workspace 规范，不要直接在本包目录运行 `npm install`（应改为 Rush/pnpm 对应命令）；
  - `@coze-arch/ts-config` 作为内部 tsconfig 预设，不要随意删除或替换，新增 TS 配置应尽量继承它。
- 代码风格：
  - 统一由本包自己的 ESLint 配置控制，尽量不要在单个文件中增加局部大量 `eslint-disable`；
  - 若规则实现必须使用某些“看起来不规范”的写法，请添加最小范围的 `eslint-disable-next-line`，并在注释中说明原因。
- 发布/构建：
  - 由于 `build` 目前是 no-op，发布流程更多依赖 monorepo 顶层脚本；
  - 如需引入真实 build 流程（例如 TS -> JS 编译），需要：
    - 保持 `exports` 字段语义不变或做兼容迁移；
    - 使用 `tsconfig.build.json` 作为构建 TS 配置来源。

---

## 7. 给 AI Agent 的操作建议

- 当你需要 **新增一条规则** 时：
  1. 在 `src/rules/` 或 `src/zustand/rules/` 下创建对应目录/文件；
  2. 规则实现使用 `@typescript-eslint/utils` 提供的类型和工具，遵循现有规则风格；
  3. 在 `src/index.ts` 或 `src/zustand/index.ts` 中注册该规则，并根据需要加入 `configs.recommended`；
  4. 为该规则添加 vitest + RuleTester 测试；
  5. 若是对外公开且较重要的规则，可在 [frontend/infra/eslint-plugin/README.md](README.md) 中补充 API 文档与示例。

- 当你需要 **修改已有规则行为** 时：
  - 优先阅读该规则目录下的测试和 README 中对应章节，确保新行为与“Flow 应用 / Zustand 最佳实践”目标一致；
  - 修改后同步更新推荐配置中的默认选项（例如 `max` 限制），并更新测试用例。

- 当你需要 **调整 Processor 或 package 规则** 时：
  - 同时考虑 monorepo 其他包对 `package.json` lint 的依赖；
  - 使用 `semver` 做任何版本范围/比较相关的逻辑，不要自造轮子；
  - 尽量通过增加测试覆盖 `package.json` 不同场景来防止回归。
