# @coze-workflow/fabric-canvas 开发说明（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/fabric-canvas）中安全、高效地协作开发。

## 1. 子包角色与全局架构

- 该包提供基于 fabric.js 的画布编辑与预览能力，主要用于 Workflow/Flowgram 等场景下的可视化画布编辑。
- 入口为 src/index.tsx，对外导出：
  - FabricEditor：主编辑器 React 组件。
  - FabricPreview / IFabricPreview：只读预览组件及其接口。
  - loadFont 与 fontTreeData：字体加载工具与可选字体树配置。
  - typings 中定义的 Schema、节点属性等类型。
- 主体结构：
  - src/components/fabric-editor：画布编辑器核心 UI，组合顶部工具栏、右侧属性表单、画布主体等子组件。
  - src/components/fabric-preview：轻量级预览组件，仅负责根据 Schema/配置渲染静态画布。
  - src/hooks：围绕 fabric.Canvas 的一组高内聚 hooks（初始化、缩放/移动、对齐线、撤销重做、对象对齐、拖拽添加元素等），FabricEditor 通过它们组装出完整交互。
  - src/utils：封装 fabric 相关的工具函数（元素工厂、默认属性、对齐/吸附计算等）和字体加载逻辑。
  - src/assert/font.tsx：字体元数据（分组、展示文案、预览），供编辑器和业务场景统一使用。
- 数据流与服务边界：
  - 画布数据（通常为某种 Schema）由上游 Workflow/Base 层定义并通过 props 传入；本包负责在编辑过程中维护内部状态，并在变更时通过回调向上游同步。
  - 画布渲染完全在前端完成，依赖 fabric.js，不直接发起网络请求；与 Workflow 运行时或后端交互通过上游包（@coze-workflow/base、components 等）完成。
  - hooks 对 fabric.Canvas 进行封装，统一管理事件订阅/解绑、坐标转换和对象状态，避免在组件树中直接操作全局 canvas 实例。

## 2. 代码结构与模块职责

- src/index.tsx
  - 仅做对外导出，不包含业务逻辑；新增导出时需保持 API 稳定，尽量只输出稳定组件与类型。
- src/components/
  - fabric-editor：编辑器主容器及其子组件，包括：
    - 顶部工具栏（缩放、撤销/重做、层级操作、对齐等）。
    - 画布区域（实际挂载 fabric.Canvas 的 DOM 容器）。
    - 右侧属性面板（基于 Schema 映射为表单项，依赖 schema-to-form-value 等工具）。
  - fabric-preview：只读预览组件，通常只在展示场景使用，无编辑交互；与编辑器共享 utils 中的画布构建逻辑。
  - content-menu / topbar / pop-in-screen / setters / form 等：
    - content-menu：右键菜单或元素级别的上下文操作入口。
    - topbar：全局编辑工具集。
    - setters / form：以「属性 setter 组件」形式封装各类属性编辑控件，便于在不同节点类型之间复用。
    - ref-title / icon-button 等：小型 UI 组件，抽离通用视觉与交互。
- src/hooks/
  - 以 use- 前缀命名的 hooks 是 FabricEditor 的主装配点，例如：
    - use-init-canvas：创建并初始化 fabric.Canvas，设置基础选项与事件监听。
    - use-canvas-resize / use-viewport：处理窗口/容器尺寸变化和画布缩放、平移。
    - use-active-object-change / use-canvas-change / use-schema-change：监听对象选中与画布结构变化，同步到上层 Schema 或回调。
    - use-align / use-snap-move / use-position：负责对齐线、吸附、位置计算等，依赖 utils/snap 等工具。
    - use-copy-paste / use-group / use-drag-add / use-img-add / use-inline-text-add / use-free-pencil：抽象具体操作（复制粘贴、组合、拖拽新增元素、图片与文本新增、自由绘制等）。
    - use-redo-undo / use-storage：提供撤销/重做与本地存储支持（如需要，可接入上游状态持久化方案）。
  - 所有 hooks 都避免直接操作 DOM 之外的全局状态，依赖 React 与 fabric 的事件流完成协作。
- src/utils/
  - fabric-utils.tsx：对 fabric 对象的封装工具，如创建画布、统一配置选项、解析/序列化画布数据等。
  - element-factory.tsx：根据业务 Schema 创建不同类型的 fabric.Object（矩形、文本、图片、自定义节点等）。
  - default-props.tsx：定义各类元素的默认属性（大小、颜色、边框等），保证不同创建入口表现一致。
  - controls.tsx / create-controls.tsx：自定义控件句柄（缩放、旋转、删除按钮等）的创建与注册。
  - schema-to-form-value.ts：将画布对象属性映射为表单数据结构，供属性面板使用。
  - font-loader.ts：封装字体加载逻辑，暴露 loadFont API，并与 fontTreeData 结合，为编辑器和预览统一管理字体资源。
- src/share/
  - 对外提供可跨项目共享的 util 或类型，导出路径为 @coze-workflow/fabric-canvas/share。
- __tests__/
  - 目前包含 typings.test.ts 等轻量测试，主要校验类型或关键工具逻辑；新增重要 hooks 或 utils 时建议在此补充单测。
- stories/
  - demo.stories.tsx 作为 Storybook 入口，用于本地交互调试；新增复杂交互时，可在此添加示例以便手动验证。

## 3. 构建、测试与本地开发流程

- 包管理与初始化：
  - 仓库根目录通过 rush 管理依赖，首次使用需在根目录执行 rush update。
- 本子包 npm scripts（见 package.json）：
  - dev：storybook dev -p 6006，基于 Storybook 启动本地组件调试环境；依赖 .storybook/main.js 与 preview.js 配置。
  - build：当前实现为 exit 0，实际打包由上层应用/构建系统统一处理，本包只需保证 TS 类型和导出正确。
  - lint：eslint ./ --cache，规则来自 eslint.config.js（基于 @coze-arch/eslint-config web 预设）。
  - test：vitest --run --passWithNoTests，Vitest 配置见 vitest.config.ts，由 @coze-arch/vitest-config 统一管理。
  - test:cov：npm run test -- --coverage，采集单测覆盖率。
- TypeScript 配置：
  - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，启用 strictNullChecks 与 noImplicitAny，rootDir 为 src，outDir 为 dist，tsBuildInfoFile 为 dist/tsconfig.build.tsbuildinfo。
  - references 中声明对 @coze-workflow/base、components 以及内部 ts-config、eslint-config、stylelint-config 等包的依赖，以支持 TS project references 与增量编译；新增跨包类型依赖时若出现编译错误，需要同步维护此列表。
  - tsconfig.json / tsconfig.misc.json 分别用于 IDE 编辑体验与杂项脚本/测试文件的 TS 行为。
- 样式与构建：
  - 使用 Less + CSS Modules（index.module.less）结合 Tailwind 原子类；Tailwind 配置在 tailwind.config.js / tailwind.config.ts 中，使用 @coze-arch/tailwind-config 预设。
  - Stylelint 由 .stylelintrc.js 和 @coze-arch/stylelint-config 管理；开发过程中若修改样式较多，建议在仓库级别执行统一 lint。

## 4. 项目约定与编码风格

- 技术栈与组件风格：
  - React 18 函数组件 + TypeScript，无类组件；FabricEditor/FabricPreview 等核心组件通过 hooks 组装逻辑。
  - UI 组件尽量复用 @coze-arch/coze-design（按钮、弹窗、表单控件等），与 Studio 其他区域保持视觉一致。
  - 布局与样式优先使用 Tailwind 原子类，复杂局部样式放在 index.module.less 中，通过 classNames 组合使用。
- hooks 与状态管理：
  - 所有与 fabric 相关的状态（当前选中对象、画布尺寸、缩放比例、撤销栈等）通过 useXxx hooks 管理；组件内部仅以 props + hooks 读写，不在本包内创建全局 store。
  - 跨组件共享的画布实例或者编辑上下文通常通过 React context 暴露（见 src/context），避免在 utils 中硬编码单例。
  - hooks 命名统一为 use-动词/语义，返回值以对象形式暴露行为与状态（例如 { onCopy, onPaste, canUndo }）。
- 类型与错误处理：
  - 公共类型集中在 src/typings.ts 与 src/global.d.ts；涉及 Workflow/Base 的类型通过 @coze-workflow/base、@coze-arch/bot-typings 引入，避免重复声明。
  - 对 fabric 相关操作，一般以类型守卫或可选链防御潜在 null/undefined（例如 当前无选中对象时的操作）。
  - 出错场景多为用户操作问题（如非法对象、越界坐标），通常通过 UI 提示或忽略操作而不是抛出异常；真正的逻辑异常应通过上游错误捕获体系处理。
- 样式与交互约定：
  - 自定义控件（拖拽手柄、删除按钮等）统一通过 controls.tsx/create-controls.tsx 注册，并在 fabric-utils 中集中启用，避免分散注册导致行为不一致。
  - 对齐线/吸附行为由 snap 相关 util 统一实现，不在各个 hook 中重复写几何计算逻辑。

## 5. 与其它包和外部依赖的集成

- 与 @coze-workflow/* 的集成：
  - 依赖 @coze-workflow/base 与 @coze-workflow/components 提供的 Workflow 基础类型与 UI 组件，用于在编辑器周边展示工作流信息或集成到整体 Workflow IDE。
  - FabricEditor 通常作为 Workflow 节点编辑器的一部分被上游包引用，不直接控制路由或全局布局。
- 与 @coze-arch/* 的集成：
  - 使用 @coze-arch/coze-design 进行基础 UI 组件封装，遵循全局主题与交互规范。
  - 使用 @coze-arch/i18n 管理文案，所有文字均应通过 I18n.t(key) 获取；新增文案需在对应 i18n 包中补充词条。
  - 使用 @coze-arch/vitest-config 与 @coze-arch/ts-config、eslint-config、stylelint-config、tailwind-config 等统一工具包，保证测试、构建和样式 lint 的一致性。
- 第三方库：
  - fabric：画布渲染与对象模型的核心依赖；版本为 6.0.0-rc2，部分 API 相较 v4/v5 有调整，新增/修改逻辑时应参考对应版本文档。
  - @use-gesture/react：处理鼠标/触摸手势（拖拽、缩放等），常与 React 事件结合，为 FabricEditor 提供更自然的交互。
  - ahooks：常用通用 hooks（如 useSafeState、节流/防抖等），减少样板代码。
  - lodash-es：用于集合和对象操作，应按需导入以减小打包体积。
  - @tanstack/react-query 可能用于异步数据（如远程资源、模板列表）加载和缓存，但本包本身不直接负责业务接口定义。

## 6. 开发流程与协作规范（AI 助手注意事项）

- 变更范围控制：
  - 优先在本包内扩展画布交互和 UI 组件，不在此处修改 Workflow 基础类型、运行时逻辑或外层 IDE 的路由与状态管理；如需修改其它 workflow 子包，应遵循对应包中的 copilot-instructions。
- 新增功能时的推荐路径：
  - 若是新的画布交互（如新手势、新元素类型）：
    - 首选在 src/hooks 中新增 use-xxx hook，内部基于 fabric 与现有 utils 实现逻辑。
    - 在 src/utils 中复用/补充公共几何或对象创建工具，避免在 hook 中直接硬编码 math 逻辑。
    - 在 FabricEditor 中通过组合该 hook 挂载新行为，同时在 stories/demo.stories.tsx 中增加示例用于手动验证。
  - 若是新的属性编辑能力：
    - 在 setters/ 与 form/ 下新增对应表单组件，利用 schema-to-form-value 完成数据映射。
    - 确保默认值在 default-props.tsx 中定义，便于各处创建路径复用。
- 只读态与权限：
  - 是否允许编辑通常由上游通过 props 控制（例如 isReadonly/disabled），本包内部仅根据该值切换交互与视觉状态，不自行判断权限。
- Storybook 与调试：
  - 推荐通过 npm run dev 启动 Storybook，在 stories 中构造典型场景（含大量节点、复杂对齐/吸附等）进行交互测试。
  - 对涉及性能的改动（多节点批量操作、频繁重绘等），可在 Storybook 中使用浏览器性能面板进行简单检查。

## 7. 本子包的特殊点与注意事项

- 构建无实际产物：
  - npm run build 为 no-op，本包的 TS 编译和最终打包由上层工程统一处理；不要在此引入额外 bundler 或打包脚本。
- 强依赖 fabric 版本：
  - 由于使用的是 fabric 6.0.0-rc2，一些 API 与社区示例存在差异；迁移第三方代码片段时需仔细比对，避免静默行为变化。
- 性能与稳定性：
  - 大量对象场景下的性能优化主要依赖 fabric 本身与合理的事件节流；修改重绘逻辑或事件订阅时要注意避免在高频事件中做重计算。
- 单画布多场景复用：
  - 同一画布引擎既被用于编辑器也被用于预览，因此 utils 与 hooks 需保持「编辑模式」与「预览模式」兼容；新增功能时应考虑是否会影响预览组件的只读表现。
