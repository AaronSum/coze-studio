# Copilot Instructions for @coze-arch/bot-utils

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-utils）中安全、高效地协作开发。

## 1. 全局架构与角色定位
- 本包是 Coze Studio 前端 monorepo 中的通用工具库，路径为 frontend/packages/arch/bot-utils，面向 Web 端 Bot / Workflow / 社区 等多个上层应用复用。
- 对外主要通过 src/index.ts 进行聚合导出，局部子入口通过 package.json 的 exports 暴露（例如 ./voice-assistant、./upload-file-v2、./post-message-channel、./date）。
- 工具函数大致分为几类：
  - 基础数据与格式化：array-buffer-to-object、array、number、date、safe-json-parse、cache、retry-import 等。
  - Web/DOM/平台相关：dom、viewport、is-mobile、platform、html、image、responsive-table-column、url、post-message-channel、event-handler。
  - 业务集成：upload-file / upload-file-v2（统一文件上传逻辑）、message-report（消息收发埋点）、skill（与能力/工具配置联动）。
- 核心设计理念：
  - 将与 Bot 前端强耦合但在多个应用间复用的逻辑抽离到独立包，减少重复实现。
  - 对外暴露相对稳定的轻量 API，内部依赖 monorepo 其他包（如 @coze-arch/bot-api、@coze-arch/logger、@coze-arch/report-events、@coze-studio/uploader-adapter 等）来完成实际网络 / 埋点 / 上下文逻辑。
  - 对浏览器环境有一定假设（window、document、navigator、location 存在），不面向 Node 端直接使用。

## 2. 关键模块与数据流

### 2.1 上传模块：upload-file / upload-file-v2
- 相关文件：
  - src/upload-file.ts
  - src/upload-file-v2.ts
  - __tests__/upload-file.test.ts, __tests__/upload-file-v2.test.ts
- 核心依赖：
  - @coze-studio/uploader-adapter：封装的 CozeUploader，负责真正上传。
  - @coze-arch/bot-api DeveloperApi / workflowApi：提供 GetUploadAuthToken 接口，获取上传凭证（service_id、upload_host、auth 信息等）。
  - 全局变量：APP_ID、IMAGE_FALLBACK_HOST、BYTE_UPLOADER_REGION、IS_OVERSEA；在测试环境通过 __tests__/setup.ts 写死默认值。
- upload-file：
  - 针对单文件上传，支持业务场景 biz = 'bot' | 'workflow' 或自定义 biz + getUploadAuthToken。
  - 封装获取上传 token 的逻辑（区分 bot / workflow 场景），然后用 initUploader 创建 CozeUploader 并监听 complete / error / progress 事件。
  - 返回 Promise<string>，resolve 为上传得到的 Uri。
- upload-file-v2：
  - 面向多文件上传与更细粒度控制，导出 uploadFileV2、UploaderInstance、EventPayloadMaps、FileItem 等类型。
  - 数据流：
    1. uploadFileV2 接收 fileItemList、userId、AbortSignal、各种回调 + timeout。
    2. 先调用 DeveloperApi.GetUploadAuthToken('bot_task') 获取授权；使用 getReportError 对异常统一封装并交给 onGetTokenError。
    3. 成功后创建 uploader 实例（initUploader），为每个文件调用 addFile 并 start；通过 onProgress/onUploadError/onSuccess/onUploadAllSuccess/onStartUpload 提供回调钩子。
    4. 监听 AbortSignal，中止上传并清理事件监听，保证中断时不发生资源泄漏。
  - 适合 Workflow Playground、知识库导入等复杂交互场景使用。

### 2.2 消息埋点模块：message-report
- 文件：src/message-report.ts
- 依赖：
  - @coze-common/chat-core 中的 Message / ContentType 类型。
  - @coze-arch/web-context 中的 globalVars（获取 LAST_EXECUTE_ID 作为 log_id）。
  - @coze-arch/report-events：REPORT_EVENTS、createReportEvent。
  - @coze-arch/logger：reporter；@coze-arch/bot-error：CustomError。
- 目标：对 Bot 调试执行与消息流进行统一埋点和时长统计：
  - executeDraftBotEvent：记录一次 bot 调试执行，成功后启动总消息统计与主消息接收统计。
  - receiveMessageEvent：
    - 通过 start / receiveMessage / success / error / finish 四阶段记录：首包耗时、总内容长度（content_length）、是否全部完成（reply_has_finished）。
    - 若 message.content 为空会额外上报 emptyReceiveMessage 事件。
  - messageReceiveSuggestsEvent：
    - 在 messages 完成后，如果消息 ext.has_suggest === '1'，认为存在“建议回复”流，再启动对应事件并追踪首包、成功、失败等。
  - receiveTotalMessagesEvent：
    - 汇总上述两类流的最终结果，标记整体 reply_has_finished（含中断场景）。
- 使用方式：
  - 通过单例 messageReportEvent.start(botID) 设置上下文；在执行入口/Socket 消息处理处调用对应 start/receive/finish/error 方法。
  - AI 修改代码时，要保持时间线及 gate 逻辑不被破坏（_receivingMessages / _receivingSuggests 等标记）。

### 2.3 事件与跨窗口通信
- 事件总线：src/event-handler.ts
  - BufferedEventEmitter：基于 eventemitter3 的缓冲事件封装，支持 stop 后缓存 emit，再在 start 时依次放出，适用于初始化前先收事件的场景。
  - OpenBlockEvent / OpenModalEvent：枚举定义了一组业务上常见的模块区域/弹窗，例如 DATA_MEMORY_BLOCK_OPEN、PLUGIN_API_MODAL_OPEN 等。
  - EmitEventType = OpenBlockEvent | OpenModalEvent | AbilityKey；AbilityKey 来自 @coze-agent-ide/tool-config，使本包能驱动 Agent IDE 的能力开关。
  - 提供 emitEvent / handleEvent / removeEvent 三个顶层方法作为对外 API，默认懒初始化 eventEmitter。
  - DraftEvent + draftEventEmitter：另一个简单的全局 EventEmitter，用于如 DELETE_VARIABLE 这类草稿事件。
- 跨 window 通信：src/post-message-channel.ts
  - 实现 PostMessageChannel：围绕 window.postMessage 封装 request/response+超时模式。
  - 协议：MessageChannelEvent<{syncNo, type, senderName, toName, eventName, requestData, respondData}>。
  - send：发送 REQUEST 消息并等待 awaitRespond，支持超时（默认 3000ms，超时返回 code -1）。
  - onRequest：注册特定 eventName 的处理函数，将 REQUEST 转换为 RESPONSE 并自动回复到 event.source 或 channelPort。
  - 适用场景：iframe 与父页面、同源窗口之间的 RPC 式通信。

### 2.4 DOM / 平台 / 视图工具
- src/platform.ts：使用 bowser 分析 userAgent（浏览器端限定），封装：
  - getIsMobile：缓存 browser.getPlatformType(true).includes('mobile') 结果。
  - getIsIPhoneOrIPad / getIsIPad：基于 UA 及触控能力判断苹果手机 / iPad / iPadOS。
  - getIsMobileOrIPad / getIsSafari：组合判断。
- src/is-mobile.ts：视口宽度阈值（<= 640）判断移动端；常用于响应式布局，和 platform 中逻辑分离（一个看 UA，一个看视口宽度）。
- src/dom.ts：
  - closestScrollableElement：从元素向上查找第一个 overflow 为 auto/scroll/overlay 或 data-overflow='true' 的祖先；用于滚动容器定位。
  - openNewWindow：为避免浏览器阻止异步 window.open，先同步打开 window，再异步填充 URL（失败时跳到 /404）。
- src/viewport.ts：
  - setMobileBody / setPCBody：通过设置 body/html 的 minWidth/minHeight 来切换移动/桌面布局的 viewport 约束，有副作用，慎在 SSR 或非浏览器环境调用。
- src/image.ts：loadImage(url)：简单的图片预加载封装，返回 Promise。
- src/html.ts：renderHtmlTitle(prefix)：基于 I18n.t('platform_name') 生成页面标题，prefix 仅接受 string 时追加 “prefix - platformName”。

### 2.5 数据处理与格式化工具
- src/safe-json-parse.ts：
  - safeJSONParse(v, emptyValue?)：已标记 @Deprecated，会在解析失败时上报 logger.persist.error(REPORT_EVENTS.parseJSON) 并返回 emptyValue 或 undefined。
  - typeSafeJSONParse(v)：若 v 已为 object 直接返回，否则尝试 JSON.parse，异常时通过 reporter.errorEvent(REPORT_EVENTS.parseJSON) 上报并返回 undefined。
- src/array-buffer-to-object.ts：使用 TextDecoder 将 ArrayBuffer 解码为字符串，再经 typeSafeJSONParse 转为对象，异常时返回 {}。
- src/array.ts：
  - array2Map：多重重载，支持将数组转为 key->item / key->某字段 / key->自定义映射值 的 Record；内部用 reduce + isFunction，注意返回值类型是 Partial<Record<...>>。
  - mapAndFilter：将 map 与 filter 合并为一趟 reduce，支持只 filter 或同时 map。
- src/number.ts：
  - simpleformatNumber：使用 Intl.NumberFormat('en-US') 格式化整数。
  - formatBytes：将字节数转成带单位（Bytes, KB, MB,...）的字符串。
  - formatNumber：将大数转为 K/M/B/T 形式（使用 lodash-es 的 ceil 保留 1 位小数）。
  - formatPercent：将 0-1 之间的数转为百分字符串（最多 1 位小数，处理 NaN/undefined）。
  - formatTime：将毫秒转成 {x}h/{x}min/{x}s/{x}ms 形式，带一位小数。
  - getEllipsisCount：如 120, max=99 -> '99+'。
  - exhaustiveCheck：空实现，标注为 @Deprecated，通常用于 TS 联合类型穷举检查。
  - sleep(timer)：简单 Promise 化 setTimeout。
- src/cache.ts：
  - 基于 Map<CachedKey, RecordData> 的本地内存缓存；每条记录可带超时清理：setCache(key, cacheTime, {data, time})。
  - getCache(key) 读取；clearCache(key?) 支持清除单个、多项或全部缓存。
- src/date.ts：
  - 依赖 dayjs + utc/timezone/duration 插件以及 @coze-arch/i18n。
  - getFormatDateType(time): 根据给定秒级时间戳与当前时间关系返回 'HH:mm' / 'MM-DD HH:mm' / 'YYYY-MM-DD HH:mm' 模板。
  - formatDate(v, template?): 秒级时间戳 -> dayjs.unix(...).format(template)。
  - getCurrentTZ(param?): 根据 IS_OVERSEA 决定使用 UTC 或 Asia/Shanghai 时区，返回 Dayjs 实例。
  - getTimestampByAdd / getCurrentTimestamp：辅助时间戳计算。
  - getRemainTime：计算到下一天 UTC0 点的剩余时长，返回如 "12h 30m"。
  - formatTimestamp(timestampMs)：根据与当前时间差，返回“刚刚 / n 分钟前 / n 小时前 / n 天前 / 日期字符串”，文案来自 I18n。

### 2.6 URL 与 Query 相关
- src/url.ts：
  - getParamsFromQuery({key})：基于 query-string.parse(location.search) 获取指定 query 参数，返回 string。
  - appendUrlParam(url, key, value)：使用 query-string.parseUrl/stringifyUrl 修改指定参数，value 为空则删除该参数。
  - openUrl(url)：对移动 Safari 使用 location.href，其余场景用 window.open('_blank')；内部依赖 getIsMobile / getIsSafari。

## 3. 构建、测试与调试流程
- 构建：
  - 本包在 package.json 中的 build 脚本当前为 "build": "exit 0"，真实产物构建由上层 Rush/构建系统驱动（tsconfig.build.json 配置 outDir=dist、extends 公共 tsconfig.web.json）。
  - 一般不要单独调用子包 build，而是在 repo 根目录使用 Rush/统一脚本（例如 rush build/自定义脚本），以保证 TS references 与整体依赖一致。
- TypeScript 配置：
  - tsconfig.build.json：
    - rootDir=src，outDir=dist，strictNullChecks=true，skipLibCheck=true。
    - references 指向多个内部包的 tsconfig.build.json，确保类型依赖顺序正确。
  - tsconfig.misc.json：
    - 覆盖 __tests__ 与 vitest.config.ts，types=vitest/globals，便于测试环境下的类型推导。
  - tsconfig.json：作为 references 聚合文件，仅 composite + references，exclude=**/*，不直接参与编译。
- 测试：
  - 使用 Vitest，配置在 vitest.config.ts：通过 @coze-arch/vitest-config.defineConfig 统一管理，preset='web'，并加载 __tests__/setup.ts。
  - 运行：在子包目录执行 npm test 或通过 Rush 在根目录统一执行。npm run test:cov 生成覆盖率。
  - __tests__/setup.ts：为上传/时间相关逻辑注入全局变量（IS_OVERSEA、APP_ID 等），AI 改动前要确认这些依赖是否被新代码使用。
- Lint：
  - eslint.config.js 使用 @coze-arch/eslint-config.defineConfig({preset:'web'})，保证风格与 monorepo 统一。
  - 在子包目录执行 npm run lint。

## 4. 项目约定与风格
- 代码风格：
  - 全面启用 TypeScript，偏好精确类型但对工具包中的部分函数允许 any（用 eslint-disable 标注）。
  - 常见 ESLint disable 注释带原因说明，如 // eslint-disable-next-line max-lines-per-function、// cp-disable-next-line，用于兼容已有风格或第三方库限制。
  - deprecated 工具（safeJSONParse、exhaustiveCheck）均显式加 @Deprecated 注释，并在 README/API 中仍提及但不会主动推荐使用。
- 全局变量与环境假设：
  - 大部分工具假设运行在浏览器环境（window/document/navigator/location 可用），不对 SSR/Node 做防御式分支，AI 在新工具中建议保持一致：
    - 若确需 SSR 兼容，需在调用侧而非工具内部做防护，避免破坏现有行为。
  - 上传与时区逻辑依赖全局常量（IS_OVERSEA、APP_ID 等），其真实赋值由上层应用或构建注入，本包只消费不声明来源。
- 业务约定：
  - upload-file / upload-file-v2：
    - 默认场景字符串（scene: 'bot_task'、'imageflow'）由服务端约定，避免在本包内部擅自修改。
    - uploader 配置中 imageHost 必须以 https:// 前缀拼接 upload_host，且 region/imageFallbackHost 等字段需传递全局常量。
  - message-report：
    - botID 由上层控制（messageReportEvent.start(botID)），本包不做校验；埋点事件名称必须使用 REPORT_EVENTS 常量，不要硬编码字符串。
  - skill 模块：skillKeyToApiStatusKeyTransformer 构造的 key 与后端接口字段强关联（xxx_tab_status），不要修改模板格式。

## 5. 与其他子包的集成
- 依赖关系：
  - 类型与工具：@coze-arch/bot-typings、@coze-arch/ts-config、@coze-arch/vitest-config 等，通过 tsconfig.build.json references 管理。
  - 运行时依赖：
    - @coze-arch/bot-api：DeveloperApi、workflowApi。
    - @coze-arch/logger：logger、reporter。
    - @coze-arch/report-events：REPORT_EVENTS、createReportEvent。
    - @coze-arch/i18n：I18n.t（时间、平台名称等文案）。
    - @coze-arch/web-context：globalVars（log_id 等上下文）。
    - @coze-studio/uploader-adapter、@coze-studio/user-store：上传相关。
    - @coze-agent-ide/tool-config：能力键 AbilityKey、SkillKeyEnum。
- 对上层包的影响：
  - 多个应用（workflow playground、knowledge-ide-base、database-v2-main 等）已广泛使用本包的数值/时间/上传/JSON 工具以及事件总线；
  - 修改这些核心工具时需要注意非向后兼容变更会影响大量包，优先增加新 API 而非破坏旧 API。

## 6. 开发建议与注意事项（面向 AI Agent）
- 在本包新增工具：
  - 优先按功能分类放入现有子模块（number/date/dom/url 等），避免在 index.ts 内写实现。
  - 对外导出时：在 src/index.ts 加上 export，并视情况更新 README.md 的 API Reference。
  - 若工具依赖全局变量或其他子包，请在对应 __tests__ 中补充最小验证用例，沿用 __tests__/setup.ts 的全局约定。
- 修改现有行为：
  - 对上传、埋点、跨窗口通信等“系统级”工具的改动，务必：
    - 保持函数签名不变，或以新增参数 + 默认值方式扩展。
    - 更新/新增针对边界情况的单元测试（超时、中断、无 token、空消息等）。
  - 对通用工具（formatNumber、typeSafeJSONParse 等），修改前优先查看全仓调用点（grep '@coze-arch/bot-utils'），确认不会破坏调用假设。
- 测试优先级：
  - 对平台相关工具（platform/is-mobile/viewport/dom）需要在 JSDOM 环境下模拟 UA/DOM；当前已有测试示例，可参考 __tests__/platform/is-mobile/dom/viewport 等测试编写。

## 7. 项目流程与分支策略（从上下文推断）
- 本包处于 rush monorepo 中，版本管理、构建与发布均由仓库顶层配置统一控制；
- 没有在子包中定义单独的发布脚本，通常在 feature 分支上修改后通过统一 CI（构建 + lint + test）校验；
- 变更应遵循仓库根目录的 CONTRIBUTING.md 与 CODE_OF_CONDUCT.md 中的要求（如提交信息规范、Code Review 流程等）。

## 8. 非常规/特殊点总结
- 依赖大量全局变量（IS_OVERSEA、APP_ID、IMAGE_FALLBACK_HOST、BYTE_UPLOADER_REGION 等），这些在测试中通过 setup.ts 注入，在真实运行时由宿主应用提供；AI 不应在本包随意改动这些常量名或语义。
- 部分逻辑直接依赖 window/document/navigator/location，且没有防御性判断，意味着工具函数不是通用 Node 工具；在 SSR/Node 环境使用时须由调用侧负责保护。
- message-report 中的时序控制与 gate 标志较复杂（_receivingMessages/_receivingSuggests/_hasReceiveFirstChunk 等），若需要改动，请优先读完文件头部注释并保持状态机不被破坏。
- 部分函数存在 TODO/@Deprecated 注释（retryImport、safeJSONParse、exhaustiveCheck），这些代表历史兼容或临时方案，应尽量不再新增依赖，必要时在调用侧迁移到更安全的新接口（如 typeSafeJSONParse）。
