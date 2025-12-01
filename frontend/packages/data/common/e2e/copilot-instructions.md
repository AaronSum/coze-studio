# @coze-data/e2e 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/common/e2e）中安全、高效地协作开发。

## 1. 子包角色与整体架构
- 本包提供「前端可观测的 e2e 打标 ID」的集中定义，面向自动化测试、埋点或回放系统使用。
- 导出入口为 src/index.ts，统一暴露四类枚举：
  - KnowledgeE2e：知识库全链路相关标识，对应知识创建、上传、分段、增量等页面流程。
  - BotE2e：Agent/Bot 相关配置与调试页面的 UI 标识（变量、记忆、数据库等）。
  - CommonE2e：通用 UI 交互（文件选择、图片上传、通用表格渲染等）。
  - VariableE2e：变量树等独立模块相关标识。
- 所有枚举值都映射为字符串 key，例如 "knowledge.create.modal.title.text"，由上层 UI 组件在 data-* 属性或测试框架中引用。
- 该子包自身不依赖 React 或运行时代码，只是类型安全的常量集合，构建输出为 TS -> JS 的 ESM/UMD 包，供 monorepo 内其他前端包消费。

## 2. 代码结构与文件说明
- src/index.ts
  - 统一 re-export 各领域枚举：KnowledgeE2e、BotE2e、CommonE2e、VariableE2e。
  - 作为其他包的唯一推荐导入入口，避免从具体文件路径 import。
- src/knowledge-e2e.ts
  - 定义 KnowledgeE2e enum，覆盖知识库 Tab、创建弹窗、多种上传方式、本地/在线/自定义/表格/图片等场景。
  - 枚举值命名基本模式：领域 + 页面/模块 + 具体控件 + 动作/类型（例如 knowledge.create.table.local.preview.title.text）。
  - 末尾定义 UIE2E 常量数组，收录底层通用 UI 前缀标识（ui.*），供需要遍历底层组件 key 的场景使用。
- src/bot-e2e.ts
  - 定义 BotE2e enum，主要覆盖：Bot 列表、知识配置弹窗、变量配置与调试、数据库配置与调试、记忆调试等功能区域。
  - 与 KnowledgeE2e 一样，严格使用「点分层级」字符串，确保可读性与可组合性。
- src/common-e2e.ts
  - 定义 CommonE2e enum，放置跨业务通用的 e2e key，例如上传组件、通用文件选择器、通用表格文本渲染等。
- src/variable-e2e.ts
  - 定义 VariableE2e enum，目前仅包含变量树删除按钮等少量标识，后续如有扩展仍建议集中放在此处。
- README.md
  - 简要说明本包是 React 组件 + Storybook 模板起家，但在当前形态下主要作为 e2e 打标常量集合使用。
- tsconfig.build.json / tsconfig.json
  - 继承 monorepo 通用 TS 配置 @coze-arch/ts-config/tsconfig.web.json，启用严格类型检查（strictNullChecks、noImplicitAny）。
  - 构建输出目录为 dist，索引入口为 src/index.ts。

## 3. 开发与构建流程
- 依赖安装
  - 在仓库根目录执行：rush install 或 rush update，确保 monorepo 依赖完整。
- 本包脚本（在 frontend/packages/data/common/e2e 内）：
  - lint：npm run lint（底层执行 eslint ./ --cache，规则来自 @coze-arch/eslint-config）。
  - build：npm run build（当前实现为 exit 0，CI 只验证 TS 编译通过即可，由 Rush/TS 工具链统一增量构建）。
- 推荐本地验证步骤：
  - 先在仓库根目录：rush build -t @coze-data/e2e 或对应链路的增量构建命令，验证 TS 无误并确保依赖方可正常编译。
  - 若需要联调 UI，可到引用这些 e2e key 的上层应用（例如 frontend/apps/coze-studio 或相关 data/knowledge 包）执行 rushx dev / rushx build。

## 4. 项目约定与命名规范
- e2e key 命名规则
  - 统一使用小写 + 下划线/点分层：<领域>.<页面或模块>.<子模块>.<控件>.<动作或类型>。
  - 领域前缀示例：
    - knowledge.*：知识库相关页面与弹窗。
    - bot.*：Bot / Agent 配置、变量、数据库、记忆调试相关。
    - common.*：与具体业务无关的通用交互。
    - variable.*：变量模块特有节点。
    - ui.*：底层通用 UI 组件，如表格操作按钮、搜索输入等（集中在 UIE2E 数组中）。
  - 语义应尽量贴近 UI 文案与交互含义，而非实现细节；避免携带短期性的实验信息。
- TypeScript 使用约定
  - 所有 e2e key 必须通过 enum 成员定义，不允许硬编码字符串散落在业务层，方便全局搜索与重构。
  - enum 成员名采用 PascalCase + 简要英文描述（例如 KnowledgeTab、CreateKnowledgeModalTitle），值为稳定的字符串 key。
  - 新增或调整枚举时必须保持向后兼容性考虑：已有自动化脚本依赖这些 key，删除或重命名需要明确评估。
- 注释与多语言
  - 枚举上方的注释描述 UI 含义和场景，用英文为主，必要时附简短中文解释。
  - 某些历史或弃用 key 在枚举中以注释行保留，表示当前不推荐新用，但仍存在于线上脚本，可用于回溯。

## 5. 与其他子包的集成方式
- 使用方式
  - 其他前端包应从 @coze-data/e2e 导入所需枚举，而非引用内部文件路径：
    - import { KnowledgeE2e, BotE2e, CommonE2e, VariableE2e } from '@coze-data/e2e';
  - 在 React 组件或测试工具中，将枚举值绑定到 data- 属性或测试选择器上，例如：
    - <Button data-e2e={KnowledgeE2e.CreateKnowledgeModalSubmitAndImportButton} />
  - 对底层通用 UI 组件，可使用 UIE2E 数组辅助生成白名单或校验规则。
- 依赖与约束
  - 本包 devDependencies 仅包含 lint/ts/stylelint 配置包，不引入运行时依赖，确保被任意前端子包安全引用。
  - 对于知识、Bot、变量、数据库等业务模块的 UI 变更，应先在具体业务包中设计布局，再回到本包补充/调整对应 e2e 枚举值。

## 6. 变更流程与协作注意事项
- 变更类型
  - 新增：为新 UI 元素或流程添加枚举成员，倾向追加而非复用旧 key，确保语义清晰。
  - 修改：如需修改字符串值（例如重构路径层级），必须检查所有使用方，通常应通过 "新增新 key + 标记旧 key 待废弃" 的方式渐进迁移。
  - 删除：仅在确认无任何自动化依赖后才可移除；建议先在业务侧与 QA/自动化同学沟通。
- 协作建议
  - 对粒度较大的页面改版，优先在设计阶段一起梳理 e2e key 命名，避免后期多次改名。
  - 保持不同领域文件的职责边界：知识相关放在 knowledge-e2e.ts、Bot 相关放在 bot-e2e.ts，通用放在 common-e2e.ts，避免跨文件散落。

## 7. 非常规点与易踩坑
- build 脚本目前为占位（exit 0），不要在本包里引入额外的构建步骤；构建逻辑统一由 monorepo 顶层处理。
- tsconfig.json 顶层 exclude 配置为 ["**/*"]，真实编译入口由 tsconfig.build.json 控制；在本包增加文件时，只需放在 src/ 下即可被构建，无需修改 exclude。
- 某些注释掉的枚举成员（特别是 KnowledgeE2e、BotE2e 中以 ui.* 开头的原始标记）源自历史实现：
  - 新增标记时不可直接复用这些旧 key，除非确认自动化脚本仍依赖，并与相关负责人达成一致。
- 由于本包被大量前端应用依赖，小改动也可能影响 CI 或自动化测试稳定性；对 AI 助手而言，任何对 enum 的删改都应默认视为「高风险操作」，除非用户明确要求。
