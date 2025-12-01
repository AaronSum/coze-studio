# @coze-common/prompt-kit-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/prompt-kit/adapter）中安全、高效地协作开发。

## 总体架构与角色定位

- 本包是对 @coze-common/prompt-kit-base 的「适配层」，主要用于：
  - 重新导出基础库中的能力（如 usePromptConfiguratorModal）。
  - 在不修改基础库的前提下，为特定业务（Studio/Agent IDE 等）注入 UI 与交互定制。
- 入口与导出：
  - [src/index.tsx](src/index.tsx)：包的主导出，当前仅 re-export usePromptConfiguratorModal 自 create-prompt 目录。
  - [src/create-prompt/index.tsx](src/create-prompt/index.tsx)：对基础包的 create-prompt 能力进行包装并导出 PromptConfiguratorModal 与 usePromptConfiguratorModal。
- 关键依赖：
  - @coze-common/prompt-kit-base：提供基础 Prompt 配置器 Modal 组件与上下文能力，是本包最核心的上游依赖。
  - @coze-common/editor-plugins：提供富文本编辑相关能力，这里使用 useCursorInInputSlot 判断光标是否在输入槽内。
  - @coze-arch/i18n：本包当前未直接使用，但作为公共依赖存在，新增 UI 时应保持与整体多语言方案兼容。
- 架构理念：通过「适配器包」对基础能力进行轻量包装，集中业务差异化配置，避免在上游基础库内塞入具体业务逻辑。

## 目录结构与关键模块

- [src/](src)
  - [src/index.tsx](src/index.tsx)
    - re-export usePromptConfiguratorModal 自 ./create-prompt。
    - 作为包的默认导出入口，被其他子包引用时通常 import { usePromptConfiguratorModal } from '@coze-common/prompt-kit-adapter'。
  - [src/create-prompt/index.tsx](src/create-prompt/index.tsx)
    - 再导出：
      - usePromptConfiguratorModal：直接从 @coze-common/prompt-kit-base/create-prompt 透传。
      - PromptConfiguratorModal：在基础 Modal 上叠加本包特有的 UI 配置（见下）。
  - [src/create-prompt/prompt-configurator-modal.tsx](src/create-prompt/prompt-configurator-modal.tsx)
    - 引入：
      - useCursorInInputSlot：来自 @coze-common/editor-plugins/input-slot，用于判断光标是否处于「输入槽」中。
      - BasePromptConfiguratorModal、ImportPromptWhenEmptyPlaceholder、useCreatePromptContext、InsertInputSlotButton：均来自 @coze-common/prompt-kit-base/create-prompt。
    - PromptConfiguratorModal 组件职责：
      - 基于 BasePromptConfiguratorModal 封装 promptSectionConfig：
        - editorPlaceholder：使用 ImportPromptWhenEmptyPlaceholder，指引用户导入 Prompt。
        - editorActions：在编辑器下方区域放置 InsertInputSlotButton，并根据 inInputSlot 禁用。
        - headerActions：在非只读态时，在头部区域增加一组 InsertInputSlotButton 操作按钮，并同样受 inInputSlot 控制。
      - 根据 useCreatePromptContext()?.isReadOnly 决定是否渲染 headerActions，保证只读场景下不会暴露修改入口。
  - [src/create-prompt/use-modal.tsx](src/create-prompt/use-modal.tsx)
    - 当前通过 index.tsx 仅 re-export 自 @coze-common/prompt-kit-base/create-prompt。
    - 后续如有扩展（例如默认参数、埋点等），应在此文件中实现，再由 index.tsx 暴露。

- 配置与工具文件：
  - [package.json](package.json)
    - scripts：
      - build：当前为 "exit 0"，表示本包暂无单独打包流程，由上层工具统一处理；AI 助手不应私自改为真实构建，除非明确需求。
      - lint：eslint ./ --cache。
      - test：vitest --run --passWithNoTests。
      - test:cov：在 test 基础上收集覆盖率。
    - exports：
      - "." -> ./src/index.tsx。
      - "./create-prompt" -> ./src/create-prompt/index.tsx。
    - typesVersions：为 TS 消费者提供 create-prompt 子路径的类型映射。
  - [tsconfig.json](tsconfig.json)、[tsconfig.build.json](tsconfig.build.json)、[tsconfig.misc.json](tsconfig.misc.json)
    - 统一继承 @coze-arch/ts-config 的组织级配置；新增 TS 配置时优先通过上游共享配置解决，保持一致性。
  - [eslint.config.js](eslint.config.js)、[.stylelintrc.js](.stylelintrc.js)
    - 依赖组织级配置包 @coze-arch/eslint-config 与 @coze-arch/stylelint-config；规则修改优先在上游完成。
  - [vitest.config.ts](vitest.config.ts)
    - 一般基于 @coze-arch/vitest-config 做轻量包装，用于单元测试配置。
  - [stories/](stories)
    - demo.stories.tsx / hello.mdx：使用 Storybook 演示组件行为，适合作为 UI 与交互的参考实例如需调整视觉/交互，应同步维护 Storybook 示例。

## 关键数据流与交互模式

- Prompt 创建/配置流（create-prompt）：
  - 上游 @coze-common/prompt-kit-base 提供：
    - BasePromptConfiguratorModal：包含 Prompt 编辑主区域与基础布局。
    - useCreatePromptContext：暴露 isReadOnly 等上下文状态，用于控制交互能力。
    - ImportPromptWhenEmptyPlaceholder：在内容为空时的导入占位提示。
    - InsertInputSlotButton：在 Prompt 文本中插入「输入槽」的按钮组件。
  - 本包在 prompt-configurator-modal.tsx 中：
    - 通过 useCursorInInputSlot() 了解当前光标是否处于输入槽内，从而避免重复插槽或非法位置插入。
    - 在 editorActions 与 headerActions 中布置 InsertInputSlotButton，实现：
      - 编辑区内快捷插槽按钮。
      - 头部工具条中的插槽按钮组。
    - 根据 isReadOnly 自动关闭 headerActions，确保只读态安全。
  - AI 编程助手在修改或新增与上述流相关代码时，必须：
    - 保持对 useCreatePromptContext 的使用是「只读」型，不在此适配层中修改全局 Prompt 状态写入逻辑。
    - 所有对 UI/交互的改动，都应通过 BasePromptConfiguratorModal 的 props（如 promptSectionConfig）进行配置式注入，而不是在上游基础组件中写死业务逻辑。

## 开发与调试工作流

- 依赖安装（在仓库根目录）：
  - 使用 Rush + PNPM：
    - rush install 或 rush update（参考 [frontend/README.md](../../../../README.md)）。

- 本包常用命令（在本子包目录下）：
  - Lint：
    - npm run lint
    - 依赖 @coze-arch/eslint-config，规则较为严格，新增导出/文件注意保持类型与风格统一。
  - 单元测试：
    - npm run test
    - 默认使用 vitest，开启 --passWithNoTests；即便当前 __tests__ 为空，命令也会通过。新增功能时建议在 __tests__ 下补充用例。
  - 覆盖率：
    - npm run test:cov
  - 构建：
    - npm run build 当前为 no-op（exit 0），实际构建通常由上层 Rsbuild/Rush 流程统一进行。

- Storybook / 交互验证：
  - stories/ 目录提供最小示例，但启动 Storybook 的命令定义在上层应用或公共脚本中；
  - AI 助手在调整组件交互时，应同步维护 stories 下的示例，保持查看效果的一致性。

## 项目约定与风格

- 语言与技术栈：
  - React 18 + TypeScript 函数组件，使用 JSX/TSX。
  - Hooks 风格为主（useXXX），避免在适配层编写类组件。

- 适配层职责边界：
  - 本包不直接处理网络请求、全局状态持久化等「业务逻辑」，仅关注：
    - UI 组合与布局调整。
    - 基于上游上下文/Hook 的交互增强（如光标位置控制、只读态判断）。
  - 当需要业务数据或副作用时，应通过上游提供的 context/hook 扩展，而不是在本包内自行新建全局单例或 store。

- 导出与 API 设计：
  - 通过 package.json 的 exports 控制对外可见的模块：
    - 保持 "./" 与 "./create-prompt" 两个入口稳定，避免随意增加深层路径导出。
  - 新增导出时：
    - 优先在 src/index.tsx 或 src/create-prompt/index.tsx 中集中管理。
    - 确保 typesVersions 同步更新，以便 TS 子路径导入能正确拿到类型。

- 命名与结构：
  - Modal、Hook 等命名与上游保持一致（PromptConfiguratorModal、usePromptConfiguratorModal），避免出现多套语义相近的别名。
  - 组件 props 类型尽量复用上游类型定义，例如 PromptConfiguratorModalProps，而不是在本包重复定义结构相同的接口。

- 样式与类名：
  - 当前示例中直接使用 Tailwind 风格的类名（如 "flex gap-2"），与整体项目的实用类策略保持一致。
  - 如需增加复杂样式，优先通过上游设计体系（例如 @coze-arch/coze-design）或公共样式方案，而非在本包内创建全局样式文件。

## 与上游/其他子包的集成要点

- 与 @coze-common/prompt-kit-base 的关系：
  - 将其视为「协议定义者」：
    - 它定义 PromptConfiguratorModal 的基础形态与 props 协议。
    - 它提供 create-prompt 上下文与基本组件，控制 Prompt 编辑的核心逻辑。
  - 本包通过组合方式进行扩展：
    - 不直接修改上游包代码；如需能力调整，应优先增加可配置 props，然后在本包内使用。

- 与 @coze-common/editor-plugins 的关系：
  - useCursorInInputSlot 是关键 Hook：
    - 决定何时允许插入输入槽按钮（避免重复/非法位置）。
    - 若未来有更多编辑器相关能力扩展，保持在适配层中仅「读取状态/触发上游提供的行为」，不过度耦合细节实现。

- 版本与 peerDependencies：
  - react / react-dom 通过 peerDependencies 强制与主应用保持一致版本（>=18.2.0）。
  - AI 助手在修改依赖时不要随意升级 React 版本，应遵循整个 monorepo 的统一版本策略。

## 过程与协作规范（面向 AI 助手）

- 变更范围控制：
  - 仅在 frontend/packages/common/prompt-kit/adapter 目录内修改文件，除非用户明确要求跨包调整。
  - 不读取或依赖 git 未提交的改动内容进行设计决策，所有推断基于当前工作区已存在文件。

- 修改策略：
  - 优先通过参数化与组合实现需求，而不是复制上游逻辑或引入重复组件。
  - 如需要新增 Hook/组件：
    - 放在 src/ 或 src/create-prompt/ 下，文件名与导出命名保持语义清晰。
    - 在 index.tsx 或 create-prompt/index.tsx 中暴露公共 API。

- 测试与验证：
  - 新功能尽量配套 Vitest 单测（放置在 __tests__ 目录或与文件同级，遵循仓库现有约定）。
  - 涉及 UI 行为更改时，建议同时更新 stories 下示例，便于人工/可视化验证。
