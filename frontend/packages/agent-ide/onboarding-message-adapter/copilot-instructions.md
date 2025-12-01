# @coze-agent-ide/onboarding-message-adapter 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/onboarding-message-adapter）中安全、高效地协作开发。

## 一、子包定位与全局架构

- 包路径与名称：frontend/packages/agent-ide/onboarding-message-adapter，对应 npm 包名 `@coze-agent-ide/onboarding-message-adapter`。
- 角色：为 Agent IDE 领域提供「Onboarding 欢迎消息」组件的适配层，本包本身不实现 UI，只对上游组件做二次导出，方便在 monorepo 中统一依赖。
- 对外入口：
  - 源码入口为 src/index.ts。
  - 当前仅导出 `OnboardingMessage`：
    - 实际实现来自 `@coze-agent-ide/space-bot/component`。
    - 本包保持 API 透明转发，不改变 props/行为。
- 架构理念：
  - 将 Agent IDE 中的 OnboardingMessage 能力抽象为独立 package，方便在不同前端应用中按需引入。
  - 通过 workspace:* 依赖直接绑定到上游 space-bot 包，减少重复实现与版本漂移。

## 二、开发与测试工作流

- 依赖安装（在仓库根目录）：
  - 使用 Rush 管理：`rush update` 或 `rush install`。
- 常用脚本（在本子包目录 frontend/packages/agent-ide/onboarding-message-adapter 下执行）：
  - `npm run build`：当前实现为 `exit 0`，仅作为占位命令；真实构建/打包由上层应用/构建系统统一处理，本包只需要保证类型与导出正确。
  - `npm run lint`：运行 ESLint（eslint ./ --cache），规则由 `@coze-arch/eslint-config` 提供，preset 通常为 `web`；在改动 TypeScript/React 代码后建议执行。
  - `npm run test`：基于 Vitest 运行单测（vitest --run --passWithNoTests），配置见 vitest.config.ts，通过 `@coze-arch/vitest-config.defineConfig` 统一管理。
  - `npm run test:cov`：在 test 基础上开启覆盖率统计（--coverage）。
- Storybook 与本地调试：
  - README.md 说明这是一个「react component with storybook」模板，通常会配套 .storybook 目录与 stories 文件；当前本子包仅作为适配层，实际 story 和交互调试应在上游 `@coze-agent-ide/space-bot` 或应用级包中完成。

## 三、代码组织与项目约定

- 源码结构（当前精简）：
  - src/index.ts：
    - 统一导出 `OnboardingMessage`：`export { OnboardingMessage } from '@coze-agent-ide/space-bot/component';`。
    - 不添加任何包装逻辑（如 props 改写、额外副作用）。
- TypeScript 配置：
  - 顶层 tsconfig.json：
    - `compilerOptions.composite = true`，作为 TS Project References 的一部分参与增量构建。
    - `exclude: ["**/*"]`，实际编译入口由 tsconfig.build.json 与 tsconfig.misc.json 管理，这与前端 monorepo 其他子包保持一致。
  - tsconfig.build.json：
    - 继承 `@coze-arch/ts-config` 下的前端预设（例如 tsconfig.web.json），负责将 src 编译到 dist（具体路径以文件内容为准）。
  - tsconfig.misc.json：
    - 覆盖 __tests__、配置文件等非产出代码，保证编辑器类型提示与测试环境一致。
- 依赖与 peerDependencies：
  - dependencies：
    - `@coze-agent-ide/space-bot: workspace:*`：提供真正的 OnboardingMessage 实现与相关 Agent IDE 能力，是本包的核心上游依赖。
    - `classnames`：虽然当前导出未直接使用，但作为通用工具类库存在，若未来在适配层中加入轻量样式合并可直接复用。
  - devDependencies：
    - 统一使用 @coze-arch 前缀的 ts/eslint/stylelint/vitest 配置包，保证与整个前端工程的开发体验一致。
    - React/ReactDOM 仅作为 devDependencies（版本 ~18.2.0），真正运行时依赖通过 peerDependencies 由消费方提供。
  - peerDependencies：
    - `react`、`react-dom`：要求版本 >=18.2.0，调用方（应用或上层包）必须在自身依赖中提供，以避免重复打包 React。
- 代码风格：
  - 源文件头部统一使用 Apache-2.0 版权声明，新增 TS/TSX 文件时保持相同注释格式。
  - 由于本包目前几乎无业务逻辑，所有变更应尽量保持文件简短、职责单一。

## 四、与上游/下游系统的集成

- 与 @coze-agent-ide/space-bot 的关系：
  - `OnboardingMessage` 组件真实实现位于 space-bot 包的 `component` 导出中，本包只是简单 re-export：
    - 这样可以在不同场景中按 `@coze-agent-ide/onboarding-message-adapter` 作为依赖接入 Agent IDE Onboarding 能力，而无需感知 space-bot 的内部结构/路径。
  - 若未来 space-bot 调整导出路径（例如从 component 迁移到其他模块），应在本包中同步更新 import 语句，同时保持对外导出名不变，尽量不影响下游调用。
- 与前端应用的关系：
  - 应用通常直接在 React 视图中引用本包：
    - 例如 `import { OnboardingMessage } from '@coze-agent-ide/onboarding-message-adapter';`。
    - 组件的 props/行为应与 space-bot 中的实现完全一致，本包不做参数变形。
  - 若需要在应用层面进行 UI 包装（例如加外层布局、埋点、权限判断），推荐在应用自己的组件中组合使用本包导出的 OnboardingMessage，而不是在本包内耦合具体业务场景。

## 五、项目流程与协作规范

- 开发流程：
  - 在 monorepo 根目录完成依赖安装后，即可在前端应用中引用本包；本包自身无需单独启动 dev server。
  - 调试 OnboardingMessage 行为时，首选在实际使用它的应用页面中进行，而不是在本包内增加 demo 代码。
- 代码修改建议：
  - 由于本包主要职责是「转发导出」，任何改动都可能影响到所有依赖该适配层的功能，修改前建议:
    - 检查仓库内对 `@coze-agent-ide/onboarding-message-adapter` 的所有引用（尤其是路径 import 与组件使用方式）。
    - 在至少一个集成应用中验证组件是否仍能正常渲染 Onboarding 内容。
  - 如果未来需要在适配层增加逻辑（例如注入额外上下文、埋点包装），应：
    - 明确区分「纯 re-export」与「带包装组件」：可保留原始导出，同时新增包装组件导出名，避免破坏已有使用方。
    - 在 README 或本说明中补充新导出的用途与差异。
- Lint/测试与 CI：
  - 在提交涉及本包的改动前，至少应保证：
    - `npm run lint` 通过（无新增 ESLint 报错）。
    - 如新增单测，则确保 `npm run test` 通过，必要时在上层 CI 中检查覆盖率阈值要求。

## 六、对 AI 助手的特别提示

- 变更范围控制：
  - 本包当前实现极简，只负责导出 OnboardingMessage；在没有明确需求的情况下，不要在此处引入新的 UI 依赖、状态管理或网络请求逻辑。
- 新增功能时的推荐方式：
  - 若只是需要额外导出 space-bot 中的其他 Agent IDE 组件，可以：
    - 在 src/index.ts 中增加对应的命名导出，并在本文件中记录说明。
  - 若要提供包装后的高阶组件，建议：
    - 使用新的导出名（例如 WrappedOnboardingMessage），内部在 `OnboardingMessage` 外层增加布局/上下文。
    - 保持原始 `OnboardingMessage` 导出行为不变，以最大程度避免破坏兼容。
- 依赖更新：
  - 如需升级 React/ReactDOM 或 @coze-arch 工具包版本，应配合同一 monorepo 中其它前端包统一升级，避免单包锁版本；具体流程遵循仓库根目录的贡献指南。
