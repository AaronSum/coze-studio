# @coze-common/md-editor-adapter — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/md-editor-adapter）中安全、高效地协作开发。

## 全局架构与职责

- 子包定位：为业务代码提供一个统一的 Markdown 编辑器适配层，对外暴露稳定的类型与工具函数，同时在当前仓库内使用简化实现（基于 textarea），以便在开源/内源环境统一代码路径。
- 入口文件：src/index.tsx。
  - 统一导出编辑器相关类型与枚举（例如 EditorInputProps、EditorHandle、Editor、Delta、ToolbarItemEnum 等，定义于 src/types.ts）。
  - 提供若干空实现占位符：Text、ToolbarButton、Plugin，用于与内部闭源实现保持 API 一致但在当前仓库中不做实际渲染。
  - 透出工具函数：md2html、checkAndGetMarkdown、delta2md、normalizeSchema（定义在 src/utils.ts）。
  - 通过 React.lazy 暴露 LazyEditorFullInput、LazyEditorFullInputInner，懒加载真正的编辑器输入组件（从 src/editor.tsx 导入 EditorInput / EditorFullInputInner）。
- 实际可见编辑体验由 src/editor.tsx 中的 EditorFullInputInner / EditorInput 提供：
  - 使用 @coze-arch/coze-design 的 TextArea 作为可编辑区域。
  - 通过 withField 封装为表单字段组件（EditorInput），方便在表单系统中直接使用。
- 核心设计目标：
  - 对外暴露一个“富文本 Markdown 编辑器”的统一接口；
  - 在开源版本中仅提供 textarea + 简单 Delta/markdown 映射，以便上层业务可以无差异集成；
  - 真正复杂的富文本能力留给内建闭源实现，通过相同类型和导出形态复用业务代码。

## 开发与运行工作流

- 依赖管理与初始化：
  - 整体前端使用 Rush + PNPM 管理依赖，在仓库根目录执行：
    - rush update
  - 子包自身依赖主要为：
    - @coze-arch/coze-design：统一设计系统与表单 HOC（withField、TextArea 等）。
    - @coze-arch/bot-api：目前未在可见源码中直接使用，但为未来能力预留接口类型。
- 常用脚本（在 frontend/packages/common/md-editor-adapter 目录执行）：
  - 构建：npm run build
    - 当前实现为 exit 0，本包自身不产出构建物；真正打包由上层应用/构建系统处理。
  - 单测：
    - npm test / npm run test
      - 实际命令为 vitest --run --passWithNoTests，测试配置由 @coze-arch/vitest-config 提供（见 vitest.config.ts）。
    - npm run test:cov
      - 在 test 基础上增加覆盖率统计。
  - Lint：npm run lint
    - 使用 eslint.config.js 中的 @coze-arch/eslint-config web 预设。
  - README 中提到 dev / esm/umd bundle/storybook 为模板说明，当前 package.json 未定义 dev / build 打包逻辑；如需本地 Storybook 或打包，应参考 monorepo 顶层配置，而非在本包单独新增构建工具链。

## 代码结构与约定

- src/index.tsx：对外入口
  - 类型与常量全部从 src/types.ts 透出，保持本包作为“类型门面层”的角色。
  - Text、ToolbarButton、Plugin 均为空实现，目的是在开源环境下不引入真实富文本渲染逻辑，同时让现有业务代码可以无改动编译通过。
  - LazyEditorFullInput、LazyEditorFullInputInner：
    - 使用 React.lazy 按需加载 ./editor 模块中的 EditorInput / EditorFullInputInner；
    - 上层业务通常通过这两个 lazy 组件在需要时加载编辑器，避免在首屏强制引入编辑器代码。
  - 从 src/utils.ts 再导出 md2html、checkAndGetMarkdown、delta2md、normalizeSchema，业务侧应优先使用这些函数而不是自己解析 Delta/Markdown。
- src/editor.tsx：轻量编辑器实现
  - EditorFullInputInner：
    - 是一个 forwardRef 组件，ref 暴露 EditorHandle（setDeltaContent、getEditor、getMarkdown）。
    - 内部维护 value / isComposing 两个状态：
      - value：当前文本内容，初始化自 props.value。
      - isComposing：IME 输入法组合态标记，组合过程中不会频繁触发 onChange，从而避免中文输入抖动问题。
    - 使用 valueRef 同步记录最新 value，保证 getContent / getText 始终读取到当前值。
    - editorRef 实现一个“Editor 接口兼容对象”：
      - setHTML / setText / setContent：将传入内容写入 value。
      - getContent / getText：返回当前文本内容或 Delta 形式内容。
      - 其他接口（getRootContainer / getContentState / selection / registerCommand / scrollModule / on）为空实现或简单占位，用于兼容内部富文本 Editor 类型。
    - useImperativeHandle 将上述能力通过 ref 暴露给外层；getEditor 回调允许调用方在挂载时拿到 editorRef.current。
    - 渲染层：
      - 使用 TextArea 组件，透传其余 props（restProps）。
      - onChange：更新本地 value；若非组合输入阶段，则触发 props.onChange(v)。
      - onCompositionStart / onCompositionEnd：管理 isComposing 与最终 propsOnChange 调用。
  - EditorInput：
    - 通过 withField 包装 EditorFullInputInner，适配表单组件体系；
    - 约定 valueKey 为 value，onKeyChangeFnName 为 onChange。
- src/utils.ts：Markdown 与 Delta 工具函数
  - md2html(md: string): string
    - 目前为“空实现”，直接返回入参 md；注释说明用于“开闭源统一实现占位”。
    - 上层依赖不要对其输出做复杂假设（例如 DOM 解析），在需要真实 HTML 转换时应在内源版本接入真正实现。
  - delta2md(delta, zoneDelta, ignoreAttr?)
    - 将 Delta 结构转换为 markdown 与附件信息；当前实现简单返回：
      - markdown: delta.insert
      - images / links / mentions / codeblocks：均为空数组。
    - 依赖方如需图片/链接等抽取，应在内部版本实现中扩展此函数；在本仓库中只保证 markdown 字段可用。
  - checkAndGetMarkdown({ editor, validate, onImageUploadProgress? })
    - 目前仅返回 editor.getText() 作为 content，并返回空的 images / links 数组；
    - validate / onImageUploadProgress 参数在公开版本中未使用，保留参数是为了与内源更完整实现兼容。
  - normalizeSchema(input)
    - 将数组形式的 zone 描述转为以 '0' 为 key 的对象形式：
      - 保留 zoneType / zoneId / ops 字段；
    - 用于兼容上游对“多 zone Schema”的期望结构，当前实现只处理第一个元素。
- 其他文件：
  - tsconfig*.json：使用 @coze-arch/ts-config 的 web 预设，启用严格 TS 检查；
  - eslint.config.js / .stylelintrc.js：继承统一前端规范，不建议在本包添加自定义风格规则，保持与其他 frontend 子包一致。

## 集成方式与使用约定

- 在业务/上层包中常见用法示例（伪代码）：
  - 懒加载编辑器：
    - 使用 React.Suspense 包裹 LazyEditorFullInput 或 LazyEditorFullInputInner，根据需要传入 value / onChange 等 props。
  - 受控使用：始终通过 value / onChange 受控管理内容，避免在业务层同时维护自身 state 和调用 ref.setDeltaContent 造成不同步。
  - 获取 markdown 内容：
    - 通过 ref.getMarkdown() 拿到当前纯文本 markdown，再结合 md2html 或后端转换使用。
  - 检查与抽取内容：
    - 上层可以通过 checkAndGetMarkdown({ editor, validate: true }) 获取 { content, images, links } 结构，但当前实现 images/links 固定为空；如需使用附件信息，应在内源版本实现中完成。
- 与表单系统集成：
  - EditorInput 已经通过 withField 适配 @coze-arch/coze-design 的表单容器：
    - 直接在 Form.Item 中使用 EditorInput，value 与 onChange 将自动与表单值联动。
  - 若需要更细粒度控制（例如手动管理 ref 或实例），可直接使用 EditorFullInputInner 并结合 forwardRef。
- 类型与开放封装：
  - 建议依赖 src/index.tsx 导出的类型（Editor、Delta、EditorInputProps 等），避免直接从 ./types 引入，以便未来可以在不破坏外部的前提下调整内部结构。

## 项目规范与协作注意点

- 本包是一个“适配层 + 占位实现”：
  - 不在这里引入实际的复杂富文本编辑能力（如 Markdown AST、代码高亮、图片上传等），这些应在闭源实现内完成；
  - 在开源仓库中修改时，应避免向外暴露与闭源实现不兼容的新行为（例如改动 Editor 接口字段名）。
- 变更公共 API 时：
  - 任何对外导出的组件/类型/函数（尤其是 index.tsx 的导出）变更，都可能影响多个上层子包；
  - 修改前应在仓库内全局搜索引用，确认兼容性，再视情况采用“新增字段/方法而非删除/改名”的方式演进。
- 单测与回归：
  - 若在 editor.tsx / utils.ts 中更改行为（例如调整组合输入逻辑、Delta 转换规则），建议补充 Vitest 单测，至少覆盖：
    - 受控输入与 onChange 的调用时机；
    - isComposing 打开/关闭时的行为差异；
    - md2html / delta2md / checkAndGetMarkdown 的基本返回结构。
- 性能与懒加载：
  - LazyEditorFullInput 默认通过 React.lazy 按需加载编辑器组件，保持首屏 bundle 较小；
  - 若在 editor.tsx 中引入较重依赖（例如语法高亮、解析库），应继续维持这种懒加载模式，不要在 index.tsx 中直接同步 import 编辑器实现。

## 不寻常/需要特别说明的特性

- Text / ToolbarButton / Plugin 为空实现：
  - 这些导出仅用于兼容上游业务在内源环境中对“富文本编辑器工具栏/插件系统”的依赖；
  - 在当前仓库中不要给它们补上“半截实现”，否则容易出现行为与真正编辑器不一致的问题；如确需扩展，应在闭源实现侧完成，并保持这里仍然是最小占位。
- 工具函数的“空实现”策略：
  - md2html、delta2md、checkAndGetMarkdown、normalizeSchema 等函数目前都只保证签名与返回结构存在，不承担完整富文本处理；
  - 任何使用这些工具的上层逻辑都应考虑到“当前实现返回的是非常朴素的数据”，不要依赖高级特性（如图片/mention 抽取）。
- build 为 no-op：
  - 本包不产生 dist 目录，也不在自身目录执行真实打包；
  - 构建/打包行为完全依赖工作区顶层（apps 或工具包），在这里追加 bundler 配置可能与整体架构冲突。
