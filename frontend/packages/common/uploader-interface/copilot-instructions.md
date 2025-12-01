# Copilot 使用说明（@coze-arch/uploader-interface）

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/uploader-interface）中安全、高效地协作开发。

## 1. 子包定位与整体角色

- 本包名为 `@coze-arch/uploader-interface`，位于 monorepo 前端工程的 common 层，用于抽象上传 SDK 的 **类型与事件协议**。
- 当前实现仅包含一个源码文件 [src/index.ts](src/index.ts)，主要导出一组 TypeScript 接口和类型，用于描述上传配置、任务、事件与结果；**本包自身不包含任何具体上传逻辑或网络请求实现**。
- 在整体架构中，本包通常被：
  - 具体上传实现包（例如针对特定云厂商 / SDK 的 adapter）引用，作为类型契约；
  - 上层业务代码（Studio、Agent IDE、Data 等）引用，用于在调用上传服务时获得统一的类型和事件结构。

## 2. 代码结构与核心概念

### 2.1 目录结构

- [package.json](package.json)：定义包元数据与脚本（build / lint / test 等），无运行时代码入口配置以外的特殊逻辑。
- [README.md](README.md)：简要说明用途和导出 API。
- [src/index.ts](src/index.ts)：
  - 定义上传鉴权、配置、文件选项、事件 payload 以及上传结果等核心接口。
  - 定义上传器接口 `BytedUploader`，约束外部上传 SDK 适配器的能力与事件模型。
- [tsconfig.json](tsconfig.json) + [tsconfig.build.json](tsconfig.build.json) + [tsconfig.misc.json](tsconfig.misc.json)：
  - 使用 monorepo 里的公共 TS 配置（`@coze-arch/ts-config`），本包自身仅做引用与增量配置。
- [vitest.config.ts](vitest.config.ts)：沿用 monorepo 公共 vitest 配置（`@coze-arch/vitest-config`）。

### 2.2 核心类型与数据流

所有与上传相关的数据流都通过 [src/index.ts](src/index.ts) 中的接口进行约束：

- `STSToken`：临时访问凭证，包含 `AccessKeyId / SecretAccessKey / SessionToken / ExpiredTime / CurrentTime`，通常由后端签发，由上层调用方注入。
- `ObjectSync`：描述对象同步渠道信息（`ChannelSource / ChannelDest / DataType / BizID`），供上传后对象同步场景使用（如同步到其他业务系统）。
- `Action` 与 `VideoConfig` / `ImageConfig` / `ObjectConfig`：
  - `Action.name` 限制为一组特定字符串（`GetMeta`、`StartWorkflow`、`Snapshot` 等），表示上传过程中需要附加的处理动作。
  - `VideoConfig` / `ImageConfig` / `ObjectConfig` 将这些动作挂在 `processAction` 上，外加服务侧标识（`spaceName` / `serviceId`）来控制后续处理链。
- `Config` / `UpdateOptions`：
  - `Config` 是创建上传器实例所需的**完整配置**，包含：用户维度（`userId / appId`）、区域信息 `region`（枚举）、各类资源 host（`videoHost / imageHost / ...`）、各类子配置（`videoConfig / imageConfig / objectConfig`）以及大量行为开关（如 `skipDownload / skipMeta / enableDiskBreakpoint` 等）。
  - `UpdateOptions` 是部分字段的可选更新版本，用于在运行过程中通过 `setOption` 动态调整部分配置（例如切换分片策略、更新 STS 等）。
- `FileOption` / `ImageFileOption` / `StartOptions` / `StreamTaskOption` / `StreamSliceOption`：
  - `FileOption`：通用文件上传参数（`file: Blob`、`type: 'video' | 'image' | 'object'` 等），支持携带 `objectSync`、`storeKey`、`serviceType` 等额外信息。
  - `ImageFileOption`：针对图片批量/多文件上传做的类型精简封装。
  - `StartOptions`：控制上传起始阶段（是否优选路由、路由超时、缓存时间及文件大小阈值等）。
  - `StreamTaskOption` / `StreamSliceOption`：描述流式上传任务与单个分片信息，供大文件/流式场景使用。
- 事件体系：
  - `BaseEventInfo`：统一的事件基础 payload，包含：
    - 各类时间戳（`startTime / endTime / stageStartTime / stageEndTime`）、阶段耗时 `duration`；
    - 文件级别信息（`fileSize / key / oid / percent / sliceLength / stage / status / uploadID`）；
    - 扩展信息 `extra`（错误详情、错误码、提示 message）。
  - `ProgressEventInfo` / `StreamProgressEventInfo` / `ErrorEventInfo` / `CompleteEventInfo`：
    - 以上均基于 `BaseEventInfo`，`CompleteEventInfo` 在此基础上新增 `uploadResult: UploadResult`。
  - `UploadResult`：统一封装视频 / 图片 / 文件上传后的返回值：
    - 视频：`Vid / VideoMeta / PosterUri`；
    - 图片：`ImageUri / ImageWidth / ImageHeight / ImageMd5 / FileName`；
    - 文件：`Uri / ObjectMeta` 等。
- `EventPayloadMaps` + `UploadEventName` + `BytedUploader`：
  - 通过 `EventPayloadMaps` 将 `complete / progress / stream-progress / error` 与对应 payload 类型绑定。
  - `BytedUploader` 暴露的 `on / once / removeListener` 等方法使用泛型 `<T extends UploadEventName>`，确保不同事件回调的参数类型安全。

整体数据流：上层业务通过 `Config` 初始化上传器实例（实现方满足 `BytedUploader` 接口），通过 `addFile` / `addImageFile` / `addStreamUploadTask` 等方法提交上传任务，再通过 `on('progress' | 'complete' | 'error' | 'stream-progress')` 订阅上传生命周期事件，事件 payload 以 `BaseEventInfo` 为核心结构统一承载。

## 3. 构建、测试与本地开发流程

### 3.1 本包级命令

在本包目录 `frontend/packages/common/uploader-interface` 内：

- 安装依赖（通常在 monorepo 根目录执行）：
  - `rush install` / `rush update`（见前端根 [README.md](../../README.md)）。
- 构建：
  - `npm run build` 当前实现为 `exit 0`，即**占位脚本且不产生构建产物**；本包作为纯类型定义，通常依赖上游构建工具直接消费 `src` 源码。
- Lint：
  - `npm run lint` → `eslint ./ --cache`，继承 monorepo 的 `@coze-arch/eslint-config`。
- 测试：
  - `npm test` → `vitest --run --passWithNoTests`，即使没有测试文件也会成功退出（用于 CI 流程对齐）；
  - `npm run test:cov` → 带覆盖率的 vitest 执行。

在 monorepo 语境中，也可以通过 Rush 调用：

- `rushx lint -p @coze-arch/uploader-interface`（实际命令视 workspace 设置而定）；
- 统一执行所有包的测试/检查时，本包会被一起跑过（由于 `test` 不会因无测试失败，因此对流水线友好）。

### 3.2 TypeScript 配置与编译行为

- [tsconfig.json](tsconfig.json)：
  - 使用 `"exclude": ["**/*"]` 并仅通过 `references` 指向 `tsconfig.build.json` 和 `tsconfig.misc.json`；
  - 说明本包实际编译行为完全由这些子配置控制，并依赖根层 `@coze-arch/ts-config` 中的统一规则（如 strict 模式、模块解析等）。
- 在 AI 编程时：
  - 若需要新增源码文件，请确保被相应 `tsconfig.*.json` 包含（通常通过 `include` / `files` 在那些子配置中管理）；
  - 不要在本地简单修改根 tsconfig 的 `exclude`/`include` 以规避 monorepo 约定。

## 4. 项目约定与模式

### 4.1 仅暴露类型，不实现具体逻辑

- 本包设计为**上传接口与事件模型的类型定义层**：
  - 不引入任何 runtime 依赖；
  - 不包含实际上传实现、网络请求、SDK 调用等逻辑；
  - 仅通过 `BytedUploader` 等接口约束外部实现的能力与行为。
- 在修改 / 扩展时：
  - 避免在此包中添加具体实现（如直接封装第三方上传 SDK）；
  - 若确有需要，引入新的实现包（例如 `*-adapter`），由适配器依赖本接口包，而非反向依赖。

### 4.2 命名与字段约定

- 许多字段与后端 / 外部 SDK 命名保持一致（如 `Vid / Uri / ObjectMeta / STSToken` 等），**请勿随意重命名**，以免破坏跨端协议或已有调用约定。
- 区域 `region` 是受控枚举字符串，仅接受预定义值：
  - `cn-north-1` / `us-east-1` / `ap-singapore-1` / `us-east-red` / `boe` / `boei18n` / `US-TTP` / `gcp`。
- 上传状态与阶段：
  - `BaseEventInfo.status`：`1 | 2 | 3` 分别表示运行中 / 取消中 / 暂停中；
  - `BaseEventInfo.stage`：自由文本，但存在既有约定（如 `'browserError'`），新增值时需确保上下游解析方也同步更新。

### 4.3 事件模型与类型安全

- 本包使用 `EventPayloadMaps` 与 `UploadEventName` 来将事件名与 payload 类型做映射：
  - `BytedUploader.on<'complete'>('complete', handler)` 时，`handler` 参数自动推导为 `CompleteEventInfo`；
  - 新增事件名时应：
    - 在 `UploadEventName` 联合类型中加入新字符串；
    - 在 `EventPayloadMaps` 中补充同名字段与类型；
    - 更新 `BytedUploader` 上相关事件方法（`on/once/removeListener/removeAllListeners`）使用的新事件名。
- 在修改事件模型时需特别谨慎，避免破坏现有适配器 / 监听方的类型推导与运行时行为。

## 5. 与外部系统及其他子包的集成

- 鉴于本包只定义接口，没有直接依赖外部 SDK/网络库，其“集成”全部体现在类型层面：
  - `STSToken` / `Config` 等通常与后端上传服务（如 TOS/VOD/ImageX 等）协议匹配；
  - `BytedUploader` 期望由某个上传 SDK（可能是内部封装）实现，并在其他包中实例化使用；
  - `ObjectSync` / `bizType` / `instanceId` 等字段为业务埋点、对象同步和实验控制预留字段，上层业务或后端会读取和解释这些值。
- 在 AI 编程时：
  - 若需要为新的上传 SDK 写 adapter，推荐在其他包（例如 `uploader-adapter`）实现，并让该 adapter 满足 `BytedUploader` 接口；
  - 新增字段时，应与后端/SDK 对齐协议后再写入本包类型。

## 6. 开发流程与协作规范（与 monorepo 的关系）

- Monorepo 层级：
  - 本包受 Rush + PNPM 管理，版本号通常由整个仓库统一发布流程控制；
  - 依赖管理：`package.json` 中仅声明开发依赖（eslint/ts/vitest 等），不引入业务 runtime 依赖，以保持接口层的轻量。
- 分支与提交规范：
  - 请遵循仓库根目录的 CONTRIBUTING / git-hooks 等约定（如提交信息规范、lint-staged、格式化等）。
- 发布与使用：
  - 通常通过 workspace 互相引用（`"workspace:*"`），不单独作为独立 NPM 包在外部使用；
  - 修改类型定义会影响大量下游包，需配合相应的编译与回归测试（可使用 Rush 的批量命令执行）。

## 7. 对 AI 编程助手的具体建议

- 编写 / 修改代码时优先：
  - 在 [src/index.ts](src/index.ts) 中补充或调整接口定义，避免在其他包重复定义上传相关类型；
  - 保持字段命名与现有模式一致（英文驼峰 + 与后端协议对齐）。
- 非必要时不要：
  - 在本包加入实现代码、React 组件或工具函数；
  - 修改 `tsconfig` 的基础结构或 monorepo 共享配置引用方式。
- 若用户请求新增上传能力：
  - 优先在此处补充必要的类型（例如新增 `Action.name` 的枚举值、扩展 `UploadResult` 字段）；
  - 然后在对应适配器 / 业务包中实现具体逻辑。
