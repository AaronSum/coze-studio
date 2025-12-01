# AI 协作开发说明：@coze-agent-ide/chat-background-config-content

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-background-config-content）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本子包是 Agent IDE 中的「会话背景配置」内容区域，实现背景图上传、裁剪、AI 生成结果接入等交互。
- 暴露统一入口：src/index.ts，导出 BackgroundConfigContent 与 DragContent 两个 React 组件，供上层应用或其他包集成。
- 与共享逻辑/状态解耦：核心业务状态与工具方法主要来自 @coze-agent-ide/chat-background-shared、@coze-studio/bot-detail-store 等 workspace 依赖，本包更侧重 UI 与交互编排。

## 2. 目录结构与关键模块
- package.json：定义依赖、脚本（build/lint/test），main 指向 src/index.ts。
- README.md：说明这是一个 React 组件模板型子包，提供 dev/build 基本命令（但当前未配置本地 dev 脚本）。
- tsconfig.json / tsconfig.build.json / tsconfig.misc.json：统一使用 @coze-arch/ts-config，保证 TS 编译配置与整体前端一致。
- eslint.config.js / .stylelintrc.js：统一依赖 @coze-arch/eslint-config 与 @coze-arch/stylelint-config，遵循统一 ESLint/Stylelint 规则。
- vitest.config.ts：通过 @coze-arch/vitest-config.defineConfig({ dirname, preset: 'web' }) 接入统一测试预设，测试工具链由上层统一管理。
- src/index.ts：
  - re-export BackgroundConfigContent, BackgroundConfigContentProps。
  - re-export DragContent，用于上传区域的拖拽内容复用。
- src/components/chat-background-config-content/index.tsx：
  - 本包核心组件 BackgroundConfigContent 的实现文件，负责串联上传、裁剪、AI 生成结果、审核提示等逻辑。
- src/components/chat-background-config-content/cropper-upload/**：
  - CropperUpload：封装 Web/移动端裁剪组件，使用 react-cropper/cropperjs 和 Semi Upload 组件。
  - cropper/index.tsx + index.module.less：裁剪区域视图与样式。
  - drag-upload-content/**：拖拽上传 UI 片段（DragContent），样式在 index.module.less 中。
  - cropper-guide / cropper-cover：裁剪引导图层、覆盖层等 UI 组件。
- src/typings.d.ts：本包局部类型补充（如样式模块声明），避免 TS 报错。
- __tests__/.gitkeep：当前无实际测试用例，仅保留测试目录结构，后续可在此添加 Vitest+RTL 测试。

## 3. 核心业务流程与数据流
### 3.1 BackgroundConfigContent 组件职责
- 负责在 Bot 详情页中渲染一个「背景图配置」区域，支持：
  - 初始化展示：优先显示「AI 生成成功」的背景图；否则使用历史配置；否则为空。
  - 用户上传图片（手动选择或拖拽）。
  - 使用 Cropper 实现 Web/Mobile 双端裁剪，支持多 ref 协同。
  - 调用 useSubmitCroppedImage 完成裁剪结果上传与保存，成功后通过 onSuccess 回调传给上层。
  - 当审核不通过时，展示 AuditErrorMessage 提示。

### 3.2 与外部 store 和 hooks 的交互
- useGenerateImageStore（来自 @coze-studio/bot-detail-store）：
  - 通过 useShallow 只订阅 selectedImageInfo、generateBackGroundModal.gif/image.dotStatus、setGenerateBackgroundModalByImmer，避免无关状态变更导致的重渲染。
  - selectedImageInfo：当前选中的 AI 生成图片信息（含 tar_uri/tar_url）。
  - dotStatus：通过 DotStatus 判定 AI 生成是否成功，进而影响初始展示和 UploadMode。
  - setGenerateBackgroundModalByImmer：用于在初始化时同步「已选择的背景图」到 store。
- useBackgroundContent / useSubmitCroppedImage（来自 @coze-agent-ide/chat-background-shared）：
  - getInitBackground：根据是否有生成成功图片、已有背景配置、当前选中信息，计算初始展示图片（uri/url）。
  - useBackgroundContent：提供 showDot 等 UI 状态，影响 UploadMode 的初始值（Generate/Manual）。
  - useSubmitCroppedImage：封装提交裁剪结果、处理 loading/auditNotPass 等副作用，需要将 cropper ref、当前图片、用户信息、onSuccess/onAuditCheck 注入。

### 3.3 UploadMode 与交互模式
- UploadMode 来自 @coze-agent-ide/chat-background-shared，枚举值至少包含 Generate 与 Manual：
  - Generate：优先使用 AI 生成图片，对应 showDot 或已有 initPicture.url。
  - Manual：用户手动上传图片。
- BackgroundConfigContent 初始化时：
  - 先计算 initPicture（getInitBackground）。
  - 如果 showDot 为 true 或 initPicture.url 存在，则 initUploadMode 为 UploadMode.Generate，否则为 UploadMode.Manual。
- uploadMode 与 pictureValue 通过 useState 管理；上传或切换模式时，需要同步更新，以确保 Cropper 和 Footer 状态正确。

### 3.4 裁剪与提交流程
- ReactCropperElement ref：
  - cropperWebRef、cropperMobileRef 分别用于桌面端和移动端裁剪实例。
  - clearAllSideEffect 在取消时调用，遍历 ref，调用 cropper.destroy() 释放资源。
- useSubmitCroppedImage 负责：
  - 从两个 cropper ref 中获取裁剪后的图片数据。
  - 调用后端/存储接口写入背景图。
  - 包装 loading 状态控制与 onAuditCheck 回调，驱动 auditNotPass 状态更新。
- onSuccess：
  - 由调用方注入（类型为 (value: BackgroundImageInfo[]) => void）。
  - 内部提交成功后，回调携带最新背景图列表，交由上游页面或 store 处理。

## 4. 组件接口与复用方式
### 4.1 BackgroundConfigContentProps
- onSuccess: (value: BackgroundImageInfo[]) => void
  - 裁剪提交成功时调用，返回新的背景图列表。
- backgroundValue: BackgroundImageInfo[]
  - 当前已有背景图列表，用于 getInitBackground 初始化展示和 CropperUpload 历史图展示。
- getUserId: () => { userId: string }
  - 返回当前操作用户 ID；内部 useSubmitCroppedImage 会把该 ID 传给后端接口。
- cancel: () => void
  - 点击「取消」按钮时调用；组件内部还会调用 clearAllSideEffect 清理 cropper。
- renderUploadSlot?: ({ pictureOnChange, pictureUrl, uploadMode }) => React.ReactNode
  - 插槽式扩展：允许业务方在裁剪区域下方插入自定义内容（例如提示文案、操作按钮），可通过 pictureOnChange 主动变更当前图片。
- renderEnhancedUpload?: CropperUploadProps['renderEnhancedUpload']
  - 透传给 CropperUpload，用于自定义上传按钮/区域样式和行为。

### 4.2 DragContent
- 从 src/components/chat-background-config-content/cropper-upload/drag-upload-content 暴露的纯 UI 组件，用于拖拽上传区域的内容复用。
- 适合在其他上传场景中直接使用，需确保样式依赖（index.module.less）已按模块化 CSS 引入。

## 5. 开发工作流（构建 / 测试 / Lint）
### 5.1 全局前端工作流约定
- monorepo 管理：使用 Rush（根目录 rush.json，前端在 frontend/），安装依赖统一通过 rush 命令完成。
- 大多数子包不直接运行 npm install，而是依赖 rush update / rush install。
- 本包的具体 dev/build 命令通常通过 workspace 顶层 RushX 映射（frontend/rushx-config.json 等）统一调度。

### 5.2 本子包相关命令
- 安装/初始化依赖：
  - 在 repo 根目录执行：rush update
- 单包脚本（在本目录执行）：
  - lint：npm run lint
    - 调用 eslint ./ --cache，规则由 @coze-arch/eslint-config 提供。
  - test：npm run test
    - 使用 Vitest 运行测试，配置来自 vitest.config.ts，默认 --run --passWithNoTests，当前无测试用例不会报错。
  - test:cov：npm run test -- --coverage
  - build：npm run build
    - 目前脚本实现为 exit 0，仅占位，不生成构建产物；真实打包通常由上层构建系统处理。
- 调试建议：
  - 当前 package.json 未定义 dev 脚本；如果需要本地调试，可参考 README 中的通用模板，在上层应用中引入 BackgroundConfigContent，然后通过该应用启动 dev。

## 6. 代码风格与模式约定
- 语言与框架：
  - TypeScript + React 18，函数式组件为主，使用 React.FC 和显式 Props 类型导出。
- 状态管理：
  - 组件内部只持有局部 UI 状态（loading、auditNotPass、uploadMode、pictureValue）。
  - 跨模块/跨页面状态全部通过 zustand store（如 useGenerateImageStore）和共享 hooks 统一维护，本包仅通过 hooks 读写。
  - 在订阅 zustand store 时配合 useShallow，避免不必要的重渲染。
- 样式与 UI：
  - 使用模块化 less（*.module.less）结合 Tailwind 风格类名（如 flex, overflow-hidden, px-6），风格由上层设计系统统一。
  - UI 基础组件主要来自 @coze-arch/bot-semi、@coze-arch/coze-design、@douyinfe/semi-icons。
- 副作用与资源释放：
  - 使用 useEffect 管理初始化和依赖 selectedImageInfo 变化的逻辑。
  - 明确的 clearAllSideEffect 函数集中处理 cropper.destroy()，在取消/关闭 modal 时调用，避免内存泄漏。
- 错误与审核处理：
  - 审核相关逻辑通过 onAuditCheck 回调置 auditNotPass 状态；
  - 审核失败时统一展示 AuditErrorMessage（来自 @coze-studio/bot-audit-adapter），不在本包写死错误文案。

## 7. 外部依赖与集成注意事项
- 与其他 workspace 包的关系：
  - @coze-agent-ide/chat-background-shared：提供背景图相关共享逻辑与 hooks，是本包的核心依赖，修改其接口时需同步更新本包。
  - @coze-studio/bot-detail-store：负责 Bot 详情页相关的全局 state（包含生成背景图 modal 状态）；更改 store 结构需检查 BackgroundConfigContent 的选择/初始化逻辑。
  - @coze-arch/bot-api：定义 BackgroundImageInfo 等接口类型，与后端 API 契约保持一致。
  - @coze-studio/bot-audit-adapter：封装审核失败的 UI 展示。
- 第三方库：
  - react-cropper + cropperjs：实现裁剪区域，注意 DOM ref 生命周期和 destroy 调用。
  - zustand：简单、无模板的状态管理，配合 useShallow 订阅部分状态。
  - lodash-es、classnames：提供工具函数和 className 组合能力。

## 8. 项目流程与协作规范（与 monorepo 保持一致）
- 版本管理：
  - 包版本由 monorepo 统一管理；本包当前 version 为 0.0.1，通常通过变更集和 Rush 发布流程统一升级。
- 分支与提交：
  - 遵循仓库级别流程（可参考根目录 CONTRIBUTING.md / README），一般通过 feature 分支开发后合入主干。
- 测试与代码质量：
  - 新增/修改核心逻辑建议在 __tests__ 目录下增加 Vitest + React Testing Library 用例，重点覆盖：
    - initPicture 和 uploadMode 初始化逻辑。
    - 上传/裁剪成功与审核失败的状态流转。
  - 统一通过 rush 驱动 lint/test 检查，以避免局部配置不一致。

## 9. 对 AI 编程助手的特别提醒
- 修改 BackgroundConfigContent 时：
  - 优先查阅 @coze-agent-ide/chat-background-shared 与 @coze-studio/bot-detail-store 的接口定义，确保状态字段与 type 一致。
  - 避免在本包内部新增与 store 重复的全局状态，保持「无状态视图 + 外部 store」的分层。
  - 新增 props 时，请同步更新 src/index.ts 的导出类型。
- 新增组件：
  - 放在 src/components/chat-background-config-content/ 子目录中，保持按功能分组（如 cropper-***/drag-upload-content 等）。
  - 样式优先使用模块化 less + 设计系统变量，避免硬编码颜色/尺寸。
- 调整上传/裁剪流程时：
  - 确保 clearAllSideEffect 在所有退出路径（取消、提交成功后关闭等）都被调用。
  - 审核逻辑变更时，保持 onAuditCheck -> auditNotPass -> AuditErrorMessage 的链路完整，避免 UI 沉默失败。
