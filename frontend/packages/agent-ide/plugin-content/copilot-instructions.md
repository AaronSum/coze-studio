# @coze-agent-ide/plugin-content — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/plugin-content）中安全、高效地协作开发。

## 一、子包角色与全局架构

- 包名：@coze-agent-ide/plugin-content，定位为「Agent IDE 中插件列表区域的内容渲染组件」。
- 对外入口：src/index.ts 只导出一个组件与其 props：
  - PluginContent
  - PluginContentProps
- 核心组件：src/components/plugin-content/index.tsx，实现插件列表区域的完整 UI 与交互。
- 主要职责：
  - 将「已启用插件 API 列表」与「插件基础信息」合并为可展示的数据源。
  - 渲染每个插件的名称、描述、图标、标签（本地插件）、状态（已下架）、操作按钮等。
  - 提供复制 API 名称、打开插件设置、删除插件等操作入口，并打通埋点与后端 API。
  - 允许上层通过 renderPluginItemIconSlot / renderActionSlot 插槽在单个条目上扩展图标或操作按钮。
- 非目标：
  - 不负责插件启用/禁用的策略与权限控制，只消费传入的 pluginApis。
  - 不负责插件的创建与编辑页面，设置入口交给 @coze-agent-ide/plugin-setting-adapter 处理。

## 二、关键数据结构与数据流

- PluginContentProps（对外 API）：
  - spaceID?: string：当前空间 ID，用于 DeleteBotDefaultParams 等后端调用；可以为空。
  - botId: string：当前 Bot/Agent ID，是多数埋点和 API 调用的必要参数。
  - pluginApis: EnabledPluginApi[]：当前技能下启用的插件 API 列表，来自 @coze-studio/bot-detail-store。
  - plugins: PluginInfoForPlayground[]：插件基础信息列表（名称、图标、状态、类型等），来自 @coze-arch/bot-api。
  - readonly: boolean：是否只读。只读时不显示设置/删除等会修改状态的操作按钮。
  - renderPluginItemIconSlot?(params: RenderSlotParameters): ReactNode：用于在 ToolItem 的 icons 区域注入自定义内容。
  - renderActionSlot?(params: RenderSlotParameters): ReactNode：用于在默认 Actions 中插入额外操作。
- 内部聚合结构：
  - PluginData = { api: EnabledPluginApi; info?: PluginInfoForPlayground }。
  - pluginData 数组通过 useMemo 根据 pluginApis + plugins 生成：
    - 匹配逻辑：plugins.find(_plugin => _plugin.id === api.plugin_id)。
  - apiUniqueId：使用 getApiUniqueId({ apiInfo: plugin.api }) 生成，用于上层唯一标识该 API（方便插槽中打点或扩展逻辑）。
- 状态与更新路径：
  - useBotSkillStore(state => state.updateSkillPluginApis)：从 @coze-studio/bot-detail-store 读取更新函数，用于删除插件时写回新的 pluginApis 列表。
  - 删除逻辑：调用 updateSkillPluginApis(filter 后的数组)，然后调用 PluginDevelopApi.DeleteBotDefaultParams 通知后端删除默认参数配置。

## 三、UI 结构与交互模式

- 列表容器：
  - 使用 @coze-agent-ide/tool 中的 ToolItemList 包裹每个 ToolItem。
  - 每个 ToolItem 渲染：
    - title："{plugin.info?.name} / {plugin.api.name}"（插件名 / API 名）。
    - description：plugin.api.desc。
    - avatar：plugin.info?.plugin_icon。
    - tags：当 plugin_type === PluginType.LOCAL 时，展示一个 cyan mini Tag（local_plugin_label）。
    - disabled：当 plugin.info.status === PluginStatus.BANNED（下架）时禁用交互。
    - tooltips：在下架状态下显示「已下架 + 删除按钮」。
    - icons：通过 renderPluginItemIconSlot 扩展。
    - actions：通过内部 Actions 组件 + renderActionSlot 组合。
- 下架态特殊处理：
  - isBanned = plugin.info?.status === PluginStatus.BANNED。
  - ToolItem.disabled = isBanned。
  - tooltips：右侧展示「Plugin_delisted」文案与一个删除按钮，点击后调用 handleDelete。
  - actions：整体不渲染交互式设置/删除，仅保留 tooltip 区域的删除按钮，避免误操作。
- 插槽位使用：
  - renderPluginItemIconSlot：适合渲染额外状态图标（如「新」标记、监控状态灯）。
  - renderActionSlot：插在默认 Actions 中，可扩展为「测试调用」「跳转文档」等额外 Action；在 readonly==true 或 isBanned==true 的情况下不会渲染默认可写操作。

## 四、操作行为与外部依赖

### 4.1 删除插件（handleDelete）

- 位置：PluginContent 组件内部。
- 行为：
  - 1）更新前端状态：
    - 基于 getPluginApiKey(a) !== getPluginApiKey(api) 过滤 pluginApis，兼容历史数据中 api_id 为 '0' 的情况，一并删除。
    - 调用 updateSkillPluginApis(filtered as PluginApi[]) 将新列表写回 bot-skill store。
  - 2）埋点：如果 api.isAuto 为 true：
    - sendTeaEvent(EVENT_NAMES.delete_rec_plugin, { bot_id, api_name, plugin_id })，表示删除了推荐插件。
  - 3）通知后端删除默认参数：
    - PluginDevelopApi.DeleteBotDefaultParams({
        bot_id: botId,
        dev_id: info?.creator?.id,
        plugin_id: api.plugin_id,
        api_name: api.name,
        space_id: spaceID,
        delete_bot: false,
      });
- 注意：
  - 删除操作在下架态既可以通过 tooltip 区域按钮触发，也可以在未下架态的「删除」Action 按钮触发（Actions 中）。
  - AI 扩展删除行为时，应保证三方一致：前端 store、埋点、后端 API 调用。

### 4.2 Actions 组件（复制 / 设置 / 删除）

- 位置：同文件底部的 Actions 组件；仅在 !isBanned 时渲染。
- useToolItemContext：
  - setIsForceShowAction(visible)：在 ParametersPopover 显示/隐藏时调用，用于控制 ToolItem 的「悬浮始终显示操作」状态。
- 复制 API 名称（ToolItemActionCopy）：
  - handleCopy(text):
    - 使用 createReportEvent({ eventName: ReportEventNames.copy, meta: { copyEvent: 'copy_api_name' } }) 创建埋点上下文。
    - 使用 copy-to-clipboard 将文本复制到剪贴板。
    - 成功：reportEvent.success()；Toast.success(content=copy_success, id='plugin_copy_id', showClose=false)。
    - 失败：抛 CustomError 或捕获异常 → reportEvent.error({ reason: 'copy api name fail' })；Toast.warning(copy_failed)。
  - ToolItemActionCopy 配置：
    - tooltips：bot_edit_page_plugin_copy_tool_name_tip。
    - data-testid：bot.editor.tool.plugin.copy-button。
- 参数查看（ParametersPopover + ToolItemIconInfo）：
  - 作为「信息」图标 Hover 区域。
  - pluginApi：plugin.api 以 PluginApi 类型传入，展示插件 API 的参数信息。
  - trigger="hover"、position="bottom"、disableFocusListener=isBanned。
  - onVisibleChange → handleVisibleChange → setIsForceShowAction，保证 hover 时操作区域不消失。
- 插件设置入口（PluginSettingEnter）：
  - 仅在 !readonly 且 !isBanned 时渲染。
  - bindSubjectInfo：
    - componentType: ComponentType.CozeTool。
    - componentID: plugin.api.api_id。
    - parentComponentType: ComponentType.CozePlugin。
    - parentComponentID: plugin.api.plugin_id。
    - detail: { name: plugin.api.name }。
  - bizCtx：
    - trafficScene: TrafficScene.CozeSingleAgentDebug。
    - trafficCallerID: botId。
    - bizSpaceID: spaceID。
  - 其他：plugin、apiInfo、botId、devId=plugin.info?.creator?.id、disabled=isBanned。
  - 行为：打开统一的插件设置编辑界面。
- 删除按钮（ToolItemActionDelete）：
  - 仅在 !readonly 渲染。
  - tooltips：Remove。
  - data-testid：bot.editor.tool.task-manage.delete-button。
  - onClick：handleDelete(plugin.api, plugin.info)。

## 五、工程配置与开发工作流

- package.json：
  - scripts：
    - build：exit 0（不单独打包，由上层构建系统统一处理）。
    - lint：eslint ./ --cache。
    - test：vitest --run --passWithNoTests。
    - test:cov：npm run test -- --coverage。
  - dependencies：
    - @coze-agent-ide/plugin-setting-adapter：插件设置入口组件。
    - @coze-agent-ide/plugin-shared：工具方法（getPluginApiKey、getApiUniqueId 等）。
    - @coze-agent-ide/tool：ToolItemList/ToolItem 及其 Actions/上下文组件。
    - @coze-arch/bot-api：插件与调试相关类型与 API（PluginDevelopApi、PluginStatus、PluginType、ComponentType、TrafficScene 等）。
    - @coze-arch/bot-error：CustomError。
    - @coze-arch/bot-tea：埋点事件 EVENT_NAMES、sendTeaEvent。
    - @coze-arch/report-events：createReportEvent、REPORT_EVENTS。
    - @coze-arch/i18n：I18n.t 文案国际化。
    - @coze-arch/coze-design：Tag、IconButton、Toast 及 IconCozTrashCan。
    - @coze-studio/bot-detail-store：useBotSkillStore 获取并更新技能插件 API 列表。
    - @coze-studio/components：ParametersPopover。
    - copy-to-clipboard：通用复制实现。
- TypeScript：
  - tsconfig.build.json：
    - extends：@coze-arch/ts-config/tsconfig.web.json。
    - rootDir: src，outDir: dist，jsx: react-jsx。
    - strictNullChecks + noImplicitAny：开启严格类型检查。
    - references：指向 arch/*、config/*、studio/* 以及同域包（plugin-setting-adapter、plugin-shared、tool）的 tsconfig.build.json，保证 TS project references 正确。
- Lint / Test：
  - 使用 @coze-arch/eslint-config 作为 ESLint 预设；Vitest 通过 @coze-arch/vitest-config 统一配置（在包根 vitest.config.ts 中）。

## 六、项目约定与开发注意事项

- 只暴露单一入口组件：
  - 新增对外导出时，应保持 src/index.ts 的简单聚合模式，不在入口文件写业务逻辑。
- i18n 文案：
  - 所有中英文文案均通过 I18n.t('key') 获取，本包内仅引用 key，不定义具体文案内容。
  - 新增操作或提示时，应在上游 i18n 包中补充对应 key。
- 埋点与错误：
  - 复制、删除等行为需配套埋点：
    - 文案/事件名来自 @coze-arch/report-events 和 @coze-arch/bot-tea，不要在本包中硬编码字符串。
    - 发生错误时优先通过 CustomError + reportEvent.error 报告，再给用户 Toast 提示。
- 只读模式：
  - readonly=true 时，不允许出现会改变数据的入口（插件设置、删除按钮等），保持只读视图一致性。
  - 若新增「可写操作」，必须挂在 !readonly 条件下。
- 兼容历史数据：
  - 删除逻辑使用 getPluginApiKey 做等价比较，包含 api_id 为 '0' 的旧数据。
  - 未来扩展匹配规则时，务必在 plugin-shared 中统一修改，而不是在本包重复逻辑。
- 插槽扩展：
  - renderPluginItemIconSlot / renderActionSlot 设计为「无侵入式扩展点」，AI 在新增功能时应优先通过插槽扩展，而不是直接改动 PluginContent 内部渲染结构，除非确实需要调整整体布局。

## 七、对 AI 助手的操作建议

- 若要新增行为：
  - 优先检查是否可以通过 renderActionSlot 或 renderPluginItemIconSlot 注入，而不修改现有 Actions 结构。
  - 如必须改动 handleDelete / 复制逻辑，需同步考虑：
    - 前端状态（useBotSkillStore）。
    - 埋点（report-events / bot-tea）。
    - 后端 API（PluginDevelopApi）。
- 若要扩展 props：
  - 在 PluginContentProps 中新增可选属性，并保持现有调用方兼容；再在 src/index.ts 中导出更新后的类型。
  - 避免引入与现有职责无关的字段（如过多与布局/样式强耦合的配置），保持组件关注于「插件内容区域」。
- 在进行重构时：
  - 不改变外部可见的标题/描述/图标/标签/操作区域布局语义，除非产品层有明确需求。
  - 对关键路径（删除、复制、设置入口）进行简单自测或新增 Vitest + @testing-library/react 用例，验证基本行为。
