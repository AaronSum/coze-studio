# @coze-arch/monorepo-kits 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/infra/utils/monorepo-kits）中安全、高效地协作开发。

## 全局架构与模块职责

- 本包是基于 Rush 的 monorepo 管理工具库，只负责**读取与分析 Rush 配置**，不直接修改磁盘结构或执行构建。
- 所有对仓库结构的认知都来自 `@rushstack/rush-sdk` 暴露的 `RushConfiguration`/`RushConfigurationProject` 等类型。
- 主要模块：
  - [src/rush-config.ts](src/rush-config.ts)：封装 `RushConfiguration.loadFromDefaultLocation` 的单例访问入口，是全局配置的唯一来源。
  - [src/sub-packages.ts](src/sub-packages.ts)：围绕 `RushConfigurationProject.dependencyProjects` 做**递归依赖查找**和包元信息查询。
  - [src/lookup.ts](src/lookup.ts)：提供以包名为中心的项目查找与依赖关系查询（单向查询，当前无反向依赖实现）。
  - [src/index.ts](src/index.ts)：对外公共 API 聚合出口，仅做 re-export。
- 架构原则：
  - 将 Rush 配置读取集中在 `getRushConfiguration`，方便缓存与未来扩展（自定义配置路径/环境变量等）。
  - 各功能模块通过 `getRushConfiguration` 间接依赖 Rush，不直接触碰磁盘路径字符串，保证调用点简单可靠。
  - 依赖分析以 **包名（`packageName`）为主键**，返回的始终是包名或 `RushConfigurationProject` 对象，避免混用路径与名称。

## 关键数据流与调用关系

- Rush 配置流：
  - `getRushConfiguration()` → `RushConfiguration.loadFromDefaultLocation({})` → 内部缓存到闭包变量 `rushConfig`。
  - 多次调用始终复用同一个 `RushConfiguration` 实例，不会重复读取磁盘。
- 依赖与包信息流（[src/sub-packages.ts](src/sub-packages.ts)）：
  - `lookupSubPackages(packageName)`：
    - 通过 Rush 配置查找 `projects.find(p => p.packageName === packageName)`。
    - 然后从 `project.dependencyProjects.values()` 中取出依赖项目，深度递归构造依赖集合并去重。
    - 使用 `cachedSubPackages: Map<string, string[]>` 作为递归缓存，避免环和重复遍历。
  - `getPackageLocation(packageName)`：返回目标项目的 `projectFolder` 绝对/相对路径字符串。
  - `getPackageJson(packageName)`：直接返回 `RushConfigurationProject['packageJson']` 对象（非深拷贝）。
- 项目查找流（[src/lookup.ts](src/lookup.ts)）：
  - `lookupTo(to)`：
    - 先按包名过滤 `config.projects.filter(p => p.packageName === to)`，只取第一项。
    - 从其 `dependencyProjects` 中收集所有直接依赖包名数组。
  - `lookupOnly(packageName)`：
    - 与 `lookupTo` 类似过滤方式，返回匹配到的第一个 `RushConfigurationProject` 对象。
  - `lookupFrom(from)`：
    - 目前只校验项目是否存在，没有返回值或进一步逻辑，可视为“占位 / 未完成”能力。

## 开发与运行工作流

- 本子包只提供纯 TypeScript 工具函数，没有 CLI 入口，也不负责执行 Rush 命令。
- 常用脚本（见 [package.json](package.json)）：
  - `npm run build`：目前实现为 `exit 0`，即**空构建**，通常由上层工具使用 `ts-node`/`sucrase` 或其他方式直接消费源码。
  - `npm run lint`：调用根仓库的 `eslint.config.js` 配置，按工作区 `@coze-arch/eslint-config` 规则进行 Lint。
  - `npm run test`：通过 Vitest 执行单测，配置见 [vitest.config.ts](vitest.config.ts)，使用 `@coze-arch/vitest-config` 自定义预设。
  - `npm run test:cov`：在 `test` 基础上加 `--coverage`，使用 `@vitest/coverage-v8`。
- 调试建议：
  - 若要在 Node 中临时调用这些 API，可在 Rush 根目录下创建小型脚本（使用 `ts-node` 或 `sucrase/register`），从包入口 `src/index.ts` 导入函数，并确保当前工作目录下能找到 Rush 根的 `rush.json`。
  - 所有接口都依赖 `RushConfiguration.loadFromDefaultLocation`，故调试时要确保 **当前进程的 `cwd` 位于包含 `rush.json` 的仓库内**。

## 项目内约定与编码风格

- 语言与环境：
  - TypeScript 目标 Node 18，类型配置通过 [tsconfig.json](tsconfig.json) 和工作区 `@coze-arch/ts-config` 管理。
  - 测试框架统一使用 Vitest；若增加测试文件，放在 `__tests__` 或与源码同级，遵循现有 vitest 约定。
- API 设计约定：
  - 所有对外导出的函数从 [src/index.ts](src/index.ts) 统一 re-export，外部使用时总是从包根导入（例如 `import { lookupSubPackages } from '@coze-arch/monorepo-kits'`）。
  - 函数参数一律使用**完整包名字符串**（如 `@coze-studio/xxx`），而不是相对路径或项目名别名。
  - 失败场景一律通过 `throw new Error('Project xxx not found')` 抛出同步异常，不返回 `undefined/null`；新函数应保持一致，以便上层统一处理。
  - 对 Rush SDK 的类型引用集中在实现文件中（例如 `RushConfigurationProject`），不要在外部 API 类型上暴露除非确有必要。
- 性能与缓存约定：
  - Rush 配置：必须通过 `getRushConfiguration` 获取，不要在新代码中直接调用 `RushConfiguration.loadFromDefaultLocation`，以遵守单例与缓存语义。
  - 递归依赖查询：若新增类似 `lookupXxx` 的递归逻辑，优先复用或扩展 [src/sub-packages.ts](src/sub-packages.ts) 中的 `cachedSubPackages` 模式，避免重复遍历大图。
- 错误消息约定：
  - 对于“项目不存在”场景，统一消息格式：`Project ${packageName} not found`；新增函数应沿用该模式，以利于调用侧识别。

## 与外部模块的集成关系

- Rush SDK（`@rushstack/rush-sdk`）：
  - 是本包的唯一运行时依赖，所有核心功能都构建在 Rush 的项目图之上。
  - 关键类型与成员：
    - `RushConfiguration`：通过 `loadFromDefaultLocation` 读取包含 `projects`、`rushJsonFolder` 等信息的配置对象。
    - `RushConfigurationProject`：项目节点对象，暴露 `packageName`、`projectFolder`、`packageJson`、`dependencyProjects` 等字段。
  - 注意：
    - 本包不对 Rush 的磁盘结构做任何封装假设，只通过官方 API 读取；新增功能应优先查阅 Rush SDK 文档，避免硬编码路径规则。
- 内部工具包：
  - `@coze-arch/vitest-config`：统一 Vitest 配置；在 [vitest.config.ts](vitest.config.ts) 中使用 `defineConfig({ dirname, preset: 'node' })`。
  - `@coze-arch/eslint-config`、`@coze-arch/ts-config`：规范 ESLint/TS 配置；新文件应遵循现有规则（如 import 顺序、分号策略等），以减少格式化冲突。
- 典型使用方：
  - [frontend/config/tailwind-config/src/tailwind-contents.ts](../../config/tailwind-config/src/tailwind-contents.ts) 等配置生成工具，会使用本包扫描整个 Rush monorepo 中“包含 React 依赖的子包”，从而生成 Tailwind `content` 列表。
  - 新增能力时应考虑：**调用方通常在配置/脚本层面，而非长生命周期服务**，因此同步 API 和抛异常是可接受的模式。

## 项目流程与协作规范

- Git / Rush 流程：
  - 仓库整体由 Rush 管理，本子包作为其中一个 project 参与统一的 `rush install`、`rush build`、`rush test` 流程；本说明不重复全局规范，具体可参考仓库根目录的 `rush.json` 与相关文档。
  - 在修改本包 API 时，需要同时关注：
    - 是否有下游包（例如 `frontend/config/tailwind-config`）调用这些函数；可以通过全局搜索包名或函数名确认影响面。
    - 是否需要更新本包的 [README.md](README.md) 及本说明，以保持文档与实现一致。
- 分支与提交：
  - 遵循仓库统一策略（如 feature 分支 + PR 检查）；本包无额外强制约定，但建议单次改动聚焦单一能力（例如“新增反向依赖查询 API”）。

## 特殊注意事项与坑位

- 当前 `lookupFrom` 尚未实现完整逻辑，只做存在性校验：
  - 若需要“查找依赖某包的所有上游包”（反向依赖图），需要在 `lookup.ts` 中新增实现；新增时要注意 Rush 项目图规模较大时的性能问题，并考虑是否引入缓存。
- 递归依赖查询的缓存语义：
  - `lookupSubPackages` 的 `cachedSubPackages` Map 使用“查询到的最终结果数组”作为缓存值；
  - 如果将来支持“增量更新 Rush 配置”（例如热重载），需要额外提供 **缓存失效/重建机制**，当前版本假定进程生命周期内项目图不变。
- 错误处理模式：
  - 本包默认将“项目不存在”视为异常场景直接抛错，而不是返回空数组；
  - 新增功能时如存在“可选”语义，应在函数命名和 JSDoc 中明确（例如 `tryLookupXxx` / `maybeGetXxx`），避免与现有同步抛错风格混用。
- 环境依赖：
  - 所有函数都隐式依赖 Rush 根目录存在且可通过默认查找规则定位；在非 Rush 项目或子目录中调用会直接抛异常，这属于预期行为，不在库内兼容。

## 面向 AI 助手的修改建议

- 在新增/修改导出 API 时：
  - 优先在 [src/index.ts](src/index.ts) 中维护统一出口，避免遗忘导出导致下游无法使用。
  - 同步更新 [README.md](README.md) 与本文件的“API 与数据流”描述，保持示例与真实签名一致。
- 在调整 Rush 相关逻辑时：
  - 不要修改 `RushConfiguration.loadFromDefaultLocation` 的调用方式或入参，除非你也同步更新所有调用文档；
  - 如需支持自定义 Rush 根目录，建议通过新增可选配置函数，而不是修改现有 `getRushConfiguration()` 的签名。
- 在编写测试时：
  - 由于本包强依赖 Rush 配置，单测典型写法是：在临时目录中构造一个最小 `rush.json` + `common/config/rush` 结构，再使用 Vitest 的 `beforeAll`/`afterAll` 管理工作目录切换。
  - 避免在测试中直接依赖真实仓库根路径，以保证测试可在 CI / 沙箱环境中稳定运行。
