# @coze-common/biz-tooltip-ui 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/biz-tooltip-ui）中安全、高效地协作开发。

## 全局架构与职责边界
- 本子包是一个独立的 React UI 组件包，定位为「业务场景提示 Tooltip UI」，当前主要导出 RewriteTips 与 RerankTips 组件。
- 入口文件为 src/index.tsx，仅做组件再导出：从 src/components/setting-tips/index.ts 聚合 RewriteTips、RerankTips，对外形成稳定 API。
- 业务 UI 组件集中放在 src/components/setting-tips/ 中：
  - case-block.tsx：通用案例块展示组件 CaseBlock，负责标题 + 内容排版，使用 CSS Modules + Tailwind Utility 类混合布局。
  - rewrite-tips.tsx：具体的「改写提示」组件 RewriteTips，内部维护案例列表，通过 I18n.t 读取多语言文案并组合成多个 CaseBlock。
  - index.module.less：本包样式入口，提供 tips-headline、case-block-label、rewrite-block-content 等业务样式类。
- 多语言依赖通过 @coze-arch/i18n 注入，组件内部不直接持有业务文案，只依赖 key（如 kl_write_034 等），确保 UI 与文案资源解耦。
- 测试与文档：
  - 单元测试位于 __tests__/components/ 目录，使用 vitest + @testing-library/react，对各个业务组件做渲染与行为校验。
  - Storybook 配置在 .storybook/ 下，通过 stories 目录中的故事文件进行交互与视觉验证。

## 开发与构建工作流
- 包管理与依赖：
  - 本仓库整体由 Rush 管理，新增依赖需遵守 Rush 流程；本子包自身的 package.json 仅声明局部依赖与脚本。
- 本子包常用脚本（在包目录内执行）：
  - 安装/更新依赖：在仓库根目录执行 rush update，由 Rush 统一安装 workspace:* 依赖。
  - 单元测试：npm run test（或 rushx test），底层为 vitest --run --passWithNoTests，对 __tests__ 目录进行测试。
  - 覆盖率：npm run test:cov，等价于 npm run test -- --coverage，使用 @vitest/coverage-v8。
  - 构建：当前 package.json 中 build 为占位命令（exit 0），真正的打包/发布由上层基础设施统一处理；在子包内不要擅自引入自定义打包链路。
  - Lint：npm run lint，基于 @coze-arch/eslint-config 与 @coze-arch/stylelint-config，规则由团队统一维护。
- TypeScript 与编译：
  - tsconfig.json 继承 @coze-arch/ts-config/tsconfig.web.json，仅调整 rootDir、outDir、types 等；不要随意修改基础 tsconfig，优先通过本地 overrides（compilerOptions 内）满足需求。
  - 编译输出目录为 dist/，但在 monorepo 中常由统一构建工具使用各子包 tsconfig.build.json 生成产物。
- 测试配置：
  - vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig，preset: 'web'；新增测试时应兼容该预设，不要额外引入与全局预设冲突的配置。

## 项目约定与代码风格
- 语言与框架：
  - 使用 React 18 + TypeScript，函数式组件为主，Props 与内部状态尽量类型明确；本包的 peerDependencies 要保持与主应用 React 版本一致。
- 组件设计约定：
  - 展示型组件优先保持「傻瓜组件」形式：通过 props 接收文案和内容，仅负责排版；复杂逻辑或数据组装在更上层组件中处理。
  - 业务 key（如 kl_write_0xx）统一通过 I18n.t 获取，不在组件内部写死文案字符串；新增文案时仅增加 key，避免破坏现有行为。
  - 布局采用 Tailwind Utility 类与 CSS Modules 共存策略：通用间距/布局用 className="flex ..." 等原子类，业务风格类放在 index.module.less 中。
- 样式规范：
  - CSS Modules 文件命名使用 *.module.less，类名使用 kebab-case；在 TSX 内通过 s['class-name'] 访问，避免与 JS 保留字冲突。
  - 样式检查由 stylelint + @coze-arch/stylelint-config 提供，新增样式时应遵循现有变量与命名习惯，避免在子包内定义全局样式。
- 代码规范：
  - eslint.config.js 通过 @coze-arch/eslint-config.defineConfig({ preset: 'web' }) 配置，只在必要时在 rules 字段中按包覆盖；不要在本包重复定义通用规则。
  - 严格启用 strictNullChecks、noImplicitAny 等 TS 检查；新增类型须显式声明，避免 any 滥用。

## 外部依赖与集成方式
- @coze-arch/i18n：
  - 通过 I18n.t('key') 获取多语言文本，本包不负责配置语言环境或注入资源；调用方需保证全局 I18n 已经初始化。
  - 在组件内部只引用已有 key；若要新增 key，应在上层 i18n 资源文件中补充，而不是在此包内维护。
- classnames：
  - 用于组合动态 className，建议在需要按条件拼接 Tailwind 类或 CSS Modules 类时使用；当前简单组件中不一定使用，但保持依赖以支持未来扩展。
- React / ReactDOM：
  - 作为 peerDependencies 暴露给上层应用，本包只使用 React API，不直接操作 DOM；如需挂载到 Storybook，则交由 .storybook 及主应用处理。
- 测试相关依赖：
  - @testing-library/react / @testing-library/jest-dom 等仅用于单元测试，写新测试时沿用现有断言与渲染模式。
- Storybook：
  - .storybook/main.js 使用 @storybook/react-vite + vite-plugin-svgr，支持在 stories 中直接 import SVG 作为 React 组件；如果增加新的图标或交互组件，建议通过 Storybook 添加入门示例。

## 开发流程与协作规范
- 变更范围控制：
  - 在本子包内做修改时，应尽量将影响限制在 src/components/setting-tips/ 与相关样式文件，避免跨包修改上游基础配置；如确需改动公共配置（如 @coze-arch/*），应遵循相应包的贡献规范。
- 分支与提交（参考主仓库约定）：
  - 通常采用 feature/xxx 或 fix/xxx 等分支命名，由 Rush monorepo 统一管理发布节奏；在编写说明时假定遵守主仓库贡献文档（CONTRIBUTING.md）。
- 校验流程：
  - 提交前至少在本包执行 npm run lint 与 npm run test，确保 TypeScript、ESLint、Stylelint 与 vitest 均通过；必要时在仓库根目录跑 Rush 级别的检查任务。

## 扩展与修改建议（面向 AI 助手）
- 新增业务提示组件：
  - 如果需要新增类似 RewriteTips/RerankTips 的组件，应：
    - 在 src/components/setting-tips/ 下创建新 TSX 文件，内部通过 I18n.t 读取多语言 key，使用 CaseBlock 或其他通用组件进行布局；
    - 在 index.ts 中导出新组件，并在 src/index.tsx 中同步导出，保持统一对外 API；
    - 为新组件补充 __tests__/components/ 下的测试文件，以及 stories 目录中的 Storybook 示例（如存在 stories 体系）。
- 修改现有文案或样式：
  - 文案变更应优先调整 i18n 资源文件对应 key 的内容，而不是修改组件结构；
  - 样式改动应集中在 index.module.less 内，保持类名含义清晰，必要时复用 Tailwind Utility 类以减少自定义样式行数。
- 与上层应用集成：
  - 使用方只需从 @coze-common/biz-tooltip-ui 导入对应组件，并在已初始化 I18n 的 React 应用中渲染；不要在使用方重复引入 @coze-arch/i18n 实例。

## 非常规或需注意的点
- build 脚本占位：
  - package.json 中的 build 仅为占位（exit 0），不要在本包内实现独立打包逻辑；真正的构建行为由仓库级工具链（Rush + 构建系统）负责。
- 统一配置包：
  - eslint、stylelint、tsconfig、vitest 等均依赖 @coze-arch/* 配置包，这些包隐藏了大量默认行为；在修改配置时，首先查阅对应配置包的文档或源码，避免在本子包做大范围覆盖。
- 版权与 License：
  - 所有源码文件头部包含统一的 Apache-2.0 License 注释；新增文件时应保持一致。
