# DDD Practice in Tinker Studio

> 面向：后端 / 全栈 / 架构同学，帮助理解当前仓库在 DDD 及六边形架构上的落地方式，以及阅读代码时如何围绕 **Agent / Workflow / Plugin / Knowledge / Developer / Platform** 这几个核心概念“按领域思考”。

在阅读本文前，建议你已经：

- 对仓库整体目录（backend/application、backend/domain、backend/crossdomain、frontend/packages 等）有基本印象；
- 理解 DDD 的基础概念（实体、聚合、值对象、领域服务、限界上下文等）；

辅助资料：

- DDD 基础概念参考：[ddd-concept-reference](https://domain-driven-design.org/zh/ddd-concept-reference.html)
- 前端包功能释义：主要参考各包下的 `README.md`，也可参考 `copilot-instructions.md`（AI Generated）；

## 1. 统一语言与限界上下文

### 1.1 统一语言（Ubiquitous Language）在仓库中的体现

整体以 `Agent IDE` 为核心域，围绕 **Agent / Workflow / Plugin / Knowledge / Developer / Platform** 等核心词汇建立统一语言。统一语言主要体现在：

- 包名/目录名：如 `domain/agent`、`domain/app`、`domain/conversation`、`domain/knowledge`、`domain/workflow`、`domain/plugin` 等，与业务语义强绑定；
- 类型与方法命名：如 `Agent`, `Conversation`, `KnowledgeBase`, `Workflow`, `Permission`, `User` 等结构体和接口；
- 前后端一致的术语：前端文档与代码中也使用 `Agent`（部分历史接口仍使用 `bot` 字段名）、`Workflow`、`Plugin` 等统一命名。

这使得：

- 讨论“Agent 发布”“知识接入”“对话上下文”等问题时，可以直接映射到对应包/模型；
- 代码审查和需求评审时，业务与技术语言一致，减少“翻译”成本。

#### 1.1.1 Agent / Bot / Studio 名称与历史命名

在项目演进过程中，围绕“智能体工作室/开发环境”出现过多组命名。为了避免混淆，这里统一给出对照表：

- **Agent**：当前统一使用的领域名词，表示一个可配置、可发布的智能体。后端领域模型与前端界面均使用 Agent。
- **Bot**：历史名词，部分接口字段（如 `botId`）、包名中继续保留，用于兼容早期系统；在新的代码、文档、评审中不再使用 Bot 作为主概念名词。

- **Agent IDE**：技术/架构层名字，对应 `frontend/packages/agent-ide/*` 这一大块前端子系统（开发工作区、编辑器、调试器等）。
- **Agent Studio**：产品/体验层名字，指整个“为 Agent 提供创建、管理、调试等能力”的工作室产品，可视为“外壳 + 内部多个子系统（其中之一是 Agent IDE）”。
- **Bot Studio**：旧的对外产品名，目前主要出现在 `@coze-arch/bot-studio-store` 等包名里，承载 Studio 全局空间/用户上下文能力。

约定：

- 领域文档、技术讨论、PR 评审中统一使用 **Agent / Agent IDE / Agent Studio**；
- 提及 **Bot / Bot Studio** 时，需明确是“历史命名/底层字段”，避免新逻辑继续扩散 Bot 相关命名。

### 1.2 限界上下文（Bounded Context）的划分

后端主要通过 backend/application、backend/domain、backend/crossdomain 这三组目录来承载限界上下文与分层角色：

- `backend/domain/*`：**领域模型 + 业务规则**，代表单个限界上下文内部的一致性，是“内核层”。
- `backend/application/*`：**应用服务层**，在单个限界上下文内编排用例，承接 HTTP/RPC/API 调用，做参数校验、权限校验、事务边界管理等。
- `backend/crossdomain/*`：**跨领域协作层**，处理跨上下文的流程与集成，是“多上下文编排层”。

结合当前目录结构，可以更细致地看到这三层如何承载限界上下文：

**backend/domain/**（纯领域视角）

- Agent / App 相关：`domain/agent`、`domain/app`、`domain/template`、`domain/singleagent`，负责 Agent 配置、模板、单 Agent 场景等核心模型与规则。
- Workflow / Conversation：`domain/workflow`、`domain/conversation`、`domain/shortcutcmd`，负责工作流图、运行配置、多轮会话与快捷指令等。
- Plugin / Prompt：`domain/plugin`、`domain/prompt`，负责插件能力、提示词模板等可复用能力建模。
- Knowledge / Datacopy / Memory：`domain/knowledge`、`domain/datacopy`、`domain/memory`，负责知识库、数据拷贝任务与记忆策略建模。
- User / Permission / Openauth：`domain/user`、`domain/permission`、`domain/openauth`，负责账号、权限、开放授权等领域。
- Search / Upload / Connector：`domain/search`、`domain/upload`、`domain/connector`，负责搜索、上传与外部系统连接等领域接口建模。

**backend/application/**（单上下文应用服务视角）

- 基本上与 domain 拥有类似的子目录：`application/app`、`application/workflow`、`application/conversation`、`application/plugin`、`application/knowledge`、`application/user` 等，对应各自上下文的“用例编排层”。
- 典型职责包括：
  - 将 HTTP/RPC/消息等入口映射为 Application Service（命令/查询）调用；
  - 做参数/权限校验、简单防腐（ACL），决定使用哪些领域对象与仓储接口；
  - 定义事务边界（一次用例需要修改哪些聚合、以何种顺序进行）。

**backend/crossdomain/**（跨上下文协作视角）

- 子目录与 domain/application 中的上下文名高度对齐：`crossdomain/agent`、`crossdomain/workflow`、`crossdomain/conversation`、`crossdomain/knowledge`、`crossdomain/plugin`、`crossdomain/user` 等。
- 典型职责包括：
  - 监听/组合多个上下文的领域事件，完成“横切流程”（例如 Agent 发布后，触发 Workflow 索引、Search 索引、Message runtime 准备等）；
  - 将多个上下文的读模型聚合成一个“跨域视图”，供上游查询；
  - 对接外部系统或平台级能力（如 `crossdomain/database`、`crossdomain/search`、`crossdomain/message` 等）。

通过这种设计：

- 领域规则和不变式尽量留在 `backend/domain/*`；
- 单上下文的用例编排与 DTO/参数处理在 `backend/application/*` 完成；
- 复杂跨边界用例放在 `backend/crossdomain/*`；
- HTTP / RPC 适配、DTO 映射则在 `backend/api/*` 层完成。

### 1.3 领域驱动模型，模型驱动软件设计

在本仓库中，“领域驱动模型，模型驱动软件设计”主要体现在：

- **从领域模型出发设计接口与 UI**：新增能力时，优先在 `domain/*` 中补充实体/值对象/服务/事件，然后在 `application/*` 中编排用例，最后再为其补上 HTTP handler 和前端页面；
- **IDL 与前端类型的统一**：`idl/` 下的 Thrift 定义和 `frontend/packages/arch/idl` 中生成的 TS 类型，共同充当“平台级领域模型”，驱动前后端的接口签名与错误码设计；
- **以模型为中心的编辑器**：Agent 配置区、Workflow 编辑器、Plugin 管理、Knowledge 配置等 UI，不是随意拼装，而是围绕对应领域模型（Agent 配置结构、Workflow graph、Plugin/Knowledge schema）来组织表单和交互；
- **模型演进驱动代码演进**：当业务域发生变化（例如 Agent 能力增加新维度、Workflow 节点引入新类型），首先演进的是领域模型与 IDL，然后据此更新仓储、应用服务、API 和前端；
- **避免“页面即模型”反模式**：页面组件只承载展示与交互逻辑，不直接充当领域核心；关键规则和不变式落在领域模型与领域服务中，从而降低“复制业务逻辑到多个页面”的风险。

#### 1.3.1 一个最小的端到端示例（从领域模型到前端）

以下以“为 Agent 增加一个布尔配置字段 `IsInternal`（是否仅在内部环境可见）”为例，展示模型驱动设计在仓库中的端到端路径：

1. **修改领域模型（后端领域层）**

- 在 `backend/domain/agent/model.go` 中，为 `Agent` 聚合结构体增加字段 `IsInternal bool`，并在创建/更新方法中补充不变式（例如：内部 Agent 不能被匿名访问）。

2. **更新平台级模型（IDL）**

- 在 `idl/app/agent.thrift`（或相关 IDL 文件）中，为 Agent 相关结构体增加对应字段 `is_internal`；
- 重新生成后端/前端的 Thrift/TS 类型，使 `frontend/packages/arch/idl` 中也出现该字段。

3. **补充应用服务与 API（后端应用与接口层）**

- 在 `backend/application/app` 中的命令处理（如 `UpdateAgentCommandHandler`）中，接收并传递 `IsInternal` 到领域模型；
- 在 `backend/api/app/handler` 中，更新请求/响应 DTO 与解析逻辑，确保 HTTP 层能够读写该字段。

4. **前端 UI 与表单（Agent IDE）**

- 在 `frontend/packages/agent-ide/space-bot` 或相关配置面板中：
  - 使用 `frontend/packages/arch/idl` 生成的类型，新增一个表单控件绑定 `is_internal`；
  - 调用已有 API 客户端时无需手动拼字段，只需使用更新后的类型。

5. **端到端验证与回归**

- 编写/更新后端测试：验证 `IsInternal` 的不变式在 `Agent` 聚合与相关服务中得到保障；
- 在前端通过开发环境验证：
  - 配置一个内部 Agent；
  - 观察其在不同用户/空间下的可见性是否符合预期。

通过上述步骤，一个看似简单的字段修改，被强制穿过“领域模型 → IDL → 应用服务 → API → 前端 UI”的完整链路，从而确保：

- 模型是单一真相源，而非各层各自发明字段；
- 领域规则集中在 domain 层，而不是散落在 handler 或 UI 中；
- 类型系统帮助你在编译期发现遗漏（例如忘记在某个场景传递 `IsInternal`）。

## 2. 聚合 / 实体 / 值对象 / 领域服务 / 领域事件（识别与落地）

> 以下以 Go 后端为主，具体以 `backend/domain`、`backend/crossdomain`、`backend/application` 为参考。

### 2.1 实体（Entity）与聚合根（Aggregate Root）

典型的实体/聚合根通常：

- 拥有全局唯一标识（如 `ID`, `AgentID`, `UserID`）；
- 有生命周期与状态变迁；
- 聚合根负责维护聚合内的不变式。

在本仓库中，常见的聚合根包括：

- `Agent` / `App`：聚合模型配置、插件、权限、工作流入口等。
- `Conversation`（会话）：聚合多轮消息、上下文引用、记忆策略等。
- `Workflow`：聚合节点、连线、变量等执行编排结构。
- `User`：聚合账户属性、空间信息、权限集合等。

可以在如下位置看到这些聚合的具体实现与演化：

- Agent / App：`backend/domain/agent`、`backend/domain/app`，重点关注 `model.go` 与 `service.go`；
- Conversation：`backend/domain/conversation`，包含聚合状态和与 LLM/记忆策略交互的核心行为；
- Workflow：`backend/domain/workflow`，包含节点、连线、变量等结构，以及运行期相关逻辑；
- User：`backend/domain/user`，体现用户与空间、权限等关系。

结构体通常位于：

- `backend/domain/<context>/model.go` 或类似命名的文件中；
- 领域行为方法定义在同一包里（而非散落在 service 层）。

### 2.2 值对象（Value Object）

值对象通常具备：

- 通过值而非 ID 进行判断（例如配置项、枚举、复合值）；
- 不单独持久化（作为聚合内部的一部分）；
- 不可变或在逻辑上视为不可变。

本项目中常见的值对象包括：

- 模型配置：如 `ModelConfig`, `LLMParams`，包含温度、最大 token、history 策略等；
- 工作流节点配置：节点类型、输入输出定义等；
- 权限规则：`PermissionRule`, `Role` 的值对象；
- 知识库索引配置、检索策略等。

可以在如下文件中看到值对象的具体用法：

- 模型配置相关：`backend/domain/llm`（如存在）、`backend/domain/app` 中与模型参数相关的结构体；
- 工作流节点配置：`backend/domain/workflow` 中节点/变量结构及其校验逻辑；
- 权限规则：`backend/domain/permission` 中的 `PermissionRule`、`Role` 等；
- 知识相关配置：`backend/domain/knowledge` 与 `backend/domain/datacopy` 中的数据源/索引配置。

这些通常以结构体存在于 `domain/*` 包内，不带持久化 ID，只在聚合内部被组合使用。

### 2.3 领域服务（Domain Service）

当某个领域行为：

- 难以自然地放在某个聚合根的方法上；
- 或需要跨多个聚合/实体协同；
- 且主要体现的是领域规则而非技术操作。

就适合抽象为领域服务。典型位置：

- `domain/<context>/service.go` 或 `<context>_service.go`；
- 仅依赖领域模型与仓储接口，不直接操作基础设施。

例子（抽象形式）：

```go
// Agent 领域服务
func (s *AgentService) PublishAgent(agent *Agent, workflows []Workflow, plugins []Plugin) error {
    // 校验 Agent 状态、工作流入口、插件兼容性等
    // 根据业务规则生成快照、版本号、变更记录
    // 通过仓储接口持久化
}
```

在区分“领域服务”与“应用服务”时，可以使用以下准则：

- 若服务内出现 HTTP 请求解析、日志 trace id 注入、重试/熔断策略、具体 SDK 调用等，更可能是应用服务或基础设施服务，不应归类为领域服务；
- 领域服务只关心业务规则与领域对象协作，并通过抽象的 Port（接口）访问外部能力（如仓储、事件总线、LLM 提供方）。

### 2.4 领域事件（Domain Event）

领域事件用于：

- 显式表达“领域内已经发生了什么”；
- 让其他限界上下文或下游流程对此进行反应；
- 为未来的事件溯源、审计埋下基础。

在本仓库中，领域事件通常：

- 定义在 `domain/*` 下的 `event.go` 或类似文件中；
- 由聚合根或领域服务在状态变更处发布；
- 由 `crossdomain/*` 或 `application/*` 中的监听/handler 消费。

示意代码：

```go
type AgentPublishedEvent struct {
    AgentID   string
    Version   int
    PublishedAt time.Time
}

func (a *Agent) Publish() ([]DomainEvent, error) {
    // ... 状态与规则校验
    a.Status = AgentStatusPublished
    return []DomainEvent{AgentPublishedEvent{AgentID: a.ID, Version: a.Version, PublishedAt: time.Now()}}, nil
}
```

## 3. 基于上面概念的具体用例建模

下面选取几个在 Agent IDE / Marketplace 中经常出现的业务用例，演示如何在当前架构中将“需求”落到具体代码结构上。每个用例都包含：

- 业务描述（从产品/体验视角理解要做什么）；
- 建模拆解（从实体/值对象/服务/事件视角拆解）；
- 代码落点指引（去哪些包/文件中查看完整链路）。

### 3.1 用例一：创建并发布 Agent（从配置到发布）

**业务描述**：

- 用户在 Studio 中配置一个 Agent（模型、知识、插件、工作流入口等），保存草稿并最终发布。

**建模拆解：**

- 聚合根：`Agent`

  - 属性：`ID`, `Name`, `Description`, `ModelConfig`, `EntryWorkflowID`, `PluginBindings`, `Permissions`, `Status`, `Version` …
  - 行为：`UpdateConfig`, `BindWorkflow`, `AttachPlugin`, `Publish` 等。

- 值对象：

  - `ModelConfig`：温度、最大 token 数量、history 策略等；
  - `PermissionRule`：空间可见性、角色要求；
  - `MonetizationPolicy`（如有）：免费额度、刷新周期等。

- 领域服务：

  - `AgentService.PublishAgent(agent, workflows, plugins)`：
    - 校验 Agent 是否满足发布条件（模型已配置、入口 Workflow 存在且合法、插件处于可用状态等）；
    - 生成发布快照和版本号；
    - 发布 `AgentPublishedEvent`。

- 领域事件：

  - `AgentPublishedEvent`：
    - 被 `crossdomain/workflow` 监听：对工作流做相应索引或部署；
    - 被 `crossdomain/search` 监听：更新搜索索引；
    - 被 `crossdomain/message` 或 runtime 监听：准备接入运行环境。

**代码落点指引：**

- 聚合与领域服务：`backend/domain/agent`（`model.go`, `service.go`）；
- 应用服务：`backend/application/app` 中的 Agent 相关命令 handler；
- 事件消费与跨上下文编排：`backend/crossdomain/agent`、`backend/crossdomain/workflow`、`backend/crossdomain/search`；
- HTTP 接口：`backend/api/app` 相关 handler；
- 前端配置与发布入口：`frontend/packages/agent-ide/space-bot` 及相关发布面板。

### 3.2 用例二：会话执行与记忆管理（从消息到回复）

**业务描述**：

- 用户与 Agent 进行多轮对话，系统应按模型配置策略保留/裁剪上下文，并结合知识检索、插件调用。

**建模拆解：**

- 聚合根：`Conversation`

  - 属性：`ID`, `AgentID`, `UserID`, `Messages[]`, `MemoryPolicy`, `Status` 等；
  - 行为：`AppendUserMessage`, `AppendAgentMessage`, `ApplyMemoryPolicy`, `Close` 等。

- 值对象：

  - `Message`：角色、内容、时间戳、引用的知识/插件调用结果等；
  - `MemoryPolicy`：最大轮次、短期记忆配置等。

- 领域服务：

  - `ConversationService.RunTurn(conv, input)`：
    - 根据 `MemoryPolicy` 截断或压缩历史消息；
    - 调用 `KnowledgeService.Search` 获取知识上下文；
    - 调用 `LLMService` 获取回复；
    - 生成并附加 `Message`，返回对前端的响应。

- 领域事件：

  - `ConversationStartedEvent`, `MessageAppendedEvent`, `ConversationClosedEvent` 等，用于统计、审计或驱动下游分析。

**代码落点指引：**

- 聚合与领域服务：`backend/domain/conversation`（会话状态与策略）、`backend/domain/llm`（如存在，抽象模型调用接口）；
- 应用服务：`backend/application/conversation` 中的运行命令 handler；
- 跨领域编排：`backend/crossdomain/conversation` 及与 message/knowledge 等上下文协作的逻辑；
- LLM/向量库适配：`backend/infra/llm`、`backend/infra/cache`、`backend/infra/search` 等；
- 前端会话界面与调试：`frontend/packages/agent-ide/chat-debug-area` 及相关组件。

### 3.3 用例三：知识库接入与数据拷贝（从数据源到可检索）

**业务描述**：

- 用户为 Agent 绑定一个知识库，系统支持从外部源（文档库、数据库等）批量导入并建立索引。

**建模拆解：**

- 聚合根：`KnowledgeBase`

  - 属性：`ID`, `Owner`, `SourceType`, `IndexConfig`, `Status` 等；
  - 行为：`BindToAgent`, `UpdateIndexConfig`, `Enable`, `Disable` 等。

- 值对象：

  - `IndexConfig`：分词策略、向量维度、召回参数等；
  - `DataSourceConfig`：连接串、表/集合名、过滤条件等。

- 领域服务：

  - `KnowledgeImportService.StartImport(kb, source)`：触发数据拷贝、分片处理、索引构建；
  - `KnowledgeSearchService.Search(kb, query)`：对外提供统一召回接口。

- 领域事件：

  - `KnowledgeBaseImportedEvent`、`KnowledgeIndexRebuiltEvent`：
    - 驱动 `crossdomain/datacopy` 或 `crossdomain/search` 进行后续步骤；
    - 供监控/可观测性系统订阅。

**代码落点指引：**

- 聚合与领域服务：`backend/domain/knowledge`、`backend/domain/datacopy`；
- 应用服务：`backend/application/knowledge` 中知识相关命令/查询；
- 跨领域编排与任务调度：`backend/crossdomain/datacopy`、`backend/crossdomain/search`；
- 外部系统与索引适配：`backend/infra/database`、`backend/infra/search`、`backend/infra/eventbus` 等；
- 前端知识配置与导入：`frontend/packages/agent-ide/knowledge-*`、`frontend/packages/studio/*` 中与知识管理相关的页面和 store。

### 3.4 用例四：Marketplace 商品与 ProductEntityType（从领域实体到商品）

**业务描述**：

- 在 Marketplace 中，需要以统一的“商品”视角展示和管理各种不同来源的实体，例如 Bot、Plugin、Workflow 模板、Project 以及计费/额度类产品等；
- 前端和外部调用方只关心“这个商品是什么类型、如何展示、如何购买/收藏”，而不关心其背后具体属于哪个上下文的聚合。

**建模拆解：**

- 聚合根：`Product`（位于 Marketplace / Product 上下文中）

  - 属性：`ProductID`, `EntityID`, `EntityType`, `Status`, `CommercialSetting`, `Owner`, `DisplayMeta` 等；
  - 行为：`List`, `Search`, `Publish`, `Unlist`, `BindEntity` 等。

- 值对象与枚举：

  - `ProductEntityType`：定义商品背后对应的实体类型（如 `Bot`, `Plugin`, `WorkflowTemplateV2`, `Project`, `SaasPlugin`, `CozeToken`, `MsgCredit` 等）；
  - `CommercialSetting`：收费模式（免费/付费）、计费单位、权益说明等；
  - `ProductStatus`, `ProductDraftStatus` 等：商品的生命周期状态。

- 领域服务：

  - `ProductService.Publish(product, entity)`：校验商品与被绑定实体（Bot/Plugin/Template 等）的关系是否合法，确保 Marketplace 不直接篡改其他上下文的内部状态；
  - `ProductService.Search(query)`：基于 `ProductEntityType` 和其他条件进行统一检索，并将结果映射为前端可展示的列表项。

- 领域事件：

  - `ProductPublishedEvent`, `ProductUnlistedEvent` 等：
    - 可被计费/统计上下文订阅，用于产出曝光/成交数据；
    - 也可被推荐系统订阅，用于更新特征和推荐索引。

**代码落点指引：**

- IDL 与平台级模型：
  - `idl/marketplace/product_common.thrift` 中的 `ProductEntityType`, `CommercialSetting`, `ProductStatus` 等；
  - 对应生成的 TS 类型：`frontend/packages/arch/idl/src/auto-generated/*/namespaces/product_common.ts` 与 `frontend/packages/arch/api-schema/src/idl/marketplace/product_common.ts`。
- 后端领域与应用（如有专门 Marketplace 上下文时）：
  - `backend/domain/marketplace` 或相关目录中的商品聚合与服务；
  - `backend/application/marketplace` 中的上架/下架/搜索命令与查询处理。
- 前端商品列表与详情：
  - `frontend/apps/*` 与 `frontend/packages/*` 中与 Marketplace / Store / Product 列表相关的页面和组件，通常通过 `ProductEntityType` 决定跳转路径和展示形态（Bot 详情页、Plugin 详情页、Project 详情页等）。

### 3.5 用例五：账号注册与登录（从 Passport 到 User）

**业务描述**：

- 用户通过邮箱在 Web 端注册账号、登录、退出登录，并在登录后查看当前账号信息；
- 其他上下文（Agent / Workspace / Marketplace 等）都需要依赖“当前是哪个 User、拥有哪些属性/权限”，但不直接关心登录过程细节。

**建模拆解：**

- 聚合根：`User`

  - 属性：`UserID`, `Name`, `Email`, `AvatarURL`, `Locale`, `AppUserInfo` 等；
  - 行为：`Register`, `Login`, `Logout`, `UpdateProfile`, `BindAppUserInfo` 等（部分行为当前可能分散在应用层或 infra 层实现，建模时建议向聚合收拢）。

- 值对象：

  - `AppUserInfo`：应用侧用户信息映射，用于将外部系统的用户标识与平台 User 绑定；
  - 登录凭据/会话信息（当前主要通过 session/cookie/token 等基础设施承载，未来可演进为显式值对象）。

- 领域服务：

  - `AccountService.RegisterByEmail(email, password)`：负责根据业务规则创建 User，校验邮箱格式与唯一性，并触发后续欢迎流程；
  - `AccountService.LoginByEmail(email, password)`：校验凭据并发放会话/令牌，将登录事件与审计/风控等下游打通；
  - `AccountService.GetCurrentAccount(session)`：根据会话信息解析并返回当前 User 聚合的只读视图。

- 领域事件：

  - `UserRegisteredEvent`, `UserLoggedInEvent`, `UserLoggedOutEvent` 等：
    - 可被消息/通知/统计等上下文订阅，用于发送欢迎邮件、埋点统计或风控分析；
    - 为未来的审计和事件溯源打基础。

**代码落点指引：**

- IDL 与平台级模型：
  - `idl/passport/passport.thrift` 中的 `User`, `AppUserInfo` 以及各类 `Passport*Request/Response` 结构；
  - 对应生成的 TS 类型与 API：`frontend/packages/arch/api-schema/src/idl/passport/passport.ts` 中的请求/响应接口与 `createAPI` 封装。
- 后端领域与应用：
  - `backend/domain/user`：用户相关领域模型与规则（如名称/头像/locale 等）；
  - `backend/application/user`：`UserApplicationService` 中的 `PassportWebEmailRegisterV2`, `PassportWebEmailLoginPost`, `PassportWebLogoutGet`, `PassportAccountInfoV2` 等应用服务方法；
  - `backend/api/router/coze/api.go` 中 `/api/passport/...` 路由组及其 handler/middleware。
- 前端账号模块：
  - `frontend/packages/arch/foundation-sdk/src/passport.ts` 与 `frontend/packages/foundation/account-*`：对 Passport API 的前端封装；
  - 登录/注册页面、账号信息入口所在的 app/包，通过这些封装获取当前账号并驱动 UI 状态（已登录/未登录、显示头像与昵称等）。

## 4. 六边形架构 + Adapter 的实践（如何找对“那一层”）

### 4.1 六边形架构的分层对应

仓库整体采用接近 **六边形架构（Ports & Adapters）** 的组织方式：

- **领域层（Domain）**：

  - 位置：`backend/domain/*`
  - 职责：实体/值对象/聚合根、领域服务、领域事件；
  - 对外通过接口（Port）定义所需能力，例如仓储接口、消息总线接口、向量检索接口等。

- **应用层（Application）**：

  - 位置：`backend/application/*`
  - 职责：用例编排、事务边界、防腐层（ACL）；
  - 调用领域层接口，协调多个聚合与上下文完成一个应用场景。

- **跨领域组装层（Crossdomain）**：

  - 位置：`backend/crossdomain/*`
  - 职责：跨限界上下文流程、事件订阅与转发、复合查询等；
  - 依赖多个 `domain/*` 包与基础设施 Adapter。

- **接口适配层（Adapters）**：
  - HTTP / RPC 适配：`backend/api/*`（handler/router）、`backend/middleware/*`；
  - 基础设施适配：`backend/infra/*`（cache、db、eventbus、llm 等）；
  - 配置适配：`backend/bizpkg/config`、`backend/conf/*`。

### 4.2 Adapter 模式的常见形式

1. **存储适配（Repository Adapter）**

   - 领域层定义仓储接口，例如：

   ```go
   type AgentRepository interface {
       Save(ctx context.Context, agent *Agent) error
       FindByID(ctx context.Context, id string) (*Agent, error)
   }
   ```

   - 基础设施层在 `infra/database` 或类似包中实现具体存储（MySQL / OceanBase / Redis / Elastic 等）；
   - 应用层只依赖接口类型，便于测试与替换实现。

2. **外部服务适配（LLM / 向量库 / 文件存储等）**

   - `domain/llm`（如存在）定义抽象接口：`Completion`, `Chat`, `Embedding`；
   - `infra/llm` 或 `bizpkg/llm` 中实现对 OpenAI、火山引擎等提供商的 SDK 调用；
   - 领域服务只关心“生成一个回复/embedding 向量”，不关心使用了哪家厂商。

3. **API / DTO 适配（Controller / Presenter）**

   - `backend/api/*` 定义 HTTP handler：解析请求、调用 `application` 层、封装响应；
   - DTO 和领域模型间的转换在 `application` 或专门的 mapper 中完成。

4. **前端 Adapter（在 frontend 侧的呼应）**
   - 虽然本文聚焦后端，但前端也大量使用 `*-adapter` 包，将具体 UI 与后端 API/Store 解耦；
   - 统一语言在前后端 adapter 中保持一致，减少“拼 DTO”时的认知成本。

## 5. CQRS / 事件溯源 / 四色建模等的思考与实践（理念与方向）

### 5.1 CQRS（命令查询责任分离）

在仓库中，CQRS 并非被极端化（即完全分离读写存储），而是以“**读写分工清晰**”的方式渗透在：

- `application/*` 中的命令 Handler：`CreateAgentCommand`, `PublishAgentCommand`, `RunConversationCommand` 等；
- `crossdomain/*` 或 `api/*` 中的查询接口：`GetAgentDetail`, `ListWorkflows`, `SearchKnowledge` 等；
- 有些查询会直接走读库或搜索引擎（如 Elastic / 向量库），而写入则经由领域模型与仓储接口。

在建模新用例时，应当：

- 将“引起状态变化”的操作建模为 Command（命令），由应用服务处理；
- 将“仅查询”的接口建模为 Query，可直接使用专门的读模型和索引优化；
- 避免让读接口再去拼装半个聚合逻辑，以减轻领域层负担。

### 5.2 事件溯源（Event Sourcing）

当前仓库并未对所有领域采用完整的事件溯源模式，但已经具备以下“向事件靠拢”的基础：

- 领域事件在 `domain/*` 中明确建模，可用于记录关键业务状态变化；
- 事件通过 `crossdomain/*` 或 `infra/eventbus` 传播，可被多个下游订阅；
- 部分场景（如工作流运行记录、对话消息流、知识索引重建）非常适合以事件日志的形式长期保存。

如果未来需要在某些核心领域（例如计费、Agent 发布历史、权限变更）引入事件溯源，可以：

- 以事件作为“真相源”，聚合状态由重放事件得到；
- 当前的状态表仅作为快照缓存；
- 重用已有的领域事件类型与事件总线基础设施。

### 5.3 四色建模（Four-Color Modeling）在项目中的类比

四色建模大致区分：

- **黄色（黄）**：长生命周期的事物（例如 User, Agent, KnowledgeBase）；
- **绿色（绿）**：流程/过程（例如 Conversation, WorkflowRun, ImportTask）；
- **蓝色（蓝）**：描述规则/规范（例如 MemoryPolicy）；
- **粉色（粉）**：描述合同/协议（例如 TokenUsageRecord, BillingContract）。

在当前仓库里，可以粗略映射为：

- 黄：`domain/user`, `domain/agent`, `domain/app`, `domain/knowledge` 中的主实体；
- 绿：`domain/conversation`, `domain/workflow`, `domain/datacopy` 中的运行实例（Run/Task）；
- 蓝：`domain/permission`, `domain/prompt`, `domain/config` 中与规则相关的值对象和实体；Marketplace/Product 子域中的 `ProductEntityType`, `CommercialSetting`, `ProductStatus` 等可以视为“对不同实体进行统一分类与定价规则约束”的蓝色建模；Account/Passport 子域中若将登录策略、密码复杂度要求等抽象为独立对象，也同样属于蓝色；
- 粉：若引入完善的计费/用量系统，可由 `Billing` / `Usage` 等上下文承载（目前可在 crossdomain 或 bizpkg 中看到雏形）。

在日常设计时，你可以：

- 用“四色”思维区分“东西”和“过程”、“规则”和“协议”；
- 在包/结构命名时体现这一差异（如 `*Policy`, `*Rule`, `*Run`, `*Task` 等后缀）。

## 6. 如何在本仓库中继续演进 DDD 实践（可执行 checklist）

### 6.1 新增领域能力时的步骤

- 在 `domain/<context>` 中定义/扩展实体、值对象、领域服务与事件；
- 明确限界上下文归属，避免“上来就放在 crossdomain”；
- 如涉及对外接口，更新 `idl/*` 中对应结构，并重新生成类型；
- 仅在需要时，才在 `application/*` 与 `api/*` 中增加新的用例编排与 handler。

### 6.2 新增接口（命令 / 查询）时的步骤

- 对“写操作（修改状态）”：
  - 设计 Command + Application Service + 领域模型方法；
  - 保证状态变更集中通过聚合根/领域服务完成；
  - 若有下游影响，通过领域事件/应用事件通知。
- 对“读操作（只读查询）”：
  - 设计 Query + 专门读模型，考虑索引/缓存与跨上下文聚合；
  - 避免直接重放完整聚合逻辑，必要时单独设计投影表/视图。

### 6.3 引入新的外部系统时的步骤

- 在领域中先定义抽象 Port 接口，表达领域对外部系统的期望能力；
- 在 `infra/*` 或 `bizpkg/*` 中实现具体 Adapter，封装 SDK 细节；
- 在应用/跨域层中通过接口注入依赖，而不是直接依赖具体实现；
- 为关键外部依赖设计降级策略与观测指标（可结合 crossdomain 与 infra 层实现）。

### 6.4 对现有代码做 DDD 化重构时的步骤

- 将跨上下文的业务流程从 `api` / `handler` 中下沉到 `crossdomain` 或 `application`；
- 将纯领域逻辑从 `infra` / `handler` 中抽离回 `domain`，并增加必要的领域服务/值对象；
- 为跨上下文的耦合点增加事件/接口边界，减少直接数据表引用或内部结构依赖；
- 在重构前后保持外部接口（IDL / HTTP API）尽量兼容，必要时通过兼容层过渡。

### 6.5 当领域要对外以“商品/资源”形式暴露时的步骤

- 在所属上下文内（如 Agent / Plugin / Workflow / Project）先完成聚合/值对象/领域服务建模，不在 Marketplace / Product 子域硬编码这些结构；
- 在 IDL 层为 Marketplace 定义清晰的跨上下文抽象，如 `ProductEntityType` + `entity_id` 等引用字段，而不是在 Marketplace 中直接依赖其他上下文的内部表结构；
- 在 Marketplace / Product 子域中，以“Product + EntityType”的模式建模商品视图，用领域服务负责绑定/校验关系，而非在多个上下文之间相互直接更新；
- 新增商品类型时，遵循“领域模型 → IDL → 应用服务 → 前端”的路径，保证类型和语义的一致性。

通过这些约束，可以让 Agent IDE / Agent Studio 的项目逐步形成：

- 语义清晰的限界上下文；
- 以领域模型为核心的内核层；
- 适配多种前端、外部系统与基础设施的“六边形外围”。
