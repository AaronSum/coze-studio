# @coze-arch/hooks — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/hooks）中安全、高效地协作开发。

## 子包定位与全局架构
- 本包位于 frontend/packages/arch/hooks，对应 npm 包名 `@coze-arch/hooks`，是 Coze 前端架构层的通用 React Hooks 工具库。
- 当前仅导出少量无 UI 依赖的基础 Hook：useHover、usePersistCallback、useUpdateEffect、useToggle、useUrlParams、useStateRealtime，集中在 src 目录实现并由 src/index.ts 统一导出。
- 包本身不参与打包产物构建：package.json 中 `build` 为 `exit 0`，只用于类型检查、单测和被其它前端子包/应用直接引用。
- 依赖极轻：仅依赖 `lodash-es` 与 `query-string`，并将 `react`/`react-dom` 作为 peerDependencies，确保在消费方环境下统一 React 实例。

## 代码结构与职责边界
- 入口与导出：
  - [frontend/packages/arch/hooks/src/index.ts](frontend/packages/arch/hooks/src/index.ts) 只做命名导出：
    - useHover：元素 hover 状态监听；
    - usePersistCallback：稳定回调引用；
    - useUpdateEffect：跳过首渲染的 effect；
    - useToggle：通用布尔/枚举切换；
    - useUrlParams：受控状态与 URL 查询串双向同步；
    - useStateRealtime：提供“获取最新 state”能力的 useState 包装。
- Hook 源码分布：
  - use-hover：DOM 事件层 hover 检测，不依赖业务上下文；
  - use-toggle：完全纯逻辑 Hook，只依赖 React useState/useMemo；
  - use-persist-callback：通过 ref+useCallback 提供稳定 callback；
  - use-update-effect：封装“忽略首 render”的 useEffect 变体；
  - use-url-params：围绕 query-string 封装 URL 查询参数解析/写入逻辑；
  - use-state-realtime：在普通状态之外维护 ref，以便在闭包中获取最新值。
- 本包不包含业务域知识，也不关心具体 UI 库或状态管理方案，适合作为其它前端包的基础工具层。

## 开发与测试工作流
- 包管理与脚本（在 frontend/packages/arch/hooks）：
  - 依赖安装：在仓库根目录执行 `rush update`，本包通过 workspace:* 与其它包联动。
  - 构建：`npm run build` 为占位命令（`exit 0`），真正构建由上层统一处理。
  - 单测：`npm test` / `npm run test` 调用 `vitest --run --passWithNoTests`；`npm run test:cov` 增加覆盖率统计。
  - Lint：`npm run lint` 使用 eslint.config.js + `@coze-arch/eslint-config` web 预设检查源码。
- TypeScript 配置：
  - tsconfig.build.json/tsconfig.json 继承 `@coze-arch/ts-config`，以前端 web 场景为主；源文件位于 src，不生成单独声明文件输出目录，本包主要由上层 TS 构建消费。
- 测试约定：
  - 目前仅在 use-persist-callback/use-update-effect/use-state-realtime 等目录下存在 __tests__ 占位，未来补充测试应遵循 Vitest 规范，测试 Hook 行为而非实现细节。

## 关键 Hook 行为说明
- useHover（src/use-hover/index.ts）：
  - 功能：监听 DOM 元素 mouseenter/mouseleave 事件，返回 `[ref, isHovered]`；可接受元素实例或惰性 getter `() => el`，以及 `onEnter/onLeave` 回调和依赖数组。
  - 行为要点：
    - 若传入 `el`，内部优先使用该 DOM 元素；否则使用返回的 ref.current；
    - 在 useLayoutEffect 中绑定/解绑事件，保证布局阶段即可生效；
    - onEnter/onLeave 作为依赖项写法较特别：依赖的是 `typeof onEnter === 'function'`，意味着只感知“是否提供回调”，不跟踪函数身份变更。
  - 使用建议：
    - 在 React 组件中通常将 ref 绑定到真实 DOM 元素上，避免直接传入 `document` 等全局对象以减少内存泄露风险。

- useToggle（src/use-toggle/index.ts）：
  - 功能：在两个值之间切换状态，或手动设置为任意值，返回 `{ state, toggle }`。
  - 支持多种签名：
    - `useToggle()`：默认在 `false` 与 `true` 间切换；
    - `useToggle(defaultValue)`：在 `defaultValue` 与 `!defaultValue` 之间切；
    - `useToggle(defaultValue, reverseValue)`：在 `defaultValue` 与 `reverseValue` 之间切。
  - 行为细节：
    - `toggle()` 无参时，根据当前 state 是否等于 defaultValue 选择切换目标；
    - `toggle(next)` 传参时直接设置为指定值，不进行“比较切换”。

- usePersistCallback（src/use-persist-callback/index.ts）：
  - 功能：保证回调对象引用在依赖变更时仍稳定（尤其在依赖为空或频繁变化场景），内部用 ref + useCallback 封装。
  - 行为要点：
    - 最新的 fn 会通过 useMemo 存入 ref.current；
    - 返回的 callback 始终稳定（依赖只包含 ref），闭包内部调用的是最新 fn；
    - 若未传 fn 或 fn 为 undefined，将返回一个 no-op 函数（调用时直接返回 undefined）。
  - 典型用途：
    - 作为事件回调传入深层组件或第三方库，避免因父组件重渲导致频繁解绑/重绑。

- useUpdateEffect（src/use-update-effect/index.ts）：
  - 功能：与 useEffect 语义类似，但首渲染时不会执行 effect，仅在依赖首次变化后才执行。
  - 实现方式：使用 isMounted ref 标记首 render，首次依赖变更只设置标记，不调用传入的 effect；后续每次依赖变化才真正执行 effect。
  - 使用场景：
    - 需要在某些依赖变化时执行副作用，但不想在初始挂载（如从 props 默认值到相同值）时触发。

- useUrlParams（src/use-url-params/index.ts）：
  - 功能：在 React 状态与浏览器 URL 查询参数之间建立同步，支持自动格式化、合并 URL 现有参数、过滤字段等；返回 `{ value, setValue, resetParams }`。
  - 关键选项（IOptions）：
    - `omitKeys`：不写入 URL 但保留在返回值中的字段；
    - `autoFormat`：是否自动格式化 value（过滤空值，将 Date 转 ISO 字符串，将对象 JSON.stringify）；
    - `autoMergeUrlParams`：是否在每次 setValue 时将 URL 中已有参数与当前 value 进行合并；
    - `autoMergeUrlParamsOptions.useUrlParamsOnFirst`：关闭 autoMergeUrlParams 时，是否在首次初始化时仍从 URL 读取初始值；
    - `parseOptions` / `stringifyOptions`：传给 query-string 的解析与序列化配置，默认使用 `arrayFormat: 'bracket'`，且跳过 null/空字符串；
    - `replaceUrl`：为 true 时使用 `history.replaceState`，否则在非 popstate 场景使用 `pushState`。
  - 行为要点：
    - 初始 state 会根据 `autoMergeUrlParams` 和 `autoMergeUrlParamsOptions` 将 initValue 与当前 URL 合并；
    - 内部通过 window.popstate 监听浏览器前进/后退，将 URL 上的参数解析为新的 state，但不会写回 initValueRef；
    - 每次 state 变化都会更新 URL（除非当前是 popstate 中），使用 omitKeys 过滤不应出现在 URL 的字段。
  - 限制与注意：
    - 依赖浏览器环境（window.location/history），不适用于 SSR/Node；如在 SSR 中使用需加环境判断或仅在客户端 hook 中调用；
    - autoFormat 会将对象字段转为 JSON 字符串，下游使用时需手动 JSON.parse。

- useStateRealtime（src/use-state-realtime/index.ts）：
  - 功能：在 useState 的基础上提供一个 `getRealState` 函数，返回最新的 state 值，用于异步回调/闭包场景避免“旧值”问题；
  - 返回 `[state, setState, getRealState]`：
    - `state`：当前渲染使用的值；
    - `setState`：兼容 useState 的 SetStateAction（支持函数/值）；
    - `getRealState`：在任意时刻访问当前最新 state（基于 ref）。
  - 实现细节：
    - 初始值与 setState 均通过内部 getStateVal 处理，保证函数式 setState 与普通值兼容；
    - setState 会同步更新 ref 与 React state，保证下一次渲染和 getRealState 一致。

## 工程与风格约定
- 代码风格：
  - 所有源码文件使用 Apache-2.0 版权头，与 monorepo 其它前端包保持一致；新增 Hook 时需复制相同头部注释。
  - 使用 TypeScript 严格模式，并为公共 API 提供明确的泛型与类型别名（如 ReturnValue<T>）。
- 导出与文件组织：
  - 新增 Hook 时应在 src 下建立独立目录，并在该目录的 index.ts 内实现；
  - 同时在 src/index.ts 中增加命名导出，确保对外 API 入口统一；
  - 若需要测试，按现有模式在对应目录下创建 __tests__ 子目录。
- 依赖使用：
  - 只在需要时引入 `lodash-es` 与 `query-string`；避免在基础 hooks 中加入重型依赖；
  - React 版本固定为 18.2.x，Hook 实现中应避免使用不兼容旧版本的实验特性。

## 对 AI 助手的特别提示
- 在本包中新增或修改 Hook 时：
  - 保持“无业务、无 UI、可复用”原则：不要引入具体领域逻辑、路由约定或埋点行为；
  - 优先以纯函数/Hook 实现，保证良好的单元测试覆盖潜力；
  - 如需访问浏览器 API（如 useUrlParams），要在文档与命名上清晰标注其运行环境限制。
- 修改已有 Hook 行为前：
  - 先在整个 frontend 目录中搜索对应导出（如 `useUrlParams(`），确认使用场景（工作流、Studio 应用等）；
  - 尽量通过增加选项或提供新 Hook 的方式扩展能力，而不是直接改变现有默认行为，避免对调用方产生破坏性影响。
