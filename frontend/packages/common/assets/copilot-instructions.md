# @coze-common/assets 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/assets）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本包位于 Coze Studio 前端 monorepo 的 common 层，用于提供全局可复用的静态资源与样式：图片、SVG、通用 Less 变量与 mixin 等。
- 典型使用场景：其他应用或包通过 `@coze-common/assets` 统一引用视觉资源和基础样式，避免在各处散落复制。
- 与业务逻辑解耦：本包不包含 React 组件或业务逻辑，仅承担「视觉资产与样式基础设施」职责。

目录结构（省略 node_modules 等）：
- README.md：人类向包说明，内容偏通用，可忽略其中“utilities”描述，以本文件为准。
- image/：PNG、JPG 等位图资源。
- svg/：SVG 图标与插画资源。
- style/：全局 Less 样式入口及变量、mixin 定义。
- eslint.config.js、.stylelintrc.js：本包的代码/样式规范配置。
- tsconfig*.json：参与前端整体 TS project references，但当前包本身不暴露 TS 源码。

## 2. 核心结构与数据流
### 2.1 样式层结构
关键路径：
- style/index.less：对外暴露的主入口，通常在上层应用或基础样式入口中被一次性引入。
- style/variables.less：颜色、字号、间距等全局变量定义，是主题和统一视觉的基础。
- style/mixins.less：通用 Less mixin（如多行省略、清除浮动、统一滚动条样式等）。
- style/common.less：共享的基础样式片段，可被上层全局样式继承或覆盖。
- style/tailwind.less：与 Tailwind 体系的胶水层，用于在 Less 与原子类方案之间统一变量/前缀等（若存在 Tailwind 相关变量或 reset）。
- style/image-colors.less：围绕图片 / 插画使用的特定色值或辅助类（例如灰度蒙层、背景渐变等）。

约定性数据流：
- 上层应用只需要 import `style/index.less`，即可间接获得 variables/mixins/common 等全部定义；请避免在应用内直接深入 import 某个子文件，除非明确需要局部能力。
- 若需要新增一套全局变量或通用样式，应在 variables.less / mixins.less / common.less 中扩展，并在 index.less 中合理组织导入顺序，保证变量先于依赖它的样式导入。

### 2.2 资源层结构
- image/：为页面背景、图标位图、示意图等提供规范化路径；文件名通常直接表达业务含义，如 `coze_home_bg_light.png`、`bind-card-preview.png`。
- svg/：为 Agent、Widget 等统一提供矢量图标（如 `default-agent-logo.svg`、`icon_ai.svg` 等），在上层组件中通过 URL 或 bundler 的 `import`/`new URL` 引入。

资源引用路径约定：
- 统一通过 bundler 的资源处理能力引用，如：
  - Less 中使用 `url("~@coze-common/assets/image/xxx.png")` 或构建系统约定的别名写法。
  - TypeScript/JSX 中通过 `import logo from '@coze-common/assets/svg/default-agent-logo.svg';`。
- 不建议跨包直接访问相对路径（例如 `../../common/assets/image/...`），一律通过 package 名称访问，确保可维护性与 Rush workspace 兼容。

## 3. 开发与构建流程
### 3.1 脚本与构建
package.json 中定义：
- `build`: 当前为 `exit 0`，本包没有独立的构建产物；构建逻辑由上层应用或统一构建体系（Rsbuild）处理。本包的职责是“被消费”的资源集合。
- `lint`: `eslint ./ --cache`，对 JS/TS 文件执行 eslint（本包当前几乎没有源码，主要保障未来扩展时规范统一）。

在 monorepo 中的典型操作：
- 安装/更新依赖：在 repo 根目录执行 `rush install` / `rush update`。
- 针对本包执行 lint：
  - 在前端根目录使用 Rush：`rushx lint --to @coze-common/assets`（根据仓库 rushx 约定，若有全局 lint 命令）。
  - 或进入子包目录后直接执行 `pnpm lint` / `npm run lint`（取决于根级工具链）。

本包无单独测试/构建命令，所有构建行为由上层应用在打包时进行整合。

### 3.2 本地开发建议
- 新增样式/资源后，通常无需对本包执行 build，只需在消费方应用中 `rushx dev` / `npm run dev`，由 Rsbuild 重新打包即可看到效果。
- 当修改 Less 变量或 mixin 时，应同时在主要消费方应用（如 frontend/apps/coze-studio）中验证常见页面，避免引入全局视觉回归。

## 4. 代码与样式规范
### 4.1 ESLint / TypeScript
- 使用 monorepo 统一的 `@coze-arch/eslint-config` 与 `@coze-arch/ts-config`：
  - 若未来在本包中增加 TS/JS 源码，应遵循这些共享配置，不在本包内定义自有规则。
- tsconfig.json 仅用于建立 TS project references：
  - `compilerOptions.composite = true`，且通过 `references` 指向 `tsconfig.build.json` 与 `tsconfig.misc.json`。
  - `exclude: ["**/*"]` 表示本主 tsconfig 不直接参与编译，真正的编译配置在引用的 build/misc 配置中，由整体工具链控制；AI 不需要为本包单独新增 tsconfig，除非与现有模式一致。

### 4.2 样式规范（Stylelint / Less）
- .stylelintrc.js 继承 `@coze-arch/stylelint-config`：新增 Less 文件或类名时应尽量遵循已有命名风格（通常偏 BEM 或业务前缀，如 `.coze-xxx`）。
- 通用规则：
  - 公共变量统一放在 `style/variables.less` 中，避免在其他文件中硬编码颜色或尺寸。
  - 复用型逻辑样式写在 `style/mixins.less`，通过 mixin 调用，避免复制粘贴。
  - 全局性的 reset/基础布局类收敛到 `style/common.less`，防止在业务包内重复定义。

## 5. 与上层系统的集成方式
### 5.1 与 Coze Studio 应用的关系
- 主应用 [frontend/apps/coze-studio](frontend/apps/coze-studio) 以及其他 packages 可将本包视为「全局 design assets」：
  - 在它们自己的样式入口中 import `@coze-common/assets/style/index.less`，以获得统一变量和基础样式。
  - 在组件中 `import` svg/png/jpg 用作图标、背景或兜底图。
- 该包与 `@coze-arch/coze-design`（UI 组件库）、`@coze-arch/i18n` 等属于同一设计系统生态层面，但更偏「资源仓库」而非「交互组件」。

### 5.2 外部依赖与运行时特性
- package.json 中的 React 相关 devDependencies 只是为了对齐 monorepo 的类型环境与工具链，不意味着本包会直接渲染 React 组件。
- 运行时不需要额外初始化逻辑：
  - 引入本包不会执行 JS 代码，只有静态资源与 Less 被 bundler 处理。
  - 因此在集成时无需担心副作用，只需确保构建配置正确处理 Less 与静态资源。

## 6. 项目流程与约定
### 6.1 覆盖率与等级约束（level-1）
- 根据 frontend/rushx-config.json：
  - level-1 包的覆盖率目标较高（如 coverage ≥ 80%，增量 ≥ 90%），但本包目前不包含可测的逻辑代码，通常不需要新增测试文件。
  - 如果未来引入 TS/JS 逻辑，应按照 level-1 规范添加测试，并遵循全局 vitest/jest 配置。

### 6.2 变更与评审
- 由于本包影响范围广（全局视觉与变量），任何修改都可能产生大规模 UI 回归：
  - 在调整变量或 common 样式前，优先在业务包中做小范围实验，再上升为全局变量。
  - 对公共资源（如默认头像、兜底图）替换时，请确认所有使用场景都接受新的视觉效果。
- Git 分支/提交规范遵循仓库根部文档和 CI 规则（参考 [frontend/README.md](frontend/README.md) 与根级 CONTRIBUTING）。AI 生成修改时应保持提交粒度小、变更范围清晰。

## 7. AI 助手使用注意事项
- 修改或新增样式时：
  - 优先复用 `variables.less` 中已有变量，若新增变量请命名清晰并说明用途（例如 `@color-widget-bg-secondary`）。
  - 避免在业务包中复制变量数值；如果发现重复色值，倾向于在本包集中抽象变量，再在业务处引用。
- 新增图片/SVG 时：
  - 放入对应目录（image/ 或 svg/），命名体现用途与主题（如 `widget-no-content-dark.svg`）。
  - 不要在本包中写死具体业务 ID/环境信息，保持资源的通用性。
- 不要在本包中新增与业务强耦合的逻辑 / 组件：
  - 这会破坏「通用 assets」定位，应放到对应业务包中（例如 studio、agent-ide 等）。
