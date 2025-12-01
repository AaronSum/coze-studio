# bot-tea 子包开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-tea）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是 Coze Studio 前端 monorepo 的架构子包之一，定位为「Bot 相关 Tea 埋点封装层」，不直接承载 UI，只对外提供埋点工具函数与类型导出。
- 主要依赖：
  - @coze-arch/tea：统一的 Tea 埋点 SDK 与事件类型定义，是本包最核心的依赖；约定了 EVENT_NAMES、UserGrowthEventParams、ParamsTypeDefine 等类型与 TeaNew.sendEvent 调用方式。
  - @coze-arch/bot-api：Bot & 模板领域 API 与领域枚举，例如 ProductEntityType、ProductInfo 等，用于从后端协议结构中提取并转换埋点字段。
  - @coze-arch/logger：monorepo 内统一日志工具，用于在发送埋点前记录 meta 信息，方便排查问题。
- 代码组织：
  - [src/index.ts](src/index.ts)：包主入口，重新导出 @coze-arch/tea 中的一系列事件常量与类型，并提供 UG 埋点增强工具（LandingPageUrl 维护 / sendTeaEvent 封装），是大多数上层业务的唯一入口。
  - [src/utils.ts](src/utils.ts)：与 Bot/模板场景强相关的参数构造工具，如模板类型转换、模板埋点公共参数抽取。
  - [src/global.d.ts](src/global.d.ts)：用于补充本包运行环境的全局声明（例如特性开关、window / location 等浏览器全局）；在修改运行环境相关逻辑前应优先确认此处声明。
- 数据流：
  - 业务页面调用本包导出的工具函数（如 sendTeaEvent、extractTemplateActionCommonParams），本包基于 ProductInfo 等领域对象构造埋点参数，统一补齐 UG 所需公共字段（LandingPageUrl / AppId / EventTs 等），通过 TeaNew.sendEvent 下发给埋点 SDK。
  - 本包不会直接发起网络请求，所有网络与持久化行为均由 @coze-arch/tea 或浏览器环境（sessionStorage）完成。

## 核心模块与关键函数

- Landing Page URL 管理（UG 埋点关键字段）：
  - 常量键：LANDING_PAGE_URL_KEY，固定为 'coze_landing_page_url'，用于 sessionStorage 存取。
  - initBotLandingPageUrl：
    - 语义为「会话首次落地页 URL 初始化」。
    - 若 sessionStorage 中尚无 LANDING_PAGE_URL_KEY，则写入当前 location.href；若已有值则不覆盖（即使用户打开新页面）。
    - 调用时机通常在应用入口或 Bot 入口首次渲染时，由上层应用负责保证只需调用一次（幂等设计允许多次调用但不覆盖已有值）。
  - getBotLandingPageUrl：
    - 返回 sessionStorage 中已保存的 LandingPageUrl；若不存在则回退为当前 location.href。
    - 所有需要 UG LandingPageUrl 的事件，请统一通过该函数获取，避免自行从 location 读取导致含义不一。
- sendTeaEvent：统一埋点发送入口：
  - 泛型签名：sendTeaEvent<TEventName extends EVENT_NAMES>(event: TEventName, rawParams?: ParamsTypeDefine[TEventName])。
  - 入参 event 必须是 @coze-arch/tea 定义的 EVENT_NAMES 成员；rawParams 类型严格受 ParamsTypeDefine[event] 约束。
  - 行为：
    - 根据全局特性开关 FEATURE_ENABLE_TEA_UG 判断是否需要叠加 UG 扩展参数（UserGrowthEventParams）：
      - LandingPageUrl：来自 getBotLandingPageUrl。
      - AppId：对 UG 约定的固定值 510023，请勿随意修改。
      - EventName：即传入的 event。
      - EventTs：Date.now() / 1000 向下取整的秒级时间戳。
      - growth_deepevent：固定值 '4'。
    - 若开启 UG，则通过对象展开将 ugParams 与 rawParams 合并（rawParams 优先级更高，用于允许额外字段覆盖同名 UG 字段，如确有需要）。
    - 通过 logger.info 打印结构化日志：{ message: 'send-tea-event', meta: { event, params } }，方便本地调试与线上排查。
    - 最终调用 TeaNew.sendEvent(event, params)。
  - 类型收紧：通过 @ts-expect-error 标注扩展了 ParamsTypeDefine 之外的 UG 字段，调用侧仍以 Tea 的 ParamsTypeDefine 为准；新增事件或参数时请优先到 @coze-arch/tea 中更新类型定义。
- 模板埋点工具：
  - convertTemplateType：
    - 输入：@coze-arch/bot-api/product_api 中的 ProductEntityType（例如 WorkflowTemplateV2 / ImageflowTemplateV2 / BotTemplate / ProjectTemplate）。
    - 输出：ParamsTypeDefine[EVENT_NAMES.template_action_front]['template_type'] 对应的字符串枚举（'workflow' | 'imageflow' | 'bot' | 'project' | 'unknown'）。
    - 默认分支返回 'unknown'，用于兜底未来未识别的枚举值，避免埋点上报失败。
  - extractTemplateActionCommonParams：
    - 输入：可选的 ProductInfo，通常为模板详情接口返回对象。
    - 行为：
      - 使用 query-string.parse(location.search) 解析 URL 查询参数，抽取 from 字段（若不存在则为空字符串）。
      - 从 detail.meta_info 中提取一系列字段，构造成模板埋点公共参数：
        - template_id / entity_id / template_name / template_type。
        - 若 entity_type 为 ProjectTemplate，则追加 entity_copy_id（来自 detail.project_extra.template_project_id）。
        - template_tag_professional：根据 is_professional 映射为 'professional' 或 'basic'。
        - template_tag_prize / template_prize_detail：根据 is_free 与 price.amount 区分免费或付费模板。
      - 最终返回的对象使用 as const 断言，方便下游维持字面量类型信息。
    - 该函数只做映射与安全兜底（大量使用可选链与默认值），不会抛出异常；上层在缺少 detail 时也能拿到结构完整但值为空的埋点对象。

## 构建、测试与调试流程

- 构建
  - package.json 中的本地 build 脚本目前为占位实现："build": "exit 0"，实际打包通常由 monorepo 顶层构建流程处理（例如 Rush 命令或应用打包脚本）。
  - 若需要在本包内新增构建产物，请对齐 monorepo 通用 TS 构建方案，并更新 tsconfig.build.json；在未明确要求前，不建议私自添加自定义 bundler。
- Lint
  - 本包使用集中维护的 ESLint 配置：@coze-arch/eslint-config，预设 preset 为 'web'。
  - 本地执行：
    - 在 frontend 根目录使用 rush / pnpm 安装依赖后，进入本包目录执行：npm run lint。
  - 默认启用缓存（--cache），新增规则请直接在 eslint.config.js 的 rules 字段中追加，保持与其他 arch 包风格一致。
- 单元测试
  - 测试框架：Vitest，配置通过 @coze-arch/vitest-config 统一管理，预设 preset 为 'web'。
  - 本包配置：
    - [vitest.config.ts](vitest.config.ts) 中通过 defineConfig({ dirname: __dirname, preset: 'web', test: { coverage: { all: true } } }) 开启全量覆盖统计，确保未被引用的文件也被纳入覆盖率。
  - 执行命令：
    - npm test：运行全部测试用例（__tests__ 目录下）。
    - npm run test:cov：在上面的基础上生成覆盖率报告。
  - 代码覆盖率要求：
    - 根据 [frontend/rushx-config.json](frontend/rushx-config.json) 中的配置，本包标签为 ["team-arch", "level-2"]，对应的最低覆盖率为 coverage >= 30%，增量覆盖率 >= 60%。在扩展本包功能时，应优先为行为复杂的工具函数补充测试。
- 调试建议
  - 在开发新埋点或参数映射时，优先通过 logger.info 日志观察 sendTeaEvent 的 meta 内容，确认 event 与 params 是否符合预期。
  - 利用 Vitest 针对 convertTemplateType 与 extractTemplateActionCommonParams 编写单元测试，覆盖不同 ProductEntityType、免费/付费模板、from 参数缺失等边界情况。

## 项目约定与风格

- TypeScript 与类型安全：
  - 严格依赖 @coze-arch/tea 提供的 EVENT_NAMES 与 ParamsTypeDefine，不在本包内自行声明事件名称或事件参数类型；新增事件时，请先在 Tea 包中完成定义，再在本包进行导出或封装。
  - 对外 API 尽量导出类型（如 ParamsTypeDefine、EVENT_NAMES）而非重新声明，保持单一事实来源，避免跨包类型漂移。
- 浏览器环境假设：
  - 本包假定运行在浏览器环境：直接使用 window、location、sessionStorage 等对象，不做 SSR / Node 兼容处理。
  - 在非浏览器场景（如 Node 端渲染）使用本包之前，需由上层调用方自行隔离调用或提供 polyfill；AI 助手在进行跨端改造时应明确这一点，避免默认为可在 Node 运行。
- 常量与枚举映射：
  - 统一通过 ProductEntityType → template_type 的映射函数维护枚举关系，禁止在业务侧手写字符串枚举（如 'workflow' / 'bot' 等）；若后端新增实体类型，应在 convertTemplateType 中同步映射并补充测试。
- 安全兜底策略：
  - 所有来源于后端或 URL 的字段，都使用可选链与默认值（'' / 0 / 'unknown' 等）兜底，避免因字段缺失导致运行时异常或上报中断。
  - 不在本包中抛出业务异常；出错时应尽量返回结构完整但值为空/兜底的对象，由上游业务决定是否展示错误提示。
- 日志与隐私：
  - logger.info 日志仅记录事件名与参数对象，不应写入用户敏感信息（如明文令牌、手机号等）。
  - 若新增参数包含潜在敏感信息，应在参数层面进行脱敏或避免记录到 meta 中。

## 与其他子包的集成关系

- 与 @coze-arch/tea：
  - 本包实际上是 Tea SDK 在「Bot / 模板业务域」上的一层语义封装与类型 re-export。
  - 直接从 @coze-arch/tea 转出大量事件与类型（EVENT_NAMES, AddWorkflowToStoreEntry, ExploreBotCardCommonParams 等），上层在需要 Tea 原始能力时可以从本包引入，保持域内聚合。
  - 若 Tea 包升级事件命名或参数结构，需要同步检查本包的 re-export 与工具函数签名是否仍然兼容。
- 与 @coze-arch/bot-api：
  - 只在 utils 层使用 product_api 中的 ProductEntityType / ProductInfo，用于将后端协议转换为埋点所需字段结构。
  - 新增 API 字段映射时，应保持「API → utils → sendTeaEvent」这一条链路清晰，不要在业务组件中直接对 ProductInfo 进行埋点字段解构。
- 与 @coze-arch/logger：
  - 仅作为事件发送前的调试/追踪手段，不依赖 logger 的返回值。
  - 如果需要为不同类型事件引入差异化日志格式，应集中在 sendTeaEvent 内部完成，业务侧不要自行调用 logger 记录 Tea 事件。

## 测试与质量控制约定

- 测试目录结构：
  - [__tests__/index.test.ts](__tests__/index.test.ts)：
    - 通常用于测试主入口导出的公共 API（如 sendTeaEvent、initBotLandingPageUrl / getBotLandingPageUrl 等），需要在测试中通过 mock logger / TeaNew 来断言调用参数，而不是依赖真实网络行为。
  - [__tests__/utils.test.ts](__tests__/utils.test.ts)：
    - 聚焦 convertTemplateType、extractTemplateActionCommonParams 等纯函数；通过构造不同 ProductInfo / URL 参数组合覆盖边界逻辑。
- 测试风格：
  - 使用 Vitest 的 describe / it / expect API，与 monorepo 内其他前端包保持一致。
  - 对于返回值为 as const 的工具函数，推荐断言精确字面量类型（toEqual + 类型提示），防止无意更改字段名或字段类型。
- 覆盖率与质量门禁：
  - 由于本包等级为 level-2，在新增功能或重构时，应确保新增代码拥有相应测试，避免覆盖率在 MR 中下降到阈值以下。

## 仓库流程与协作规范（与 monorepo 一致的部分）

- 依赖管理：
  - 所有依赖通过 Rush 统一管理；在修改本包依赖（dependencies / devDependencies）后，应在 frontend 目录下执行 rush update 以刷新 lockfile。
  - 若引入第三方埋点/统计库，应优先评估是否可以通过 @coze-arch/tea 或其他现有封装实现，避免在本包中直接集成新的 SDK。
- 分支与提交：
  - 具体分支策略、提交规范等请参考仓库根目录的 CONTRIBUTING.md 与团队内部规范；AI 助手在本子包范围内修改代码时，应保持变更最小化、聚焦单一需求，方便 code review。
- 部署与发布：
  - 本包作为 arch 层工具库，通常不会被单独部署；随前端应用构建一并发布。
  - 包版本与发布节奏由 monorepo 顶层流程控制，禁止在子包内手动修改版本号并单独发布。

## 特色与注意事项总结

- 埋点 UG 增强逻辑通过 FEATURE_ENABLE_TEA_UG 开关受控，AI 助手在做埋点相关改动时要注意保持该开关语义不变（"开启时追加 UG 字段"，而非改变事件本身含义）。
- LandingPageUrl 的定义为「用户首次点击进入的页面 URL」，即使后续打开新页面也不应覆盖；任何关于入口来源的需求都应优先复用 initBotLandingPageUrl / getBotLandingPageUrl，而不是重新发明入口识别逻辑。
- 所有「Bot / 模板」相关的埋点参数构造，优先在本包集中维护，避免分散在各个业务包里形成重复且不一致的实现。
- 若需要引入新的埋点场景或字段，通常的改动顺序应为：更新 @coze-arch/tea 类型 → 在本包导出或封装 → 在上层业务中调用；请避免直接在业务中使用 Tea 的底层 API 而绕过本包。
