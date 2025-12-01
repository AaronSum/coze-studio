# AI 协作开发指南（@coze-arch/import-watch-loader）

本说明用于指导 AI 编程助手在本子包（frontend/infra/plugins/import-watch-loader）中安全、高效地协作开发。

## 全局架构与设计意图

- 本包是一个极简的 JavaScript Loader 插件，主要用于在构建阶段扫描源码中的特定 `import` / 使用模式并阻止不符合规范的写法。
- 核心逻辑集中在 [frontend/infra/plugins/import-watch-loader/index.js](frontend/infra/plugins/import-watch-loader/index.js)，没有多层封装或复杂依赖。
- Loader 的职责是只读分析传入的源码字符串 `code`，按预定义规则匹配正则表达式；若命中则抛出带中文提示和责任人信息的错误，否则原样透传源码。
- 该包被其他前端子项目通过构建工具（通常是 Webpack / Rspack 类 Loader 机制）引用，用来强制执行架构规范，因此**稳定性和错误信息清晰度**比新增功能更重要。
- 测试文件 [frontend/infra/plugins/import-watch-loader/__test__/index.test.js](frontend/infra/plugins/import-watch-loader/__test__/index.test.js) 验证 Loader 在包含/不包含特定语句时的行为，是理解预期行为的主要依据。

## 源码结构概览

- [frontend/infra/plugins/import-watch-loader/index.js](frontend/infra/plugins/import-watch-loader/index.js)
  - 声明 `defaultRuleOwner` 作为默认负责人标识。
  - 定义 `rules` 数组，每个元素包含：
    - `regexp`: 用于匹配源码中禁止出现的模式，例如 `@tailwind utilities`、`@ies/starling_intl`、误用 `@coze-arch/bot-env`。
    - `message`: 命中时展示的中文错误提示，部分包含替代方案说明。
    - `owner`: 规则负责人，可选；若缺省则使用 `defaultRuleOwner`。
  - 导出函数 `module.exports = function (code, map) { ... }` 作为 Loader 入口：
    - 遍历 `rules`，对每条规则执行 `rule.regexp.test(code)`。
    - 命中时通过 `throw Error("<resourcePath>:<message>。如有疑问请找<owner>")` 形式抛错，其中 `resourcePath` 从 Loader 上下文 `this.resourcePath` 读取。
    - 未命中任何规则时调用 `this.callback(null, code, map)` 继续后续 Loader 流程。
    - `catch` 块中再次调用 `this.callback(err, code, map)` 并重新 `throw Error(err)`，以确保构建工具和单测都能感知到异常。
- [frontend/infra/plugins/import-watch-loader/__test__/index.test.js](frontend/infra/plugins/import-watch-loader/__test__/index.test.js)
  - 使用 Vitest 的 `describe/it/expect` 编写：
    - `loader.call({ resourcePath, callback }, rawCode)` 手动构造 Loader 上下文并调用。
    - 第一条用例验证当代码中包含 `@tailwind utilities;` 时会抛出特定错误文案（包括资源路径与负责人）。
    - 第二条用例验证在未命中规则时 `callback` 被调用且 `code` 未被修改。
- [frontend/infra/plugins/import-watch-loader/package.json](frontend/infra/plugins/import-watch-loader/package.json)
  - `main: "index.js"` 指定入口。
  - `scripts` 中仅定义了 `build` 占位命令、`lint`、`test` 和 `test:cov`。
  - 依赖均为 Dev 依赖，真正运行时只依赖 Node / Loader 机制本身。
- [frontend/infra/plugins/import-watch-loader/eslint.config.js](frontend/infra/plugins/import-watch-loader/eslint.config.js)
  - 复用 monorepo 的 `@coze-arch/eslint-config`，约束代码风格与规则。
- 配置目录 [frontend/infra/plugins/import-watch-loader/config](frontend/infra/plugins/import-watch-loader/config) 下：
  - `rush-project.json` / `rushx-config.json`：声明本包在 Rush monorepo 中的项目信息和脚本集成方式，通常不需要 AI 修改，除非明确调整 monorepo 配置。

## 开发与运行工作流

- 单元测试
  - 在 monorepo 根目录或子包目录执行：`rushx test --to @coze-arch/import-watch-loader`（推荐通过 Rush 运行），或在本子包内执行 `npm test`（若已单独安装依赖）。
  - 测试框架为 Vitest，配置来自 workspace 级别的 `@coze-arch/vitest-config`。
- 代码检查
  - 通过 Rush：`rushx lint --to @coze-arch/import-watch-loader`。
  - 直接在本包：`npm run lint`。
- 构建
  - `npm run build` 当前是空实现（`exit 0`），本包本质为纯 JS Loader，不需要额外打包步骤；真实使用依赖于上层构建工具的加载配置。
- 调试 Loader 行为
  - 推荐在单测中增删用例以验证新规则或文案，而不是直接在大型应用构建流程中实验。
  - 如需手动调试，可在测试中 console.log 传入的 `code`、`this.resourcePath` 或规则匹配情况，但提交前应清理调试输出。

## 项目约定与模式

- 规则定义方式
  - 所有导入/使用约束集中在 `rules` 数组中维护，新增规则时：
    - 按现有结构新增对象 `{ regexp, message, owner? }`。
    - `regexp` 应尽量精确，避免误伤合法用例（例如使用非贪婪匹配或锚点）。
    - `message` 需为简明的中文提示，明确指出错误点和推荐做法。
    - `owner` 若不填则自动回退至 `defaultRuleOwner`，用于后续咨询与责任划分。
- 错误信息格式
  - 约定格式为：`<resourcePath>:<message>。如有疑问请找<owner>`。
  - 单测对完整错误字符串做断言，修改错误文案或格式时必须同步更新相关测试。
- Loader 上下文使用
  - 通过 `loader.call({ resourcePath, callback }, code)` 在测试中注入上下文，保持与构建工具真实调用方式一致。
  - 不在 Loader 中做异步操作；所有校验同步完成后一次性调用 `this.callback`。
- 语言与文案
  - 规则提示与 README 中面向内部开发者的说明以中文为主。
  - 仅在配置或示例中使用英文（如 JSON 字段名、命令）。

## 与外部系统的集成细节

- 构建系统
  - 本包设计为通用的“导入监控 Loader”，可以接入 Webpack / Rspack 等支持 Loader 接口的构建系统。
  - Loader 仅依赖 `this.resourcePath` 与 `this.callback`，不关注具体构建工具实现；因此在迁移构建栈时通常无需修改本包。
- 与其他 Coze 包的关系
  - 规则中明确限制直接使用 `@ies/starling_intl`，要求改用 `@coze-arch/i18n`，体现本 monorepo 内部的国际化抽象层级。
  - 对 `@coze-arch/bot-env` 的使用也做了运行时约束：在 Web 端禁止直接引入，提示使用页面注入的 `GLOBAL_ENV` 变量，以保持运行环境统一。

## 团队流程与规范

- 版本与发布
  - 版本号与发布流程由 Rush monorepo 统一管理；本包的 `version` 字段通常由自动化脚本更新。
- 修改与评审
  - 由于 Loader 会在所有相关前端应用构建环节生效，修改规则需评估潜在影响范围，建议：
    - 为每个新规则新增或补充对应单元测试，覆盖命中与未命中两类情况。
    - 在合并前在典型应用上试跑构建流程，观察是否出现误报。
- 分支与提交
  - 遵循 monorepo 通用分支/提交规范（可参考仓库根目录下的贡献指南 CONRTIBUTING/README 等），本包没有额外的分支策略要求。

## 特殊注意事项与坑

- 正则匹配要谨慎
  - 正则写得过于宽松可能导致大量合法代码被阻止构建；尤其在匹配包名或指令时，要避免误匹配注释、字符串中的无关内容。
  - 对已有规则进行改动前，最好在 monorepo 里全局搜索相关语句，评估现有使用情况。
- 错误处理
  - 当前实现中在捕获到错误后既调用 `this.callback(err, code, map)` 又 `throw Error(err)`，这是为了兼容构建工具和测试用例两侧的错误传播方式；修改错误处理逻辑时需确认不会改变现有行为。
- 兼容性
  - 由于 Loader 是纯 JS 且不依赖 Node 新特性，保持向后兼容性相对简单；如需引入新语法或依赖，请确认与 monorepo 的 Node 版本策略一致。

## 面向 AI 助手的实用建议

- 在修改或新增规则时：
  - 始终同步更新 [frontend/infra/plugins/import-watch-loader/__test__/index.test.js](frontend/infra/plugins/import-watch-loader/__test__/index.test.js)，确保测试覆盖新规则和错误文案。
  - 避免直接修改 monorepo 构建配置中对本 Loader 的接入方式，除非用户明确指示；更推荐仅在本包内演进规则。
- 如用户请求“放宽/关闭某个限制”，优先：
  - 通过调整或删除对应 `rules` 条目实现，而不是在 Loader 中加入特例分支。
  - 在提交说明中描述变更背景及影响，以便人类维护者评审和回溯。
