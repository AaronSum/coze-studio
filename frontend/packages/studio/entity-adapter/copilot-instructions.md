# Coze Studio 前端子包开发说明（@coze-studio/entity-adapter）

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/entity-adapter）中安全、高效地协作开发。

## 1. 子包定位与角色

- 本包 package：`@coze-studio/entity-adapter`，位于 Coze Studio 前端 monorepo 的 studio 层。
- 职责：为「实体」（当前主要是 Agent/Bot）提供统一的创建、更新能力的 React Hook 适配层，对上暴露简洁的业务 API，对下复用 agent-ide / arch / common 等已有能力。
- 使用场景：通常由上层 Studio、Agent IDE 等 UI 组件在需要弹出“创建/编辑 Agent”对话框时调用本包导出的 Hook。

## 2. 全局架构与数据流

### 2.1 输出能力

- 入口文件：[src/index.ts](src/index.ts)
  - 导出：
    - `useCreateAgent` — 创建 Agent 的 Hook。
    - `useUpdateAgent` — 更新 Agent 的 Hook。
- 实际实现统一落在：[src/hooks/use-create-or-update-agent/index.tsx](src/hooks/use-create-or-update-agent/index.tsx)
  - 两个 Hook 仅对 props 做轻量包装与预处理，然后调用 `useCreateOrUpdateAgent`。

### 2.2 主要数据流

- 关键类型：
  - `DraftBot`：来自 `@coze-arch/bot-api/developer_api`，代表 Agent 草稿数据；在本包中通过 `botInfoRef` 进行读写，用于表单初始值与提交内容。
- 读状态：
  - `useBotInfoStore`（来自 `@coze-studio/bot-detail-store/bot-info`）：提供当前选中 bot 的 `botId` 等信息，用于更新场景。
  - `useSpaceStore`（来自 `@coze-arch/bot-studio-store`）：提供当前空间信息 `space.id`、`space.hide_operation` 以及 `spaces.bot_space_list`。
- 写状态 / 业务操作：
  - `useAgentFormManagement` & `AgentInfoForm`（来自 `@coze-agent-ide/space-bot/hook`）：
    - 管理创建/编辑 Agent 的表单结构、验证、错误状态。
    - 提供 `formRef`、`handleFormValuesChange`、`getValues` 等接口。
  - `useAgentPersistence`（同上）：
    - 提供 `handleCreateBot`、`handleUpdateBot` 以及持久化 loading 状态。
    - 内部负责真正的 API 调用与错误处理。
- UI 反馈：
  - `Modal` 组件来自 `@coze-arch/coze-design`，承载创建/编辑弹窗。
  - `PictureUpload`（来自 `@coze-common/biz-components/picture-upload`）用于上传/展示 Bot 头像。
  - 文案统一通过 `I18n.t` 实现多语言。

### 2.3 结构设计动机

- 将「创建」与「更新」统一到 `useCreateOrUpdateAgent`：
  - 便于上层使用时只关心入口 Hook；复用逻辑，减少重复代码。
  - 差异由 `mode: 'add' | 'update'`、`botInfoRef`、`spaceId` 等参数控制。
- 子包只做“适配与整合”，不直接操作 API URL：
  - 所有服务调用、状态管理都由 `@coze-agent-ide/space-bot`、`bot-detail-store`、`bot-studio-store` 等专用包承担。
  - 符合整个前端工程“studio 作为集成层、arch/data 作为能力层”的分层理念（可参考 [frontend/README.md](../../README.md)）。

## 3. 开发与调试工作流

### 3.1 本子包常用脚本

见 [package.json](package.json)：

- `npm run build`
  - 当前实现为 `exit 0`，仅为 Rush 构建流程占位；实际产物由上层打包器控制。
- `npm run lint`
  - 使用 `@coze-arch/eslint-config`，preset 为 `web`。
- `npm run test`
  - 使用 Vitest，配置在 [vitest.config.ts](vitest.config.ts)，
  - 依赖 `@coze-arch/vitest-config` 的 `defineConfig({ dirname, preset: 'web' })`。
- `npm run test:cov`
  - 在 `test` 命令基础上附加 `--coverage`，使用 `@vitest/coverage-v8`。

> 建议 AI 助手在改动逻辑后，至少运行一次 `npm run test`，如需修改 Lint 规则，遵从仓库统一配置。

### 3.2 在整体项目中运行

在仓库根目录：

- 安装依赖：`rush install` 或 `rush update`（详见 [frontend/README.md](../../README.md)）。
- 启动主应用以联调：
  - 进入 [frontend/apps/coze-studio](../../apps/coze-studio) 执行 `npm run dev` 或 `rushx dev`。
  - 本子包不直接启动单独应用，而是作为依赖被 Studio 主应用引入。

## 4. 项目约定与模式

### 4.1 React Hook 设计

- 导出的 Hook 均以 `useXxx` 命名，位于 [src/hooks](src/hooks) 目录：
  - `useCreateAgent`：
    - 接收 `Omit<CreateAgentEntityProps, 'mode' | 'botInfoRef'>`；内部创建 `botInfoRef`，默认 `DraftBot` 初始值为 `{ visibility: 0 }`。
    - 委托给 `useCreateOrUpdateAgent`，并固定 `mode: 'add'`。
  - `useUpdateAgent`：
    - 参数对象包含可选的 `botInfoRef` 和 `onSuccess`。
    - 委托给 `useCreateOrUpdateAgent`，并固定 `mode: 'update'`。
  - `useCreateOrUpdateAgent`：
    - 对外不会直接从包入口导出，作为内部统一实现。
    - 返回 `{ startEdit, modal }`：
      - `startEdit`：触发弹窗显示（目前开源版不支持入参控制多语言等扩展）。
      - `modal`：一段 JSX，用于在调用方组件树中渲染 Modal。

### 4.2 表单与空间逻辑

- 表单：
  - 必须通过 `AgentInfoForm` 承载，避免在本包内部硬编码表单字段；
  - 表单错误通过 `checkErr` / `errMsg` 传入，由 Agent IDE 层统一渲染。
- 空间选择：
  - `showSpace` 控制是否在表单中展示空间选择区域。
  - 若 `outerSpaceId` 为空，则在 `visible` 变为 true 时，通过 `useSpaceStore.getState().fetchSpaces()` 拉取空间列表，并设置默认 `spaceId`：
    - 若 `hide_operation` 为 true，则默认选中第一个空间；
    - 否则优先当前 `spaceId`，缺省时退回第一个空间。

### 4.3 上传组件与文件类型

- 头像上传使用 `PictureUpload`，传入：
  - `fileBizType = FileBizType.BIZ_BOT_ICON`；
  - `iconType = IconType.Bot`；
  - `field = 'bot_uri'`，与表单字段绑定；
  - `initValue` 通过 `getPictureUploadInitValue` 从 `botInfo.icon_url` / `botInfo.icon_uri` 派生。
- 该约定保证了：
  - 文件业务类型、字段命名与其他 Agent 相关模块保持一致；
  - 未来若统一调整存储策略，可在底层组件中集中修改。

### 4.4 i18n 与 UI 规范

- 所有文案通过 `I18n.t(key)` 获取，不写死字符串：
  - 例如：`I18n.t('bot_list_create')`、`I18n.t('bot_edit_title')`、`I18n.t('Confirm')` 等。
- Modal 的按钮文案、标题、校验提示等，均遵循 Coze 前端统一多语言规范。

## 5. 依赖与集成要点

### 5.1 外部依赖包

`package.json` 中核心依赖：

- `@coze-agent-ide/space-bot`：Agent 创建/更新的核心业务能力（表单 + 持久化 Hook）。
- `@coze-arch/bot-api`：提供 `DraftBot`、`FileBizType`、`IconType` 等类型与常量。
- `@coze-arch/bot-studio-store`：空间（Space）相关 store。
- `@coze-studio/bot-detail-store`：Bot 详情 store，暴露 `useBotInfoStore`。
- `@coze-common/biz-components`：业务通用 UI 组件库，这里主要使用 `PictureUpload`。
- `@coze-arch/i18n`、`@coze-arch/coze-design`：国际化与设计系统组件库。

> AI 助手在修改或新增逻辑时，如需访问更多 store 或 API，请优先在上述包中查找已有能力，而不是在本包直接新建 HTTP 请求或本地状态。

### 5.2 TypeScript 配置

- 构建 TS 配置：[tsconfig.build.json](tsconfig.build.json)
  - 继承 `@coze-arch/ts-config/tsconfig.web.json`，开启 `moduleResolution: 'bundler'`，面向浏览器环境。
  - `references` 广泛引用其他包的 `tsconfig.build.json`，以启用 TS Project References 加速增量构建。
- 辅助配置：[tsconfig.misc.json](tsconfig.misc.json)
  - 为测试、配置文件等非 src 代码提供类型支持（`__tests__`、`stories` 等）。
- 顶层 [tsconfig.json](tsconfig.json)
  - 只做 references 聚合，不直接参与编译，`exclude: ['**/*']`。

### 5.3 Lint & Test 规范

- ESLint：
  - 配置文件 [eslint.config.js](eslint.config.js) 通过 `@coze-arch/eslint-config` 统一定义规则，preset 为 `web`。
  - 如需为本包添加特殊规则，建议在 `rules` 字段中做最小增量配置，保持与全局规则一致性。
- Vitest：
  - 配置文件 [vitest.config.ts](vitest.config.ts) 统一由 `@coze-arch/vitest-config` 管理，preset 为 `web`。
  - 测试文件放在 [__tests__](__tests__) 目录；当前只有 `.gitkeep`，尚未有具体测试实现。

## 6. 项目流程与协作习惯

- 仓库整体采用 Rush + PNPM monorepo 管理：
  - 新增依赖应通过 Rush 工作流（在根目录运行 `rush add` 等）而不是直接 `npm install`。
- 分支与提交：
  - 遵循主仓库的 CONTRIBUTING 要求（见根目录 [CONTRIBUTING.md](../../../CONTRIBUTING.md)）。
  - 提交前建议本地执行：`npm run lint`、`npm run test`，保持 CI 通过。
- 部署：
  - 本包不会单独部署，而是随着 `frontend/apps/coze-studio` 一起被打包发布，构建行为由上层 Rsbuild / 应用配置控制。

## 7. 不寻常/需要特别注意的点

- `build` 脚本目前为 `exit 0`：
  - 说明真正的打包构建不在本包完成，而是在主应用或统一构建工具中完成；AI 助手如需新增构建行为，需同时考虑仓库级构建体系。
- Hook 返回的 `modal` 是 JSX 元素而非渲染函数：
  - 调用方需要在组件树中直接插入 `modal` 节点，否则不会渲染弹窗。
- `startEdit` 函数的参数目前在注释中说明“开源版不支持”，
  - 请保持签名兼容（接收但忽略参数），避免破坏潜在的闭源/内部用法。
- Space 选择逻辑依赖 `useSpaceStore.getState().fetchSpaces()` 的异步结果：
  - 若在测试或 Storybook 中单独使用本 Hook，应模拟或 mock store，避免空数据导致表单初始空间为空。

## 8. 面向 AI 助手的修改建议

- 新增功能时：
  - 优先复用现有 store / Hook / 组件，不在本包直接引入新的副作用通道（如直接请求后端、引入新的全局状态库）。
  - 通过扩展 `CreateAgentEntityProps` 或内部局部逻辑，保持 `useCreateAgent` / `useUpdateAgent` 的调用体验简单稳定。
- 修复 bug 时：
  - 先在本包内查找逻辑问题，再检查依赖包版本与使用方式；若发现依赖包内部问题，仅在确有必要时改动其实现。
- 编写测试时：
  - 建议使用 Testing Library + Vitest，遵循项目中其他包的测试风格，
  - 尽量通过渲染 `modal` 并模拟用户操作来验证行为，而不是只测内部状态。