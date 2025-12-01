# idl2ts-runtime 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/infra/idl/idl2ts-runtime）中安全、高效地协作开发。

## 总体架构与职责
- 本包提供基于 IDL 生成的前端 HTTP 客户端在运行时的统一封装能力，是 idl2ts 工具链在浏览器/Node 端的“执行层”。
- 上游生成器会为每个 service/method 生成携带 IMeta 的调用函数，本包负责：
  - 维护服务级别的配置中心（configCenter），支持按 service/method 覆盖配置；
  - 将 IMeta + 业务入参转换为标准的 fetch 请求（URI、Query、Body、Header、Content-Type 等）；
  - 暴露 createAPI / createCustomAPI 等工厂方法，生成带中止控制的 ApiLike 实例。
- 设计目标：
  - 统一请求构造逻辑，降低由 IDL 到 HTTP 映射的心智负担；
  - 通过 clientFactory 注入真实请求实现，避免对具体 HTTP 库（fetch/axios 等）的硬依赖；
  - 支持通过 CustomAPIMeta 对非 IDL 接口做统一管理。

## 目录结构与关键模块
- src/index.ts
  - 暴露 createAPI、createCustomAPI、registerConfig，以及类型 IMeta；
  - 其他模块只作为内部实现，不建议从深层路径直接引用。
- src/types.ts
  - 定义 IMeta：描述单个接口的完整元信息（reqType、resType、url、method、reqMapping、resMapping、service、schemaRoot、serializer 等）。
  - 定义 IHttpRpcMapping：说明请求各部分（path/query/body/header/status_code/cookie/entire_body/raw_body）与入参字段的映射关系。
  - 定义 CustomAPIMeta：用于 createCustomAPI 构造“非 IDL”接口的简化元信息。
- src/config-center.ts
  - ConfigCenter：以 Map<service, IdlConfig> 形式维护配置；
  - getConfig(service) / registerConfig(service, config)：对外只暴露 configCenter 实例和 registerConfig 包装函数；
  - registerConfig 在重复注册时仅打印 warn，不抛错，方便多处初始化。
- src/utils.ts
  - 定义 IdlConfig / ServiceConfig / IOptions / PathPrams 等配置与调用期选项类型；
  - getConfig(service, method)：按优先级合并配置（先查 configCenter，再从 config.services[service].methods[method] 细粒度覆盖），并删除 services 字段；
  - unifyUrl(uri, pathParams, option, req)：
    - 处理 URL 中的 :id 占位符，优先从 option.pathParams / option.getParams / req 取值；
    - 返回替换后的 apiUri 和未映射的参数名列表（当前仅返回给调用方，内部不消费）；
  - normalizeRequest(req, meta, option)：构造最终请求：
    - 合并 IdlConfig 与 option.config，计算 uriPrefix + apiUri；
    - 基于 serializer（json/urlencoded/form）设置 Content-Type 与 body 序列化方式（qs 或 FormData）；
    - 处理 query/body/header/entire_body 映射，并对 POST/PUT/PATCH 强制补空 body 兼容旧网关；
    - 返回 { uri, requestOption, client }，其中 client 来自 config.clientFactory(meta)。
- src/create-api.ts
  - createAPI<T, K, O, B>：构造 ApiLike/CancelAbleApi：
    - 内部调用 normalizeRequest，将 req + meta + option 统一转换为 HTTP 请求；
    - 当 cancelable 为 true 时，为每个实例维护 AbortController，并在 pending === true 时允许 abort；
    - 暴露 api.meta（IMeta）和 api.withAbort()，用于派生可中止版本；
    - useCustom 为 true 时，会根据 meta.reqMapping 自动将“未声明映射”的字段按 HTTP Method 注入到 body 或 query，服务于 createCustomAPI。
  - createCustomAPI(customAPIMeta, cancelable)：将 CustomAPIMeta 补齐为 IMeta 并调用 createAPI，service 固定为 'CustomAPI'。

## 开发与运行工作流
- 依赖安装
  - 在仓库根目录：rush install 或 rush update（本包依赖 workspace 内部工具链与 devDependencies）。
- 本包常用脚本（在 frontend/infra/idl/idl2ts-runtime 下）：
  - 测试：npm test
    - 调用 vitest --run --passWithNoTests；配置见 vitest.config.ts，preset 为 'node'。
  - 覆盖率：npm run test:cov
    - 等价于 npm test -- --coverage，使用 @vitest/coverage-v8。
  - Lint：npm run lint
    - 使用 @coze-arch/eslint-config，规则在根层统一维护。
  - 构建：npm run build
    - 当前实现为 exit 0，仅占位；上层通常直接编译 src 或通过 bundler 处理，不依赖本包独立 build 产物。

## 项目特有约定与模式
- 配置优先级与结构
  - 运行时配置由两部分组成：
    - ConfigCenter 中按 service 注册的 IdlConfig（通过 registerConfig 注入）；
    - 调用 normalizeRequest/createAPI 时传入的 option.config（一次性覆盖）。
  - ServiceConfig 支持为单个 service 设置 methods[method] 级别细化配置（例如为某个接口覆盖 uriPrefix 或 clientFactory）。
  - getConfig 中会在合并后 delete config.services，保证下游只接收扁平化配置。
- clientFactory 约定
  - IdlConfig.clientFactory(meta) 必须返回 (uri, init, opt) => Promise<any> 形式的函数；
  - runtime 完全不关心内部实现，可以是 fetch/axios 或其他 RPC 客户端；
  - 缺失 clientFactory 时 normalizeRequest 直接抛出 Error('Lack of clientFactory config')，调用方需保证在初始化阶段配置完备。
- 请求构造行为
  - query 参数：
    - 来自 meta.reqMapping.query 中声明的字段，使用 qs.stringify，默认 skipNulls: true, arrayFormat: 'comma'；
  - body 参数：
    - 若使用 entire_body，则要求字段数组长度为 1，否则抛出异常；
    - 使用 body 映射时，默认直接使用对象，必要时根据 serializer 转为 FormData 或 urlencoded 字符串；
  - header 参数：
    - meta.reqMapping.header 中声明的字段会被提取到 headers 中，并与 option.requestOptions.headers 合并；
  - method 为 POST/PUT/PATCH 且尚未设置 body 时，会注入一个空对象作为 body 以兼容旧后端。
- 中止控制语义
  - createAPI 的 cancelable 泛型 B 仅影响返回类型是否带 abort/isAborted 属性；
  - 实际执行时只有 pending === true 且 cancelable === true 时才会调用 abortController.abort()；
  - isAborted 仅通过 abortController.signal.aborted 判断，结合 pending 语义用于区分“主动取消”与“请求已结束”。
- Custom API 行为
  - createCustomAPI 通过 useCustom 标志开启默认字段映射：
    - 统计 IMeta.reqMapping 中所有字段，将不在映射表中的入参字段自动加入到 body 或 query；
    - 方便为少量“非 IDL”接口快速接入统一请求体系，而无需手写完整 IHttpRpcMapping。

## 外部依赖与集成细节
- qs
  - 用于 querystring 序列化（normalizeRequest 中处理 meta.reqMapping.query 与 urlencoded body）；
  - 既作为 devDependency 也作为 peerDependency 声明，以确保宿主应用自行安装，避免重复打包。
- Web 平台 API
  - 依赖标准 RequestInit、AbortController、FormData、Blob、File 等浏览器/Node Fetch 相关类型；
  - 编写新逻辑时应维持对这些原生对象的直接使用，不在本包内再引入额外的 HTTP 抽象层。

## 团队流程与协作规范
- 与生成器子包协同
  - 本包对 IMeta/IHttpRpcMapping 的字段语义有硬性假设，生成器（如 idl2ts-generator）应保证：
    - method/url/service/schemaRoot 等字段语义一致；
    - reqMapping 中各字段名与生成的请求类型 T 属性对齐；
  - 若在此包调整 IMeta/IHttpRpcMapping 结构，应同步更新生成器与上游文档。
- 修改与测试
  - 涉及 normalizeRequest/unifyUrl/createAPI 的改动，建议至少补充单测：
    - 不同 serializer、不同 HTTP method、path/query/body/header 组合的请求构造；
    - abort 行为与 pending 状态的交互；
  - 现有项目中大量依赖这些工具函数，请避免破坏现有默认行为（尤其是空 body 与 skipNulls 的处理）。

## 开发提示与注意事项
- 新增能力时优先通过扩展 IdlConfig 与 IMeta 来表达，不要在 createAPI 内塞入过多与业务强相关的分支逻辑。
- 修改 getConfig/unifyUrl/normalizeRequest 时，要注意与 registerConfig 以及上层 serviceConfig 的配置模型保持兼容，尽量通过可选配置而非行为改变满足新需求。
- 如果需要引入新的请求序列化方式（新增 serializer），请同时：
  - 在 ContentTypeMap 中补充映射；
  - 在 normalizeRequest 中增加对应的 body 构造分支，并保证对已有 serializer 不产生行为变化。
