# frontend/packages/arch/idl 子包开发说明（AI 编程助手用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/idl）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 本子包位于 monorepo 前端部分：frontend/packages/arch/idl，对应 rush 管理的一个 package（packageName: "@coze-arch/idl"）。
- 职责：集中管理与「IDL（接口/领域定义）」相关的前端资源，如 TypeScript 类型定义、契约对象、生成脚本或与后端 thrift/IDL 的映射工具；常作为其它 arch 子包或应用的底层依赖，而不直接与 UI 交互。
- 典型结构（以现有文件为准，以下为预期形态）：
  - frontend/packages/arch/idl/src/**：IDL 相关的核心源码（类型、模型、工具函数）。
  - frontend/packages/arch/idl/scripts/**：IDL 生成、对齐或校验脚本（如从 idl/ 目录生成 ts 类型）。
  - frontend/packages/arch/idl/package.json：定义 name、version、main/module/exports、build/test 脚本和依赖。
  - frontend/packages/arch/idl/tsconfig*.json：本包 TypeScript 编译配置，通常继承仓库公共 tsconfig 基础配置。
- 依赖关系上的角色：
  - 作为「领域描述 / 协议层」，上游通常是根目录 idl/ 下的 thrift / proto 等文件以及后端服务定义。
  - 下游为 frontend/apps/** 和其它 frontend/packages/arch/** 子包，通过导入本包导出的类型与常量保证前后端契约一致。

## 2. 关键开发流程（build / test / lint / 本地调试）

在 monorepo 中，一切以 rush & workspace 脚本为入口，本子包自身的脚本定义只写在 package.json 中：

- 构建：
  - 推荐通过仓库根目录统一命令（示例，需以实际脚本为准）：
    - `rushx build -p @coze-arch/idl` 或在 frontend 目录用 `pnpm run build --filter @coze-arch/idl`。
  - 本子包通常会有 `build` script，执行 `tsc -b` 或使用 repo 内部统一的构建工具（例如 `rushx build:lib`）。
- 测试：
  - 如 package.json 中存在 `test` 或 `test:ci`，优先使用仓库统一命令，例如：
    - `rushx test -p @coze-arch/idl`。
  - 测试框架（Jest / Vitest 等）以实际配置文件（jest.config.*、vitest.config.* 等）为准；不要凭空引入新框架。
- Lint / 格式化：
  - 优先使用仓库定义好的命令（在 frontend 根有 `rushx lint`、`rushx lint:pkg` 等），并对本包按 filter 执行。
  - 遵循已有 ESLint、Prettier、TypeScript 规则，不单独在本包新增与全局冲突的规则。
- IDL 生成 / 校验脚本：
  - 若本包有 scripts 如 `generate`, `sync-idl`, `build-idl` 等，通常会读取仓库根 idl/ 下的 *.thrift 或其它 schema，并输出 TypeScript 类型到 src/ 下。
  - 修改生成逻辑前，先确认生成输出文件是否被 git 跟踪；不要偷偷改变「源码 vs 生成物」的边界。

## 3. 项目内约定与模式

- TypeScript 与模块组织：
  - 所有业务相关导出统一集中在 src/index.ts 或对应的 barrel files 中，让其它包通过 `@coze-arch/idl` 单点引入所需类型。
  - 类型命名以领域为中心，避免使用与运行时对象混淆的名称（如 FooDto, BarRequest, XxxResponse 等），保持与后端 IDL 命名尽量一致。
- 与根目录 idl/ 同步的约定：
  - 本包中的类型、枚举、常量应能映射到 [idl/**] 下同名（或约定映射规则）的 thrift/proto 文件，不要在本包中随意虚构协议字段。
  - 若必须增加字段/接口，应先在 idl/ 目录进行修改和评审，再同步到本包；AI 助手不要仅在本包侧修改契约。
- 运行时代码 vs 纯类型：
  - idl 子包通常以类型定义为主，运行时代码应保持极少，只做必要的转换/适配（如 thrift enum ↔ ts enum 映射函数）。
  - 若引入复杂运行时逻辑（例如校验、序列化），优先考虑放到其它更贴近业务的包中，这里只保留可重用、无副作用的纯函数。
- 错误处理与兼容性：
  - 与后端协议变更相关的 breaking 改动（字段删除、类型变更）必须向下游消费者明确，通过 semver 大版本和 CHANGELOG 体现；AI 助手在不确定时应更偏向添加新类型而非修改/删除旧类型。

## 4. 重要组件与外部依赖集成

- 与后端服务契约：
  - 本包不直接发起网络请求，而是为调用层（例如 frontend/apps/** 或其它 arch 包）提供强类型定义和轻量工具。
  - 常见模式：
    - 定义 Request/Response/DataModel 类型，与后端 API 文档及 idl/ 中定义保持一一对应。
    - 暴露工具函数用于在「IDL 类型」与「前端视图模型」之间转换，命名例如 `fromXxxDto`, `toXxxDto`。
- 与生成工具的集成：
  - 若使用自定义生成器（例如内部脚本从 *.thrift 生成 ts），通常在本包 scripts 或根 scripts/ 中；调用时注意：
    - 输入目录（一般为根 idl/**），输出目录（本包 src/generated/** 或类似结构）。
    - 生成脚本不应在其它与 IDL 无关的目录写文件。
- 第三方依赖：
  - 本包应保持依赖尽量精简，多数情况只依赖 TypeScript 类型工具包或极少数运行时工具库。
  - 新增依赖前：检查是否已有仓库级别的统一版本（在根 package.json / common/config 中），确保一致性。

## 5. 协作流程、分支与发布

- 分支与提交：
  - 遵循整个仓库统一的 Git 流程（参考根 README.md / CONTRIBUTING.md）。通常为 feature 分支 + Pull Request 的模式。
  - 若变更会影响到多个子包（例如修改 idl/ 并同步到本包及多个消费者），在 PR 描述中清晰写明「影响范围」和「升级指南」。
- 版本与发布：
  - 版本管理由 monorepo 的发布流程统一负责（如 Rush + changefiles / Changelog 工具）；在本包中不要手动修改 version，除非已确认流程要求。
  - 发布前需要保证：
    - 本包 build 通过。
    - 与之相关的应用/包在基础功能上可正常运行（至少通过基础的 e2e 或 smoke 测试流程）。

## 6. 对 AI 编程助手的具体要求

- 修改范围控制：
  - 仅在与 IDL 类型/契约相关的代码中工作，避免跨子包大范围重构。
  - 若需求涉及根目录 idl/ 中的文件，请提醒人工先在服务/协议层做修改，再回到此包同步类型定义。
- 新增代码时：
  - 优先遵循现有文件组织方式：在已有 domain-specific 目录下放置新类型/枚举/工具，而不是随意创建新顶级目录。
  - 所有对外可用的类型或工具需通过本包的公共导出入口暴露（例如 src/index.ts）。
- 重构与删除：
  - 避免删除既有导出；若发现重复或过时代码，先搜索全仓库引用，确认无下游依赖再考虑标记为 deprecated 或清理。
- 文档与注释：
  - 只在关键协议类型、转换函数上增加必要的注释（简要说明与后端字段/接口的关系），不做大段叙事性注释。

## 7. 不寻常/需要特别注意的点

- 本包的核心存在感在于「契约统一」：它承接后端 idl/ 与前端多应用，对协议的任何修改都会产生广泛影响。
- 多数情况下，这里不直接实现业务逻辑，而是提供「标准定义」和「轻量映射」。如果一个改动看起来更像业务规则而不是契约，请考虑把变更放到其它子包。
- 当仓库有大规模代码生成或 IDL 迁移（例如 thrift → http+json）时，本包通常是最先需要更新的地方；AI 助手在处理此类变更时要尽量保持向后兼容（添加新定义、保留旧定义并标注过时），并避免一次性大爆炸式替换。