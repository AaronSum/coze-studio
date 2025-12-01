# copilot-instructions for @coze-studio/project-entity-base

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/workspace/project-entity-base）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是「项目实体 CRUD」相关的 React 业务基础库，主要提供一组可复用的 Hook 与表单组件，用于创建、更新、复制、删除项目，以及关联的智能体（Agent）创建入口。
- 对外主要入口为 src/index.tsx，通过命名导出暴露若干 Hook 与类型：
  - useCreateProjectModalBase / useUpdateProjectModalBase / useCopyProjectModalBase：用于弹出项目创建、编辑、复制的统一模态框能力。
  - useDeleteIntelligence：封装删除项目/智能体的确认逻辑与后端调用。
  - ProjectFormValues 等类型：规范化表单字段与上传资源字段（icon_uri）的结构。
  - UpdateProjectSuccessCallbackParam / CopyProjectSuccessCallbackParam 等：统一回调入参结构，方便上游 IDE / Studio 处理。
- 业务请求全部通过 @coze-arch/bot-api 暴露的 intelligenceApi 调用后端 intelligence_api（参见 src/hooks/use-create-project-modal.tsx 与 src/hooks/use-base-update-or-copy-project-modal.tsx）。
- 表单与 UI 层统一依赖 @coze-arch/coze-design 与 @coze-common/biz-components，项目图标上传、表单布局、校验规则全部通过这些基础组件完成；本包只聚焦业务装配与字段映射。
- I18n 由 @coze-arch/i18n 负责，文案均通过 I18n.t(key) 调用，不在本包内硬编码多语言文案。
- 输入长度、描述长度等限制统一由 @coze-agent-ide/bot-input-length-limit 提供服务（botInputLengthService），本包只传入对应字段 key，例如 projectName / projectDescription。
- 包内不会直接管理路由或全局状态，关于 Agent 编辑流程通过 @coze-studio/entity-adapter 暴露的 useCreateAgent 触发，其内部再决定如何切换页面或视图。

## 关键数据流与核心 Hook

- 创建项目（useCreateProjectModalBase，见 src/hooks/use-create-project-modal.tsx）：
  - 外部传入 selectSpace、初始 spaceId、若干 onBefore/onSuccess/onError 回调以及 bizCreateFrom（navi/space）。
  - 内部先弹出 GuideModal 让用户选择创建「项目」还是「智能体」，根据 IS_OVERSEA / IS_OPEN_SOURCE 环境变量决定是否展示 ProjectTemplateModal；海外/开源版不支持模板，直接进入 ProjectFormModal。
  - ProjectFormModal 内部使用 ProjectForm + ProjectInfoFieldFragment 构造表单；提交时通过 ahooks 的 useRequest 发送 intelligenceApi.DraftProjectCreate 请求：
    - 将表单中的 icon_uri 上传值转换为后端需要的 uid。
    - 在海外环境下组装 monetization_conf 字段，并补充 create_from = bizCreateFrom。
  - 请求成功后，若后端返回 audit_data.check_not_pass 为 false，则触发 onCreateProjectSuccess 回调，回传 projectId/spaceId。
- 更新/复制项目（useBaseUpdateOrCopyProjectModal，见 src/hooks/use-base-update-or-copy-project-modal.tsx）：
  - 以 scene: 'update' | 'copy' 区分两种模式，对外由 useUpdateProjectModalBase 与 useCopyProjectModalBase 包装。
  - openModal 时传入 initialValue（ProjectFormValues）：
    - update 场景直接作为 initValues 传入 ProjectForm。
    - copy 场景会通过 appendCopySuffix + botInputLengthService.sliceStringByMaxLength 对项目名称追加「副本」后缀并裁剪长度。
  - update 场景下请求 intelligenceApi.DraftProjectUpdate，copy 场景请求 intelligenceApi.DraftProjectCopy，均使用 useRequest(manual: true) 管理。
  - 成功后根据 scene 调用 onSuccess，传出 UpdateProjectSuccessCallbackParam 或 CopyProjectSuccessCallbackParam；当后端返回 check_not_pass = true 或 basic_info 为空时会直接返回不触发回调。
- 表单与类型转换（见 src/components/project-form/index.tsx 与 src/type/index.ts）：
  - ProjectFormValues 组合 DraftProjectCreateRequest、DraftProjectCopyRequest、DraftProjectUpdateRequest 若干字段，并通过 ModifyUploadValueType 将原本 string 的 icon_uri 替换为 UploadValue（上传组件值）。
  - RequireCopyProjectRequest 要求 project_id/to_space_id 为必填，用于复制场景。
  - ProjectInfoFieldFragment 封装通用项目信息字段：name、enableMonetize（可选）、description、icon_uri 上传，所有长度校验依赖 botInputLengthService。

## 构建、测试与本地开发工作流

- 本子包依赖 Rush monorepo 统一管理，位于 frontend/packages/studio/workspace/project-entity-base。
- package.json 中脚本：
  - build: 当前实现为 "exit 0"，表示本包本身不独立产出构建产物，实际打包由上层应用或统一构建系统处理，不要在此包单独实现 bundling 逻辑。
  - lint: 使用 eslint.config.js 与 @coze-arch/eslint-config，对整个目录进行 lint，并开启缓存。
  - test: 使用 vitest 执行单测（见 vitest.config.ts，通过 @coze-arch/vitest-config 统一预设，preset 为 web）。
  - test:cov: 在 test 基础上带 coverage 运行。
- 推荐命令顺序：
  - 安装依赖与链接：在仓库根目录执行 rush update（参考 frontend/README.md 中整体说明）。
  - 在本包目录下开发时：
    - 运行单测：npm test 或 npm run test -- <pattern>。
    - 跑覆盖率：npm run test:cov。
    - 代码检查：npm run lint。
- 本包 README 中提到 storybook 与 dev 命令，但当前 package.json 未显式定义 dev / storybook 相关脚本；如需调试 UI，通常由上游应用（如 frontend/apps/coze-studio）以 workspace 依赖形式集成，并通过整体应用的 dev 命令启动。

## 项目特有约定与模式

- 环境变量：
  - 使用全局常量 IS_OVERSEA / IS_OPEN_SOURCE 控制海外版与开源版差异：
    - 海外 & 开源版不展示项目模板弹窗（ProjectTemplateModal），直接进入 ProjectFormModal。
    - 海外版在创建项目请求中追加 monetization_conf，并默认 enableMonetize = true。
- 文案与多语言：
  - 所有文案统一通过 I18n.t('key') 调用，key 格式如 creat_project_title、creat_project_project_name、project_ide_edit_project 等；新增 UI 时必须使用已有 i18n key 或在上游 i18n 包中新增。
- 表单与字段校验：
  - 表单字段 key 并不直接硬编码字符串，而是通过 filedKeyMap（ProjectFormValues 的键映射）确保字段名统一，后续若字段名调整只需在一个地方维护。
  - 是否允许提交由 isFormValid 控制（如 useCreateProjectModalBase 里将 commonProjectFormValid 与 space_id 非空组合）；commonProjectFormValid 位于 src/utils/common-project-form-valid.ts，用于统一校验规则。
- 上传组件与 icon_uri 处理：
  - 业务层永远使用 UploadValue 结构（含 uid 等信息），在发送请求前再转为后端字段 icon_uri: uriList?.at(0)?.uid；新增场景需沿用此转换方式，避免把完整 URL 传给后端。
  - PictureUpload 统一配置 accept、fileBizType、iconType 与 renderAutoGenerate 回调；生成图标使用 renderAutoGenerate 的参数（name、desc）进行 AI 生成或推荐。
- 请求结果审查：
  - intelligenceApi 返回时若有 audit_data.check_not_pass 标记为 true，则视为「未通过审核」场景，不触发成功回调；新增请求逻辑时需要保持同样的模式。
- 名称裁剪与副本命名：
  - 复制项目时使用 appendCopySuffix 给名称追加后缀，并通过 botInputLengthService.sliceStringByMaxLength 控制长度，避免超出前端/后端限制；新增类似逻辑时请统一依赖此服务。

## 与其他子系统的集成关系

- 与 Agent IDE / Studio：
  - 通过 @coze-studio/entity-adapter 使用 useCreateAgent 打开 Agent 创建流程，本包只负责弹出 modal，不关心后续页面跳转。
  - 与 Agent 输入长度限制共享 botInputLengthService，保持名称、描述等字段限制一致。
- 与设计系统：
  - 全部表单 UI 依赖 @coze-arch/coze-design（Form、FormInput、FormTextArea、withField 等），不要引入其他 UI 库；若需要新控件，优先在 coze-design 中实现后再在此组合。
- 与后端接口：
  - 仅通过 intelligenceApi 调用 intelligence_api 中的 DraftProjectCreate / DraftProjectUpdate / DraftProjectCopy 等接口；不要在本包直接拼写 URL 或使用裸 fetch/axios。
- 与上传与文件服务：
  - PictureUpload 使用 FileBizType.BIZ_BOT_ICON 和 IconType.Bot，约定该表单只上传 Bot/项目 icon 类型的文件；若需要其他文件类型，需在上游配置新的 bizType，并在此替换常量。

## 代码风格与工程规范

- 统一使用 TypeScript + React 18（见 package.json peerDependencies）。
- Lint 由 eslint.config.js 管理，规则基于 @coze-arch/eslint-config；常见定制规则包括：
  - 限制函数最大行数（@coze-arch/max-line-per-function），当前部分 hook 使用 eslint-disable-next-line 进行本地豁免，新增大函数时尽量拆分而不是继续豁免。
- 样式文件多为 *.module.less，遵循 CSS Modules 命名及 @coze-arch/stylelint-config 规则；在本包只做局部样式，避免全局选择器。
- 类型定义集中在 src/type 与 src/typings.d.ts 中；若需给第三方库补充声明应优先放到 typings.d.ts，而非随意散落在业务文件中。

## 测试与调试约定

- 单测使用 vitest + @testing-library/react(/hooks) 进行组件与 Hook 测试，对应测试文件位于 __tests__ 目录；新增 Hook 时，若存在复杂分支逻辑（如海外/开源分支、审核结果 check_not_pass 分支），建议在此包添加用例。
- vitest.config.ts 通过 @coze-arch/vitest-config.defineConfig 配置 preset: 'web'，会自动拉入 JSDOM、别名等前端预设；新增测试时无需重复手动配置环境。
- 对外暴露的 Hook（useCreateProjectModalBase 等）在实际使用中通常这样集成：
  - 在顶层组件中调用 Hook 获取 modalContextHolder 与触发函数（createProject / openModal）。
  - 将 modalContextHolder 挂到页面 JSX 的合适位置（通常靠近根组件），并在按钮点击事件中调用触发函数。
  - 调试问题时优先从调用方传入的回调与参数入手，再下沉到 Hook 内部逻辑。

## 分支、发布与依赖管理

- 本包作为 Rush workspace 包，版本与发布策略受整个仓库统一控制；package.json version 字段目前为 0.0.1，实际发版流程需参考仓库根级 CONTRIBUTING / RELEASE 文档。
- 依赖版本号多为 workspace:* 或统一范围（如 react ~18.2.0），新增依赖时优先在根层维护统一版本，再在此包声明为 workspace:* 避免多版本冲突。
- 由于 build 脚本为空，本包不会单独产出可发布构建；真正被消费时由上游 bundler (如 rsbuild / vite 等) 通过 workspace 依赖进行打包。

## 对 AI 编程助手的特别提示

- 修改请求参数或回调类型时，务必同时更新：
  - src/type/index.ts 中相关类型（如 ModifyUploadValueType、RequireCopyProjectRequest）。
  - src/components/project-form/index.tsx 中 ProjectFormValues 与 filedKeyMap 映射。
  - src/index.tsx 中的导出列表，确保外部调用方仍能正确导入类型与 Hook。
- 新增 Hook 或组件时：
  - 命名遵循现有模式（useXXXProjectModalBase / XxxModal / XxxFragment）。
  - 优先复用 existing 工具函数（commonProjectFormValid、botInputLengthService、appendCopySuffix 等），不要重复实现相同逻辑。
- 遇见与环境变量相关的条件逻辑（IS_OVERSEA / IS_OPEN_SOURCE）时，不要删除或合并这些分支；它们直接影响海外版与开源版行为差异，是产品要求的一部分。
