# copilot-instructions.md

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-resource-processor-core）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 子包位置：frontend/packages/data/knowledge/knowledge-resource-processor-core，对应 Rush/monorepo 里的 data 领域知识资源处理核心库。
- 主要职责：提供“知识资源”（如文档、网页、文件等）的解析、标准化、分块、元数据提取与入库前处理能力，被上层应用（知识库管理、对话知识检索等）复用。
- 常见调用方：同 workspace 下的知识数据相关子包（如 common stores、前端知识库应用），通过 npm 包依赖或相对路径导入使用本子包导出的 API。
- 架构风格：以 TypeScript 模块为单位的“管道 + 适配器”结构，核心是若干纯函数/类负责：
  - 输入：原始资源（文件内容、URL、上传记录等）+ 配置（分块策略、过滤条件）。
  - 处理：按步骤执行解析、清洗、切分、元信息构造。
  - 输出：结构化资源片段（如分段文本+属性），供后续向量化、索引或展示。
- 模块划分（参考 src/ 下典型结构）：
  - src/types/：资源、分块结果、处理配置等统一类型定义。
  - src/pipeline/：处理流水线定义与组合，包含通用步骤（去噪、行合并、分段等）。
  - src/adapters/：针对不同来源/格式的适配器（如 markdown、html、pdf、webpage 等）。
  - src/utils/：字符串处理、正则、DOM 解析、日志/调试辅助等工具函数。
  - src/index.ts：对外导出公共 API 与类型，是其他包引用的入口。
- 设计 rationale：
  - 保持核心处理逻辑“无 I/O、可纯函数测试”，便于在浏览器和 Node 侧复用。
  - 通过 adapter + pipeline 组合，使新增资源类型或处理策略时尽量只扩展边缘模块，不修改已有核心步骤。

## 2. 源码与目录结构约定

> 以下结构为在本子包中实际存在或约定的模式，命名以实际文件为准。

- 入口与打包：
  - package.json 中的 main/module/types 指向编译后的入口（通常在 dist/），源码在 src/。
  - 不直接在其他包中引用 dist/ 内私有文件，只使用 src/index.ts 导出的符号。
- 类型定义：
  - 所有跨模块复用的类型集中放在 src/types/（如 Resource, ResourceChunk, ProcessOptions）。
  - 若类型仅在单一模块内部使用，则就近定义，避免在 types/ 中制造过度抽象。
- 处理流水线：
  - src/pipeline/ 下通常包含：
    - createResourcePipeline.ts：组合若干步骤产生处理函数。
    - steps/*：细粒度步骤（normalizeText、splitParagraphs、extractMetadata 等）。
  - 约定 pipeline 步骤为 (input, ctx) => output 形态，并避免在步骤中做全局状态修改。
- 适配器：
  - src/adapters/ 里的每个适配器聚焦某类资源：
    - e.g. markdownAdapter.ts, htmlAdapter.ts, pdfAdapter.ts。
  - 适配器主要负责：
    - 将外部输入（文件、DOM、第三方 SDK 输出）转换为统一 Resource 结构；
    - 做与特定格式强相关的预处理（如去掉 HTML 标签、表格转文本等）。
- 工具函数：
  - src/utils/ 下为“无副作用”的纯工具，避免直接依赖上层业务；
  - 若工具需日志输出，优先通过依赖注入传入 logger，而不是在工具内部直接引用全局 logger。

## 3. 依赖与配置

- 语言与构建：
  - 使用 TypeScript，tsconfig 通常由上层 workspace 继承（见 frontend/tsconfig.base.json 或 packages 级 tsconfig）。
  - 构建由 Rush 脚本统一调度，子包自身 package.json 中的 scripts 只定义本地常用命令（如 build、test、lint）。
- 典型依赖：
  - 文本处理：如 lodash-es、string 库或自研 util，用于 trim、normalize、深拷贝等。
  - 解析相关：对于 markdown/html 等会依赖对应 parser（如 remark、cheerio / jsdom 等）；
  - 日志/调试：共用前端 infra 或 common 包中提供的 logger/debug 工具，而不是引入新的 logger 体系。
- 依赖管理：
  - 请以 package.json 为唯一真源，新增依赖需遵守 workspace 的版本对齐策略（通常由 Rush 或 pnpm-lock 管控）。
  - 避免在本子包中直接加入大体积、浏览器不友好的依赖（如 Node-only 模块），如确有需求需通过 adapter 隔离或在调用层做环境判断。

## 4. 开发与调试工作流

- 构建：
  - 在 repo 根目录使用 Rush：`rush build -t @coze-data/knowledge-resource-processor-core` 只构建本子包及依赖。
  - 在子包目录下（frontend/packages/.../knowledge-resource-processor-core）可运行：
    - `pnpm build` 或 `rushx build`（具体以 package.json 为准），执行 ts 编译和打包。
- 测试：
  - 若存在单测目录 tests/ 或 __tests__/：
    - 使用 `rushx test` 或 `pnpm test` 运行。
    - 新增测试时优先对 pipeline 步骤与适配器做“输入 → 输出”型例子测试，而非端到端依赖环境的集成测试。
- 本地调试：
  - 推荐在本子包中添加/使用简单的 playground 脚本（如 scripts/dev.ts 或 demo.ts），通过 `rushx dev` 或 `ts-node` 执行，对任意文本/文件做处理观察输出。
  - 在被调用方应用（例如 knowledge 相关前端 app）中，引入本包的本地构建结果并通过浏览器 DevTools 调试数据流。

## 5. 项目特有约定与模式

- 函数风格：
  - 大部分处理逻辑为纯函数，不依赖外部可变状态；入参/出参使用明确的类型；
  - 若步骤需要外部配置或运行上下文（如当前用户、语言等），通过参数 ctx 显式传入，而非读取全局单例。
- 错误处理：
  - 默认不抛出致命异常，中间步骤尽量使用 Result/Option 风格（如返回 null/空数组或包含 error 字段），由调用方决定降级策略；
  - 对于输入格式不满足预期的情况，适配器负责尽早校验并尽量返回“可降级结果”（如忽略部分字段、做 best-effort 解析）。
- 日志与调试：
  - 不直接在库代码中输出 console.log，若需调试输出，使用可开关的 debug 标志或传入 logger；
  - 对难以排查的问题，常见做法是在 pipeline 中间步骤保留中间态结构（如在 ctx 中记录），以便上层应用打印或分析。
- 性能与浏览器环境：
  - 避免同步大循环中做复杂 DOM 操作/正则回溯，尽量将重操作拆分或限制输入规模；
  - 代码需兼容浏览器使用场景，禁止直接使用 Node 专属 API（如 fs、path、Buffer）除非在明确的 Node-only 适配层中。

## 6. 与其他模块/服务的集成

- 与知识数据存储/检索模块：
  - 本子包只负责“前置处理”，不直接操作数据库或向量引擎；
  - 输出数据结构（资源片段）被其他包（如 embedding、搜索、知识库存储模块）消费，这些消费者通常位于 frontend/apps 或 data 子包中。
- 与上传/文件服务：
  - 上传、文件存储 SDK 不在本包内部使用，由上层调用方读出文件内容后以文本/二进制形式传入；
  - 如需根据文件 MIME/扩展名分支处理，应在调用方或本包暴露的统一入口（如 processResource(file, options)）中进行，而不是在各步骤里散落判断。
- 与事件/任务系统：
  - 若 workspace 内有任务/流水线系统（如后台批处理服务），本包被作为纯函数库嵌入；不在本子包中直接引入队列或调度逻辑。

## 7. 版本控制与协作规范

- 分支与提交流程：
  - 遵循仓库统一规范（详见根目录 CONTRIBUTING.md）；通常在 feature 分支上开发，通过 PR 合并至主干。
  - 提交信息需简洁表达变更意图，涉及本子包时建议在标题中包含包名标识（如 feat(knowledge-resource-processor-core): ...）。
- 代码风格：
  - 使用 workspace 公共 ESLint/Prettier 配置；在提交前运行 lint/format（可通过 `rush lint` 或本包 `rushx lint`）。
  - 类型严格程度遵循全局 tsconfig 设置，不在本包中单独放宽 strict 选项，除非有充分理由并在 PR 中说明。

## 8. 新贡献时的实用建议

- 在新增功能前：
  - 先确认是否已有类似步骤/适配器可复用，避免复制逻辑。
  - 若需要新的资源类型，优先新增 adapter + 若干步骤，而非修改已有统一 pipeline 行为。
- 在修改核心处理逻辑时：
  - 为关键路径增加或更新测试样例，覆盖典型输入（短文本、大文本、边界格式）；
  - 注意不要改变公共类型字段含义或默认行为，如确需调整，需要同步更新所有使用方子包并在文档中标明。
- 与 AI 编程助手协作时：
  - 明确指出目标是新增步骤/适配器/类型扩展，并提供几个具体输入/输出示例，便于自动生成的实现符合既有模式；
  - 避免在自动生成代码中引入全新第三方库，如确有需要，应先评估与现有依赖的重合度与体积影响。