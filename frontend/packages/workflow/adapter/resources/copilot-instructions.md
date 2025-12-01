# @coze-workflow/resources-adapter 使用说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/adapter/resources）中安全、高效地协作开发。

## 1. 子包定位与角色

- 本包名称：`@coze-workflow/resources-adapter`，位于 [frontend/packages/workflow/adapter/resources](frontend/packages/workflow/adapter/resources)。
- 主要作为 **Workflow 前端功能组件与 hooks 的适配层**，为 workflow 组件库（如 [frontend/packages/workflow/components](frontend/packages/workflow/components)）与 playground 提供统一入口。
- 开源版本中，绝大多数组件和 hooks 仅提供 **占位/降级实现**，真实业务能力在闭源环境下实现。因此：
  - 要保持**对外 API 形状稳定**（导出名称、参数/返回类型、行为语义）。
  - 内部实现可以是空实现、mock、或简化版 UI，但禁止破坏调用方预期的类型与基本流程。

## 2. 目录结构与全局架构

本包为典型 React + TypeScript 组件/Hook 包，结构相对扁平：

- [src/index.tsx](frontend/packages/workflow/adapter/resources/src/index.tsx)
  - 对外统一导出所有能力：
    - 语音相关：`useSelectVoiceModal`（来自 `./voice`），`useAudioPlayer`（来自 `./audio`，当前开源缺失文件，视为潜在 TODO）。
    - 协作/权限：`CollaboratorsBtn`、`getIsCozePro`、`useCozeProRightsStore`（来自 `./auth`）。
    - 知识库：`DouyinKnowledgeListModal`（来自 `./knowledge`）。
    - Prompt 能力：`NLPromptButton`、`NLPromptModal`、`NlPromptAction`、`NlPromptShortcut`、`NLPromptProvider`（来自 `./prompt`）。
    - 发布工作流：`PublishWorkflowModal`、`usePublishWorkflowModal`（来自 `./store`）。
    - 市场入口：`useWorkflowPublishEntry`（来自 `./market/use-workflow-publish-entry`）。
- [src/voice/index.tsx](frontend/packages/workflow/adapter/resources/src/voice/index.tsx)
  - `useSelectVoiceModal(options)`：返回 `{ open, modal }`，当前 `open` 为空实现、`modal` 为 `null`，并通过注释说明“开源版不提供音色能力”。
- [src/auth/index.tsx](frontend/packages/workflow/adapter/resources/src/auth/index.tsx)
  - `CollaboratorsBtn`：协作入口按钮，在开源版中直接返回 `null`。
  - `getIsCozePro`：判断是否为 Pro 账号，当前始终返回 `false`。
  - `useCozeProRightsStore`：基于 `zustand` 实现的权限信息 store，`rightsInfo` 为空对象，`getRights` 返回空对象 Promise。
- [src/knowledge/index.tsx](frontend/packages/workflow/adapter/resources/src/knowledge/index.tsx)
  - `DouyinKnowledgeListModal`：抖音知识库选择弹窗，目前返回 `null`，仅占位。
- [src/prompt/index.tsx](frontend/packages/workflow/adapter/resources/src/prompt/index.tsx)
  - 一组与 NL Prompt / Prompt Kit 相关的组件：`NLPromptButton`、`NLPromptModal`、`NlPromptAction`、`NlPromptShortcut`；当前均返回 `null`。
  - `NLPromptProvider`：唯一有实际渲染逻辑的组件，只是简单透传 children（`<>{children}</>`），保证调用侧 JSX 不崩溃。
- [src/store/index.tsx](frontend/packages/workflow/adapter/resources/src/store/index.tsx)
  - `PublishWorkflowModal`：用于标识不同发布工作流弹窗的枚举（如 `PUBLISH_RESULT`、`WORKFLOW_INFO` 等）。
  - `usePublishWorkflowModal(options)`：返回 `{ ModalComponent, showModal, setSpace }`，当前均为 `null` 或空函数。
- [src/market/use-workflow-publish-entry.ts](frontend/packages/workflow/adapter/resources/src/market/use-workflow-publish-entry.ts)
  - `useWorkflowPublishEntry()`：返回 `{ enablePublishEntry: false }`，表示市场入口默认关闭。

整体上，**本包是“能力边界适配层 + 开源降级实现”**：
- 对上：被 workflow 组件和 playground 通过包名 `@coze-workflow/resources-adapter` 引用。
- 对下：真实业务环境中会接入权限、协作、发布、Prompt、语音等多种资源；在开源版中统一以空实现/占位实现形式保留接口。

## 3. 构建、测试与开发流程

### 3.1 本包脚本

见 [package.json](frontend/packages/workflow/adapter/resources/package.json)：

- `lint`: `eslint ./ --cache`
  - 使用 [eslint.config.js](frontend/packages/workflow/adapter/resources/eslint.config.js)，底层依赖 `@coze-arch/eslint-config`（preset: `web`）。
- `test`: `vitest --run --passWithNoTests`
  - 使用 [vitest.config.ts](frontend/packages/workflow/adapter/resources/vitest.config.ts)，并通过 `@coze-arch/vitest-config` 继承通用配置（从依赖可推断）。
- `test:cov`: `npm run test -- --coverage`
- `build`: 当前为 `exit 0`，即 **构建脚本占位**，真正 bundling 由上层统一构建流水线处理。

在 Rush monorepo 维度：

- 安装依赖：在仓库根目录执行 `rush install` 或 `rush update`。
- 针对本包运行：
  - `rushx lint -p @coze-workflow/resources-adapter`（或在包目录下直接 `npm run lint`）。
  - `rushx test -p @coze-workflow/resources-adapter`（或在包目录下 `npm run test`）。

### 3.2 TypeScript 配置

- [tsconfig.json](frontend/packages/workflow/adapter/resources/tsconfig.json)
  - `exclude: ["**/*"]` + `references` 指向 `tsconfig.build.json` 和 `tsconfig.misc.json`，采用 **Project References** 方案。
  - 具体编译选项在 `@coze-arch/ts-config` 中统一维护，本包只作为 composite 子工程参与增量构建。

## 4. 项目内特有约定与模式

1. **开源降级策略**
   - 对应注释如 “The open source version does not provide xxx capabilities”：所有关键业务能力在开源版中用 **空实现 + 明确注释** 方式保留接口。
   - AI 助手在修改这些文件时，应：
     - 不随意删改这类注释；
     - 保持函数签名与导出名不变；
     - 若要增加简单 mock 逻辑，需确保不会破坏调用方测试（例如继续返回 `null` UI、`false` 标志或空对象）。

2. **Zustand store 使用方式**（见 [src/auth/index.tsx](frontend/packages/workflow/adapter/resources/src/auth/index.tsx)）
   - store 创建集中在 adapter 包中，外部只通过导出好的 hook 访问（如 `useCozeProRightsStore`）。
   - 默认 state 极简，仅保证类型完整。若新增字段，请同时确保默认值安全（避免 `undefined` 破坏调用方渲染）。

3. **导出聚合入口**
   - 所有对外能力必须从 [src/index.tsx](frontend/packages/workflow/adapter/resources/src/index.tsx) 统一导出，以便其他包只依赖包名而不关心内部目录结构。
   - 新增能力时：
     - 在对应子目录实现（例如 `src/xxx/index.tsx`）。
     - 在 `src/index.tsx` 中显式 re-export。

4. **UI 组件占位约定**
   - UI 组件占位实现统一采用 `props => null` 形式；如需在开源版展示占位文案，也建议保持 **不侵入布局/交互**，避免影响上层实际产品布局。

5. **枚举与配置常量**
   - 枚举如 `PublishWorkflowModal` 仅在共享时机发生变化时才可调整；调用侧通常依赖这些枚举字符串做路由/埋点/开关判断，修改需谨慎。

## 5. 与其它子包的集成关系

从全局搜索 `@coze-workflow/resources-adapter` 可见典型使用方：

- Workflow 组件层：[frontend/packages/workflow/components](frontend/packages/workflow/components)
  - 如 `workflow-modal`、`voice-select`、`use-workflow-resource-action` 等文件，从本包引入语音、发布、Prompt 等能力。
- Workflow Playground：[frontend/packages/workflow/playground](frontend/packages/workflow/playground)
  - 测试运行、系统 Prompt 编辑器、数据集选择等功能，通过本包提供的 Modal / Provider / hooks 接入资源能力。

集成特征：

- **本包不直接调用后端 API**，只暴露 React 组件 / hooks 及常量；真正的数据获取、权限和埋点逻辑通常位于闭源实现或上层包中。
- 对调用方而言，本包是“资源相关 UI + 状态”的入口；因此任何签名变化都可能影响多个上层包，AI 修改时要保持向后兼容。

## 6. 代码风格与质量规范

- ESLint：统一使用 `@coze-arch/eslint-config`，preset 为 `web`，不在本包内做自定义规则（见 [eslint.config.js](frontend/packages/workflow/adapter/resources/eslint.config.js)）。
- TypeScript：通过 workspace 共享 `@coze-arch/ts-config`，默认严格模式，避免使用 `any`；当前占位实现使用 `_props` 等前缀避免未使用变量告警。
- 测试：
  - 使用 Vitest；开源包可能暂未提供实际用例，但命令需要保持可运行。
  - 若为本包新增行为（即不再是纯占位），建议在 `__tests__` 中添加最小覆盖，符合仓库 `rushx-config` 中对 level-3 包“无强制覆盖率”的定位。

## 7. 分支、发布与部署相关

- 本包遵循整个前端仓库的统一流程：
  - 通过 Rush 和 PNPM 管理依赖与版本。
  - 版本号与发布策略由上层脚本/CI 控制，本包自身不包含单独的 release 脚本。
- `README.md` 中仅保留模板说明（storybook、bundle 类型等），真正的构建与发布流程在 monorepo 级别统一维护。

## 8. 开发建议（面向 AI 助手）

- 修改或新增导出能力时：
  - 先在调用方（如 workflow/components 或 playground）确认现有使用方式，避免破坏调用链。
  - 优先保证类型与返回结构稳定；功能缺失时，可以通过注释说明“开源环境下为空实现”。
- 若需为开源版补充简单 mock 行为：
  - 需确保行为 **幂等、安全、易理解**，例如：
    - 将 `useWorkflowPublishEntry` 中的 `enablePublishEntry` 改为可配置的常量开关，而不是硬编码为 `true`。
    - 为 UI 占位组件增加轻量提示（可选），同时不影响布局与交互路径。
- 避免在本包内引入新的全局状态管理方案或复杂副作用逻辑；如有必要，应与调用方/上层包现有模式保持一致。
