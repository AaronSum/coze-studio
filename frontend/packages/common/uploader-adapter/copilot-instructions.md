# AI 协作开发说明（@coze-studio/uploader-adapter）

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/uploader-adapter）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本包是 Coze Studio 前端 Rush monorepo 中的一个通用能力子包，用于封装上传 SDK `tt-uploader`，并适配内部抽象接口 `@coze-arch/uploader-interface`。
- 主要职责：对外暴露统一的 `getUploader` 工厂方法和类型定义，对内负责：
  - 根据配置动态拼装上传 SDK 的初始化参数（域名、区域、schema 等）；
  - 将内部定义的 `FileOption` 映射到 `tt-uploader` 的 `ImageXFileOption`，对上游隐藏具体 SDK 形态；
  - 复用并扩展第三方 Uploader 实例，补充项目需要的 `addFile` 等接口。
- 其他业务包应依赖本包完成上传能力接入，而不直接依赖 `tt-uploader`。

## 2. 代码结构与模块职责

关键目录/文件：
- [src/index.ts](src/index.ts)
  - 核心导出：
    - `getUploader(config: Config, isOversea?: boolean): CozeUploader`
    - `type FileOption`
    - `type CozeUploader`
    - 透传导出：`Config`, `EventPayloadMaps`（来自 `@coze-arch/uploader-interface`）。
  - 主要逻辑：
    - 从 `@coze-arch/uploader-interface` 引入 `Config`、`STSToken`、`ObjectSync` 等类型，从 `tt-uploader` 引入默认 `Uploader` 与 `ImageXFileOption`。
    - 根据 `config.imageHost`/`config.imageFallbackHost` 计算最终 `imageHost`，并按需替换 `https://` 为 `config.schema://`，以适配不同部署环境及特殊 HTTP 场景。
    - 依据 `isOversea` 决定上传区域：
      - 国内：`region = 'cn-north-1'`
      - 海外：`region = 'ap-singapore-1'`
    - 将 `config` 中的 `appId`、`userId`、`useFileExtension`、`uploadTimeout`、`imageConfig` 等直接透传给 `tt-uploader` 构造函数，并以 `as any` 规避 SDK 类型差异。
    - 为 `uploader` 实例新增 `addFile(options: FileOption)` 方法：
      - 仅从 `FileOption` 中取出 `file` 与 `stsToken`，构造成 `ImageXFileOption` 调用原始 `addImageFile`，其余字段目前不参与上传流程（但保留在类型上，便于未来扩展）。
- [__tests__/index.test.ts](__tests__/index.test.ts)
  - 使用 `vitest` 对 `getUploader` 行为做单元测试，通过 `vi.mock('tt-uploader')` 注入 mock 实现。
  - 覆盖点：
    - 国内/海外 `region` 设置是否正确；
    - `imageHost` 计算逻辑（去掉 `https://`、使用 `imageFallbackHost`、都缺失时为空字符串）；
    - `addFile` 是否正确转发 `file` 与 `stsToken` 给 `addImageFile` 并返回 key。
- [package.json](package.json)
  - `main: src/index.ts`，当前未配置构建产物输出，build 脚本为 `exit 0`，依赖按 Rush workspace 方式管理。
- [eslint.config.js](eslint.config.js)
  - 使用内部 ESLint 预设 `@coze-arch/eslint-config`，preset 为 `node`，并关闭 `@typescript-eslint/no-explicit-any`，以允许对第三方 SDK 做 `as any` 适配。
- [vitest.config.ts](vitest.config.ts)
  - 使用内部 `@coze-arch/vitest-config`，preset 为 `node` 并指定 `dirname`，保证测试在 Node 环境下运行。
- [README.md](README.md)
  - 简要描述与安装方式，目前缺少具体使用示例，后续可在该文件中补充。

## 3. 构建、测试与本地开发流程

本包是 Rush monorepo 成员，常见工作流：

- 安装依赖（在 monorepo 根目录执行）：
  - `rush update`

- 在本子包下的 NPM scripts：
  - `npm run build`
    - 当前实现为 `exit 0`，即无实际打包行为。
    - 项目对外导出通常依赖 Rush/TS 构建链路，具体可参考同类包（例如 `@coze-arch/uploader-interface`）的构建方式；在需要新增构建能力时应保持与 monorepo 其他包一致。
  - `npm run lint`
    - 使用根目录安装的 ESLint + `@coze-arch/eslint-config` 规则，对当前包进行增量检查（开启了 `--cache`）。
  - `npm run test`
    - 通过 `vitest --run --passWithNoTests` 执行测试；当前仅有 `__tests__/index.test.ts`。
  - `npm run test:cov`
    - 在 `npm run test` 基础上追加覆盖率统计。

在 monorepo 层面，也可以通过 Rush 提供的统一命令（例如 `rushx test --to @coze-studio/uploader-adapter` 或类似脚本）来执行，但具体命令需参考根目录 `rush.json` 及 `frontend/rushx-config.json` 中的定义。

## 4. 项目内约定与编码风格

- 类型与接口：
  - 与上传相关的共享类型（`Config`、`STSToken`、`ObjectSync`、`EventPayloadMaps` 等）统一从 `@coze-arch/uploader-interface` 引入；本包不重复定义同义类型，只在需要扩展时新增局部类型（如 `FileOption`、`CozeUploader`）。
  - `FileOption` 与 `ImageXFileOption` 有意不完全对齐，当前仅使用 `file` 与 `stsToken` 字段，其余字段预留在业务侧使用或未来适配。
- 环境与区域：
  - `getUploader(config, isOversea?)` 中的 `isOversea` 是唯一影响 `region` 的开关，所有新增上传场景若有海外需求，应沿用该布尔位或在不破坏现有语义的前提下扩展；
  - `imageHost` 处理逻辑依赖 `config.imageHost` / `config.imageFallbackHost` 中是否包含 `https://` 前缀，并可根据 `config.schema` 替换协议；修改时务必同步更新测试用例，避免线上资源域名异常。
- 对第三方 SDK 的封装方式：
  - 通过 `new Uploader({...} as any)` 初始化实例，将内部配置透传并在类型层面放宽校验；
  - 使用 `uploader.addImageFile.bind(uploader)` 保存原始方法，再在其外包一层适配函数 `addFile`，避免直接修改第三方类型定义；
  - `CozeUploader` 使用交叉类型 `Uploader & { addFile(...) }` 对外声明额外能力，而不是继承或重新实现上传类。
- Lint/测试约定：
  - 代码中允许使用 `any` 主要是为与第三方库类型兼容，新增业务逻辑时仍建议优先使用精确类型，并仅在确实需要兼容时才引入 `any`。
  - 测试中通过 `vi.mock('tt-uploader')` + 全局挂载 mock（`(global as any).__mockUploader`）的方式解决 type/模块隔离问题；新增测试时保持该模式可以避免多处重复声明 mock。

## 5. 对外依赖与集成细节

- `@coze-arch/uploader-interface`
  - 提供所有上传相关的统一 TypeScript 类型定义，也是本包与其他业务包之间的主要契约层。
  - 当前本包仅在类型层面依赖，不直接调用其中的运行时代码（如有）。
  - 当该接口包添加新字段（例如额外的域名、鉴权信息等）时，应评估是否需要在本包的 `FileOption` 或 `getUploader` 初始化参数中同步支持，并补充测试覆盖。

- `tt-uploader`
  - 第三方上传 SDK，提供底层上传实现与 `addImageFile` 等方法。
  - 本包默认按 Node preset 执行测试，但 `tt-uploader` 在真实运行时可能依赖浏览器/运行环境，请在单测中继续使用 mock，避免直接引入真实实现。
  - 若未来需要在 `addFile` 中使用更多 `ImageXFileOption` 字段（如回调参数、自定义域名等），应：
    - 扩展 `FileOption` 的字段并在实现中正确转发；
    - 更新单测中 mock 参数断言，确保新增字段被传入。

## 6. 开发注意事项与安全边界

- 兼容性与回滚：
  - 由于本包是对上传能力的集中封装，改动容易影响多个上游子包；新增字段或修改默认行为时，应：
    - 首先调整/补充本包单测，确保核心行为（域名、区域、addFile 参数）被完整覆盖；
    - 再在依赖本包的上游包中做小步联调，避免一次性大规模修改。
- 不要在本包内写入与上传无关的业务逻辑：
  - 例如权限校验、UI 状态管理等应由上层业务或 UI 包处理；
  - 本包仅负责“如何调用上传 SDK”，不关心“何时/为何上传”。
- 与 monorepo 其他流程的关系：
  - 分支策略、发布流程等由仓库根部统一管理；在本子包修改时，保持与现有提交习惯一致（例如遵守根目录的提交规范、CI 流程）。

## 7. 为 AI 助手准备的操作建议

- 在实现新功能前：
  - 先阅读 [src/index.ts](src/index.ts) 与 [__tests__/index.test.ts](__tests__/index.test.ts)，理解现有适配层如何桥接 `Config` 与 `tt-uploader`；
  - 必要时，参考相邻的接口包（如 `frontend/packages/common/uploader-interface`，实际路径需在 workspace 中确认）。
- 修改或新增能力时：
  - 优先在该包内补全类型和测试，再在上游业务中调用；
  - 对改变 `region`、`imageHost` 计算方式、`addFile` 参数映射的改动，一定要扩展单测断言。
- 生成代码时应避免：
  - 引入与上传无关的外部依赖；
  - 直接在测试中使用真实的 `tt-uploader` 实现，而不是通过 `vi.mock`。
