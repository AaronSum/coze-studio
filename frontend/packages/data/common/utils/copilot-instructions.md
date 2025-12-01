# @coze-data/utils 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/common/utils）中安全、高效地协作开发。

## 1. 子包定位与角色
- 本包名称：`@coze-data/utils`，位于数据层 data/common 分组下，服务于知识库、数据库等数据产品的前端能力。
- 在整体前端架构中（参考 frontend/README.md），本包作为 **可复用数据工具与 UI 小组件集合**，为 apps（如 apps/coze-studio）提供：
  - URL 与路径解析工具（如知识库页、数据库页的路由辅助）。
  - 与 Feishu/Lark 相关的资源类型判定工具。
  - 面向知识资源的数据类型选择等表单组件。
  - 与更新周期等配置相关的枚举与选项生成工具。
- 该包被其它 data 子包和上层应用以 `workspace:*` 形式依赖，要求保持 **API 稳定、无副作用、与宿主应用解耦**。

## 2. 代码结构与模块职责

### 2.1 目录总览（本子包）
- package.json：声明构建、测试脚本及依赖；main 指向 src/index.ts（通过 ts 构建到 dist）。
- tsconfig.build.json：构建入口，extends @coze-arch/ts-config/tsconfig.web.json，rootDir=src，outDir=dist。
- tsconfig.json：仅作为 references 聚合（指向 build/misc），不直接参与编译。
- eslint.config.js：统一使用 @coze-arch/eslint-config，preset=web。
- vitest.config.ts：统一使用 @coze-arch/vitest-config，preset=web。
- README.md：简单命令说明（dev/build 目前并未在 package.json 中定义，视为模板遗留）。
- src/：核心实现与导出聚合。
- __tests__/：Vitest 单测，重点覆盖组件行为与公共导出。

### 2.2 src 结构
- src/index.ts
  - 作为 **单一出口**，集中 re-export 下列功能，外部调用一律从此处引入：
    - URL 相关：`isValidUrl`, `completeUrl`（来自 url.ts）。
    - 知识页：`getFormatTypeFromUnitType`（来自 knowledge-page.ts）。
    - 数据库页：`isDatabasePathname`, `getDatabasePageQuery`, `getDatabasePageMode`, `databasePageModeIsModal`（来自 database-page.ts）。
    - 基础枚举：`FilterKnowledgeType`, `DocumentUpdateInterval`（来自 types.ts）。
    - Feishu/Lark 工具：`isFeishuOrLarkDocumentSource`, `isFeishuOrLarkTextUnit`, `isFeishuOrLarkTableUnit`, `isFeishuOrLarkDataSourceType`（来自 feishu-lark.ts）。
    - 更新周期选项：`getUpdateIntervalOptions`, `getUpdateTypeOptions`（来自 update-interval.ts）。
    - UI 组件：
      - `DataTypeSelect`, `getDataTypeText`, `getDataTypeOptions`（components/data-type-select）。
      - `CozeInputWithCountField`（components/input-with-count）。
      - `CozeFormTextArea`（components/text-area）。
    - 控制流与 hooks：
      - `abortable`, `useUnmountSignal`（abortable.ts）。
      - `useDataModal`, `useDataModalWithCoze`, `UseModalParamsCoze`（hooks/use-data-modal.tsx）。

- src/types.ts
  - 定义与知识资源/文档更新相关的公共枚举：
    - `FilterKnowledgeType`：ALL/TEXT/TABLE/IMAGE，用于筛选知识单元类型。
    - `DocumentUpdateInterval`：0/1/3/7/30 天等更新周期，用于文档自动更新设置与选项生成。

- src/abortable.ts
  - 封装可中断操作与组件卸载信号：
    - `abortable`：接收异步函数及 AbortSignal，确保在组件卸载或外部取消时中断请求，避免状态更新报错。
    - `useUnmountSignal`：React hook，返回一个在组件卸载时自动 abort 的 AbortController.signal。
  - 常用于网络请求、长耗时任务封装，与业务无关，应保持 **无副作用纯工具** 特性。

- src/hooks/use-data-modal.tsx
  - 提供与「数据资源弹窗」相关的复用逻辑：
    - `useDataModal`：管理弹窗打开/关闭、当前数据项、确认回调等。
    - `useDataModalWithCoze`：进一步融合 Coze 设计体系组件（@coze-arch/coze-design / @douyinfe/semi-ui），返回适配后的 props。
    - `UseModalParamsCoze`：为 withCoze 版本 hook 的参数类型导出，外部直接引用类型而无需触达内部实现。
  - 调用方负责渲染 Modal 组件，本 hook 仅负责 **状态与行为封装，不直接操作 DOM**。

- src/components/*
  - data-type-select/
    - 提供 `DataTypeSelect` 组件以及 `getDataTypeText`, `getDataTypeOptions` 等纯函数，用于知识/数据类型的选择与文案映射。
    - UI 基于 @coze-arch/coze-design / @douyinfe/semi-ui，样式上遵守 arch/bot-semi 体系。
  - input-with-count/
    - `CozeInputWithCountField`：带计数能力的输入框封装，统一字符数提示样式与逻辑。
  - text-area/
    - `CozeFormTextArea`：表单场景下的多行文本输入封装，遵循 Coze 设计规范，配合 Form.Item 使用。

- src/url.ts, src/knowledge-page.ts, src/database-page.ts, src/feishu-lark.ts, src/update-interval.ts
  - 这些文件主要承担 **与具体业务领域解耦的「规则封装」**：
    - URL/路由解析（如根据 pathname 判断是否数据库页面，提取 query/mode 信息）。
    - 知识单元格式映射（unitType → 展示格式/内部类型）。
    - Feishu/Lark 资源与数据单元类型判定（基于 source 或 unit 字段结构）。
    - 更新周期文案与下拉选项生成（结合 DocumentUpdateInterval）。
  - 不直接依赖 React；尽量保持纯函数形式，便于单测与复用。

## 3. 构建、测试与运行工作流

### 3.1 子包级命令
- 所有命令在子包根目录 frontend/packages/data/common/utils 下执行。
- package.json.scripts：
  - `build`: 当前实现为 `exit 0`，实质上 **不做构建**，实际生产构建由上层 Rsbuild/Rush 管线负责；
    - 如需在本包新增构建逻辑，应遵循前端整体规范（参考 frontend/config/rsbuild-config 等），并与团队确认。
  - `lint`: `eslint ./ --cache`，使用统一 @coze-arch/eslint-config；
    - 修改/新增代码后，应至少在本包运行一次 `npm run lint`，修复全部 eslint 报错。
  - `test`: `vitest --run --passWithNoTests`，配置在 vitest.config.ts 中 preset=web；
  - `test:cov`: `npm run test -- --coverage`，生成覆盖率报告。

### 3.2 Monorepo 级命令（只做引用）
- 在仓库根目录：
  - `rush install` / `rush update`：安装/更新所有子包依赖。
- 在 frontend 目录：
  - 日常开发一般通过 app 入口（如 apps/coze-studio）启动 dev/build，@coze-data/utils 作为依赖自动参与构建与 HMR，无需单独 dev 命令。

### 3.3 调试建议
- 对纯函数工具：
  - 通过 __tests__ 中的 Vitest 单测覆盖；
  - 推荐以「输入/输出」为核心场景编写测试，如 URL 解析、Feishu/Lark 类型判断、更新周期选项生成等。
- 对 React 组件与 hooks：
  - 参考现有测试文件（如 __tests__/data-type-select.test.tsx, singleline-select.test.tsx, index.test.ts）；
  - 使用 @testing-library/react / @testing-library/react-hooks，侧重交互行为而非内部实现细节。

## 4. 项目约定与模式

### 4.1 导出与 API 稳定性
- 统一从 src/index.ts 导出对外 API：
  - 新增函数/组件时 **必须在 index.ts 中补充导出**，同时保持命名清晰、语义稳定。
- 不对内部实现文件（如具体组件子目录、内部工具）进行路径直引导出；上层仅依赖 `@coze-data/utils` 包级 API，以降低路径变更带来的破坏性影响。

### 4.2 React 组件与 hooks 规范
- UI 组件：
  - 首选基于 @coze-arch/coze-design 与 @douyinfe/semi-ui 进行封装，保持与其他前端模块统一的交互与视觉风格。
  - 组件命名以业务语义为主，如 `DataTypeSelect`, `CozeFormTextArea`，避免无意义缩写。
- Hooks：
  - 单一职责，关注状态/行为封装（如 useDataModal），不要在 hook 内直接做全局副作用（如直接操作 window/document）。
  - 对外导出时，若存在 Coze 设计体系定制版本，统一使用 `WithCoze` 后缀区分（如 useDataModalWithCoze）。

### 4.3 纯工具函数规范
- 与 UI/React 无关的工具函数应保持：
  - 纯函数特性（输入 → 输出，无外部可见副作用）。
  - 引用类型/枚举时，只依赖 src/types.ts 或上层 arch/bot-api 定义，不直接嵌入 magic number / magic string。
  - 命名体现含义，如 `isDatabasePathname`, `getDatabasePageQuery`, `completeUrl`。

### 4.4 Feishu/Lark 相关逻辑
- 所有与 Feishu/Lark 资源类型判定、单元格式识别的逻辑 **集中在 src/feishu-lark.ts**：
  - 保持输入类型与上游数据结构（如知识资源单元的数据结构）对齐；
  - 通过 `isFeishuOrLark*` 前缀暴露类型守卫式工具，便于调用方在 TS 层做类型收窄。
- 如需扩展支持新的 Feishu/Lark 单元类型，应：
  - 优先在 feishu-lark.ts 中新增对应工具函数；
  - 然后在 index.ts 中统一导出；
  - 补充单测覆盖典型/边界样例。

### 4.5 更新周期与知识类型
- DocumentUpdateInterval 与 FilterKnowledgeType 是本包内较为稳定的「跨模块枚举」：
  - 禁止随意更改已有成员值（尤其是数字枚举），避免影响服务端/其他前端模块联动逻辑；
  - 新增取值需确认是否影响下游接口/配置，并同步相关团队。

## 5. 外部依赖与集成方式

### 5.1 依赖概览（仅列出与本包行为关系紧密者）
- 运行时依赖（package.json.dependencies）：
  - `@coze-arch/bot-api`, `@coze-arch/bot-error`, `@coze-arch/bot-semi`, `@coze-arch/coze-design`, `@coze-arch/i18n`, `@coze-arch/report-events`：
    - 提供统一的 API 类型定义、错误处理、UI 组件及国际化能力；
    - 在本包中主要通过 React 组件封装与类型引用间接使用。
  - `@coze-data/e2e`, `@coze-data/knowledge-resource-processor-core`：
    - 与知识资源的解析、转换相关，本包中的知识页/Feishu-Lark 工具可能与这些数据模型耦合。
  - `@douyinfe/semi-ui`：底层 UI 组件库，实现 DataTypeSelect 等组件的基础交互。
  - `ahooks`, `zustand`, `dayjs`, `classnames`, `utility-types` 等：
    - 公共 React hooks、状态管理、时间处理、className 组装、类型辅助。
- devDependencies：
  - `@coze-arch/eslint-config`, `@coze-arch/stylelint-config`, `@coze-arch/ts-config`, `@coze-arch/vitest-config`：
    - 统一 lint、样式、TS 与测试规范，不在本包内自定义规则（除非有强业务需求）。

### 5.2 与上层应用的交互
- 上层应用（如 apps/coze-studio）以 `@coze-data/utils` 为一个独立 npm 包依赖：
  - 不直接依赖内部文件路径；
  - 通过明确的导出 API 完成：
    - 表单/弹窗组件复用；
    - URL/路由处理逻辑统一；
    - 知识/数据库相关的枚举与类型选项统一。

## 6. 测试与质量约定

- 使用 Vitest + @testing-library/react(/hooks) 完成单元测试：
  - 所有新增导出（函数/组件/hook）均应考虑补充测试，至少覆盖基本成功路径与关键边界场景。
  - 对纯函数建议使用 snapshot 或显式断言结果结构。
- __tests__/ 中现有文件：
  - data-type-select.test.tsx：覆盖 DataTypeSelect 组件的选项展示与交互行为。
  - singleline-select.test.tsx：覆盖单行选择组件（位于 components/singleline-select）的行为。
  - index.test.ts：对包出口的基本行为/导出做回归校验，避免误删导出 API。

## 7. 协作流程与注意事项

- 分支与提交流程遵循仓库根目录的通用规范（参考 CONTRIBUTING.md、frontend/README.md），本说明仅补充对子包的具体约束：
  - 优先在本子包完成实现与本地测试，然后再联调上层 app。
  - 变更涉及公共枚举/导出 API 时，须评估影响范围（grep 上游引用）。
- 对 AI 助手特别注意：
  - 不要擅自修改 tsconfig.build.json 中的 references；这会影响整个 monorepo 的构建拓扑。
  - 不要删除/重命名现有导出（index.ts），除非用户明确要求并确认所有引用已更新。
  - 新增文件时，请保持与现有风格一致：
    - 工具函数 → 放在 src 根目录或与领域相关的文件中（如 *-page.ts, *-lark.ts）。
    - 组件 → 放在 src/components/ 下新建子目录，并通过 index.ts 做统一 re-export。
  - 保持所有新增代码的 License 头与现有文件一致（参考 src/index.ts）。
