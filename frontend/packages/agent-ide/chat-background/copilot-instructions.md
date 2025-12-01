# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-background）中安全、高效地协作开发。

## 全局架构概览

- 本包是一个前端 UI 子包，提供「聊天背景」相关的展示组件和配置弹窗 Hook。
- 入口文件 [frontend/packages/agent-ide/chat-background/src/index.tsx](frontend/packages/agent-ide/chat-background/src/index.tsx) 只做导出：
	- `ChatBackGroundContent`：展示当前背景、小图标和编辑/删除操作区。
	- `useChatBackgroundUploader`：封装背景配置弹窗（Modal），供上层页面调用。
- 背景业务核心逻辑拆分为两块：
	- 展示层：[src/chat-background-content](frontend/packages/agent-ide/chat-background/src/chat-background-content/index.tsx) 负责列出当前背景、提示文案和操作按钮；
	- 配置层：[src/chat-background-modal/use-chat-background-uploader](frontend/packages/agent-ide/chat-background/src/chat-background-modal/use-chat-background-uploader/index.tsx) 负责弹出配置面板，并与全局 store 同步 loading / dot 状态。
- 业务状态与工具逻辑基本交由其他 workspace 包处理：
	- `@coze-agent-ide/chat-background-shared`：提供 `useBackgroundContent` 等共享逻辑，包括编辑、删除、notice dot 状态等；
	- `@coze-agent-ide/chat-background-config-content-adapter`：提供实际的背景配置表单 `BackgroundConfigContent`；
	- `@coze-studio/bot-detail-store`：基于 Zustand 的全局 store，管理背景图生成的 loading / dot 状态。
- 组件 UI 统一使用 `@coze-arch/coze-design`、`@coze-arch/bot-semi` 与 `@coze-studio/components`，遵循团队统一设计体系。

## 关键数据流与协作关系

- 背景数据模型基于 `BackgroundImageInfo`（来自 `@coze-arch/bot-api/developer_api`）。上层需要维护一个 `BackgroundImageInfo[]` 列表，并传入：
	- 对于 `ChatBackGroundContent`：
		- `backgroundImageInfoList`: 当前背景集合；
		- `setBackgroundImageInfoList`: 更新背景列表的方法；
		- `openConfig`: 打开配置弹窗的回调（通常由 `useChatBackgroundUploader` 提供）。
	- 对于 `useChatBackgroundUploader`：
		- `backgroundValue`: 当前背景列表；
		- `onSuccess`: 配置保存成功后回调，返回新的 `BackgroundImageInfo[]`；
		- `getUserId`: 获取当前用户 ID，用于后端接口或配置内容组件内部使用。
- 展示组件中通过 `getOriginImageFromBackgroundInfo` 从列表中提取展示用原图 URL；
- `useBackgroundContent` 在两个地方使用：
	- 在内容组件中，提供 `handleEdit / handleRemove / showDot / showDotStatus`；
	- 在上传 Hook 中，提供 `markRead`，用于在取消弹窗时标记引导消息已读。
- `useChatBackgroundUploader` 内部调用 `useGenerateImageStore`：
	- 通过 `imageLoading` / `gifLoading` 判断当前是否有生成中的任务；
	- 在取消弹窗时根据 loading 状态将 dot 状态重置为 `DotStatus.Generating`，以维持与主站一致的「生成中」提醒逻辑。

## 开发与测试工作流

- 本包使用 Rush 管理依赖；进入 monorepo 根目录后：
	- 初始化依赖：`rush update`
- 在子包目录 [frontend/packages/agent-ide/chat-background](frontend/packages/agent-ide/chat-background) 下常用命令：
	- `npm run build`：当前实现为 `exit 0`，仅占位，实际构建通常由上层构建系统处理；
	- `npm run lint`：使用 `@coze-arch/eslint-config` 的 web preset 进行 ESLint 校验；
	- `npm run test`：使用 Vitest 运行测试，`vitest.config.ts` 通过 `@coze-arch/vitest-config` 统一配置；
	- `npm run test:cov`：运行带覆盖率的测试。
- Storybook 与 ESM/UMD 构建能力由脚手架提供（见 [README.md](frontend/packages/agent-ide/chat-background/README.md)），实际入口和脚本集中管理，不在本包单独维护复杂配置。

## 代码风格与项目约定

- 语言与框架：
	- React 18 + TypeScript；函数式组件为主，使用 `React.FC<Props>` 和显式 `Props` interface；
	- 状态管理优先通过上层 store（Zustand / 业务 store 包）或 props 传递，本包内部只维护局部 UI 状态（如 Modal 显隐）。
- 代码风格：
	- ESLint 配置在 [eslint.config.js](frontend/packages/agent-ide/chat-background/eslint.config.js)，preset 为 `web`，规则由上层共享配置统一控制；
	- 引入样式使用 CSS Modules（`.module.less`），命名风格以语义化 class 为主，避免全局污染；
	- JSX 中大量使用 Tailwind-like 的 utility class（如 `coz-fg-secondary`, `coz-mg-primary`），这些来自统一设计系统，不在本包定义。
- 文案与多语言：
	- 所有展示文案通过 `@coze-arch/i18n` 的 `I18n.t(key)` 获取，如 `bgi_desc`、`bgi_title`、`bgi_remove_popup_title` 等；
	- 在新增交互或提示时，应先确认对应多语言 key 是否存在于上游 i18n 包，避免写死文案。
- 交互细节：
	- 删除背景时，通过 `Popconfirm` 二次确认，`okButtonColor="red"` 为约定样式；
	- 编辑背景按钮与删除按钮保持「迷你尺寸 + 透明背景 + hover 高亮」的统一视觉风格（见 `className` 与 [src/chat-background-content/index.module.less](frontend/packages/agent-ide/chat-background/src/chat-background-content/index.module.less)）。

## 重要外部依赖与集成点

- `@coze-agent-ide/chat-background-shared`：
	- 提供 `useBackgroundContent` Hook 和 `getOriginImageFromBackgroundInfo` 方法；
	- 决定了背景编辑、删除、notice dot 的业务规则；若要修改逻辑（如删除时的后端接口或提示策略），应优先在 shared 包中调整。
- `@coze-agent-ide/chat-background-config-content-adapter`：
	- 封装具体的背景配置内容组件 `BackgroundConfigContent`；
	- 通过 props 接收 `BackgroundImageInfo[]` 及回调，在内部与后端/业务逻辑通信；
	- `useChatBackgroundUploader` 只负责容器层（Modal）和与 store 的 glue 逻辑，不直接关心表单细节。
- `@coze-studio/bot-detail-store`：
	- 基于 Zustand 的全局 store，暴露 `useGenerateImageStore`，含 `generateBackGroundModal.image/gif` 两路状态；
	- 调用 `setGenerateBackgroundModalByImmer` 时依赖 immer；修改时需保证更新逻辑是 immutable-safe 的。
- UI 与交互库：
	- `@coze-arch/coze-design`：主 UI 组件库，使用 `Button`, `Popconfirm`, `IconCozImage` 等；
	- `@coze-arch/bot-semi`：封装 Semi UI 的业务风格组件，如 `UIModal`；
	- `@coze-studio/components`：补充组件，如 `AvatarBackgroundNoticeDot`，用于显示 dot 状态。

## 测试与质量策略

- 测试框架：Vitest，配置在 [vitest.config.ts](frontend/packages/agent-ide/chat-background/vitest.config.ts)，通过 `@coze-arch/vitest-config` 统一；
- 目前 `__tests__` 目录仅包含 `.gitkeep`，尚未有具体用例：
	- 新增测试时，按 monorepo 约定统一放在 [__tests__](frontend/packages/agent-ide/chat-background/__tests__) 目录；
	- 建议优先覆盖：
		- `ChatBackGroundContent` 在不同 `backgroundImageInfoList` / `isReadOnly` 组合下的渲染与按钮行为；
		- `useChatBackgroundUploader` 在 `cancel` 时对 `markRead` 和 dot 状态的处理逻辑（可通过 mock store 实现）。

## 分支、发布与使用方式

- 分支策略与发布流程遵循整个 tinker-studio monorepo 的统一规范（见仓库根目录文档），本包本身不单独声明分支策略；
- 包名为 `@coze-agent-ide/chat-background`，一般在上层 bot-editor 或 IDE 页面中被引用：
	- 通过 `ChatBackGroundContent` 展示背景配置入口及当前状态；
	- 通过 `useChatBackgroundUploader` 在页面级组件中挂载一个全局 Modal 节点，并将 `open` 暴露给「设置背景」按钮；
- 构建与发布通常由 Rush + CI/CD 在仓库层面统一处理，本包只需保证：
	- TypeScript 类型正确；
	- ESLint 通过；
	- 单元测试（如果存在）通过。

## 其他注意事项与易错点

- `useChatBackgroundUploader` 返回的 `node` 需要被实际渲染到 DOM 中（通常放在页面根组件 JSX 中），否则调用 `open()` 不会显示弹窗；
- 在取消 Modal 时，`markRead` + dot 状态重置逻辑是与主站保持一致的产品约定，修改前应与 PM/交互确认；
- `ChatBackGroundContent` 既依赖 CSS Modules，又依赖全局样式类，重构样式时要兼顾两套命名，避免破坏其他子包共享的全局样式；
- 多语言 key（如 `bgi_*`）在多个子包中共用，新增/删除时要考虑跨包影响。