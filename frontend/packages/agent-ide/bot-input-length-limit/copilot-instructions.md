# bot-input-length-limit 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-input-length-limit）中安全、高效地协作开发。

## 1. 子包定位与整体职责

- 该子包提供「Agent / Project 文本输入长度控制」的纯业务逻辑能力，不负责 UI 展示。
- 对外唯一入口为 [src/index.ts](src/index.ts)，导出 `botInputLengthService` 实例，供 Studio / Agent IDE 场景统一使用。
- 典型调用点包括：空间 Bot 创建表单、Onboarding 文案编辑、建议问题列表、项目复制/选择空间弹窗等（参见其它包中对 `@coze-agent-ide/bot-input-length-limit` 的引用）。
- 长度计算采用 `grapheme-splitter`，确保按「用户感知字符数（Grapheme Cluster）」计数，正确处理 emoji、组合字符等。
- 长度配置根据站点环境切换：国内（CN）与海外（OVERSEA）两套配置，通过全局常量 `IS_OVERSEA` 区分。

## 2. 代码结构与数据流

核心目录结构：

- [package.json](package.json)：定义包名、脚本和依赖；`main` 指向 `src/index.ts`（源码入口）。
- [src/index.ts](src/index.ts)：导出 `botInputLengthService`，是外部唯一应依赖的符号。
- [src/services/index.ts](src/services/index.ts)：
  - `BotInputLengthService` 类实现所有长度相关逻辑：
    - `getInputLengthLimit(field)`：根据字段名（`botName` / `onboarding` / `projectName` 等）获取最大长度。
    - `getValueLength(value)`：使用 `GraphemeSplitter` 计算字符串长度；`undefined` 时返回 0。
    - `sliceStringByMaxLength({ value, field })`：按配置截断字符串，保证不超过最大长度且不截断 Grapheme Cluster。
    - `sliceWorkInfoOnboardingByMaxLength(param)`：对包含 `prologue` 和 `suggested_questions` 的对象做深拷贝后逐字段截断，并保持 `suggested_questions_show_mode` 不变。
  - 默认导出实例 `botInputLengthService`，构造函数参数为配置函数 `getBotInputLengthConfig`。
- [src/services/constants.ts](src/services/constants.ts)：
  - 定义 `CN_INPUT_LENGTH_CONFIG` 与 `OVERSEA_INPUT_LENGTH_CONFIG` 两组 `BotInputLengthConfig`：
    - 字段包括 `botName`、`botDescription`、`onboarding`、`onboardingSuggestion`、`suggestionPrompt`、`projectName`、`projectDescription`。
    - 海外站普遍限制更宽松（例如 `botName` 40、`onboarding` 800）。
  - `getBotInputLengthConfig()`：根据全局 `IS_OVERSEA` 选择配置；该变量由上层构建环境注入（不在本包内定义）。
- [src/services/type.ts](src/services/type.ts)：
  - 定义业务相关类型：
    - `BotInputLengthConfig`：各字段最大长度的配置对象。
    - `SuggestQuestionMessage` / `WorkInfoOnboardingContent`：用于 Onboarding 内容和建议问题的结构体。
  - 依赖 `@coze-arch/bot-api/playground_api` 中的 `SuggestedQuestionsShowMode`，与 Playground 接口保持对齐。
- [src/typings.d.ts](src/typings.d.ts)：通过三斜线指令引入 `@coze-arch/bot-typings` 类型声明，统一 IDE / 构建期类型环境。
- [__tests__/services.test.ts](__tests__/services.test.ts)：对 `BotInputLengthService` 的行为进行单元测试（如长度计算与截断逻辑）；新增功能时需同步补充。

数据流高层概览：

1. 上层调用方（如空间 Bot 表单）导入 `botInputLengthService`。
2. 通过配置函数 `getBotInputLengthConfig` 读取当前站点的长度限制配置。
3. 由 `BotInputLengthService` 对输入字符串或对象结构执行长度计算与截断。
4. 上层根据结果展示提示/截断文本或做进一步校验，但不直接操作配置常量。

## 3. 构建、测试与开发工作流

### 本子包常用命令（在包根目录执行）

- 安装依赖（在 monorepo 根目录）：`rush install` 或 `rush update`。
- Lint：`npm run lint`（实质为 `eslint ./ --cache`，使用 `@coze-arch/eslint-config` 预设）。
- 单测：`npm test`（`vitest --run --passWithNoTests`），或 `npm run test:cov` 查看覆盖率。
- 构建：`npm run build` 当前实现为 `exit 0`，即占位脚本；真正产物由上层统一打包流程处理。

### 测试与覆盖率约束

- Vitest 配置位于 [vitest.config.ts](vitest.config.ts)，通过 `@coze-arch/vitest-config` 统一管理：
  - `preset: 'web'`，自动注入 jsdom、React 测试环境等。
  - 默认按 monorepo 规范输出覆盖率（`@vitest/coverage-v8`）。
- 根据 [frontend/rushx-config.json](../rushx-config.json) 的规则：本包标签为 `level-2`，要求：
  - 全量覆盖率不低于约 30%。
  - 增量变更覆盖率不低于约 60%。
- 引入新公共方法或增加复杂逻辑时，需要在 `__tests__` 中增加针对 Grapheme 计数、多语言输入、极端长度、`undefined` 等 case 的测试，用例风格需与现有保持一致。

## 4. 项目约定与编码风格

### 类型与业务边界约定

- 类型定义集中在 [src/services/type.ts](src/services/type.ts)，禁止在业务代码中散落重复的结构定义。
- 所有长度相关常量只允许通过 `BotInputLengthConfig` / `getBotInputLengthConfig` 获取，不在上层重复硬编码数值，避免中外站配置不一致。
- 面向上层暴露时，统一使用：
  - `getValueLength` 进行展示长度计算。
  - `sliceStringByMaxLength` / `sliceWorkInfoOnboardingByMaxLength` 执行截断，而不是直接使用 `substring` 等原生方法。

### 国际化与站点环境约定

- 国内 / 海外两套长度配置在 [src/services/constants.ts](src/services/constants.ts) 中集中维护：
  - 调整单个字段时务必同时考虑 CN 与 OVERSEA 两侧的产品需求。
  - 如新增字段（例如未来可能新增的 description 类型），需：
    - 在 `BotInputLengthConfig` 中增加字段并更新注释。
    - 在 CN/OVERSEA 两个配置对象中添加对应键值。
    - 在所有使用 `keyof BotInputLengthConfig` 的方法中确认是否需要支持该字段。
- `IS_OVERSEA` 不在本包定义，由运行环境注入（通常来自 Webpack/Rsbuild 的 DefinePlugin 或运行时全局变量）；在本包中不要尝试声明或修改该变量，只能读取。

### ESLint / TS / 样式相关

- Lint：
  - 使用 [eslint.config.js](eslint.config.js) 中的 `@coze-arch/eslint-config`，preset 为 `web`。
  - 自定义规则目前为空对象，如需添加规则，优先考虑在 monorepo 统一配置里调整，确需本包特例时再在此处覆盖。
- TypeScript：
  - [tsconfig.build.json](tsconfig.build.json) 继承自 `@coze-arch/ts-config/tsconfig.web.json`，开启了一系列严格选项（`noImplicitAny`、`noUncheckedIndexedAccess` 等）。
  - 底层通过 project references 依赖 `bot-api`、`bot-flags`、`bot-typings` 及各类 config 包，以保证编译顺序正确。
  - 新增文件应放在 `src/` 下并纳入 `include` 覆盖范围；避免在 `dist/` 中手改输出。
- 样式：本包当前没有样式文件，仅提供逻辑能力；如未来添加 UI，请遵循 `@coze-arch/stylelint-config` 的规范，并参考其它 Agent IDE 包的结构（`src/components`、`src/styles`）。

## 5. 外部依赖与集成细节

- 第三方库：
  - `grapheme-splitter`：按 Unicode Grapheme Cluster 分割字符串，是计数与截断的核心依赖；任何替换或版本升级都需重点回归测试 emoji、复合字符、RTL 文本等场景。
  - `lodash-es/cloneDeep`：用于在 `sliceWorkInfoOnboardingByMaxLength` 中对输入对象进行深拷贝，确保调用者传入的原始数据不会被修改（函数应视为纯函数）。
- 内部依赖：
  - `@coze-arch/bot-api/playground_api`：提供 `SuggestedQuestionsShowMode` 枚举，保证与后端/Playground 模块数据结构一致。
  - `@coze-arch/bot-typings`：通过 [src/typings.d.ts](src/typings.d.ts) 影响全局类型解析，避免重复声明。
  - `@coze-arch/bot-flags`：目前仅在 TS references 中声明，用于未来与 Feature Flags 体系联动；如增加按实验标识调整 length 的逻辑，应通过该包提供的能力实现，而不是直接访问全局变量。

与上层模块集成要点：

- 只从 `@coze-agent-ide/bot-input-length-limit` 导入 `botInputLengthService`，不要直接引用内部文件路径（例如 `services/constants`），以便后续可以自由调整内部结构。
- 在 UI 组件或表单中：
  - 使用 `getInputLengthLimit('fieldName')` 显示计数器最大值或配置校验规则。
  - 在 `onChange` 或提交前调用 `sliceStringByMaxLength`/`sliceWorkInfoOnboardingByMaxLength` 对文本进行截断，保证存储到后端的数据不会超长。
  - 如需展示当前已用字数，使用 `getValueLength` 而非 `value.length`。

## 6. 项目流程与协作规范

- 版本管理：
  - 包版本目前为 `0.0.1`，由上层 monorepo 的发布流程统一管理，不在子包内独立发版。
- 分支与提交：
  - 遵循仓库整体 Git 流程（参考仓库根目录的贡献指南 CONtributing 文档）。
  - 针对该子包的改动建议在提交信息中显式包含包名，便于追踪，例如：`feat(bot-input-length-limit): support project description limit`。
- 代码评审：
  - 涉及长度配置调整或逻辑改动时，应在 PR 描述中列出各字段新旧值对比，以及受影响的页面/场景，便于产品与 QA 评估风险。
  - 涉及 `grapheme-splitter` 相关逻辑变动时，必须附带多语言/emoji/极端长度用例的测试截图或结果说明。

## 7. 特殊注意事项与坑点

- 不要使用 `string.length` 作为长度依据：本包的统一规范是以 Grapheme Cluster 作为计数单位；任何绕过 `BotInputLengthService` 自行计算长度的做法都可能导致中英文/emoji 混排场景下的体验不一致。
- 保持函数纯度：
  - `sliceWorkInfoOnboardingByMaxLength` 对入参做深拷贝后再返回新对象；扩展时不要引入对外部可变状态的读写。
- `IS_OVERSEA` 来源不在本包：
  - 本包只能读取该值，不应做环境检测或注入逻辑；如需在本包测试中覆盖不同环境，可通过构造新的 `BotInputLengthService` 实例并传入自定义配置函数来模拟。
- 与其它包的耦合控制：
  - 所有新增导出优先考虑逻辑层（例如新增 `sliceProjectInfoByMaxLength`），避免在此包中引入 UI 依赖，以保持其在 monorepo 中的位置清晰：**跨场景可重用的长度限制域服务**。
