# @coze-agent-ide/bot-plugin 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-plugin/entry）中安全、高效地协作开发。

## 全局架构与角色定位
- 本子包是 Agent IDE 中「Bot 插件」能力的 UI/逻辑入口，主要用于在 Coze Studio 内管理和查看插件（包括插件详情、工具详情、Mock 集合等）。
- 技术栈：React 18 + TypeScript + Zustand 状态管理，UI 统一使用 @coze-arch/coze-design 体系，并依赖 @coze-arch/bot-api 提供的插件领域接口、@coze-arch/i18n 提供多语言能力。
- 打包/集成方式：
  - package.json 中通过 exports 暴露多个子入口（如 ./page、./hook、./util、./store、./components/*），供主应用和其它包按需引用。
  - main 指向 src/index.tsx，仅导出部分常量与组件（当前为 PLUGIN_TYPE_MAP、PLUGIN_PUBLISH_MAP 以及 PluginHeader）。
- 与其它子包的关系：
  - 依赖 @coze-agent-ide/bot-plugin-export、@coze-agent-ide/bot-plugin-mock-set、@coze-agent-ide/bot-plugin-tools 等子包，它们分别承载插件导出、Mock 能力、工具管理等具体业务逻辑；本包更加偏向聚合入口和 UI 组合。
  - 通过 @coze-agent-ide/plugin-*、@coze-studio/plugin-*、@coze-studio/mockset-* 等 adapter/store 包对接全局插件存储、发布管理、Mock 集合等能力。

### 目录结构概览
- src/index.tsx：包的主导出入口，暴露公共常量和基础 UI 组件。
- src/common/：存放插件相关的通用常量/映射，例如：
  - src/common/index.ts：定义 PLUGIN_TYPE_MAP（插件类型 → 多语言文案 + 颜色标签）、PLUGIN_PUBLISH_MAP（发布状态 → 多语言文案 + 颜色）。
- src/components/：本子包内部的可复用 UI 组件集合，例如：
  - src/components/plugin-header/：插件详情页头部信息展示组件 PluginHeader（显示插件名称、图标、发布状态、创建方式、描述、OAuth 操作等）。
  - 其它目录（check_failed、code-snippet、oauth-action、plugin-apis、plugin-tool-detail 等）为插件详情页中各功能模块的 UI 和交互组件（AI 修改时需先阅读对应实现再扩展）。
- src/pages/：暴露给上层路由/宿主使用的页面级组件：
  - plugin-id：插件详情页（PluginDetailPage）。
  - plugin-tool-detail：工具详情页（ToolDetailPage）。
  - mock-set：Mock 集列表（MockSetList）。
  - mock-set-detail：Mock 集详情（MockSetDetail）。
- src/hooks/、src/store/、src/util/：
  - 通过 package.json 的 exports 暴露统一入口（./hook、./store、./util）；内部通常封装业务 hooks、Zustand store 和通用工具函数。

## 数据流与关键组件
- 插件类型/发布状态映射：
  - 源于 @coze-arch/bot-api/plugin_develop 中的 PluginType 与接口字段（如 published、meta_info 等），在 src/common/index.ts 中映射为可直接用于 UI 的配置对象（包含文案、Tag 颜色、Icon 颜色等）。
  - 所有展示插件类型/发布状态的组件应复用 PLUGIN_TYPE_MAP 和 PLUGIN_PUBLISH_MAP，避免在多个文件中硬编码文案与颜色。
- 多语言：
  - 使用 I18n.t('xxx_key') 获取文案 key，本包不负责定义文案字典，仅引用已有 key（如 plugin_type_app、Unpublished_1、plugin_mark_created_by_ide 等）。
  - AI 修改时需保持 key 不变，除非已确认上游 i18n 包中存在对应配置。
- 典型 UI 组件：PluginHeader
  - 接口：接收 pluginInfo（GetPluginInfoResponse）、loading、canEdit、extraRight、onClickEdit 等参数。
  - 功能：
    - 展示插件 icon/name/desc。
    - 基于 published 字段通过 PLUGIN_PUBLISH_MAP 渲染 Tag + Icon（使用 @douyinfe/semi-icons 中的 IconTickCircle/IconClock）。
    - 当 creation_method === CreationMethod.IDE 时，追加一个「由 IDE 创建」标记 Tag。
    - 按 canEdit 控制展示编辑按钮或查看按钮（IconEdit / IconCardSearchOutlined）。
    - 挂载 OauthHeaderAction，用于展示/配置 OAuth 相关能力。
  - 依赖样式：使用 CSS Modules（.module.less）+ classNames 组合 Tailwind 原子类（例如 px-[16px]、py-[16px]）形成最终布局。

## 开发与构建流程
- 安装依赖：在仓库根目录执行 rush install 或 rush update，依赖由 Rush + PNPM 管理，本子包不单独运行 pnpm install。
- 本子包命令（在 frontend/packages/agent-ide/bot-plugin/entry 下执行）：
  - lint：`npm run lint` → 使用 @coze-arch/eslint-config，注意遵守项目统一的 ESLint 规则。
  - test：`npm run test` → 使用 Vitest + @coze-arch/vitest-config（web preset），自动加载 __tests__/setup.ts 作为测试初始化。
  - test:cov：`npm run test:cov` → 在 test 基础上输出 coverage 报告。
  - build：当前为 "exit 0"（占位），真实打包通常由上层 Rsbuild/Rush 流程负责，不依赖本包的本地 build。
- 调试/运行：
  - 主应用调试一般在 frontend/apps/coze-studio 中通过 `rushx dev` 或 `npm run dev` 启动。
  - 本包代码改动后会通过 workspace 链接被主应用即时消费；如遇缓存问题，可考虑清理 Rush 缓存或重新启动 dev 服务器。

## 项目约定与风格
- 类型与接口：
  - 优先从 @coze-arch/bot-api、@coze-studio/*、@coze-agent-ide/* 中复用已有类型（如 GetPluginInfoResponse、PluginType、CreationMethod），避免在本包重复声明领域模型。
- UI 与交互：
  - 所有按钮、输入框、布局组件优先使用 @coze-arch/coze-design 与相关子包（例如 Tag、Typography、Space、Avatar、IconButton 等）。
  - 图标统一使用 @coze-arch/bot-icons 或 @douyinfe/semi-icons。
  - 文案均通过 I18n.t 获取；不要在组件中写死中文或英文字符串，除非已有代码中已经这么做且确认为特例。
- 样式：
  - 使用 .module.less + classNames 组合，保证样式作用域隔离。
  - 允许搭配 tailwind 原子类使用，例如 px-[16px]，但仍应把通用样式封装在模块类中（如 plugin-detail-info、plugin-detail-title 等）。
- 状态管理：
  - 业务状态通常由 @coze-arch/bot-studio-store、@coze-studio/*-store 等子包维护，本包若需要局部 UI 状态则使用 Zustand；新增 store 时应通过 src/store/index.ts 暴露统一入口。

## 与外部系统的集成要点
- Bot API：
  - @coze-arch/bot-api/plugin_develop 暴露的类型与接口是本包最重要的后端契约（如 PluginType、GetPluginInfoResponse、CreationMethod 等）。
  - AI 修改调用代码时需保持字段名与类型一致，谨慎变更请求/响应结构，避免破坏与后端的兼容性。
- OAuth / 鉴权：
  - OauthHeaderAction 组件封装在 src/components/oauth-action 下，本包只在 PluginHeader 中挂载，不直接处理 OAuth 逻辑。
  - 如需扩展 OAuth 相关功能，应在对应 adapter/组件内修改，而不是在 PluginHeader 中直接调用后端。
- Mock 能力：
  - MockSetList / MockSetDetail 页面由 src/pages 中导出，具体业务逻辑通常依赖 @coze-studio/mockset-* 系列包。
  - 本包主要负责在 IDE 中提供入口与 UI 展示，不负责构建 Mock 引擎。

## 测试与质量保障
- 测试框架：Vitest，统一通过 @coze-arch/vitest-config 配置；如需新增测试，建议放在 __tests__/ 目录内，与 src 中的模块一一对应或按业务域分组。
- 组件测试：
  - 使用 @testing-library/react、@testing-library/react-hooks 编写 UI 和 hooks 测试。
  - 避免依赖真实后端或全局单例 store，优先使用 mock/fixture。
- Lint 与样式检查：
  - ESLint：通过 eslint.config.js 继承统一规则；新增依赖或语法特性时需保证 lint 不报错。
  - Stylelint：由上层配置提供；新增 .less 文件时注意遵守命名与嵌套规范。

## 协作注意事项（面向 AI 助手）
- 修改入口导出时（package.json.exports、src/index.tsx、src/pages/index.ts 等），必须确保：
  - 不破坏已存在的导出路径与类型签名，除非明确确认没有下游依赖，或同步完成所有受影响调用点的更新。
  - 导出的组件/函数有稳定的 props/参数设计，避免频繁变更公共 API。
- 增加新页面或组件时：
  - 页面级组件应放在 src/pages 下，并通过 src/pages/index.ts 暴露统一入口，如有需要再在 package.json 的 exports 中加上路径别名。
  - 复用型 UI 放在 src/components 下，保持细粒度拆分，避免出现过重的「大组件」。
- 引入新依赖时：
  - 优先使用 monorepo 内已有包（@coze-arch/*、@coze-studio/*、@coze-agent-ide/*、@coze-common/* 等），只有在确认没有现成能力时才增加第三方库。
  - 如必须新增第三方依赖，应符合前端根目录 README 中规定的技术栈和规范，并注意同步到 disallowed_3rd_libraries.json 的限制策略。
- 任何涉及后端接口变更或领域模型调整的修改，都应仅在已充分理解 @coze-arch/bot-api 契约的前提下进行，避免由本子包单方面定义新的后端语义。
