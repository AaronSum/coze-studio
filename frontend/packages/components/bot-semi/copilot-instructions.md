# bot-semi 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/bot-semi）中安全、高效地协作开发。

## 全局架构与职责边界

- 子包定位：本包是 Coze Studio 前端的「Semi UI 包装层」，位于组件层（frontend/packages/components）。对外提供两类能力：
  - 以 `UI*` 为前缀的增强 UI 组件（统一视觉与交互行为）。
  - 对 `@douyinfe/semi-ui` 的 re-export，作为业务代码的统一 Semi 入口。
- 目录结构（仅本子包）：
  - [src/index.ts](src/index.ts)：统一出口，导出 `UI*` 组件、hooks 以及 `./semi` 的全部导出。
  - [src/components](src/components)：平台定制的增强组件（如 `ui-button`、`ui-modal`、`ui-table` 等）。
  - [src/semi](src/semi)：对 `@douyinfe/semi-ui` / `@douyinfe/semi-icons` / `@douyinfe/semi-illustrations` 的类型与组件再导出层，对应 `package.json.exports` 的每个子路径。
  - [src/hooks](src/hooks)：本包内的通用 hooks（目前主要是拖拽相关的 `use-grab`）。
  - [src/utils](src/utils)：UI 与运行环境相关的工具（如 env 判定）。
- 数据流/依赖方向：
  - 业务应用 → 使用 `@coze-arch/bot-semi` 暴露的 UI API（`UI*` 组件、hooks、Semi 组件间接导出）。
  - 增强组件（`src/components`）→ 依赖 Semi 原始组件、平台 i18n（`@coze-arch/i18n`）、图标库（`@coze-arch/bot-icons`）、工具库（`ahooks`、`lodash-es` 等）。
  - Semi re-export（`src/semi`）→ 只做类型/组件转发，不引入业务逻辑。
- 结构设计动机：
  - 通过统一出口隐藏 `@douyinfe/semi-*` 细节，便于未来替换 UI 框架或集中升级版本。
  - 使用 `UI*` 前缀区分「平台增强组件」与「直接 Semi 组件」，业务推荐优先使用 UI 组件，保持统一 UX 与行为。
  - 将「含业务逻辑」的组件与纯 UI 包装解耦：有注释 `// TODO: ... contains logic code, move it out of bot-semi` 的模块，意味着这里只允许轻量 UI 行为，复杂业务逻辑需要迁出到其他包。

## 开发与测试工作流

- 本包级 npm 脚本（在 frontend/packages/components/bot-semi 下）：
  - `npm run lint`：基于 [eslint.config.js](eslint.config.js) 的前端规则进行 Lint，团队采用统一 `@coze-arch/eslint-config` 预设。
  - `npm run test`：使用 Vitest 运行单测，配置在 [vitest.config.ts](vitest.config.ts)，preset 为 `node`。
  - `npm run test:cov`：在 `test` 基础上开启 V8 覆盖率。
  - `npm run build`：当前是 `exit 0` 占位，真正产物构建在上层 Rush/Rsbuild 流水线上完成，不要在此包内实现自建 bundling 逻辑。
- 在 monorepo 顶层常用命令：
  - `rush lint`：对整个 frontend 包进行 Lint，本包受其统一规则约束。
  - `rush test` / `rush test:cov`：统一执行测试与覆盖率校验，`@coze-arch/bot-semi` 属于 `team-arch`、`level-1` 包，会被高覆盖率门槛约束（参见 [frontend/rushx-config.json](../../rushx-config.json) 的 `codecov.level-1` 配置）。
- 调试方式：
  - 优先在引用本包的上层应用（如 `apps/coze-studio`）中调试组件 UI 效果。
  - 对通用逻辑（如 hooks、纯函数 utils）请补充 Vitest 单测，避免只依赖手动回归。
  - 改动 Semi re-export 映射时，建议写最小化 smoke test，确保导出的类型与组件名称与 Semi 官方一致。

## 代码风格与项目特定约定

- TypeScript 与导入：
  - ESLint preset 为 `preset: 'web'`，但显式关闭了 `@typescript-eslint/consistent-type-imports`，因此本包内允许使用 `import type` 与普通 `import` 混合，但新增代码推荐尽量使用 `import type` 引入类型以减小打包体积。
  - 禁用了 `no-restricted-syntax` 与 `no-restricted-imports`，允许引入更灵活的语法/路径，但请保持与现有写法风格一致和安全。
- 组件命名与导出：
  - 增强组件统一使用 `UI*` 命名，如 `UIButton`、`UIModal`、`UITable`、`UIEmpty`，同时经常保留同名的旧导出并在注释上标记 `@deprecated`，例如 [src/index.ts](src/index.ts) 中 `Input` 与 `useModal`。
  - 新增组件时：
    - 建立 `src/components/ui-xxx` 目录，并在 [src/index.ts](src/index.ts) 中显式导出 `UIXxx` 以及必要的类型别名。
    - 如需为 Semi 组件增加平台特性但不增加业务逻辑，优先放在 `src/components`；单纯 re-export 新增的 Semi 组件则在 `src/semi/*` 中加一层转发，并同步更新 `package.json.exports` 与 `typesVersions`。
- 兼容性与废弃策略：
  - 通过 TS 类型与 JSDoc `@deprecated` 双重标记，保留一段时间的 API 兼容（如 `useModal` 别名为 `useUIModal`）。AI 助手在改动时：
    - 不要直接删除已有导出，除非明确在 PR 描述或需求中说明会进行破坏性升级。
    - 可以在实现内部调用新 API，老 API 仅作为别名层。
- 样式与资源：
  - 本包不直接引入全局样式方案（如 Tailwind、CSS-in-JS 主题）配置，而是依赖 Semi 自带样式与上层应用全局主题。
  - 若需要引入静态资源，请放在 [src/assets](src/assets) 下，并通过增强组件消费；避免在 `src/semi` 中引入任何与样式或资源强绑定的逻辑。

## Semi 与平台组件集成细节

- Semi 转发层（src/semi）：
  - 每个文件对应一个 Semi 组件家族，例如：
    - [src/semi/button.ts](src/semi/button.ts) 对应 `Button` 类组件与类型。
    - [src/semi/modal.ts](src/semi/modal.ts) 对应 `Modal` 及其 API。
  - `package.json` 中的 `exports` 与 `typesVersions` 保证了：
    - 运行时代码路径（`"./Button": "./src/semi/button.ts"`）。
    - 类型解析路径（`"Button": ["./src/semi/button.ts"]`）。
  - 调整某个 Semi 包装时，必须同时维护：
    - 实现文件（`src/semi/*.ts`）。
    - `package.json.exports` 与 `typesVersions` 中对应条目，保持路径一一对应。
- 增强组件典型模式（src/components）：
  - `ui-button` / `ui-input`：
    - 在原 Semi 组件基础上封装统一的尺寸、主题、icon 规范，并暴露 `UIButton`/`UIInput` 与对应 `Props` 类型。
    - 可能依赖 `@coze-arch/bot-icons` 提供的图标，用于平台统一视觉。
  - `ui-modal`：
    - 除基础模态框外，扩展 `UICompositionModal`、`UIDragModal`、`UITabsModal` 等组合型组件，以及 `useUIModal` 状态管理 hook。
    - `useModal` 已标记 deprecated，但仍作为别名导出，避免直接删除。
  - `ui-table`、`ui-table-action`、`ui-table-meta`：
    - 为表格封装列定义、操作区域（`UITableAction`）、元信息（`UITableMeta`）等模块，通常作为业务表格的基础搭建层。
  - `ui-search` / `ui-search-input`：
    - 已在 [src/index.ts](src/index.ts) 中注明包含逻辑代码的 TODO 注释，说明当前实现混合了部分业务逻辑；新增逻辑时要谨慎，优先考虑迁往更合适的包（如 workflow / common 组件），本包长期目标是仅承载 UI 视图层。
- Hooks 与工具：
  - [src/hooks/use-grab.ts](src/hooks/use-grab.ts)：
    - 提供拖拽行为（grab）能力，向外暴露 `useGrab`，在 [src/index.ts](src/index.ts) 中统一导出。
    - 典型使用方式是绑定到 `ref`，通过回调拿到位置变更事件，允许选择是否直接修改 DOM 样式。
  - [src/utils](src/utils)：
    - 如 `env.ts` 这类只与运行环境或小工具相关的模块，应保持无副作用、可在 Node/Vitest 环境下安全执行。

## 测试策略与质量门槛

- 测试框架：
  - 统一使用 Vitest，配置来自 `@coze-arch/vitest-config` 的 `defineConfig`，preset 为 `node`，适用于组件逻辑与 hooks 测试。
  - 覆盖率采集依赖 `@vitest/coverage-v8`，与顶层 Rush 任务联动进行门禁。
- 覆盖率要求：
  - 根据 [frontend/rushx-config.json](../../rushx-config.json) 中的 `codecov` 配置，本包 `team-arch` + `level-1` 需要较高的整体覆盖率与增量覆盖率。
  - 新增/修改逻辑（尤其是 hooks、utils 与存在条件分支的 UI 行为）应尽量补充单测，避免只在应用中手动验证。
- 编写测试的建议模式（非泛化原则，而是本仓已存在的共识）：
  - 对纯函数/工具使用单元测试断言输入输出。
  - 对 hooks 测试使用 Vitest + React Testing Library 或自定义 hook 测试工具（参考其他 frontend 包的用法，而非在本包中另起炉灶）。

## 协作流程与提交规范

- 团队与分层信息：
  - 本包元信息：`"packageName": "@coze-arch/bot-semi", "tags": ["team-arch", "level-1"]`。
  - 这意味着：
    - 变更会影响架构层共享 UI 能力，应谨慎处理兼容性与复用性。
    - PR 一般需要经过架构团队成员审核，尽量保持 API 稳定。
- 分支与提交（遵循仓库通用规范）：
  - 功能开发通常在 feature 分支进行，由上层仓库合并；AI 助手不直接执行 git 操作，但在生成改动时应：
    - 将变更集中在与 bot-semi 强相关的文件，避免跨包大范围重构。
    - 尽量避免在一次改动中同时引入大量 API 调整与重构，以便评审。
- 依赖管理：
  - 新增第三方依赖前，应优先复用现有依赖（如 `classnames`、`lodash-es`、`ahooks` 等）。
  - 如果必须新增依赖，需：
    - 在 [package.json](package.json) 中显式添加，遵守 monorepo 对版本与 license 的约束。
    - 避免引入重量级 UI 或状态管理库；本包主职是基于 Semi 的 UI 层。

## 特殊注意事项与坑点

- 禁止在 `src/semi` 中加入业务逻辑：
  - Semi re-export 层只应做类型与组件转发，以及少量轻量包装（如默认参数），不得引入业务域逻辑或复杂副作用。
- 小心处理 TODO 注释区域：
  - 如 [src/index.ts](src/index.ts) 关于 `ui-search` 和 `ui-breadcrumb` 的 TODO，明确指出这些模块包含业务逻辑，后续计划迁移；在这些地方增加逻辑时要标明原因，并尽可能保持改动最小化。
- 导出修改必须双向同步：
  - 任何导出路径调整（新增/重命名 `./Xxx` 子路径）都必须同步修改：
    - 实现文件（`src/semi/*.ts` 或 `src/components/ui-*/index.tsx`）。
    - `package.json.exports` 与 `typesVersions`。
  - 忘记更新 `typesVersions` 会导致 TS 在消费侧找不到类型声明。
- 保持与上层应用的一致性：
  - 某些 UI 组件（如 `UITable`、`UIModal`、`UISearch`）在其他包或 apps 中已有大量使用场景；
  - 在改动 props、行为或默认值前，建议先检查引用方（通过全局搜索）评估影响范围，避免静默破坏行为兼容。

---

如需在本子包增加新的 UI 能力，请优先：
- 确认是否可以通过现有 Semi 组件 + 轻量封装实现；
- 避免在 bot-semi 中混入与具体业务域强耦合的逻辑；
- 为新增逻辑补充最小但可靠的 Vitest 测试用例。
