# mockset-shared 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/mockset-shared）中安全、高效地协作开发。

## 1. 子包定位与全局架构关系

- 本包名称：`@coze-studio/mockset-shared`，位于 mockset 相关功能的「共享逻辑层」，为 mockset 编辑器、模态框适配器等上层 UI 提供类型、常量与核心数据处理工具函数。
- 主要导出入口位于 `src/index.ts`，对外统一暴露：
  - 类型与枚举：`MockDataValueType`、`MockDataStatus`、`MockDataWithStatus`、`MockDataInfo`、`BizCtxInfo` 等。
  - 常量：`FORMAT_SPACE_SETTING`、`MAX_SUBMIT_LENGTH`、`RANDOM_BOOL_THRESHOLD`、`STRING_DISPLAY_PREFIX/ SUFFIX`、`RANDOM_SEQUENCE_LENGTH`、`ROOT_KEY`、`MOCK_SET_ERR_CODE` 等。
  - 工具函数：`parseToolSchema`、`calcStringSize`、`getArrayItemKey`、`getMockValue`、`transSchema2DataWithStatus`、`transDataWithStatus2Object`、`stringifyEditorContent`、`getEnvironment`、`getMockSubjectInfo`、`getPluginInfo`。
- 依赖关系：
  - 与调试域 API：依赖 `@coze-arch/bot-api/debugger_api` 中的 `MockRule`、`TrafficScene`、`ComponentSubject` 等类型，是 mock 调试能力与 UI 表达之间的桥梁。
  - 与 JSON Schema：依赖 `json-schema` 的 `JSONSchema7` 类型，将工具/接口 schema 与内部的 mock 数据结构相互转换。
  - 与业务上下文：通过 `BizCtxInfo`（在 `src/types/interface.ts`）封装业务空间 ID、流量场景、扩展字段 `ext.mockSubjectInfo` 等，驱动 `getPluginInfo` / `getMockSubjectInfo` 的路由逻辑。
- 关键数据流：
  - 外部提供 JSON Schema（通常来自工具或接口定义）与 `MockRule` → 使用 `parseToolSchema` 和 `transSchema2DataWithStatus` 生成带状态的树形 mock 数据结构（`MockDataWithStatus`），用于前端编辑和展示。
  - 用户在 UI 中编辑后的 `MockDataWithStatus` 树 → 使用 `transDataWithStatus2Object` 还原为纯对象结构，结合 `stringifyEditorContent` / `calcStringSize` 做入库存储或调用调试 API。
  - 业务上下文 `BizCtxInfo` + 组件主体 `ComponentSubject` → 使用 `getPluginInfo` / `getMockSubjectInfo` 推导插件/工具 ID、空间 ID 等，按不同 `TrafficScene` （单 Agent / 多 Agent / Workflow 调试等）切换行为。

## 2. 目录结构与主要模块

- `src/index.ts`
  - 统一导出本子包的公共能力，是其他 mockset 相关子包的唯一依赖入口。
  - 新增导出时应从具体实现文件集中 re-export，保持 index 仅做网关，不写业务逻辑。
- `src/types/index.ts`
  - 定义 mock 数据的核心类型与枚举：
    - `MockDataValueType`：string / integer / number / object / array / boolean；与 JSON Schema 的 type 做一一映射。
    - `MockDataStatus`：`DEFAULT` / `REMOVED` / `ADDED`，用于标记字段是在 schema 中默认存在、被移除还是新增。
    - `MockDataWithStatus`：树形 mock 数据节点结构，包含 `label`、`realValue`、`displayValue`、`description`、`isRequired`、`type`、`childrenType`、`status`、`children` 等字段。
    - `MockDataInfo`：封装 schema 文本、mock 规则、合并后的示例结果及兼容性标记。
  - 这些类型是上层 UI 与调试 API 之间的数据约定，修改类型需同时回顾依赖它的多个子包（比如 mockset-editor、mockset-edit-modal-adapter 等）。
- `src/types/interface.ts`
  - 承载与业务上下文、绑定对象、下拉选择组件等相关的接口类型（例如 `BizCtxInfo`、`BasicMockSetInfo`、`BindSubjectInfo` 等）。
  - 该文件中的枚举/类型在 index.ts 中被 re-export，为其他包提供统一来源。
- `src/constants/index.ts`
  - 格式控制类常量：`FORMAT_SPACE_SETTING` 用于 `JSON.stringify` 的缩进；`STRING_DISPLAY_PREFIX/SUFFIX` 控制展示时字符串两端引号；`MAX_SUBMIT_LENGTH` 控制提交数据长度上限等。
  - 业务常量：`ROOT_KEY = 'mock'` 作为 mock 树根节点 key；`MOCK_SET_ERR_CODE.REPEAT_NAME` 约定 mock set 名称重复时的错误码。
  - 这些常量在上层 UI/校验逻辑中会被复用，新增错误码或限制时尽量集中在此处。
- `src/utils/index.ts`
  - JSON 解析与安全封装：
    - `safeJSONParse<T>`：包装 `JSON.parse`，失败时允许返回自定义降级值，避免直接抛异常影响 UI。
    - `parseToolSchema`：基于 `safeJSONParse` 将字符串 schema 转换为 `JSONSchema7`，是所有 schema 入口。
  - 数据结构转换：
    - `transSchema2DataWithStatus`：从 `JSONSchema7` 构造 `MockDataWithStatus` 树，包含：
      - 对 `object` 属性递归展开、根据 `required` 字段标记 `isRequired`。
      - 对 `array` 类型使用 `ARRAY_PREFIX_KEY` (`item_`) 派生子节点 key，并为 items 生成默认样例节点。
      - 使用 `generateFn` 或默认 `getInitialValue` 生成初始 `realValue`、`displayValue`。
    - `transDataWithStatus2Object`：将树形结构还原为普通 JS 对象，对：
      - `OBJECT`：折叠 children，并用 `label` 作为 key。
      - `ARRAY`：将 children 的 `[getArrayItemKey(0)]` 还原为数组元素；可通过 `excludeRemovedItem` 控制是否忽略被标记为 `REMOVED` 的节点（当前实现对 `REMOVED` 节点直接返回空对象，写新逻辑时需注意这一点）。
  - Mock 值生成 & 展示：
    - `getMockValue`：根据 `MockDataValueType` 和注入的随机/固定生成函数，返回 `[realValue, displayValue]`，展示层依赖 `displayValue` 作为可读字符串。
    - `getInitialValue`：内部默认实现（string -> 空串，number/integer -> 0，boolean -> false），仅用于初始化场景。
    - `stringifyEditorContent`：用于将编辑器内容格式化为带缩进的 JSON 字符串，统一使用 `FORMAT_SPACE_SETTING`。
    - `calcStringSize`：使用 `Blob` 计算字符串字节数，用来与 `MAX_SUBMIT_LENGTH` 配合进行长度控制。
  - 业务上下文适配：
    - `getPluginInfo`：根据 `BizCtxInfo` 中的 `trafficScene` 决定如何组合 `spaceID`、`pluginID`、`toolID`：
      - `CozeWorkflowDebug`：优先从 `ext.mockSubjectInfo` 挂载的 component 信息中取 `componentID` / `parentComponentID`；业务上表示 Workflow 调试时 mock 主体来自编排节点。
      - 其他场景（单 Agent / 多 Agent / 工具调试）：直接使用 `mockSubjectInfo.componentID` / `parentComponentID`。
    - `getMockSubjectInfo`：与上类似，但返回的是「主体信息本身」——Workflow 场景下以 `ext.mockSubjectInfo` 为准，其余场景直接回传 `mockSubjectInfo`。
    - `getEnvironment`：
      - 基于全局编译期常量 `IS_PROD` / `IS_OVERSEA` / `IS_RELEASE_VERSION` 返回固定环境字符串：`cn-boe`、`cn-release`、`cn-inhouse`、`oversea-release`、`oversea-inhouse` 等。
      - 非生产环境统一返回 `cn-boe`，用于调试/测试环境。

## 3. 开发/构建/测试工作流

本子包是 Rush monorepo 下的一个前端包，遵循统一工作流，仅在子包内需关注的要点如下：

- 本地初始化（在仓库根目录）
  - `rush update`：安装/更新依赖（见 [frontend/README.md](../../README.md) 与本包 README 描述）。

- 在本子包目录下的常用命令（`frontend/packages/studio/mockset-shared`）：
  - `npm run build`
    - 当前脚本实现为 `exit 0`，主要用于保证 Rush pipeline 中 build 阶段通过，本包自身不产出独立构建产物（逻辑通过 TypeScript 源码直接消费）。
  - `npm run lint`
    - 实际执行 `eslint ./ --cache`，依赖上层的 `@coze-arch/eslint-config`，配置文件为本目录下的 `eslint.config.js`。
    - 新增文件需要确保能通过该配置的 lint 检查，尽量复用现有规则（例如 import 顺序、no-explicit-any 等）。
  - `npm run test`
    - 使用 `vitest --run --passWithNoTests`，配置文件为 `vitest.config.ts`，共用 `@coze-arch/vitest-config` 的预置配置。
    - 当前 `__tests__` 目录仅有 `.gitkeep`，可以在此处新增针对 utils 的单元测试。
  - `npm run test:cov`
    - `npm run test -- --coverage`；结合 `config/rush-project.json` 中 `test:cov` 的 operation 设置，将覆盖率输出到 `coverage` 目录供 CI 使用。

- Rush 相关：
  - `config/rush-project.json` 中声明：
    - `operationName: test:cov` 对应输出 `coverage`；
    - `operationName: ts-check` 对应输出 `dist`（通常用于类型检查结果缓存）。
  - 该包在团队/层级上标记为：`team-studio`、`level-3`（见 [frontend/rushx-config.json](../../rushx-config.json)），因此：
    - 覆盖率要求为 0，但仍建议对关键工具函数补充测试。
    - 需要满足团队级的 packageAudit 规则（至少要有 `eslint.config.js` 等核心配置文件）。

- Storybook / 运行态：
  - README 中提到 `storybook` 支持，但当前目录下仅有 `.storybook/main.js` / `preview.js`，未暴露直接脚本；如需运行 Storybook，一般在上层 workspace 内通过统一命令（例如 `rushx storybook` 或团队提供的脚本），不要在本子包单独新增入口，避免与整体工具链冲突。

## 4. 项目特有约定与模式

- TypeScript 与类型约定：
  - 所有公共类型通过 `src/index.ts` 统一导出，避免上层包直接引用内部路径（例如 `../types/interface`）。新增类型时：
    - 在 `src/types/...` 中定义，
    - 在 `src/index.ts` 中补充 export，
    - 注意与 `@coze-arch/bot-api`、`@coze-arch/bot-typings` 的类型关系，避免重复定义协议类型。
  - `MockDataWithStatus` 被视作「单一事实来源」的数据结构，其他子包不应自建类似树结构；如需扩展字段，应在该接口上统一扩展。

- Mock 数据树结构与 key 规则：
  - 数组元素 key 统一使用 `item_${index}` 形式（参见 `ARRAY_PREFIX_KEY` 与 `getArrayItemKey`），避免在上层 UI 使用下标或随机字符串自创规则。
  - 对于嵌套对象/数组，`transSchema2DataWithStatus` 使用 `keyPrefix` 将路径编码进 key（`${parentKey}-${label}`），上层如需根据路径定位字段应优先利用这一规则，而非自行拼接。

- JSON Schema 与 null 处理：
  - `getSchemaType` 对 `type: 'null'` 特殊处理——返回 `undefined`，从而在 `transSchema2DataWithStatus` 中忽略纯 null 类型字段。
  - 若需要支持 `['null', 'string']` 等联合类型，当前实现会取数组第一个元素；在扩展时需谨慎改动，以兼容现有行为。

- 业务流量场景与插件信息：
  - `TrafficScene.CozeWorkflowDebug` 被视为特殊场景：
    - `getPluginInfo` / `getMockSubjectInfo` 将优先解析 `bizCtx.ext.mockSubjectInfo`（约定为 JSON 字符串），而非直接使用 `mockSubjectInfo`。
    - Workflow 调试相关功能在扩展字段上追加信息时，应该保证结构与现有解析逻辑兼容，避免破坏老代码。
  - 其他 `TrafficScene` 使用 `ComponentSubject` 中的 `componentID` / `parentComponentID`，不要在其他位置另外定义 ID 规则。

- 环境变量约定：
  - `getEnvironment` 依赖编译期常量 `IS_PROD` / `IS_OVERSEA` / `IS_RELEASE_VERSION`：这些通常由上层构建系统（Vite/Webpack）注入，不在本子包内定义。
  - 在单测或本地逻辑中，如需覆盖环境，可通过注入自定义环境函数或在测试中临时修改全局常量；避免在源码里直接读 `process.env`，以免破坏统一封装。

## 5. 与外部依赖的集成细节

- 与 `@coze-arch/bot-api` 的集成：
  - 从 `debugger_api` 子模块导入：
    - `MockRule`：挂在 `MockDataInfo.mock` 内，用于约定 mock 规则；本包仅做类型承载，不负责解释规则细节。
    - `TrafficScene` / `ComponentSubject`：驱动 `getPluginInfo` / `getMockSubjectInfo` 的分支逻辑，是 mock 体系对「场景」与「主体」的抽象。
  - 新增逻辑时，若需要拓展 traffic scene，请在 `getPluginInfo` / `getMockSubjectInfo` 中显式处理，避免落入 `default` 分支导致行为混乱。

- 与 JSON Schema (`json-schema`) 的集成：
  - 始终通过 `JSONSchema7` / `JSONSchema7TypeName` 处理 schema，避免混用其他 schema 定义。
  - 对象属性处理依赖 `schema.properties` 和 `schema.required`：当新增 schema 处理逻辑时，需要保证对可选字段/必填字段的语义不被破坏。
  - 数组处理依赖 `schema.items`：当前仅取第一个 items 元素作为样例生成规则（`schema.items[0]`），若未来需要支持元组类型，需在此集中修改。

- 与前端运行时的集成：
  - `calcStringSize` 使用 `Blob`，要求运行环境支持 Web API；在 Node-only 场景（如纯 SSR）使用时需额外处理（一般在上层包装，而不是修改本函数）。

## 6. 项目流程与协作规范

- 版本与发布：
  - 本包版本号在 `package.json` 中管理，遵循 monorepo 统一发布流程（通常由 CI 或维护者统一 bump 版本，不建议在子包直接修改并 commit）。

- Git 与分支规范：
  - 整体仓库采用 Rush monorepo 策略，具体分支命名、PR 流程请参考仓库根目录的贡献文档（如 [CONTRIBUTING.md](../../../CONTRIBUTING.md)）。
  - 在本子包内修改代码时，应同步检查：
    - 是否需要在其他依赖此包的子包中做联动改动；
    - 是否需要调整已有单元测试或新增测试覆盖 edge case。

- 代码质量与校验：
  - 统一使用 ESLint + Stylelint + TypeScript + Vitest：
    - `eslint.config.js`、`.stylelintrc.js`、`tsconfig*.json` 由架构团队维护，尽量不要在本子包做大幅度自定义。
    - 若必须新增规则，建议先在团队层面沟通，避免破坏整体一致性。

## 7. 为 AI 助手的具体操作建议

- 在修改或新增代码前：
  - 优先查找是否已有同类逻辑（例如在其他 mockset-* 包中）；遵循「公共逻辑放到 mockset-shared，UI 逻辑留在各自包中」的原则。
  - 若需要新增对某种 `TrafficScene`、schema 结构或 mock 行为的支持，先在本包中扩展类型/工具函数，再由上层 UI 调用。

- 实现新功能时应优先遵循：
  - 所有公共类型/函数从 `src/index.ts` 导出；
  - 尽量使用已有的 `MockDataWithStatus`、`transSchema2DataWithStatus`、`transDataWithStatus2Object` 等工具，不要在其他包重新实现 schema 转换；
  - 处理环境/插件/主体信息时统一通过 `getEnvironment`、`getPluginInfo`、`getMockSubjectInfo`，避免分散读取 `BizCtxInfo` 字段。

- 修改完成后：
  - 在本目录执行：`npm run lint && npm run test`；
  - 如修改涉及 schema 转换/traffic scene 分支，建议补充或更新对应的 Vitest 单测，放在 `__tests__` 目录下。