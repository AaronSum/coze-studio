# frontend/infra/idl

IDL (Interface Definition Language) 工具链子目录，提供从 Thrift IDL 到 TypeScript 代码的完整前端基础设施。

这一层负责 **“怎么从平台 IDL 生成前端可用的类型与客户端”**，而不是承载领域模型本身（领域模型在 `frontend/packages/arch/idl`）。

## 目录结构

- `idl-parser/`
  - 解析 Thrift IDL 的基础库，将 `.thrift` 文件抽象成可消费的 AST/中间表示；
  - 被下游生成器、插件等复用，避免各自重复解析。
- `idl2ts-cli/`
  - 命令行入口（CLI），对外提供一键生成能力；
  - 负责读取配置、扫描 IDL 目录、调用 generator/runtime/plugin，最终产出 TS 代码；
  - 通常被 Rush 任务或脚本（如前端构建脚本）调用，用于生成 `frontend/packages/arch/idl` 下的 auto-generated 内容。
- `idl2ts-generator/`
  - 核心代码生成器，将解析后的 IDL AST 转换为 TypeScript：
    - 接口类型、枚举、命名空间；
    - Service 客户端模板（MethodName(req): Promise<Resp> 等）。
  - CLI 与插件都会依赖此包完成“从抽象模型到 TS 文本”的转换。
- `idl2ts-helper/`
  - 生成流程使用的通用工具函数与辅助模块：
    - 命名规范（驼峰/下划线/命名空间合并）；
    - 类型映射（Thrift 基本类型/容器类型 → TS 类型）；
    - 文件组织、import 排布等。
  - 供 generator、plugin 等多方共享，减少重复实现。
- `idl2ts-plugin/`
  - 代码生成过程中的可插拔扩展点集合：
    - hook/插件机制，用于定制生成逻辑（如特殊服务的额外 Helper、额外的 index 文件等）；
    - 便于不同业务线在统一工具链基础上做轻量差异化定制。
- `idl2ts-runtime/`
  - 生成代码在运行时依赖的轻量运行时库（runtime）：
    - 通用的 Service client 基类、请求封装、错误类型等；
    - 与生成的 TS 代码一起，为上层封装出统一的调用体验。

## 与 arch/idl 的关系

- `frontend/infra/idl/*`：
  - 定义并实现 **IDL → TypeScript** 的工具链（解析、生成、插件、runtime）；
  - 面向仓库内部脚本和构建流程，是“怎么生成代码”的实现细节。
- `frontend/packages/arch/idl`：
  - 由上述工具链生成的 **平台级类型与客户端集合**；
  - 面向业务前端/Agent IDE 等使用方，是“已经生成好的领域/平台模型与 API 契约”。

简而言之：**infra/idl 负责造轮子，arch/idl 提供装好轮胎的车轮给业务用。**

## 使用场景

- 更新/新增 Thrift IDL 后：
  - 在仓库根目录或前端子项目中执行对应的 Rush/script 任务；
  - 调用 `idl2ts-cli` 读取 `idl/` 目录并产出最新的 TS 类型与客户端；
  - 生成结果通常落在 `frontend/packages/arch/idl/auto-generated` 中。
- 定制生成策略：
  - 如需对某些服务生成额外 Helper、特殊导出，可通过 `idl2ts-plugin` 提供的 hook 机制实现；
  - 通用命名/类型映射规则则集中在 `idl2ts-helper` 和 `idl2ts-generator` 中维护。

如需了解生成结果的使用方式，请参考 `frontend/packages/arch/idl/README.md`。
