# @coze-arch/i18n：AI 编程助手协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/i18n）中安全、高效地协作开发。

## 1. 子包定位与角色

- 位置：frontend/packages/arch/i18n
- 包名：@coze-arch/i18n
- 角色：整个前端 monorepo 的统一国际化（i18n）能力中心，负责：
  - 基于 i18next 的核心多语言能力封装
  - Coze Studio 自己的资源适配（@coze-studio/studio-i18n-resource-adapter）
  - 与设计系统 @coze-arch/coze-design 的文案/语言集成
  - 对业务包暴露统一的 I18n API、类型以及 React Provider

任何修改都应假设：**这是全局通用基础设施，变更会影响大量下游包**。

## 2. 全局架构与数据流

### 2.1 模块结构

核心目录结构（简化）：

- src/index.ts
  - 导出高阶封装后的 I18n 实例（FlowIntl）
  - 包装自 src/intl 下的底层实现
  - 暴露类型：I18nKeysNoOptionsType / I18nKeysHasOptionsType
- src/intl/
  - index.ts：导出底层 i18n 实例、构造器和类型（IIntlInitOptions、IntlModuleType、IntlModule、I18nCore 等）
  - i18n.ts / i18n-impl.ts / types.ts：i18next + 语言检测 + ICU + 资源适配的具体实现（通过 @coze-studio/studio-i18n-resource-adapter 间接集成）
- src/resource.ts
  - locale 资源的统一出口，供 edenx.config.ts 或其他配置使用（README 中以 locale 引用）
- src/i18n-provider/
  - index.tsx：React 侧入口，封装 I18nProvider
  - context.ts：I18n React 上下文定义
- src/raw/
  - index.ts 等：为“独立应用模式”（非 Eden.js）提供低层 initI18nInstance、I18n 等原始接口
- global.d.ts
  - 声明全局类型，用于在应用代码中直接使用 i18n 相关类型

### 2.2 I18n 调用链

典型调用链：

1. 应用通过两种模式之一初始化：
   - Eden.js 模式：在 edenx.config.ts 中配置 intl，并使用从 ./locales（src/resource.ts）导出的 locale 作为 resources。
   - Standalone 模式：通过 @coze-arch/i18n/raw 导出的 initI18nInstance 手动初始化。
2. 初始化时，底层调用 src/intl 中的 I18n 实现，注册插件（语言检测、ICU、资源适配）并创建 i18nInstance。
3. 上层通过 src/index.ts 导出的 I18n（FlowIntl 实例）访问：
   - t(key, options?, fallbackText?)
   - setLang / setLangWithPromise
   - language / getLanguages / dir / addResourceBundle
4. React 组件通过 I18nProvider + i18nContext，把 I18n 实例注入到组件树及 @coze-arch/coze-design 组件中。

### 2.3 类型系统与资源映射

- 文案 key 与参数类型来源：@coze-studio/studio-i18n-resource-adapter 提供的 LocaleData / I18nOptionsMap。
- 在 src/index.ts 中：
  - I18n.t 使用函数重载区分：
    - 无参数 key：I18nKeysNoOptionsType，options 形参被放宽为 Record<string, unknown>（历史代码兼容）。
    - 需要参数 key：I18nKeysHasOptionsType，并基于 I18nOptionsMap 生成 options 的精确类型。
- 资源拉取流程：
  - 通过 monorepo 级命令 rush pull-i18n 从远端同步多语言资源文件，写入 src/resource/locales/。
  - 同步后会自动生成/更新 TypeScript 类型（由适配器 / 脚本负责）。

## 3. 开发与运行工作流

### 3.1 包内脚本

在 frontend/packages/arch/i18n 目录下，可用 npm scripts：

- 构建（当前占位）：
  - npm run build
    - 实现为 exit 0，本包实际构建依赖上层 Rush / Rsbuild 配置，一般不在子包单独构建。
- Lint：
  - npm run lint
    - 使用 eslint.config.js + @coze-arch/eslint-config。
- 单元测试：
  - npm run test
    - 使用 vitest，配置位于 vitest.config.ts，继承 @coze-arch/vitest-config，preset 为 web。
  - npm run test:cov
    - 运行 test 并生成覆盖率，覆盖率配置中排除了 src/resource/ 与脚本文件 script/dl-i18n.js。

在大多数场景下，**推荐从 monorepo 顶层使用 Rush 命令**：

- rushx test -p @coze-arch/i18n 或类似命令（依照全仓 Rush 约定）。
- rush pull-i18n 同步远程 i18n 资源（README 中说明）。

### 3.2 调试与本地验证

- 这是一个无 UI 的基础库包，本地验证方式通常为：
  - 为新功能/回归问题补充 Vitest 单测；
  - 在下游包（例如 frontend/packages/devops/debug/debug-panel 等）中通过 I18n.t 实际调用验证翻译结果和类型推断。
- vitest.config.ts 中覆盖率 all: true，意味着新增代码最好补充对应测试，以避免整体覆盖率下降（resource 和脚本目录已显式排除）。

## 4. 项目特定约定与模式

### 4.1 I18n API 封装约定

- FlowIntl（src/index.ts）是对底层 I18n 的轻量封装：
  - 目的：
    - 为 I18n.t 提供更强的类型约束（基于 LocaleData / I18nOptionsMap）。
    - 保持与 edenx/plugin-starling-intl/runtime 的接口一致以便迁移或复用。
  - 设计约束：
    - 不在此层直接耦合业务逻辑，仅做类型与 API 封装。
    - 变更此类方法（尤其 t 的重载签名）时，必须确保下游包类型检查通过。

### 4.2 翻译 key 与 options 的类型约定

- key 分为两类：
  - I18nKeysNoOptionsType：不需要插值参数；历史代码中可能仍传入 {}，因此 options 不能是 never，目前统一为 Record<string, unknown> 用于兼容。
  - I18nKeysHasOptionsType：必须提供 options，类型从 I18nOptionsMap<K> 推导。
- 若要引入新的 key 分类或类型规则，应首先在 @coze-studio/studio-i18n-resource-adapter 中扩展，然后在本包中消费。

### 4.3 React Provider 与设计系统集成

- I18nProvider（src/i18n-provider/index.tsx）：
  - 同时包裹：
    - CDLocaleProvider（来自 @coze-arch/coze-design/locales）。
    - i18nContext.Provider：向 React 子树暴露 i18n 实例。
  - 约定：
    - i18n 属性必须提供 Intl 类型实例（一般为从 @coze-arch/i18n 导出的 I18n）。
    - children 仅包裹 UI 子树，不进行其他副作用处理。
  - 默认兜底：未传入 i18n 时，内部使用一个 t(k) => k 的兜底实现，**仅用于开发容错，不应用于生产配置**。

### 4.4 资源同步与类型生成

- 资源来源：远端 i18n 系统（公司内部平台），由 rush pull-i18n 同步。
- 资源落地位置：src/resource/locales/（在 README 中有说明）。
- 类型生成：由 @coze-studio/studio-i18n-resource-adapter 及相关脚本自动完成，不建议在本包手工维护翻译 key 类型。

## 5. 外部依赖与集成细节

### 5.1 i18next 及其插件

- 依赖：
  - i18next
  - i18next-browser-languagedetector
  - i18next-icu
- 具体集成逻辑位于 src/intl 目录：
  - 初始化时配置检测策略（浏览器语言、localStorage 等，见实现文件）。
  - ICU 插件用于处理复杂占位符和复数/选择逻辑。
  - 若需要变更语言检测或 ICU 行为，应在 src/intl 中修改，而非直接在 src/index.ts。

### 5.2 @coze-studio/studio-i18n-resource-adapter

- 提供：
  - LocaleData：所有 locale key 的联合类型。
  - I18nOptionsMap：key 到 options 类型的映射。
- 本包在 src/index.ts 中使用这些类型：
  - I18nOptions<K> = I18nOptionsMap[K] 的条件类型封装。
  - 用于 I18n.t 的类型重载定义。
- 任何对该适配器版本或导出内容的变更，可能会在本包引发广泛类型变化，需要全仓类型检查。

### 5.3 @coze-arch/coze-design

- 本包不直接输出 UI 组件，而是通过 CDLocaleProvider 将 i18n 实例注入到设计系统：
  - 设计系统内部会使用传入的 i18n.t 渲染文案。
  - 不要在本包内书写与 UI 具体样式或布局相关的代码。

## 6. 测试与质量要求

- 测试框架：Vitest（统一由 @coze-arch/vitest-config 管理）。
- vitest.config.ts：
  - preset: 'web'，用于浏览器环境相关测试配置。
  - coverage.all: true，需关注新增代码的覆盖率。
  - exclude: ['starling.config.js', 'src/resource', 'script/dl-i18n.js']：资源文件和下载脚本默认不计入覆盖率。
- 约定：
  - 修改 I18n.t 行为、语言切换逻辑、资源注入逻辑时，应增加或更新单测，覆盖：
    - 不同 key 类型（有无 options）。
    - 异步语言切换（setLangWithPromise）。
    - 资源 bundle 的合并/覆盖行为（addResourceBundle）。

## 7. 版本管理、提交流程与注意事项

- 这是 Rush monorepo 中的一个 workspace 包：
  - 版本号由 rush.json + 相关发布流程统一管理；
  - 不要在本包内独立发布 npm 版本。
- 代码规范：
  - 使用 eslint.config.js + @coze-arch/eslint-config，遵循 monorepo 通用规范。
  - TypeScript 配置由 @coze-arch/ts-config 统一管理，tsconfig.build.json / tsconfig.json / tsconfig.misc.json 仅做包级定制。
- 提交前：
  - 至少在包内运行 npm run lint 与 npm run test；
  - 若更改 i18n 行为，对核心依赖包（如 devops/debug/debug-panel、agent-ide/workflow-* 等）做一次基本功能验证，以防回归。

## 8. 编程助手使用建议

在本子包中进行自动化修改或生成代码时，请遵循以下原则：

1. **保持 API 稳定**
   - 避免在未充分评估影响的情况下修改导出接口（尤其是 I18n.t、I18nProvider、I18nKeys* 类型）。
   - 如必须变更，先在本包内引入兼容层（例如新增重载而不是直接替换）。

2. **优先补充测试**
   - 对 i18n 行为变更，应通过 Vitest 单测锁定预期输出，而不是仅依赖手动验证。

3. **尊重资源来源与类型生成机制**
   - 不要直接在 src/resource/locales/ 内手写或编辑翻译文件；应通过 rush pull-i18n 同步。
   - 不要在本包内手工维护翻译 key 类型，统一依赖 @coze-studio/studio-i18n-resource-adapter。

4. **与下游包协同思考**
   - 任何 I18n 行为变化，都应考虑下游典型使用场景（如 debug-panel、workflow-* 等包中使用 I18n.t 的位置）。
   - 在需要时，可以先在下游包中添加回归测试，再回到本包修改实现。

遵循上述约定，可以帮助 AI 编程助手在保证稳定性的前提下高效地改进该 i18n 基础设施。
