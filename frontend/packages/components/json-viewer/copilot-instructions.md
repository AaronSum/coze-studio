# @coze-common/json-viewer copilot 使用说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/json-viewer）中安全、高效地协作开发。

## 全局架构与数据流

- 本子包提供一个通用的 JSON 查看组件 `JsonViewer`，入口位于 src/index.tsx，对外导出 React 组件及类型 JsonValueType，并复导出常量 LogObjSpecialKey、LogValueStyleType（定义在 src/constants.ts）。
- 组件的核心数据模型为 `Field`（定义在 src/types.ts），通过 `generateFields`（src/utils/generate-field.ts）把任意 `JsonValueType`（string/null/number/object/boolean/undefined 以及 BigNumber 等对象）转换为一棵字段树：每个节点记录路径 path、分行状态 lines、原始值 value、子节点 children 以及是否为可展开对象 isObj。
- 视图层由 `JsonField`、`TextField` 等子组件组成（src/components），`JsonField` 负责渲染单个字段节点及其展开/折叠交互，`TextField` 负责多行纯文本展示；长文本、行号、缩进连接线等细节也在该目录下的子组件中实现。
- 展开状态由 `JsonViewerContext` 统一管理（src/context.tsx），使用 use-context-selector 提供细粒度订阅，避免整棵树重复渲染：上层 `JsonViewerProvider` 维护 `expand: Record<string, boolean> | null`，子组件通过 context 读写展开状态。
- `JsonViewer` 的渲染流程：
  - data 为 null/undefined：直接渲染一个 JsonField，值为 "Null"；
  - data 为 string：分行后交给 TextField 渲染；
  - 其他（object/array/number/boolean/BigNumber 等）：先用 generateFields 生成 Field 列表，再包裹在 JsonViewerProvider 中，逐个渲染 JsonField。
- 展开逻辑：
  - `generateInitialExpandValue` 在 fields 更新时决定初始展开状态：若 `defaultExpandAllFields` 为 true，则递归标记所有 field 的 path 为展开；若根只有一个对象节点，则默认展开该节点；
  - `JsonViewerProvider` 通过 useEffect 监听 fields 和 defaultExpandAllFields，在首次渲染或 expand 为空时计算并写入初始展开 map。

## 开发与构建工作流

- 包管理与依赖：本仓库整体由 Rush 管理，该子包的包信息见 package.json，依赖若为 workspace:\* 表示在 monorepo 其他子包中定义（如 @coze-arch/bot-semi、@coze-arch/i18n 等）。
- TypeScript 配置：
  - tsconfig.json 仅用于 project references，排除所有源码（exclude: ["**/*"]），真正的编译配置在 tsconfig.build.json 与 tsconfig.misc.json。
  - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，编译 src 到 dist，并引用 arch 层及 config 层的 tsconfig 以参与增量编译。
  - tsconfig.misc.json 用于测试、stories 与配置文件（**tests**、stories、vitest.config.ts 等），types 包含 vitest/globals。
- 测试：
  - 运行单元测试：在子包根目录执行 `npm test` 或 `npx vitest --run`；
  - 测试框架由 vitest.config.ts 中的 `@coze-arch/vitest-config` 统一封装，preset 为 `web`，并开启 `coverage.all = true`；
  - 主要测试文件位于 **tests**/index.test.tsx，使用 @testing-library/react / jest-dom，对 JsonViewer 的空值、字符串、多行文本、普通对象、错误/警告样式、数字与 BigNumber 渲染行为进行验证。
- 构建：
  - 当前 package.json 中的 `build` 命令为 `exit 0`，实际产物构建通常由上层工具链（rush、统一构建脚本）驱动；如需在本包内增加自定义构建逻辑，应与现有 monorepo 构建流程保持兼容（参考同级其他组件包）。
- Lint：
  - 使用 eslint.config.js 与 @coze-arch/eslint-config；在本包内运行 `npm run lint` 对源码进行检查，注意遵循半角引号、import 顺序、React 相关 best practice 等统一规范。

## 项目约定与实现模式

- 类型与数据模型：
  - 所有对外暴露的数据类型在 src/types.ts 中集中定义；内部逻辑尽量使用 Field 等结构，而不是直接操作原始 JSON，方便后续维护与扩展（如新增状态、样式标签）。
  - 路径统一采用 string[]，而不是 "a.b.c" 字符串，避免 key 本身包含点号造成的误判。
- 展开状态管理：
  - 展开/折叠状态不挂在单个 JsonField 上，而是通过 JsonViewerContext 统一管理，这一点在修改展开逻辑（默认展开策略、批量展开等）时需要优先考虑；
  - `setExpandAllFields` 使用 reduce + 递归，始终根据 Field.children 结构生成一个平铺的 path -> true map，新增字段时要保证 children 结构正确，否则会导致展开状态缺失。
- 特殊 key 与样式约定：
  - src/constants.ts 定义了日志相关的特殊 key 与样式类型（如错误/警告等），JsonField 通过这些常量判断是否为错误/警告并打上对应的 CSS 类（如 is-error、is-warning）；
  - 测试中通过 `field-content`、`field-value` 的 data-testid 和 className 断言这些样式，新增样式类型（例如 info/success）时，应同步扩展常量、组件逻辑和测试用例。
- 文本渲染：
  - 简单字符串 data 由 TextField 渲染，多行文本通过 `\n` 分割成段落，并为每个段落打上 data-testid='json-viewer-text-field-paragraph' 便于测试；
  - 复杂对象中的字符串则在 JsonField 内做转义显示（例如测试中断言 "第一段文本\\n 第二段文本"），避免在树视图中直接换行影响布局。
- 数字与 BigNumber：
  - 对于 BigNumber 对象，组件逻辑会尝试以数字样式渲染（参考 **tests**/index.test.tsx 中的用例），并统一使用 `field-value-number` 类名；
  - 在实现中应当优先调用 BigNumber 实例的 toString() 或相关高精度 API，而不是依赖隐式转换。

## 关键组件与外部依赖

- React 与 hooks：
  - 使用 React 18（peerDependencies >=18.2.0），函数式组件为主，状态管理主要通过 useState/useEffect/useCallback 实现；
  - use-context-selector 用于创建 JsonViewerContext，从而让子组件仅订阅需要的部分，减少重渲染。
- UI 与样式：
  - 底层 UI 依赖 @coze-arch/bot-semi（Semi UI 定制版），但该包中的大部分逻辑以 CSS Module（index.module.less）为主，不直接暴露 Semi 组件；
  - CSS 使用 Less + CSS Modules，样式类名通过 styles['json-viewer-wrapper']、styles['xxx'] 访问，测试中仅通过 className 包含某些片段来做断言（不依赖完整 hash）。
- 工具库：
  - lodash-es 用于 isNil、isString、noop 等常见工具；
  - classnames 用于条件拼接 className；
  - BigNumber.js 在测试与组件中统一用于大数字表示与渲染。

## 测试与调试注意事项

- 单元测试：优先在 **tests**/index.test.tsx 基础上新增/扩展用例，保持对 data 类型与渲染分支的高覆盖度（null/undefined/string/object/array/BigNumber/错误警告样式等）。
- 渲染断言：统一使用 data-testid（如 json-viewer-wrapper、json-viewer-field-value、json-viewer-field-content、json-viewer-text-field-paragraph）进行选择，避免依赖复杂的 DOM 结构层级，降低未来重构成本。
- 展开逻辑：若修改 generateFields 或 JsonViewerProvider 的展开策略，请增加针对 defaultExpandAllFields、单根节点自动展开、多根节点不自动展开等场景的测试。

## 项目流程与协作规范

- 版权与 License：所有源码文件头部带有 Apache 2.0 License 注释，在新增文件（tsx/ts/配置）时应保持一致。
- 分支与提交：整体遵循仓库上层规范（参考根目录 README/CONTRIBUTING），本子包没有单独的分支策略约束；提交前至少本地通过 `npm run lint` 与 `npm test`。
- Storybook：本子包包含 stories 目录与 .storybook 配置（用于组件展示与手动测试），如需增加交互示例，应优先通过 stories 展示典型 JSON 场景（大对象、错误日志、嵌套数组等），以便设计与产品协同。

## 其他特性与注意点

- Draggable 包裹：JsonViewer 外层 div 设置了 `draggable`，并在 onDragStart 中主动 stopPropagation 与 preventDefault，避免在上层拖拽容器中误触发，修改时须谨慎，确保不破坏日志/控制台场景下的拖拽体验。
- Null 统一文案：无论 data 为 null 还是 undefined，最终渲染文案统一为 "Null"（测试已覆盖此行为），如需改动需同时更新多处逻辑与用例。
- 向后兼容：由于该组件被定位为通用 json viewer（可供日志查看、控制台、调试面板等多场景复用），在修改 Field 结构、展开逻辑或特殊 key 规范时，建议查阅全仓对 `@coze-common/json-viewer` 的使用方式，避免破坏其它子包。
