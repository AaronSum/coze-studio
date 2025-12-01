# text-grab 子包开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/text-grab）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 子包作用：提供 IM 聊天区域中的「文本选中与内容抓取」能力，包括选区监听、位置计算、内容结构化抽取与文案标准化，供上层浮动菜单 / 分享 / 工作流触发器等模块复用。
- 暴露 API 入口在 src/index.ts，统一导出：
  - React Hook：useGrab
  - 领域类型：SelectionData、GrabPosition、Direction 以及 GrabNode/GrabElement 系列类型
  - 文本解析工具：parseMarkdownToGrabNode
  - DOM 属性常量：CONTENT_ATTRIBUTE_NAME、MESSAGE_SOURCE_ATTRIBUTE_NAME
  - 各类判定与归一化工具：isGrabTextNode / isGrabLink / isGrabImage、getHumanizedContentText / getOriginContentText 等。
- 逻辑分层结构（按目录）：
  - src/hooks：与 React 生命周期绑定的 UI 行为封装（当前主要为 useGrab）。
  - src/utils：纯函数工具层，负责 DOM Range 处理、Rect 计算、选区归一化、Markdown 解析等，不直接依赖 React。
  - src/types：领域模型与结构化类型定义（选区数据、抓取节点结构等）。
  - src/constants：与 DOM Attribute 等弱耦合常量（当前通过 constants/range 导出）。
- 数据主通路：
  1. 外部组件在聊天区域根节点上挂载 contentRef，并传入 floatMenuRef、回调 onSelectChange / onPositionChange。
  2. useGrab 监听 pointerup / selectionchange / scroll / resize / keydown 等事件，通过 getSelectionData 读取 window.getSelection() 并过滤到消息内容区域。
  3. getSelectionData 内部调用 normalize / refine-range / process-node 等工具将 DOM Range 解析为统一的 GrabNode 列表，并产出 SelectionData（含方向 Direction、归一化内容、人类可读内容等）。
  4. useGrab 根据 SelectionData 与 getRectData 计算浮动菜单定位 GrabPosition，并通过回调暴露给上层 UI。

## 2. 构建、测试与调试工作流

- 包管理：前端整体由 Rush + pnpm 管理，本子包 package.json 中 scripts 偏向在 monorepo 顶层使用 Rush 命令驱动。
- 安装依赖：在仓库根目录执行 rush update，会根据 rush.json 及各子包依赖拉取安装。
- 构建：
  - 本子包定义了 build: "exit 0"，实际构建通常由上层 rsbuild / bundler 配置统一处理；在本包内单独执行 npm run build 仅作为占位，不会产出构建产物。
- Lint：
  - 在子包目录下运行：npm run lint
  - eslint.config.js 使用 @coze-arch/eslint-config，preset: 'web'，自动应用集团统一规则（例如 @coze-arch/max-line-per-function、命名规范等）。
- 测试：
  - 单测运行：npm test 或 npm run test
  - 覆盖率：npm run test:cov
  - 测试框架：vitest，配置位于 vitest.config.ts，通过 @coze-arch/vitest-config.defineConfig 统一设置；
    - dirname: 当前包目录
    - preset: 'web'
    - test.environment: 'happy-dom'（模拟浏览器环境）
    - test.globals: true
  - 若新增 API，请优先在 __tests__/ 中添加对应用例，遵循 happy-dom 环境（可直接访问 window / document）。
- Storybook：
  - README.md 提及 dev: npm run dev，但当前 package.json 未定义 dev 脚本；开发时如需可参考其它组件包的 Storybook 配置补齐，本说明不假设其已经可用。

## 3. 关键类型与核心 Hook 设计

- SelectionData（见 src/types/selection.ts）：
  - humanizedContentText：使用 getHumanizedContentText 生成的、适合给人/LLM 使用的文案（可能做了空白、换行、特殊节点处理）。
  - originContentText：使用 getOriginContentText 拿到的原始选中文本，基本忠实反映 DOM 内容。
  - normalizeSelectionNodeList：getNormalizeNodeList 的结果，为内部选区算法使用的归一化节点列表（基于 GrabNode/GrabElement 结构）。
  - nodesAncestorIsMessageBox：布尔值，控制选区是否完全落在消息盒子内；useGrab 会据此过滤无关选区。
  - ancestorAttributeValue / messageSource：从含 CONTENT_ATTRIBUTE_NAME / MESSAGE_SOURCE_ATTRIBUTE_NAME 的祖先 DOM 上解析出的业务属性，用于上游识别所属消息、来源端等。
  - direction: Direction 枚举（Forward / Backward / Unknown），代表用户拖选方向，影响浮动菜单定位。
- GrabPosition：
  - { x, y }：相对于 viewport 的菜单锚点坐标，由 getRectData + Direction 决定。
- useGrab（见 src/hooks/use-grab.ts）：
  - 入参 GrabParams：
    - contentRef：聊天内容容器 div 的 ref。
    - floatMenuRef：浮动菜单根节点 ref，用于判断点击是否落在菜单内部从而避免误清理选区。
    - onSelectChange(selectionData | null)：当选区变化 / 失效时回调 SelectionData。
    - onPositionChange(position | null)：当浮动菜单锚点位置变化 / 清空时回调 GrabPosition。
  - 内部状态：
    - selection：缓存当前 window.getSelection()，避免多次读取。
    - selectionData：缓存 SelectionData，以便在滚动/缩放时复用方向等信息。
    - isScrolling：用于上层按需显示「滚动中」状态。
    - hasSelectionData：优化监听绑定，仅在存在有效选区时挂载全局事件。
  - 主要内部方法：
    - clearSelection：
      - 调用 onSelectChange(null)、onPositionChange(null)；
      - 调用 selection.removeAllRanges() 清理系统选区，并重置内部状态 / 滚动计时器。
    - handleScreenChange：
      - 读取 window.getSelection() 与 getRectData 的 rangeRects，根据 Direction 选取首/尾行 Rect；
      - 结合屏幕宽高与 MAX_WIDTH 进行防遮挡修正，最终产出 GrabPosition。
    - handleSmartScreenChange：
      - 通过 useEventCallback + setTimeout 做 TIMEOUT 毫秒级「滚动结束」判定；
      - 滚动中 isScrolling 为 true，结束后调用 handleScreenChange。
    - handleGetSelection：
      - 检查 contentRef 是否存在；
      - 从 window.getSelection() 中构造 SelectionData（调用 getSelectionData）；
      - 校验 nodesAncestorIsMessageBox，若为 false 则视为无效选区并清空；
      - 更新 selectionData.current / hasSelectionData.current，触发 handleScreenChange 与 onSelectChange。
    - handleMouseUp / handleKeyDown / handleMouseDown：
      - 通过 pointerup / 键盘方向键 / Ctrl/Cmd+A / 全局 mousedown 检测用户操作，
      - 使用 lodash-es.defer 延迟执行 handleGetSelection，保证浏览器已完成选区更新。
  - 副作用绑定策略：
    - 当 hasSelectionData 为 true 时，才在 window 上挂载 resize / wheel / scroll / keydown / selectionchange 等监听，减少无意义监听开销；
    - 在 contentRef.current 上挂载 pointerup / selectionchange（触屏设备）事件，用于触发新一轮选区计算；
    - 每个 useEffect 在依赖变化或组件卸载时负责移除对应事件监听，防止泄漏。

## 4. 工具与归一化流程概览

- 选区与 Rect 处理工具（部分文件名）：
  - src/utils/get-selection-data.ts：
    - 负责将 Selection 转换为 SelectionData；内部会调用 refine-range / process-node / normalizer 等；
    - 校验选区是否在合法容器中（例如根据 DOM 属性判断是否在消息内容区域）。
  - src/utils/get-rect-data.ts：
    - 从 Selection 中导出 rangeRects/ boundingRect，用于后续 Position 计算。
  - src/utils/refine-range/*：
    - fix-start-node / fix-end-node / fix-end-empty / fix-link 等，用于微调浏览器原生 Range 边界，避免选中多余空白或拆断链接等问题。
  - src/utils/process-node/*：
    - process-child-node / process-special-node 等，对 DOM 节点进行遍历与归一化处理，将其转为 GrabNode 模型。
- 文本归一化与「人类可读」转换：
  - src/utils/normalizer/get-normalize-node-list.ts：
    - 将原始 DOM 节点转换为线性结构的 GrabNode 列表，供选中区域进一步处理。
  - src/utils/normalizer/get-origin-content-text.ts：
    - 从归一化节点列表中抽取原始字符串，尽量贴合 DOM 实际展示内容。
  - src/utils/normalizer/get-humanize-content-text.ts：
    - 在 origin 文本基础上进行格式整理，如合并空白、处理换行/特殊节点，使文本更适合日志 / 上报 / LLM 提示词等使用场景。
  - src/utils/normalizer/is-grab-text-node.ts / is-grab-link.ts / is-grab-image.ts / is-grab-element.ts：
    - 用于识别不同类型的抓取节点：纯文本、链接、图片等，确保上层处理可以按类型做分支逻辑。
- Markdown / 富文本解析：
  - src/utils/parse-markdown-to-grab-node.ts：
    - 对接 @coze-arch/bot-md-box-adapter，将机器人消息中的 Markdown 结构解析生成 GrabNode 列表，统一与 DOM 选区的节点模型，方便后续重用相同的归一化与文本抽取逻辑。
- DOM 属性与消息上下文：
  - src/utils/get-ancestor-attribute-node.ts / get-ancestor-attribute-value.ts：
    - 自选区起点/终点向上查找包含 CONTENT_ATTRIBUTE_NAME 或 MESSAGE_SOURCE_ATTRIBUTE_NAME 的祖先节点；
    - 用于关联选区与具体消息实例、来源渠道（例如用户/机器人、渠道来源等）。
- 设备特性：
  - src/utils/is-touch-device.ts：
    - 简单判断当前环境是否为触屏设备；useGrab 据此决定是否监听 selectionchange 事件等。

## 5. 与外部包和上游系统的集成

- 依赖的内部包：
  - @coze-common/chat-hooks：提供 useEventCallback 等基础 hook，统一 useCallback 封装与稳定引用管理；
  - @coze-common/chat-area-utils：与聊天区域 DOM 结构相关的工具方法（如消息盒子选择器等，具体实现见对应包）；
  - @coze-arch/bot-md-box-adapter：将机器人消息 Markdown 内容解析为统一节点结构，用于 parseMarkdownToGrabNode；
  - @coze-arch/i18n：国际化适配层，若后续在本包中新增提示文案，请遵循统一 i18n 使用方式；
  - @coze-arch/bot-typings：提供 Bot/消息领域的类型定义，供类型补全与约束。
- 外部三方依赖：
  - react / react-dom：React 18 作为 peer 依赖，本包仅导出 hook 与工具，不直接渲染 UI。
  - lodash-es：当前使用 defer 等工具做异步调度，避免紧贴浏览器 selection 更新时机。
  - classnames：目前未在导出 API 中直接使用，如后续新增组件注意与仓库其它包保持同样写法风格。
- 运行时环境假设：
  - 浏览器环境可访问 window / document / screen；
  - 选区相关 API（window.getSelection、Selection、Range、getBoundingClientRect 等）均可用。

## 6. 开发约定与代码风格

- TypeScript 与严格类型：
  - 统一使用 TypeScript，公共导出类型通过 src/index.ts 聚合，方便其他包从单一入口引入；
  - Direction 采用 const enum 以获得更紧凑的编译结果；
  - 引用工具函数的返回值类型时，倾向使用 ReturnType<typeof xxx>（参考 SelectionData 中的定义），保证类型与实现保持同步。
- React Hook 约定：
  - Hook 中与外部交互的回调统一通过参数传入（如 onSelectChange / onPositionChange），不在内部直接依赖全局 store；
  - 使用 @coze-common/chat-hooks 的 useEventCallback 包裹事件处理函数，以保证引用稳定与性能。
- DOM 与事件处理：
  - 避免在全局 window 上长期挂载监听，使用 hasSelectionData 控制挂载/卸载时机；
  - 尽量通过工具函数处理 Selection / Range 相关逻辑，避免在多个文件中分散写复杂 DOM 操作；
  - 与浮动菜单的点击穿透判定仅依赖 floatMenuRef 的 getBoundingClientRect，增加新交互时建议复用该模式。
- 目录与命名：
  - utils 子目录按职责分类：normalizer / process-node / refine-range / helper 等，新增文件时请放入对应子目录；
  - 文件与导出命名多采用 kebab-case 文件名 + camelCase 函数名；
  - 遵循 eslint 规则中对命名、最大行数等限制，必要时可通过注释（如 @coze-arch/max-line-per-function）局部放宽，但需保持节制。

## 7. 协作与扩展建议

- 新增能力时的推荐路径：
  - 若仅涉及「如何展示选区结果」（例如新增一个浮动菜单项），优先在上层应用内修改 UI 组件，继续复用 useGrab 暴露的 SelectionData / GrabPosition，而不要改动本包内部归一化逻辑。
  - 若需要调整「选区规则」或「文本归一化方式」，优先在 src/utils/normalizer、src/utils/refine-range 或 get-selection-data 里扩展；保证对 SelectionData 的字段含义向后兼容。
  - 若要支持新的内容类型（例如代码块、特殊富文本卡片），应先扩展 GrabNode / GrabElement 类型定义与对应的 is-grab-xxx 判定函数，再更新相关 normalizer / process-node 逻辑。
- 与测试配合：
  - 针对边界行为（如选区跨行、跨消息、多语言、触屏设备）建议在 __tests__ 中用 happy-dom 模拟 Selection/Range，并验证 SelectionData 与 GrabPosition 是否符合预期。
