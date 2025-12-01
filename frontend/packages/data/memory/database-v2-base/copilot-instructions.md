# @coze-data/database-v2-base — AI 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/memory/database-v2-base）中安全、高效地协作开发。

## 包角色与定位

- 本包是数据域的前端基础包，主要提供「数据库 v2」相关的通用 UI 组件（如单行输入/选择、创建表弹窗、可关闭横幅）、提示文案，以及与数据库字段/页签相关的类型与常量。
- 对外通过 package.json 的 exports 暴露：
  - components：常用交互组件（dismissible-banner、singleline-input/singleline-select、create-table-modal 等）。
  - constants：数据库字段相关常量与默认配置（见 src/constants）。
  - features：特定业务片段组件（例如 database-detail-waring）。
  - types：字段、标签、页签等 TypeScript 类型定义（见 src/types）。
- 包本身不负责发起网络请求或管理全局状态，而是作为上层应用和其它数据包复用的 UI/类型基础层。

## 目录与主要模块

- src/index.tsx
  - 作为聚合出口，将组件、constants、features、types 统一 re-export，调用方应优先从包根路径或 exports 子路径引用，而不要直接访问内部文件。
- src/components
  - dismissible-banner：可关闭的提示条组件，用于在数据库页面展示不可忽略或一次性提示。
  - singleline-input / singleline-select：数据库配置场景常用的单行输入/下拉选择，样式继承自统一设计体系，适配新增/编辑表字段等场景。
  - create-table-modal / base-info-modal 等：用于创建/编辑表、基础信息的弹窗组件，封装表单结构与交互流程。
  - 组件样式使用 *.module.less，类名通过 CSS Modules 绑定；修改 UI 时保持与现有类名和布局模式一致，避免破坏统一风格。
- src/constants
  - index.ts：集中导出数据库相关常量入口。
  - database-field.tsx：描述字段类型、默认展示文案、示例 key 等配置，用于驱动 UI 呈现和占位说明。
- src/types
  - database-field.ts：数据库字段模型类型（字段类型、是否必填、默认值、示例等）。
  - database-tabs.ts：数据库相关页签/视图枚举与配置类型。
  - index.ts：聚合导出所有类型，对外作为唯一类型入口。
- src/utils
  - get-file-extension.ts：从文件名推导扩展名，供上传/预览展示或后续校验使用。
  - get-base64.ts：将文件/图片转为 base64 字符串，方便与后端或其它组件交互。
- src/assets
  - database-default-icon.svg：数据库默认图标资源。
  - key-example.png：示例 key 截图，用于 UI 说明或文档展示。

## 依赖与运行时假设

- 依赖 React 18 与 ReactDOM，所有组件为函数式组件，需在 React 环境中使用。
- 设计体系依赖 @coze-arch/coze-design、@coze-arch/bot-icons / bot-semi 等 workspace:* 包，新增组件时应尽量复用这些基础组件，而非引入新的 UI 库。
- 与数据/业务交互依赖上层包，例如 @coze-data/utils、@coze-data/reporter 或具体应用；本包内部不直接发 HTTP 请求或依赖全局 store。

## 构建、测试与 Lint

- 构建
  - package.json 中 build 脚本为 "exit 0"，说明本子包不单独产出构建产物，实际打包由前端整体构建系统统一处理。
  - 如需检测类型错误，请通过仓库根目录的 Rush/Rspack 构建命令执行 TS 检查，而不要在本包新增自定义构建脚本。
- 测试
  - 使用 Vitest，配置在 vitest.config.ts，并通过 @coze-arch/vitest-config 统一 preset（web）。
  - 默认脚本：test（vitest --run --passWithNoTests）、test:cov（附加覆盖率）。新增核心逻辑（尤其 utils）时，建议在 __tests__ 下补充单测。
- Lint
  - 使用 eslint.config.js + @coze-arch/eslint-config 进行代码风格检查，脚本为 lint：eslint ./ --cache。
  - 新增文件时优先沿用现有 import 顺序与风格，避免随意关闭规则。

## 开发约定与注意事项

- 导出与 API 稳定性
  - 对外能力必须通过 src/index.tsx 与 package.json.exports/typesVersions 暴露；新增组件或类型时，请同时更新这些出口，保持路径与类型入口一致。
  - 避免从内部相对路径（如 src/components/xxx）在外部包直接 import，以免后续重构造成隐式破坏。
- 组件设计
  - 所有组件保持「受控 + 轻逻辑」优先：表单值、可见性、错误信息等由上层状态驱动，本包组件只负责渲染与触发回调（如 onChange / onOk / onCancel）。
  - 弹窗组件（如 create-table-modal）只负责前端表单与简单校验，不直接封装具体业务 API；实际创建/更新动作由上层在回调中执行。
- 类型与常量
  - 数据库字段/页签等模型的新增/调整，应优先修改 src/types 与 src/constants 下的集中定义，再在组件中引用，避免散落魔法字符串或局部枚举。
  - 若字段/配置需要与后端协议对齐，请在类型或常量定义处添加清晰注释，确保修改时能同步后端/IDL。
- 工具函数
  - utils 中函数应保持纯函数特性，不依赖浏览器全局状态；处理文件时只关注输入输出转换，实际上传/存储逻辑由调用方负责。

## 对 AI 助手的建议

- 在本包内新增功能时，请优先判断需求属于哪一层：
  - 纯 UI/交互：放在 src/components 或 src/features，并通过 src/index.tsx 暴露。
  - 类型/配置扩展：放在 src/types 或 src/constants，并尽量保持向后兼容。
  - 工具方法：放在 src/utils，编写对应单测。
- 修改现有组件前，先查阅其在上层应用中的使用方式（通过全局搜索组件名），避免破坏对外约定的 props 或行为。
- 不要在本包引入新的全局状态管理或网络库；如确有 cross-cutting 需求，应在更高层（应用或数据域其他包）实现，再以 props/回调方式传入本包组件。
