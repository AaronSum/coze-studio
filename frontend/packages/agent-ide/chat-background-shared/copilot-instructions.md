# @coze-agent-ide/chat-background-shared 协作指南（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-background-shared）中安全、高效地协作开发。

## 子包定位与整体架构
- 角色：为 Agent IDE「聊天背景配置」能力提供可复用的业务 Hook、上传控制器和工具函数，是 chat 背景编辑/渲染的领域公共层，不直接包含 UI 组件。
- 入口：[src/index.ts](src/index.ts) 只做导出聚合，对外暴露：
  - 背景能力相关 Hook：`useBackgroundContent`、`useSubmitCroppedImage`、`useUploadImage`、`useDragImage`、`useCropperImg`。
  - 枚举与常量：`UploadMode`、`MAX_AI_LIST_LENGTH`、`MAX_IMG_SIZE`、`FIRST_GUIDE_KEY_PREFIX` 等。
  - 工具方法：`checkImageWidthAndHeight`、`getModeInfo`、`getOriginImageFromBackgroundInfo`、`getInitBackground`、`computePosition`、`canvasPosition`、`computeThemeColor`、`getImageThemeColor`。
- 主要技术栈：React 18 Hook、TypeScript、zustand、ahooks、react-cropper、colorthief；强依赖内部包 `@coze-arch/*`、`@coze-common/chat-uikit`、`@coze-studio/*`。
- 架构思路：
  - 将「背景生成状态管理」「上传与审核」「裁剪与主题色计算」等通用逻辑沉淀为 Hook 和工具函数；
  - UI 侧（如 Agent IDE 面板）只负责布局与交互，将具体行为委托给本包导出的 Hook。

## 构建、测试与本地开发
- 包管理：使用 Rush + PNPM，首次开发需在仓库根目录执行：`rush update`。
- 本包 scripts（见 package.json）：
  - `build`: `exit 0`，不在子包内做实际打包，编译/打包由上层应用统一处理；AI 不要在此包新增独立 bundler 逻辑。
  - `lint`: `eslint ./ --cache`，规则来源 `@coze-arch/eslint-config`，preset 为 web。
  - `test`: `vitest --run --passWithNoTests`，使用 `@coze-arch/vitest-config` 的 web 预设，可在包目录运行 `npm test`。
  - `test:cov`: `npm run test -- --coverage`。
- TypeScript：
  - ts 配置继承 `@coze-arch/ts-config`，对外主入口为源码 `src/index.ts`；
  - 新增导出时，仅需保证类型正确定义并由 `src/index.ts` 暴露，无需手动维护 .d.ts。

## 代码组织与职责边界
- `src/hooks/use-background-content.ts`
  - 职责：围绕「背景生成消息列表 + 角标状态」提供聚合行为，供聊天背景入口区域使用。
  - 关键依赖：
    - `useGenerateImageStore`（来自 `@coze-studio/bot-detail-store`）：读取并更新背景生成弹窗状态（静图/动图 dotStatus、loading、selectedImage 等）。
    - `useBotInfoStore`：获取当前 botId。
    - `PlaygroundApi.MarkReadNotice`：将“未读生成结果”标记为已读。
  - 暴露能力：
    - `showDot`/`showDotStatus`：是否有“未读/生成中”角标及其状态。
    - `handleEdit`：调用上层传入的 `openConfig`，打开配置弹窗。
    - `handleRemove`：
      - 若存在进行中的生成任务（静图或动图），调用 `PlaygroundApi.CancelGenerateGif` 取消任务，并重置对应 dotStatus/loading；
      - 调用 `markRead` 清除“未读”状态，并通过 `setBackgroundImageInfoList?.([])` 清空当前渲染背景。
    - `markRead`：设置当前 active tab（静图/动图），将已完成状态 dotStatus 置为 `None`，必要时调用 `MarkReadNotice` 上报。
  - 使用约定：在上层组件中解构该 Hook，结合本地 UI 决定何时展示角标、何时调用编辑/删除逻辑。

- `src/hooks/use-upload-img.ts`
  - 职责：管理文件上传控制器实例、封装错误处理与审核失败提示。
  - 核心逻辑：
    - 内部以 `nanoid` 为 key 维护 `UploadController` 映射，并在组件卸载时调用 `cancel()` 清理所有在途上传。
    - `uploadFileList(files)`：为每次上传创建新的 `UploadController`，并处理：
      - `onComplete`：将上传成功的 `{ url, uri }[]` 传回调用方；
      - `onUploadError`、`onGetTokenError`、`onGetUploadInstanceError`：统一调用 `handleError`，取消当前 controller，并通过 `Toast.error` + `withSlardarIdButton(I18n.t('Upload_failed'))` 提示；
      - `onAuditFailed`：若调用方提供 `onAuditError` 则交给外部处理，否则默认弹出 `inappropriate_contents` 文案，再调用 `onUploadError`。
  - 使用约定：
    - 上层必须提供 `getUserId` 与 `onUploadAllSuccess`、`onUploadError`，可选 `onAuditError`；
    - 若需中断上传流程，可在上层通过保存的 controllerId 调用 `cancelUploadById` 模式扩展（目前内部只在错误场景调用）。

- `src/service/upload-controller.ts`
  - 封装底层上传与短链生成逻辑：
    - 通过 `uploadFileV2`（`@coze-arch/bot-utils/upload-file-v2`）发起上传，传入 `AbortController` signal 以支持取消；
    - `onUploadAllSuccess` 中：
      - 从 `event` 中提取上传得到的 `Uri` 列表；
      - 调用 `PlaygroundApi.GetImagexShortUrl({ uris, scene: GetImageScene.BackgroundImage })` 获取 CDN 短链；
      - 若所有 uri 均无可用 url，则触发 `onAuditFailed`，否则调用 `onComplete` 返回 `{ url, uri }[]`。
  - 公共方法：
    - `cancel()`：终止当前上传（`AbortController.abort()`）。
    - `pause()`：调用底层 `uploader.pause()`。
  - 注意：所有错误（短链获取失败、无 uri、onUploadError 回调等）都在内部转换为 `Error` 传给上层，AI 修改时需保持这一错误契约不变。

- `src/utils/index.ts`
  - 图片尺寸校验：`checkImageWidthAndHeight(file)`
    - 使用 `FileReader` + `Image` 加载文件，若高度 < 640，则通过 `UIToast.error(I18n.t('bgi_upload_image_format_requirement'))` 提示并返回 `false`；
    - 读取/加载失败时抛出 `CustomError('checkImageWidthAndHeight', message)`。
  - 背景信息工具：
    - `getModeInfo(mode)`：包装 `MODE_CONFIG[mode]`，用于获得 PC/Mobile 画布尺寸；
    - `getOriginImageFromBackgroundInfo(list)`：从 `BackgroundImageInfo[]` 中提取原始图片 `url/uri`；
    - `getInitBackground({ isGenerateSuccess, selectedImageInfo, originBackground })`：
      - 若生成成功且有 `selectedImageInfo.tar_url`，优先返回生成图；
      - 否则回退至已有 `origin_background`；
      - 都没有则返回空对象。
  - 画布与渐变位置：
    - `computePosition(mode, cropperRef)`：基于 `react-cropper` 的 canvas/image 数据计算左右两侧渐变遮罩百分比；
    - `canvasPosition(cropperRef)`：使用 `lodash.pick` 从 `getCanvasData()` 中提取 `left/top/width/height`，用于后续还原位置。
  - 主题色计算：
    - `computeThemeColor(cropperRefList)`：对多个 cropper 实例并行调用 `getImageThemeColor`，最终返回颜色数组；
    - `getImageThemeColor(url)`：
      - 使用 `ColorThief` 获取图片主色，转换为 `rgba(r, g, b)` 字符串；
      - 若无法获取则抛出 `CustomError('getImageThemeColor', 'not get theme color')`。

- `src/hooks/use-crop-image.ts`
  - 职责：
    - 绑定 `react-cropper` 的裁剪/拖拽事件，限制拖拽边界与缩放范围；
    - 维护 `gradientPosition` 与 `themeColor`，供 UI 渲染聊天渐变与主题色；
    - 在初始加载完成时，根据 `backgroundInfo.canvas_position` 还原旧位置。
  - 关键行为：
    - `onZoom`：限制最大缩放至画布尺寸 2 倍，遵循宽高比例不同的分支逻辑；
    - `handleDragLimit(y)`：
      - 防止图片在 vertical 方向超出容器；
      - 在 horizontal 方向约束「bubble container」的固定左右 80% 范围；
    - `handleCrop(event)`：更新渐变位置并对拖拽进行限制；
    - `cropEnd`：在拖拽结束时异步重新计算主题色并更新渐变位置；
    - `handleReady`：
      - 如果有历史 `canvas_position` 且当前 url 为历史 `origin_image_url`，调用 `setCanvasData` 恢复位置；
      - 然后计算初始主题色，并通过 `setLoading(false)` 通知 UI 完成准备。

- `src/hooks/use-drag-image.ts`
  - 提供基本的拖拽进入高亮逻辑：
    - 通过 `dataTransfer.types` 中是否包含 `Files` 判断是否拖入文件；
    - 使用短延时定时器在拖拽结束后延时清除 `isDragIn` 状态，避免 flicker；
    - 对外暴露 `isDragIn`、`setIsDragIn`、`onDragEnter`、`onDragEnd`、`onDragOver`，便于上层容器实现拖拽上传背景的 UX。

- `src/hooks/use-submit-cropped-image.ts`
  - 职责：从两个 cropper（PC/Mobile）中读取最终裁剪结果，上传/审核并生成 `BackgroundImageInfo[]` 返回给业务。
  - 关键步骤：
    1. `handleSubmit()`：
       - 调用 `setLoading(true)`；
       - 若 `currentOriginImage.fileInstance` 是 `File`，则以此构造 `fileList` 调用 `uploadFileList`；
       - 否则视为“已有 URI/URL 回填场景”，直接执行 `handleUploadAllSuccess()`，不重新上传。
    2. `handleUploadAllSuccess(croppedImageList?)`：
       - 使用 `computeThemeColor([cropperWebRef, cropperMobileRef])` 获取 PC/Mobile 主题色；
       - 组合 `originImageInfo`：若有 `croppedImageList` 则采用上传返回的 `{ uri, url }`，否则用 `currentOriginImage.uri/url`；
       - 通过 `getBackgroundInfoItem` 构造包含 `theme_color`、`gradient_position`、`canvas_position` 的 `BackgroundImageDetail` 两份（web/mobile），组装为 `BackgroundImageInfo[]`；
       - 调用 `useBotInfoAuditor().check({ background_images_struct: backgroundImageList[0] })` 进行敏感内容审核：
         - 若 `check_not_pass` 为真，则调用 `onAuditCheck(true)` 并提前返回；
         - 否则调用外部 `onSuccess(backgroundImageList)` 与 `handleCancel()` 关闭弹窗。
    3. 错误处理：
       - 上传阶段错误由 `useUploadImage` 的 `onUploadError` 回调接收，并负责 `setLoading(false)`；
       - 额外的运行时异常会通过 `logger.error({ error })` 打印，但不会中断调用者。

## 与其它子系统的集成
- 与 Agent IDE / Bot 详情页：
  - 背景生成状态与配置存储在 `@coze-studio/bot-detail-store` 中，本包仅通过该 store 读写必要片段（imageList、generateBackGroundModal 等），不直接接触更广泛的 bot 配置；
  - 审核能力来自 `@coze-studio/bot-audit-adapter` 的 `useBotInfoAuditor`，本包只在背景图片提交链路中触发审核。
- 与 Playground API：
  - 背景上传与图片服务：
    - `PlaygroundApi.GetImagexShortUrl`：根据 `uris` 和 `scene = GetImageScene.BackgroundImage` 获取背景图片短链；
    - `PlaygroundApi.CancelGenerateGif`：取消正在生成的静图/动图任务；
    - `PlaygroundApi.MarkReadNotice`：将生成结果标记为已读，用于角标状态同步。
- 与 UI/设计体系：
  - Toast 与提示：使用 `@coze-arch/bot-semi` 的 `Toast`、`UIToast`；
  - I18n：所有文案通过 `I18n.t(key)` 获取（如 `Upload_failed`、`inappropriate_contents`、`bgi_upload_image_format_requirement`），新增文案时需前往上游 i18n 资源补充 key。
  - 布局相关尺寸从 `@coze-common/chat-uikit` 的 `MODE_CONFIG` 读取，保证不同模式下行为一致。

## 工程与协作规范
- 新增/修改导出：
  - 必须同步更新 [src/index.ts](src/index.ts)，保持对外 API 扁平清晰；避免直接从深路径导入内部文件。
- Hook 使用约定：
  - 所有 Hook 设计为在 React 函数组件中调用，不应在普通函数或 class 中直接使用；
  - 若在新 Hook 中依赖本包已有 Hook（如 useUploadImage），优先通过组合实现，而不是复制粘贴逻辑。
- 错误与边界处理：
  - 涉及文件读写、图片处理和网络请求的函数（如 `checkImageWidthAndHeight`、`UploadController`）已通过 `CustomError`/Toast 做了用户提示与日志记录，AI 扩展时应保持「用户可感知 + 日志可追踪」的一致策略。
- 审核与合规：
  - 任意会改变背景图片的流程（上传、裁剪、重新选择）都应走 `useSubmitCroppedImage` + `useBotInfoAuditor.check` 的链路，避免绕过机审；
  - 如需新增背景加工能力（滤镜、裁剪模式等），建议在 `useCropperImg` 或新 Hook 中扩展，但最终仍复用 `useSubmitCroppedImage` 的审核与回填逻辑。

## 对 AI 助手的特别提示
- 不要在本包中增加具体 UI 组件或路由逻辑，保持其「逻辑层/能力层」定位；UI 应在 Agent IDE 对应子包（如 chat-background-config-content）中实现。
- 修改 `UploadController`、`useUploadImage`、`useSubmitCroppedImage` 等核心链路前，应：
  - 先阅读依赖它们的上层包代码，了解调用假设；
  - 尝试为关键路径补充或调整 Vitest 单测（可参考其它前端包的测试写法）。
- 如需支持新的背景模式（例如新增终端尺寸），优先：
  - 在 `@coze-common/chat-uikit` 中扩展 `MODE_CONFIG`；
  - 再在本包的 `getModeInfo`/`computePosition`/`useCropperImg` 等处适配，而不是在此处硬编码尺寸常量。