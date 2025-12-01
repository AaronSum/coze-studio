# frontend/config/tailwind-config / copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/config/tailwind-config）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本子包位于 Rush/PNPM monorepo 的前端配置层：frontend/config/tailwind-config，对外提供可复用的 TailwindCSS 主题配置与插件。
- package.json 的导出：
  - 主入口 . → src/index.js：基础 Tailwind config（darkMode、theme.extend 等）。
  - ./coze → src/coze.js：绑定到全局 :root/.dark 的 Tailwind 插件版本。
  - ./util → src/util.js：可自定义根选择器的 Tailwind 插件工厂（genTailwindPlugin）。
  - ./design-token → src/design-token.ts：从设计 Token JSON 生成 Tailwind theme 片段的工具方法。
- 典型使用场景：其他前端 app 在 tailwind.config.{js,ts} 中直接 require/import 这些导出以获得统一的 Coze 设计系统表现。

## 2. 全局架构与数据流
- 配置维度：
  - src/index.js 定义 Tailwind 的 darkMode、prefix、content 默认扫描范围，以及 theme.extend 内的大量 colors / spacing / fontSize 等，所有值依赖 CSS 变量 (--coze-* / --foreground / --background 等)。
  - light.js / dark.js（未在此文件展开）分别声明 light / dark 主题下的底层 CSS 变量值（多数是 RGB 三元组），index.js 只消费变量、不关心具体数值。
- 插件维度：
  - src/coze.js 使用 tailwindcss/plugin：
    - 从 light.js / dark.js 读取变量，生成 :root 与 .dark 的 CSS 变量声明。
    - 声明多组语义映射对象（semanticForeground、semanticMiddleground、semanticBackground、semanticStroke、semanticShadow、buttonRounded、inputRounded、inputHeight）。
    - 通过 generateCssVariables 将上述映射转成 CSS 变量（--coz-fg-...），通过 generateSemanticVariables 注册以 .coz-* 为前缀的语义工具类（color、background-color、border-color、box-shadow、border-radius、height）。
  - src/util.js 与 coze.js 逻辑高度相似，但导出 genTailwindPlugin(defaultCls, darkCls)：
    - 允许调用方自定义 light/dark 根选择器（例如 :root / .dark 或 .coze-root / .coze-root-dark），适配嵌套挂载、微前端等场景。
- 设计 Token 维度：
  - src/design-token.ts 提供 designTokenToTailwindConfig(tokenJson)：
    - 输入 tokenJson.palette 与 tokenJson.tokens，拆分 color / spacing / border-radius 三大类进行转换。
    - colorTransformer：
      - 支持按 theme（如 light/dark）拆分，并把 token key 中的 -color- 后缀去掉拼上 theme 生成新颜色 key（如 primary-color-brand + light → primary-brand-light）。
      - 用 genColorValueFormatter 将 value 中的 var(...) 替换为来自 palette[theme] 中的真实十六进制值。
    - spacingTransformer：去除 key 中的 $spacing- 前缀；borderRadiusTransformer：去除 --semi-border-radius- 前缀。
  - getTailwindContents(projectRoot)（src/tailwind-contents.ts）：
    - 依赖 @coze-arch/monorepo-kits，扫描所有包含 react 依赖的子包，收集其 src/**/*.{ts,tsx} 作为 content 路径，同时兼容内部 @coze-arch/coze-design 的 node_modules 样式。

## 3. 开发与构建流程
- 本子包本身没有实际 build/test 流程：
  - package.json 中 build / test / test:cov 均为 exit，占位用；真正构建由上层 Rush 工程或消费端工具链负责。
- 常用脚本：
  - lint：npm run lint 或 pnpm lint → 使用 workspace 级别的 @coze-arch/eslint-config，对 JS/TS 源码进行检查。
- 在 Rush 根目录典型流程（需结合仓库总体文档）：
  - 安装依赖：rush update。
  - 针对单包开发时，可在 monorepo 顶层使用 rushx 调用此包脚本（若有配置）。本包目前仅本地开发时直接在子目录运行 npm/pnpm 命令即可。

## 4. 项目特有约定与模式
- 主题与颜色：
  - 颜色统一以 CSS 变量 + rgba(var(--coze-xxx), alpha) 形式存在；index.js 内的 colors 字段仅指向这些变量，禁止在 theme.extend 中直接写硬编码色值。
  - 所有前景/背景/功能色分层：foreground / background / brand / red / yellow / green / emerald / orange / alternative / cyan / blue / purple / magenta / black / white / stroke / mask / icon / fornax 等，编号（0–9、50/30 等）均有语义划分：
    - 7/6/5 通常为主用、高亮色。
    - 3/2/1/0 往往作为 hover/pressed/弱化层。
- 语义类命名：
  - 前景类：coz-fg-*；中景（按钮/卡片/hover 背景等）：coz-mg-*；背景：coz-bg-*；描边：coz-stroke-*；阴影：coz-shadow-*；按钮圆角：coz-btn-rounded-*；输入圆角/高度：coz-input-rounded-* / coz-input-height-*。
  - 这些语义类**必须**通过 semantic* 映射使用 theme('...') 取值，而不是直接 hard code 色值或 px 数值，以保证 theme 可替换和暗色模式统一生效。
- 插件封装模式：
  - coze.js 和 util.js 都复用了 generateCssVariables / generateSemanticVariables 模式：先把主题变量写到 :root/.dark，再用 addUtilities 声明具体 .coz-* 工具类。
  - genTailwindPlugin(defaultCls, darkCls) 是对 coze.js 的通用化版本，新加插件时应优先在 util.js 中追加语义映射，然后根据需要暴露为新的导出，避免复制 coze.js 中的实现。
- 设计 Token 转换约定：
  - designTokenToTailwindConfig 只负责「结构转换」，不会改动业务含义；对于 token 命名（如 $spacing-xx, --semi-border-radius-xx）有硬编码前缀清洗逻辑，新接入的设计系统需遵循同样命名或在此处增强转换逻辑。
  - color token 必须通过 var(...) 指向 palette 中的 key，否则将原样返回（不进行替换）。

## 5. 外部依赖与集成要点
- Tailwind / PostCSS：
  - 依赖 tailwindcss ~3.3.3、@tailwindcss/forms、@tailwindcss/nesting、postcss、postcss-loader、autoprefixer；本包只提供配置与插件，不直接创建构建管线。
- Monorepo 工具：
  - @coze-arch/monorepo-kits 在 src/tailwind-contents.ts 中用于：
    - lookupSubPackages(projectRoot)：扫描子包。
    - getPackageJson(p)：读每个子包的 package.json，用于筛选依赖 react 的包。
    - getPackageLocation(p)：获取子包物理路径，拼接 src/**/*.{ts,tsx} 以供 Tailwind content 使用。
- UI 组件库：
  - getTailwindContents 自动加入 ./node_modules/@coze-arch/coze-design/**/*.{js,jsx}，用于扫描内部组件库 className，避免 tree-shaking 掉必要样式。

## 6. 开发注意事项与安全边界
- 不要在 index.js 中修改 light/dark 变量的具体数值；颜色/尺寸数据应集中维护在 light.js / dark.js 中，以免破坏设计统一性。
- 修改或新增语义类时：
  - 首先在 semantic* 对象中定义映射（确保值使用 theme('...') 可解析的路径，例如 colors.brand.5）。
  - 确认 addBase / addUtilities 已覆盖对应 semantic* 集合，不要遗漏导致 class 无效。
- 变更 design-token.ts 时：
  - 保持函数签名稳定（designTokenToTailwindConfig(tokenJson) / getTailwindContents(projectRoot) / 导出的类型结构）以兼容已有上层调用。
  - 若增加新的 token 类别（如 typography），务必明确约定 key 命名，并在 switch 中新增 transformer，避免默认分支静默丢弃。
- getTailwindContents(projectRoot)：
  - 调用方必须传入 monorepo 根目录或应用根路径；内部会抛出 Error('projectRoot is required') 以防误用。
  - 仅将依赖 react 的子包加入 content，这一筛选逻辑是有意为之，避免扫描纯工具包提升构建耗时。

## 7. 团队流程与约束（本子包维度）
- Lint 规范统一依赖 @coze-arch/eslint-config，保持与全仓一致；生成代码或自动重构时应遵循现有风格（CommonJS + ESM 混用，目前 src 中 index/coze/util 为 CJS，design-token/tailwind-contents 为 TS/ESM，由上层打包工具统一处理）。
- 代码头部版权/License 注释（Apache-2.0）在 TS/JS 源文件中已存在；新增文件时建议保持同样的 License 头部格式。
- 暂未在此包内发现单独的测试框架或特定分支策略/发布命名，仅作为 monorepo 下的配置子模块参与整体发布；在自动提交变更前，至少应保证 lint 通过，且不破坏现有导出接口。

## 8. 适合 AI Agent 的任务示例
- 为新增的业务场景扩展语义类（如新增某种状态的按钮/标签颜色），在 src/coze.js 与 src/util.js 中添加对应 semantic* 映射，并确保依赖的 theme 路径存在。
- 在 design-token.ts 中支持新的 token 结构（例如引入 typography token），仿照 spacingTransformer/borderRadiusTransformer 添加对应转换函数。
- 优化 getTailwindContents 的筛选逻辑（例如增加对特定文件夹的白名单），但需谨慎保持向后兼容。
