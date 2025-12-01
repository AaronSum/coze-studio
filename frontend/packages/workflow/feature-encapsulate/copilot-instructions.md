# feature-encapsulate 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/feature-encapsulate）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本包为工作流「封装 / 解封」（encapsulate / decapsulate）能力的功能子模块，基于 free-layout 工作流编辑器和 Inversify IoC 容器。
- 对外主要导出（见 src/index.ts）：
  - createWorkflowEncapsulatePlugin：为 @flowgram-adapter/free-layout-editor 创建插件的入口。
  - EncapsulateService：封装/解封业务服务（核心领域逻辑）。
  - EncapsulatePanel：封装 UI 面板组件。
  - ENCAPSULATE_SHORTCUTS：与快捷键等交互相关的配置常量。
- 关键子目录与职责：
  - src/encapsulate：封装领域服务层（EncapsulateService、Manager、Nodes/Lines/Variable 子服务等）。
  - src/validate：验证服务与结果模型，对封装条件进行统一校验。
  - src/validators：具体的校验规则集合及其 ContainerModule 装配。
  - src/generate：封装后的 workflow 生成逻辑（例如节点、连线、变量变换）。
  - src/render：与渲染、快捷键、UI 面板、tooltip 等交互相关的逻辑。
  - src/api：封装结果落盘 / 远端同步等 API 服务抽象。
  - src/utils：内部工具函数。
  - src/workflow-encapsulate-container-module.ts：将上述服务/上下文绑定到 Inversify 容器。
  - src/create-workflow-encapsulate-plugin.ts：组合 ContainerModule 并向 free-layout-editor 暴露插件。
  - src/encapsulate-context.ts：桥接外部上下文（例如节点模板、全局状态）、插件上下文的共享对象。
- 数据流大致路径：
  1. 用户在工作流编辑器里进行「封装」或「解封」行为（快捷键或 UI 操作）。
  2. EncapsulateShortcutsContribution/EncapsulatePanel 调用 EncapsulateService 或 EncapsulateManager。
  3. EncapsulateService 协调 EncapsulateNodesService / EncapsulateLinesService / EncapsulateVariableService、EncapsulateValidateService、EncapsulateGenerateService 等完成校验、生成和 API 调用。
  4. EncapsulateRenderService 负责 loading/tooltip/modal 等 UI 状态管理。

## 2. 插件与 DI 模块结构

- 插件创建（src/create-workflow-encapsulate-plugin.ts）：
  - 通过 definePluginCreator 定义 createWorkflowEncapsulatePlugin，签名为 PluginCreator<EncapsulatePluginOptions>。
  - onInit 阶段：
    - 初始化 EncapsulateManager。
    - 将 free-layout plugin ctx 注入 EncapsulateContext。
    - 将调用方传入的 getNodeTemplate、getGlobalState、onEncapsulate 回调注册到 EncapsulateContext 或 EncapsulateService。
  - onDispose 阶段：
    - 依次释放 EncapsulateValidateManager、EncapsulateService、EncapsulateManager，注意这些类需实现 dispose 方法并保持幂等。
  - containerModules：
    - WorkflowEncapsulateContainerModule：领域与 API、上下文等。
    - EncapsulateRenderContainerModule：渲染与快捷键。 
    - EncapsulateValidatorsContainerModule：验证规则模块。
- Inversify DI 约定（workflow-encapsulate-container-module.ts）：
  - 服务类以「Impl」后缀实现接口样式的 token，例如 EncapsulateService -> EncapsulateServiceImpl。
  - EncapsulateValidateResult 使用 transient scope + 工厂 EncapsulateValidateResultFactory 创建，避免结果对象复用。
  - EncapsulateContext 作为单例绑定，承担跨服务共享状态。
  - 新增服务时遵循同样模式：
    - 定义类/接口（通常导出类本身作为 DI token）。
    - 在该 ContainerModule 或对应子模块中以 inSingletonScope()/inTransientScope() 绑定。

## 3. 渲染与快捷键集成

- 渲染 ContainerModule（src/render/encapsulate-render-container-module.ts）：
  - 通过 bindContributions 将 EncapsulateShortcutsContribution 注册为 WorkflowShortcutsContribution 的实现。
  - 注入 EncapsulateRenderService 单例，提供 UI 层操作（showTooltip、setLoading、closeModal 等）。
- 快捷键实现（src/render/encapsulate-shortcuts-contribution.ts）：
  - 实现 WorkflowShortcutsContribution 接口，使用 @inject 注入：
    - PlaygroundConfigEntity：用于判断当前是否只读。
    - EncapsulateService：业务入口。
    - EncapsulateRenderService：UI 反馈。
    - WorkflowSelectService：读取当前选中节点。
  - 注册的两个核心命令（见 EncapsulateCommands）：
    - ENCAPSULATE：快捷键 meta g / ctrl g。
      - 先检查 canEncapsulate()，再调用 EncapsulateService.validate()。
      - 若存在错误则调用 EncapsulateRenderService.showTooltip() 显示提示。
      - 若通过校验则 setLoading(true)，执行 encapsulate()，结束后关闭 modal 并恢复 loading。
    - DECAPSULATE：快捷键 meta shift g / ctrl shift g。
      - 使用 WorkflowSelectService 读取当前选中节点，仅在单节点选中时才尝试 decapsulate。
      - 调用 EncapsulateService.canDecapsulate(node) / decapsulate(node)。
- EncapsulatePanel：位于 src/render/encapsulate-panel/，为 UI 主面板，通常配合 EncapsulateRenderService 和上下文组件使用。

## 4. 验证与封装生成流程

- 验证服务结构（src/validate）：
  - EncapsulateValidateService：封装校验入口，对外暴露统一 validate 能力。
  - EncapsulateValidateManager：协调多个 validator，管理验证生命周期和结果聚合，支持 dispose。
  - EncapsulateValidateResult：封装验证结果（是否有错误、错误信息集合等），通过工厂按需创建。
- 具体校验规则（src/validators）：
  - EncapsulateBaseValidator：所有 validator 的基类，抽象通用行为（例如注入上下文、错误收集）。
  - EncapsulateFormValidator / EncapsulateInputLinesValidator / EncapsulateOutputLinesValidator / EncapsulatePortsValidator / EncapsulateSchemaValidator / LoopNodesValidator / StartEndValidator / SubCanvasValidator 等：
    - 每个文件负责一类业务规则（表单完整性、输入输出连线合法性、端口、schema、一致性、起止节点、子画布约束等）。
  - EncapsulateValidatorsContainerModule：使用 ContainerModule 将以上 validator 绑定到 DI 容器，通常以「多实现集合」的方式由 EncapsulateValidateManager 统一消费。
- 生成逻辑（src/generate）：
  - EncapsulateGenerateService：在通过校验后，将选定的节点、连线与变量「封装」成新的 workflow 节点/子画布等（细节可在需要时阅读具体实现）。
  - 该服务一般由 EncapsulateService 协调调用，避免直接在 UI/快捷键层处理复杂生成逻辑。

## 5. API 与上下文集成

- EncapsulateApiService（src/api/encapsulate-api-service.ts）：
  - 封装对外部后端的请求，如保存封装后的 workflow、同步配置等。
  - 通过 EncapsulateApiService 接口 + EncapsulateApiServiceImpl 实现抽象，便于单测时通过 Vitest mock。
- EncapsulateContext（src/encapsulate-context.ts）：
  - 提供 setPluginContext / setGetNodeTemplate / setGetGlobalState 等方法，用于将 free-layout 编辑器暴露的能力与封装逻辑解耦。
  - EncapsulateService、GenerateService、Validators 等可通过 EncapsulateContext 访问外部依赖，而不直接依赖编辑器实现细节。

## 6. 项目约定与编码风格

- 语言与框架：TypeScript + React 18，使用 Inversify 进行依赖注入，Immer/Lodash 等用于数据处理。
- 导出约定：
  - index.ts 仅做 re-export，不写具体实现逻辑。
  - 具体实现放在独立文件，例如 encapsulate-service.ts、encapsulate-manager.ts。
- 命名约定：
  - Service 结尾的类表示业务服务，可注入使用，并通常有 dispose 方法。
  - Manager 结尾的类负责流程编排与资源管理。
  - XxxContainerModule.ts 负责绑定 DI 容器，不包含业务逻辑。
  - Validator 结尾表示一个具体校验器，继承 EncapsulateBaseValidator。
- 错误处理：
  - UI/快捷键层（render/*）主要负责「可见错误」处理，如 tooltip 展示和 loading 状态；
  - 领域层（encapsulate/*、validate/*、generate/*、api/*）应返回 EncapsulateValidateResult 或抛出明确异常，由调用方捕获后统一处理；
  - EncapsulateShortcutsContribution 内若 encapsulate() 抛异常，仅在控制台打印，不中断整个编辑器运行。

## 7. 构建、测试与调试流程

- 包级 scripts（package.json）：
  - build：目前为占位命令（exit 0），构建通常在上层 rsbuild / rush 流程中完成；不要在此包内添加自定义打包逻辑，除非与 monorepo 架构保持一致。
  - lint：eslint ./ --cache，遵循 @coze-arch/eslint-config。
  - test：vitest --run --passWithNoTests，使用 @coze-arch/vitest-config 统一配置。
  - test:cov：npm run test -- --coverage。
  - test:update：vitest --update 更新快照。
- Vitest 配置（vitest.config.ts）：
  - 使用 defineConfig({ preset: 'web' })，且通过 alias 将某些外部包（@coze-workflow/render、@coze-workflow/components、@coze-arch/bot-icons、@coze-studio/bot-detail-store*）指向 __tests__/default.mock.ts，避免在单测中引入复杂 UI / 运行时依赖。
  - esbuild.tsconfigRaw 开启 experimentalDecorators 与 emitDecoratorMetadata，确保 Inversify 装饰器正常工作。
  - test.setupFiles: __tests__/setup.ts 负责全局环境/DOM mock。
- 在 monorepo 中运行：
  - 安装依赖：在仓库根目录运行 bash scripts/setup_fe.sh 或 rush update。
  - 针对本包的测试与 lint 一般通过 rushx：
    - rushx test --to @coze-workflow/feature-encapsulate（具体命令请参考 frontend/README 或 rushx-config）。
    - rushx lint --to @coze-workflow/feature-encapsulate。

## 8. 贡献与协作注意事项

- 避免在本包内直接依赖浏览器全局变量，统一通过外层框架或上下文注入（如 EncapsulateContext / PlaygroundConfigEntity / WorkflowSelectService）。
- 添加新验证规则时：
  - 在 src/validators 新建对应 validator 文件并继承 EncapsulateBaseValidator。
  - 在 EncapsulateValidatorsContainerModule 中注册新 validator，保持顺序和分类清晰。
  - 确保 EncapsulateValidateManager 能正确收集并聚合新规则的结果。
- 修改快捷键或命令：
  - 在 src/render/types.ts 中更新 EncapsulateCommands 与 ENCAPSULATE_SHORTCUTS。
  - 同时调整 EncapsulateShortcutsContribution.registerShortcuts 中的逻辑，保持 isEnabled / execute 行为与产品预期一致。
- 与外部包集成时（例如 @coze-workflow/base、@flowgram-adapter/free-layout-editor 等）：
  - 优先查阅对应包的类型定义和现有用法（可参考 frontend/packages/workflow/playground 中对 createWorkflowEncapsulatePlugin 与 EncapsulatePanel 的使用方式）。
  - 避免在此包中重新实现已有的基础能力，而是通过依赖注入和上下文进行复用。

## 9. 非常规 / 需要特别注意的点

- tsconfig.json 中 exclude 配置为 ["**/*"]，真正的编译配置在 tsconfig.build.json 与 tsconfig.misc.json 中，由上层构建工具统一消费；不要直接在 tsconfig.json 中追加 include 逻辑。
- 多个外部依赖在测试环境通过 alias 指向 __tests__/default.mock.ts，意味着：
  - 单测中不能依赖这些包的真实实现；
  - 若新增对这些包的新引用，必要时也要更新 vitest.config.ts 中的 alias。
- EncapsulateValidateResult 使用 DI 工厂模式创建；如果需要在验证流程之外独立构造结果对象，应使用 EncapsulateValidateResultFactory，而不是 new。
- onEncapsulate 回调通过 createWorkflowEncapsulatePlugin 的 options 注入，调用时传入 res 和 ctx；新增字段或行为时要考虑兼容已有调用方。
