# @coze-arch/rush-logger · Copilot Instructions

> 目标：让 AI 代理熟悉并能安全修改 / 扩展 `@coze-arch/rush-logger`。

## 1. 子包角色与全局架构位置

- 所在路径：`frontend/infra/utils/rush-logger`
- 定位：**Node 环境下的终端日志工具**，为 Rush / 脚本类工具提供统一的彩色终端输出能力。
- 依赖：基于 `@rushstack/node-core-library` 的 `Terminal` / `ConsoleTerminalProvider` / `Colors`。
- 与整体前端架构关系：
  - 属于 `infra/utils` 下的通用工具库，可被脚本、工具或 Node 端服务复用；
  - 与 React UI、浏览器端运行时无直接耦合，只面向 **Node 进程日志输出**。

核心只有一个实现文件与一个测试文件：
- 源码：`src/index.ts`
- 测试：`__tests__/logger.test.ts`

## 2. Logger 设计与数据流

### 2.1 Logger 类结构

源码：`src/index.ts`。

- 使用 `ConsoleTerminalProvider` + `Terminal` 实例化终端：
  ```ts
  this.terminal = new Terminal(new ConsoleTerminalProvider());
  ```
- 通过 `Colors.xxx` 将文本染色后交给 `terminal.writeLine` 输出。
- 公开能力：
  - `logger.warning(content: string, prefix?: boolean)` → 黄色 `[WARNING] xxx`
  - `logger.debug(content: string, prefix?: boolean)` → 加粗 `[DEBUG] xxx`
  - `logger.success(content: string, prefix?: boolean)` → 绿色 `[SUCCESS] xxx`
  - `logger.error(content: string, prefix?: boolean)` → 红色 `[ERROR] xxx`
  - `logger.info(content: string, prefix?: boolean)` → 蓝色 `[INFO] xxx`
  - `logger.default(content: string)` → 直接输出，无颜色、无前缀
  - `logger.turnOff()` / `logger.turnOn()` → 打开 / 关闭日志输出开关

### 2.2 前缀与静默逻辑

底层统一由私有方法 `$writeLine` 处理：

```ts
// eslint-disable-next-line max-params
private $writeLine(
  content: string,
  colorFn: typeof Colors.bold,
  prefix?: boolean,
  prefixText?: string,
) {
  prefix = prefix ?? true;
  const formattedContent = prefix ? `${prefixText} ${content}` : content;
  if (this.$silent === true && prefixText !== '[ERROR]') {
    return;
  }
  return this.terminal.writeLine(colorFn(`${formattedContent}`));
}
```

- `prefix` 为空时会被置为 `true`：默认带 `[LEVEL]` 前缀；
- `prefix === false` 时，将输出纯内容，无 `[LEVEL]`；
- 静默模式：
  - 通过 `logger.turnOff()` 打开静默；
  - 静默时所有非 ERROR 日志都被丢弃；
  - ERROR 日志 **始终输出**（即使静默），用于重要错误不可被吞掉；
  - `logger.turnOn()` 恢复正常输出。

### 2.3 默认导出与命名导出

尾部导出：

```ts
const logger = new Logger();

export { logger };

/** @Deprecated  ... */
export default logger;
```

- 推荐：`import { logger } from '@coze-arch/rush-logger'`。
- 默认导出 **已标记为 Deprecated**，保留向后兼容，不建议在新代码中使用。

## 3. 开发工作流（build / lint / test）

`package.json`（路径：`frontend/infra/utils/rush-logger/package.json`）：

- `"main": "src/index.ts"` / `"types": "src/index.ts"`：
  - 当前版本直接指向源码，依赖端通常在 Node 环境直接执行 TS 编译产物或通过构建工具统一处理；
  - **不要随意改动 main/types 指向**，除非同时调整构建策略和引用方。
- `scripts`：
  - `build`: 当前是 `exit 0`，即构建步骤对该包是空操作；
  - `lint`: `eslint ./src ./__tests__ --cache`；
  - `test`: `vitest --run`；
  - `test:cov`: `vitest run --coverage`。

### 3.1 在子包内开发

在 monorepo 根目录先执行：

```bash
rush install # 或 rush update
```

进入子包：

```bash
cd frontend/infra/utils/rush-logger

# Lint
pnpm lint

# 单元测试
pnpm test
pnpm test:cov
```

> 注意：Vitest 配置在 `vitest.config.ts`，通过 `@coze-arch/vitest-config` 统一管理，preset 为 `node`，覆盖率对所有文件开启 (`coverage.all = true`)。

### 3.2 在前端仓库整体中使用 Rush 任务

- Rush 任务定义集中在 `frontend/rushx-config.json` 与各 package 的 `scripts` 中；
- `@coze-arch/rush-logger` 本身没有额外的 rushx 脚本，只是被其他工具包 / CLI 间接依赖；
- 如需新增面向 monorepo 的脚本，需要在更上层 app / 工具包里引用 `logger`，不要在此包内硬编码对具体项目的路径或逻辑。

## 4. 项目约定与编码风格

### 4.1 语言与运行环境

- 运行环境：**Node（非浏览器）**；
- TypeScript：严格类型；
- 禁止依赖浏览器 API（window、document 等），否则会与 `preset: 'node'` 的测试环境冲突。

### 4.2 日志使用约定

- 普通信息：`logger.info` / `logger.debug`；
- 用户/运维可感知的重要成功：`logger.success`；
- 需要引起注意但非致命问题：`logger.warning`；
- 致命或必须暴露的问题：`logger.error`（静默模式仍输出）；
- 非结构化临时输出：`logger.default`。

前缀使用：

- 默认带 `[INFO]` / `[ERROR]` 等；
- 当接入其他日志系统或已有前缀时，可以传 `false` 去掉内置前缀：
  ```ts
  logger.info('[UPGRADE] step-1 finished', false);
  ```

### 4.3 静默模式语义

- 该模式主要为批处理脚本 / CI 工具设计：
  - 在大量日志可能污染终端时，通过 `turnOff` 关闭除 ERROR 以外的所有输出；
  - 但依然保证错误不会被吞没，保持可观测性。
- 编写新逻辑时，**不要额外再判断 `$silent`**，一律通过现有 `Logger` API；如需更细粒度控制，应先讨论是否扩展接口。

### 4.4 ESLint / TSConfig 约束

- ESLint：
  - 配置文件为 `eslint.config.js`，使用 `@coze-arch/eslint-config`，`preset: 'node'`；
  - 某些规则如 `max-params` 已通过内联注释在 `$writeLine` 上豁免，如非必要不要频繁新增豁免。
- TypeScript：
  - `tsconfig.json` / `tsconfig.build.json` / `tsconfig.misc.json` 由上层统一风格管理；
  - 调整编译选项需确保不破坏 monorepo 内其他包对该包的期望（例如模块系统、目标版本）。

## 5. 测试策略与 Mock 约定

测试文件：`__tests__/logger.test.ts`。

关键模式：

- 使用 Vitest 的 `vi.mock` 对 `@rushstack/node-core-library` 进行整体 mock：

  ```ts
  const mockWriteLine = vi.fn();
  vi.mock('@rushstack/node-core-library', () => ({
    Terminal: vi.fn().mockImplementation(() => ({ writeLine: mockWriteLine })),
    ConsoleTerminalProvider: vi.fn(),
    Colors: new Proxy({}, {
      get(_, color: string) {
        return () => color;
      },
    }),
  }));
  ```

  - 这样可以在不依赖真实 console 的情况下，验证 `logger` 是否调用了底层 `writeLine`；
  - `Colors` 被替换为简单的 Proxy，只返回颜色名字符串，方便断言调用链。

- 通过 `vi.importActual('../src')` 引入真实实现，保证测试的是实际导出的 `logger`。  
- 覆盖点：
  - 各级日志方法是否被调用，参数是否正确透传；
  - `default` 是否直接调用 `writeLine`；
  - `prefix` 为 `false` 时的行为；
  - `turnOff` / `turnOn` 是否按预期控制 `mockWriteLine` 调用次数。

> 新增功能时，请参考现有测试风格：**通过 mock 外部依赖，聚焦行为而非实现细节**。

## 6. 与外部依赖的集成细节

### 6.1 `@rushstack/node-core-library`

当前只用到三个 API：

- `ConsoleTerminalProvider`：将日志写到 Node 进程的 stdout/stderr；
- `Terminal`：封装写入方法 `writeLine`，支持格式化输出；
- `Colors`：提供 `Colors.green` / `Colors.red` 等函数，用于给字符串着色。

对 AI 代理的注意点：

- 不要在此包内封装与 rush 特定命令 / 配置文件的强耦合逻辑，保持它是**通用的终端 logger**；
- 如需扩展为 file logger / JSON logger，应考虑新建独立包，或在讨论后引入可配置的 provider，而不是直接修改现有 ConsoleTerminalProvider 行为。

## 7. 版本、发布与仓库规范

- 版本管理：由上层 Rush monorepo 统一控制；此包当前版本在 `package.json`（如 `0.0.2-beta.6`）；
- License：Apache-2.0；
- 团队标签：
  - `team-arch`，`level-1`（详见 `frontend/rushx-config.json`）；
  - 对 level-1 包，有更高的覆盖率与质量要求（如覆盖率 80%+）。

### 7.1 分支与提交（遵循前端仓库通用规范）

本包不独立定义分支策略，遵循 `frontend` 仓库整体规范：

- 在主仓库层面创建 feature / fix 分支，对应修改本包代码；
- 提交前：
  - 至少在本包跑过 `pnpm lint` 与 `pnpm test`；
  - 如改动核心行为，建议增加/更新对应测试用例。

## 8. 对 AI 代理的实践建议

当你在本包中做改动或扩展时，请优先遵守以下原则：

- **保持 API 简洁**：新增日志级别时，沿用 `Logger` + `$writeLine` 的既有模式，不要引入与本包职责不符的功能（如 metrics / tracing）；
- **注意静默模式语义**：任何新日志方法都应复用 `$writeLine`，保证静默开关与 ERROR 特例逻辑的一致性；
- **严格 Node 环境**：避免引入仅在浏览器可用的依赖；
- **补齐测试**：扩展特性时仿照现有 Vitest + mock 模式，确保覆盖率不会显著下降；
- **遵循 Deprecated 提示**：不要再鼓励使用默认导出，示例和新代码统一使用命名导出。

如果你需要：
- 新增日志级别：在 `Logger` 类中添加对应方法，并在测试中新增用例，验证颜色函数 / 前缀 / 静默下行为；
- 支持结构化输出：优先在调用方组装字符串，再传入 `logger`，除非经过评审后在此包中引入新的接口（例如 `log({ level, message, metadata })`）。
