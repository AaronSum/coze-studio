# Copilot Instructions – `@coze-arch/stylelint-config`

## 1. 全局结构与定位

- 本包是 Coze 前端 Monorepo 的 **统一 Stylelint 配置中心**，为所有使用 CSS/Less（含 Tailwind）的项目提供一套约定俗成的样式规范。
- 核心角色：
  - 对外暴露一个基础配置（`@coze-arch/stylelint-config`），下游项目可以直接 `extends` 使用，或通过 `defineConfig` 进行增强。
  - 内部集成多份社区配置与自定义插件，统一管理选择器命名、嵌套深度、`:global` 使用方式、`!important` 禁用等规则。
- 主要文件/目录（根据 README）：
  - 根目录：
    - README.md：使用说明与规则示例。
    - `.stylelintrc.js` 示例写法由 README 给出。
  - 规则与插件：
    - 内置依赖的规则集：`stylelint-config-standard`, `stylelint-config-standard-less`, `stylelint-config-clean-order`, `stylelint-config-rational-order`。
    - 自定义插件目录：`plugins/plugin-disallow-nesting-level-one-global.js`，用于禁止一级 `:global`。
  - 可能存在 `examples/`：
    - 用于通过 `rush stylelint-config example` 运行示例校验。

整体结构原则：**将风格与约束集中在一个配置包中，下游项目通过简单 `extends` 即可获得完整规则，避免散落在各项目的 Stylelint 配置碎片化。**

## 2. 关键开发工作流（build / test / debug）

- 在任意前端子包中使用本配置的标准流程：
  1. 在 `package.json` 中声明依赖：
     ```json
     {
       "devDependencies": {
         "@coze-arch/stylelint-config": "workspace:*"
       }
     }
     ```
  2. 在仓库根目录执行：
     ```bash
     rush update
     ```
  3. 在子包根目录创建 `.stylelintrc.js`：
     ```js
     const { defineConfig } = require('@coze-arch/stylelint-config');

     module.exports = defineConfig({
       extends: [],
       rules: {
         // 包内少量新增/覆盖规则
       }
     });
     ```
     或最简用法：
     ```js
     module.exports = {
       extends: ['@coze-arch/stylelint-config'],
     };
     ```
- 在本包自身验证规则：
  - README 中提供命令：
    ```bash
    rush stylelint-config example
    ```
    该命令会对 `examples/` 下示例文件运行 Stylelint，验证配置是否正常工作。
  - 调试方式：
    - 在 `examples/` 中添加/修改样例 Less/CSS 文件，看 Stylelint 报错是否符合预期（例如 BEM 命名、嵌套深度限制）。
- 在下游包中运行 Stylelint（常见做法）：
  - 通常会在各子包 `package.json` 中定义脚本，如：
    ```json
    {
      "scripts": {
        "lint:style": "stylelint \"src/**/*.{css,less}\""
      }
    }
    ```
  - 这些脚本默认使用本包提供的配置，AI 修改脚本时应保持与该用法兼容。

## 3. 项目特有约定与模式

- **类名 BEM 约定**（关键约束）：
  - 模式：`$block-$element_$modifier`
  - 有效示例：
    ```css
    .button {}
    .button-large {}
    .button-large_disabled {}
    .nav-item {}
    .nav-item_active {}
    ```
  - 无效示例：
    ```css
    .Button {}
    .button_large_disabled {}
    .nav-item-active-disabled {}
    .camelCaseClass {}
    ```
  - AI 生成类名时，应始终遵循此命名风格（小写、连字符分 block/element，下划线分 modifier）。
- **嵌套深度限制**：
  - 最大允许嵌套 3 层（不计伪类）。
  - 合法：
    ```less
    .component {
      .header {
        .title {
          color: blue;
        }
      }
    }
    ```
  - 非法（过深）：
    ```less
    .component {
      .header {
        .title {
          .text {
            .span { // ❌ 第四层
              color: blue;
            }
          }
        }
      }
    }
    ```
  - AI 生成 Less/嵌套 CSS 时，应尽量在 2–3 层内解决结构，通过 BEM 组合类而不是用深层嵌套。
- **禁止一级 `:global`**：
  - 禁止：
    ```less
    :global {
      .some-class {
        color: red;
      }
    }
    ```
  - 允许：
    ```less
    .component {
      :global {
        .some-class {
          color: red;
        }
      }
    }
    ```
  - 即：`:global` 只能嵌套在组件作用域下，不能作为顶层选择器使用。AI 在需要全局类时，应放进局部 `.component { :global { ... } }` 块中。
- **禁止 `!important`**：
  - 任何 `!important` 使用都视为错误：
    ```css
    /* ❌ */
    .class {
      color: red !important;
    }
    ```
  - AI 需要优先通过更具体的选择器 / 结构设计解决覆盖问题，而非引入 `!important`。
- **Less + Tailwind 混用约定**：
  - 支持在 Less 中使用 Tailwind 的 `@apply`：
    ```less
    .custom-component {
      @apply flex items-center justify-between;

      &-item {
        @apply px-4 py-2 rounded;

        &_active {
          @apply bg-blue-500 text-white;
        }
      }
    }
    ```
  - AI 生成样式时，可以安全地在符合 BEM 结构的类中使用 `@apply`，但仍要遵守嵌套深度和命名规则。

## 4. 关键组件与外部依赖整合

- 集成的 Stylelint 配置：
  - `stylelint-config-standard`：
    - 通用 CSS 规范基础。
  - `stylelint-config-standard-less`：
    - Less 特有语法支持（变量、嵌套、mixin 等）。
  - `stylelint-config-clean-order` 与 `stylelint-config-rational-order`：
    - 属性排序规则，保证属性声明顺序统一。
- 自定义插件：
  - `plugins/plugin-disallow-nesting-level-one-global.js`：
    - 针对项目的 CSS 模块 / 作用域策略，禁止顶层 `:global`，强制所有全局样式从组件内部“开洞”。
    - 修改此插件时务必确保：
      - 不要误拦截合法的内部 `:global` 用法；
      - 与当前 Less/模块样式编译链（例如 CSS Modules / Rspack Loader）保持兼容。
- 与 Tailwind 的关系：
  - README 明确指出“Tailwind Compatible”，意味着：
    - 禁止规则与 `@apply` / Tailwind Utility Class 不冲突；
    - AI 在类名选择上仍需遵守 BEM 规则（Tailwind utility 通常在模板中使用，这里的 BEM 主要约束本项目自定义样式类）。

## 5. 项目流程与协作规范

- 变更规范（针对 `team-arch`, `level-1` 配置包）：
  - 修改规则会影响大量下游包，应在 PR 中：
    - 明确说明修改的规则项（例如“允许第四层嵌套”或“放宽 BEM 命名”）；
    - 如有示例，优先在 `examples/` 下添加对应用例。
  - 尽量使用“**增加 override 配置**”而不是直接删除核心规则，保持项目整体风格。
- 下游项目使用规范：
  - 推荐统一通过：
    ```js
    const { defineConfig } = require('@coze-arch/stylelint-config');
    module.exports = defineConfig({...});
    ```
    而不是在每个项目里自己罗列 `extends: [...]`。
  - 如某个业务线需要额外约束，可在 `rules` 中增加，而不要在本包中硬编码特定业务逻辑。
- 与仓库整体流程的关系：
  - 虽然根级说明文件（如 CLAUDE.md）未直接约束 Stylelint，但 Monorepo 使用 Rush 统一管理脚本是通用规则：
    - AI 添加新脚本或钩子时，应与现有脚本命名风格保持一致（如采用 `lint:style` / `lint` 组合）。

## 6. 特殊点与注意事项

- **这是前端样式规则的单一入口**：
  - 新项目/包只要 `extends: ['@coze-arch/stylelint-config']` 就能获得全部约束。
  - AI 创建新包时，应默认复用此配置，而不是引入新的第三方 stylelint 规则集。
- **强意见化（opinionated）**：
  - BEM 命名、嵌套深度 3 层、禁 `!important`、禁顶层 `:global` 都是高度意见化规则。
  - AI 不应随意降低这些约束；如果确有需求，应该考虑：
    - 在单个项目局部 override；
    - 或在本配置中新增“可选扩展 preset”（而非直接放宽全局规则）。
- **适用 Less 为主，兼容 Tailwind**：
  - 绝大多数示例使用 Less 语法；AI 生成示例/文档应优先用 Less，而不是纯 CSS 或 Sass。
- **无运行时依赖**：
  - 所有依赖均为开发依赖；本包不会在运行时代码中被引用，仅参与构建/检查阶段。
  - 这意味着可以放心地在规则中引用较重的开发依赖（只要不影响 CI 性能）。
