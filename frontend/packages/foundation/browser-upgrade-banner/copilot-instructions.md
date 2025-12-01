# AI 协作开发说明 - @coze-foundation/browser-upgrade-banner

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/browser-upgrade-banner）中安全、高效地协作开发。

## 全局架构与数据流
- 本包是 Coze Studio 前端 monorepo 中的基础设施子包之一，仅提供一个 React 包裹组件 BrowserUpgradeWrap，由 src/index.tsx 统一导出。
- 组件主要结构：
  - src/components/browser-upgrade-wrap/index.tsx：核心 UI 和业务逻辑，负责检测浏览器版本、上报埋点、展示/关闭升级条幅，并对 children 区域做高度适配。
  - src/utils/index.ts：基于 detect-browser 的浏览器版本识别与升级建议逻辑，输出 testLowVersionBrowse。
  - src/utils/compare-version.ts：通用版本号比较工具，按 "x.y.z" 逐段比较。
  - src/utils/is-mobile.ts：通过 UA 判定是否为移动端，目前 testLowVersionBrowse 仅走 PC 逻辑，为后续扩展预留。
  - src/constants/index.ts：定义埋点事件名 EventNames，用于统一日志上报。
- 运行时数据流：
  - BrowserUpgradeWrap 在首次渲染时调用 testLowVersionBrowse()，内部使用 detect(navigator.userAgent) 检测浏览器 name/version，并与 PC_VERSION_CONFIG 中的阈值比较；若版本过低，返回 downloadUrl。
  - 若检测到低版本：
    - 通过 @coze-arch/logger 的 reporter.event 上报 EventNames.BrowserUpgradeTipsVisible。
    - 将 { url: downloadUrl, visible: true } 写入本地 state bannerInfo。
  - 用户点击「升级」按钮：
    - 上报 EventNames.BrowserUpgradeClick。
    - 通过 window.open(bannerInfo.url) 打开下载地址（境内/海外由全局 IS_OVERSEA 决定）。
  - 用户点击关闭按钮：仅在本地 state 中设置 visible=false，不做持久化关闭；业务如需记忆关闭行为，应在上层或后续扩展实现。
  - children 容器高度通过 bannerHeight 进行补偿：外层容器高度为 calc(100% - bannerHeightpx)，确保顶部插入条幅后内容区域仍然充满剩余空间。

## 开发与构建工作流
- 依赖安装：在仓库根目录执行 rush install 或 rush update，统一由 Rush + PNPM 管理，子包自身不单独执行 pnpm install。
- 本包 package.json 脚本：
  - lint: 使用工作区 ESLint 配置（@coze-arch/eslint-config），命令为 npm run lint（rushx lint 在上层可配置）。
  - test: 使用 Vitest + @coze-arch/vitest-config 预设，命令为 npm run test 或 rushx test。
  - test:cov: 在 test 基础上加 --coverage，依赖 @vitest/coverage-v8。
  - build: 当前为占位实现（exit 0），真实打包由上层构建系统（Rsbuild / bundler）驱动；不要在此子包内试图接管打包流程。
- Storybook：
  - 存在 .storybook/main.js 和 preview.js，说明支持 Storybook 集成，但 README.md 中列出的 dev / build 命令与当前 package.json 不完全一致，且未定义 dev / build 脚本；AI 在修改文档或脚本时应以实际 package.json 为准，避免凭 README 推断不存在的命令。
- 编译配置：
  - tsconfig.json 仅声明 references 指向 tsconfig.build.json 与 tsconfig.misc.json，且 exclude: ["**/*"]，真实编译选项在 workspace 级别的 @coze-arch/ts-config 与 tsconfig.build.json 内，由 Rsbuild/TS 项目引用；不要在此文件中随意开启额外编译输出。
- 测试框架：
  - vitest.config.ts 通过 @coze-arch/vitest-config.defineConfig 统一注入 Jest-DOM、React Testing Library 等配置；新增测试时放在 __tests__ 目录或与组件同级，遵守仓库通用测试命名约定（如 *.test.tsx）。

## 项目约定与代码风格
- 语言与框架：React 18 + TypeScript，使用函数式组件与 Hooks（useState/useEffect/useRef），不使用 class 组件。
- 类型与接口：
  - BrowserUpgradeWrap 的外部 props 当前被定义为 Record<string, unknown> 且未暴露更详细类型；若需要扩展，请优先补充明确的 props 接口，而不是用 any。
  - 工具函数（如 compareVersion、isMobileFromUA）均有明确的入参/返回类型，新增工具保持同样模式。
- 样式：
  - 使用 CSS Modules（index.module.less），通过 classNames 合并类名；类名形如 banner-wrapper、flex-helper 等，遵循已有命名风格，避免切换到 Tailwind 或内联样式。
  - 样式规范由 @coze-arch/stylelint-config 管控，对应本包根目录 .stylelintrc.js；如新增样式文件，保持 .less + Modules 形式。
- i18n：
  - 文案通过 @coze-arch/i18n 的 I18n.t('browser_upgrade') / I18n.t('browser_upgrade_button') 获取；新增文本必须走 I18n.t，而非硬编码中文或英文。
- 日志与埋点：
  - 埋点统一用 @coze-arch/logger 的 reporter.event，并在 src/constants/index.ts 中定义事件名枚举 EventNames；如需新增埋点，先加枚举，再在组件内引用，避免散落的字符串常量。
- 运行环境约定：
  - 依赖 navigator.userAgent、window.open 和全局 IS_OVERSEA，因此组件仅适用于浏览器环境；如果引入服务端渲染或单测环境，注意 mock navigator 和全局变量，避免在模块顶层直接访问 window/navigator（目前 testPCVersion 在运行时 useEffect 中调用，已规避 SSR 首屏问题）。

## 关键依赖与集成点
- detect-browser：
  - 用于识别浏览器 name / version，结果类型为 Browser；版本阈值配置在 PC_VERSION_CONFIG 中维护，键名应与 detect-browser 的 name 字段保持一致（如 'chrome'、'edge-chromium'、'safari'）。
  - 如需支持新浏览器或修改阈值，请只改常量，不改变核心判断流程（compareVersion + configVersion）。
- @coze-arch/coze-design/icons：
  - 提供 IconCozCross 关闭按钮图标，仅用于 UI 显示；若替换图标，优先选用 coze-design 内置图标，保证风格一致。
- @coze-arch/i18n：
  - 与 Studio 全局 i18n 体系一致，本包不单独配置语言包；通常由宿主应用（如 foundation/global-adapter）提前初始化。
- @coze-arch/logger：
  - reporter.event({ eventName }) 只上报事件名，不在本包内绑定业务 ID 或上下文信息；扩展埋点字段时，应先确认全局埋点规范。
- 与其它包的关系：
  - 在 frontend/packages/foundation/global-adapter/src/components/global-layout/index.tsx 中被引用，用于在全局布局层包裹应用并插入浏览器升级条幅；修改 API 时必须考虑该调用方，避免 breaking change。

## 维护与扩展注意事项
- 不要在本包内引入与浏览器升级无关的通用逻辑（如通用 UA 解析封装、全局埋点封装），这些应放在更通用的 common/arch 包中。
- 扩展点示例：
  - 支持移动端单独的版本策略：可以在 src/utils/index.ts 中基于 isMobileFromUA 区分 PC / Mobile 的版本配置与下载 URL，但保持 testLowVersionBrowse 的返回结构不变。
  - 记忆关闭行为：可以在 handleBannerClose 内接入 localStorage / cookie 或通过回调透出给上游，但建议新增可选 props（如 onClose / persistKey），避免直接在本包强绑定存储策略。
- 与仓库流程相关：
  - 代码所有者在 .github/CODEOWNERS 中配置为 foundation/browser-upgrade-banner 对应的负责人；AI 修改涉及对外行为（事件名、阈值、公开 API）时，应在描述/注释中清晰说明变更意图，方便代码审查。
- 非常规点（AI 需要特别注意）：
  - tsconfig.json 故意 exclude 全部文件，真实构建由上层项目引用 tsconfig.build.json 完成；不要误以为本包未启用 TS 编译而尝试临时开启 outDir 等选项。
  - package.json 的 main 指向 src/index.tsx，而不是构建产物；在 monorepo 内由 bundler/tsconfig.path 等解析，这在独立发布时可能不同，但当前场景下不要擅自改为 dist 目录。
