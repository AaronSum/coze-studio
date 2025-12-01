 # @coze-common/biz-components Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/biz-components）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是「通用业务组件库」，位于 frontend/packages/common/biz-components，主要面向上层应用/业务页面复用复杂 UI 组件，而不是提供底层基础组件。
- 入口导出集中在 src/index.tsx，通过 re-export 暴露以下核心能力：
	- 参数编辑树组件：src/parameters（对外导出 Parameters、ParamTypeAlias、参数值与错误类型）。
	- 异步任务设置面板：src/async-setting/AsyncSettingUI。
	- 业务 Banner：src/banner/Banner（基于 @coze-arch/coze-design.Banner 做二次封装，支持富文本 label 和 DOMPurify 安全过滤）。
	- 图片上传组件：src/picture-upload（PictureUpload、自定义上传 customUploadRequest、自动生成能力 RenderAutoGenerateParams，仅在包内部 index.ts 中导出，主入口目前注释掉 UI 导出，仅导出类型 UploadValue / GenerateInfo）。
	- 引导浮层 Coachmark：src/coachmark/index.tsx（封装 react-joyride，结合本地存储控制是否展示）。
	- 智能体选择弹窗：src/select-intelligence-modal（SelectIntelligenceModal + useModal hook，内部再拆分 components/hooks/services）。
	- 用户头像上传：src/update-user-avatar/UpdateUserAvatar（封装 Upload + foundation-sdk.uploadAvatar 业务接口）。
- 整体模式是：业务逻辑聚合 + 对 coze-design / bot-semi 等基础库的封装，向上提供高层业务能力组件。

## 开发与运行工作流

- 依赖安装：在仓库根目录使用 rush 管理依赖：
	- rush install 或 rush update（参考 frontend/README.md）。
- 本子包本身的常用脚本（见 package.json）：
	- 开发 Storybook：在本目录执行 npm run dev（storybook dev -p 6006）。
	- 单元测试：npm run test（vitest --run --passWithNoTests，配置由 @coze-arch/vitest-config 统一管理，preset:web）。
	- 覆盖率：npm run test:cov（底层使用 @vitest/coverage-v8）。
	- lint：npm run lint（eslint.config.js 通过 @coze-arch/eslint-config，preset:web）。
	- build：当前实现为 exit 0，本包构建通常由上层打包器（Rsbuild / 应用构建）统一处理，不在子包内单独产物构建。
- TypeScript：
	- tsconfig.json 使用 references 指向 tsconfig.build.json 与 tsconfig.misc.json，并通过 exclude:["**/*"] 将编译控制交给上层工程配置；AI 助手在新增文件时保持与现有路径/别名一致即可。
- 测试规范：
	- Vitest 配置在 vitest.config.ts，通过 defineConfig({ dirname, preset: 'web' }) 统一接入前端测试基线；常规 React 组件测试方式与社区一致。

## 项目特有约定与模式

- 依赖与设计体系：
	- 所有 UI 组件统一依赖 @coze-arch/coze-design（UI 体系）和 @coze-arch/bot-semi（Semi UI 的业务包装），严禁直接引入第三方 UI 库。
	- 业务工具和基础能力统一依赖 @coze-arch/* 与 @coze-foundation/*，例如：
		- 文案/多语言：@coze-arch/i18n.I18n（使用 I18n.t('key')）。
		- 本地存储：@coze-foundation/local-storage.localStorageService。
		- 报错封装：@coze-arch/bot-error.CustomError + @coze-arch/report-events.REPORT_EVENTS。
		- 网络/SDK：@coze-arch/foundation-sdk（如 uploadAvatar）。
	- 通用工具统一使用 lodash-es、ahooks、classNames 等已有依赖，不重复引入等价库。
- 样式：
	- 组件内部样式优先使用 .module.less，按“同名文件 + module.less”组织，例如 src/banner/index.module.less、src/parameters/parameters.module.less。
	- 部分组件同时使用 Tailwind 风格的原子类（如 AsyncSettingUI 使用 flex/gap 字符串 class），需要兼容两种写法，不要混入其它 CSS-in-JS 实现。
- 类型与导出：
	- 统一从各子目录的 index.ts / index.tsx 聚合导出组件与类型，再由 src/index.tsx 进行包级导出；新增组件时务必按此链路补充导出，保持 package.json.exports / typesVersions 一致性。
	- 公共类型统一集中在 types.ts 或类似文件中（如 src/parameters/types.ts），组件文件只做业务渲染与事件处理。
- 安全与输入处理：
	- 所有富文本/HTML 字符串展示必须通过 DOMPurify.sanitize，参考 src/banner/index.tsx 中的 label 处理；新增类似能力时应复用该模式。
	- 与用户交互的表单组件需要显式校验与错误展示，如 AsyncSettingUI 中 validate + error state。

## 关键组件设计与集成细节

- Parameters（参数树编辑器，src/parameters）：
	- 数据结构：基于 TreeNodeCustomData（见 components/custom-tree-node/type）及 @coze-arch/bot-semi/Tree 的 TreeNodeData，支持嵌套参数与对象类型（hasObjectLike）。
	- 主要入口组件：parameters.tsx，通过 PropsWithChildren<ParametersProps> 接收 value/errors/disabledTypes/onChange 等。
	- 数据流：
		- 外部传入 value（树形参数数组）→ formatTreeData(cloneDeep(value)) 转成内部 treeData。
		- 所有树变更统一走 onTreeNodeChange(ChangeMode, TreeNodeCustomData)。
		- 更改后通过 traverse 清理多余字段，仅保留 key/name/type/description/children，再调用 props.onChange(freshValue)。
	- 错误与只读：
		- errors 通过 ConfigContext 透传给子节点渲染；
		- readonly=true 且 value 为空时直接返回 null，避免渲染空树。
	- 集成约束：
		- 新增字段时必须保证 field 唯一（当前实现使用 nanoid() 与 field path 拼接）。
		- 需要遵循现有 ChangeMode（Append/Update/Delete/DeleteChildren）语义，避免破坏上游依赖逻辑。

- AsyncSettingUI（异步任务设置，src/async-setting/index.tsx）：
	- 封装异步任务开关与回复内容输入：
		- value: { isOpen?: boolean; replyText?: string }。
		- switchStatus: 'default' | 'hidden' | 'disabled' 控制开关可见性与是否可点。
	- 校验逻辑：validate(value, needReply) 按 I18n 文案规则校验必填与最大长度 REPLY_MAX_LENGTH=1000。
	- 提交逻辑：点击保存按钮时重新校验，校验通过后调用 onChange(value)，调用者负责持久化。

- Banner（业务 Banner，src/banner/index.tsx）：
	- 对 @coze-arch/coze-design.Banner 的轻量封装：
		- label 通过 DOMPurify.sanitize 后作为 description，允许 'href' / 'target' 属性，以支持安全超链接。
		- showClose 控制是否展示关闭图标（IconCozCrossFill）。
	- 集成时请勿绕过 sanitize 直接使用 dangerouslySetInnerHTML，以统一 XSS 防护策略。

- Coachmark（功能引导，src/coachmark/index.tsx）：
	- 基于 react-joyride 封装，引入 Tooltip/StepCard 进行 UI 改造。
	- 状态持久化：
		- 使用 localStorageService，在 key=coachmark 下记录 caseId 对应的最大已读步骤索引。
		- 仅当未读或当前 itemIndex 大于已读索引时展示；结束时将步数设置为 COACHMARK_END(10000)。
	- 回调处理：
		- handleJoyrideCallback 根据 ACTIONS.PREV 与事件类型更新 stepIndex 与已读步数。
	- 使用约束：
		- 外部需要提供 caseId 与 steps（react-joyride.Step[]），以保证不同使用场景互不干扰。

- SelectIntelligenceModal（智能体选择弹窗，src/select-intelligence-modal）：
	- 对外仅暴露 SelectIntelligenceModal 与 useModal（hooks/use-case/use-modal）。
	- 内部按 components / hooks / services 分层，一般遵循「hook 负责状态与数据请求，components 负责展示」的模式；新增逻辑应优先放在 hooks 中以便复用。

- UpdateUserAvatar（头像上传，src/update-user-avatar/index.tsx）：
	- UI：基于 @coze-arch/bot-semi.Upload 与 CozAvatar 组合，支持只读/可编辑模式（isReadonly）。
	- 上传流程：
		- 通过 UploadProps.customRequest 拦截上传，调用 foundation-sdk.uploadAvatar(fileInstance)。
		- 成功时回调 onChange(url)、onSuccess(url)；失败时抛 CustomError 或调用 onError 回调。
	- loading 管理：使用 ahooks.useRafState 防止高频状态抖动，上传过程中禁用组件。
	- 集成注意：
		- 不需要在组件外传入 action；所有上传路径走统一 foundation-sdk 接口，避免绕过业务监控与埋点。

## 项目流程与协作规范

- Monorepo 管理：
	- 使用 Rush + PNPM，包信息在 frontend/rushx-config.json 与各自 package.json 中维护，本包标记为 level-3，覆盖率与质量门槛相对宽松（覆盖率要求为 0）。
	- 必须保留 eslint.config.js 等「必备配置文件」，由 rushx-config.json.packageAudit 统一校验。
- 测试与质量：
	- 建议为新增公共组件编写 Vitest + React Testing Library 测试，但 level-3 无强制覆盖率；已有 test 目录在 __tests__ 下。
	- 代码风格由 @coze-arch/eslint-config 与 @coze-arch/stylelint-config 管控，不要在子包内大量自定义规则。
- 发布与集成：
	- 包通过 workspace:* 与其它前端包联动更新；真实构建由上游应用或统一构建脚本驱动，本包自身 build 脚本不产出实际 bundle。
	- 导出路径需和 package.json.exports / typesVersions 对齐；新增子路径导出（如 ./xxx）时同步两处配置，避免类型解析异常。

## 为 AI 助手的实用建议

- 在本包内改动时优先：
	- 复用已有依赖（@coze-arch 系列、lodash-es、ahooks、classNames 等），不要新引入等价库或样式方案。
	- 遵循「组件入口 index.ts(x) + 同名 module.less + types.ts」的组织结构。
	- 修改对外导出时同步更新 src/index.tsx 及 package.json.exports / typesVersions。
- 如需新增复杂业务组件，可参考 Parameters 或 UpdateUserAvatar 的拆分方式：
	- 将渲染组件与类型定义拆开，必要时引入 context/ hooks/ components 子目录，保持单文件逻辑适中。
	- 所有对外暴露的组件/类型均应在顶层 index.tsx 有清晰导出路径。
