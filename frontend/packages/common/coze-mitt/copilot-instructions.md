# coze-mitt 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/coze-mitt）中安全、高效地协作开发。

## 全局架构与职责边界
- 本子包提供一个基于 `mitt` 的轻量级全局事件总线，导出点集中在 [src/index.ts](src/index.ts)。
- 事件名与事件参数类型通过本包内部的 `EventMap` 类型统一定义，并通过 `mitt<EventMap>()` 实例化单一的 `cozeMitt` 事件总线实例。
- 当前关注的核心事件：
  - `refreshFavList`: 用于在多个区域之间同步「收藏列表」变更，参数类型为 `RefreshFavListParams`（包含 `id`、`numDelta`、`emitPosition`）。
  - `createProjectByCopyTemplateFromSidebar`: 用于「左侧栏按模板创建项目成功」后的联动，参数类型为 `CreateProjectByCopyTemplateFromSidebarParam`（`toSpaceId`）。
- 上层应用（如 workspace、community、space-ui 等包）通过 `@coze-common/coze-mitt` 引入事件总线，实现跨包、跨页面的 UI 同步与行为协调，本包自身不关心调用方 UI 细节，只保证事件的命名与参数契约。

## 源码结构与类型设计
- [src/index.ts](src/index.ts)
  - 只导出三个符号：`RefreshFavListParams`、`CreateProjectByCopyTemplateFromSidebarParam`、`cozeMitt`，以及辅助类型 `CozeMittEventType`（事件名联合类型）。
  - `EventMap` 使用 `type` 而非 `interface`（见 eslint 注释），是因为 `mitt` 的泛型签名要求使用具名类型映射，`@typescript-eslint/consistent-type-definitions` 在此处被局部关闭。
  - 所有事件都应添加到 `EventMap` 中，并为其定义明确的参数类型，确保调用方在 `emit` / `on` 时获得类型检查。
- [src/typings.d.ts](src/typings.d.ts)（若存在额外声明时可扩展）：用于放置本包需要暴露给编译器的全局类型声明；修改时需要考虑对其他 workspace 包的影响。

## 依赖与配置
- 运行时依赖（见 [package.json](package.json)）：
  - `mitt`: 事件总线的唯一运行时核心依赖。
  - `classnames`: 当前源码未使用，保留是为了与其他 UI 包模板保持一致，新增代码如需处理 className 拼接可直接复用。
- 开发依赖：
  - 统一使用 monorepo 提供的基础配置包：`@coze-arch/eslint-config`、`@coze-arch/stylelint-config`、`@coze-arch/ts-config`、`@coze-arch/vitest-config`。
  - React/ReactDOM 类型作为 peer + dev 依赖存在，源于模板化的 React 组件包结构，即使本包当前不导出 React 组件，也需要保持配置一致保证在不同项目中解析正常。
- TypeScript 配置：
  - [tsconfig.json](tsconfig.json) / [tsconfig.build.json](tsconfig.build.json) / [tsconfig.misc.json](tsconfig.misc.json) 通过 `@coze-arch/ts-config` 继承统一规则，仅做最小化本地覆盖；调整编译行为时优先在 `tsconfig.build.json` 中修改。

## 构建、测试与 Lint 工作流
- 包级脚本（见 [package.json](package.json)#scripts）：
  - `npm run build`: 当前实现为 `exit 0`，即构建阶段在本包总是快速通过，主要依赖上层构建工具（如 rsbuild）实际打包；如需增加独立构建逻辑，应在保证与 monorepo 总体流程兼容的前提下扩展。
  - `npm run lint`: 调用 `eslint ./ --cache`，规则由根部与 `@coze-arch/eslint-config` 提供；修改源码后建议先运行此命令以对齐团队规范。
  - `npm run test`: 通过 `vitest --run --passWithNoTests` 执行单元测试，即使当前没有测试文件也会视为通过。
  - `npm run test:cov`: 在 `test` 基础上追加覆盖率报告，使用 `@vitest/coverage-v8` 配置。
- Vitest 配置：
  - [vitest.config.ts](vitest.config.ts) 使用 `@coze-arch/vitest-config` 的 `defineConfig`，设置 `preset: 'web'`，并显式传入 `dirname`；如需为本包新增测试，直接在 `src` 旁增加 `*.test.ts`/`*.spec.ts` 即可，遵守统一 web preset 约定。
- Rush 集成：
  - [config/rushx-config.json](config/rushx-config.json) 提供覆盖率阈值等元信息（例如 `codecov.coverage`）；在 monorepo 级别通过 `rushx` 命令被消费。
  - 本包作为 workspace 成员，被其他包（如 foundation/global、community/component 等）在其 `tsconfig.build.json` 与 `package.json` 中通过 `workspace:*` 依赖及 `project reference` 引用。

## 项目内约定与模式
- 事件命名规范：
  - 采用语义化的动词短语小驼峰形式，例如 `refreshFavList`、`createProjectByCopyTemplateFromSidebar`，反映行为与触发上下文。
  - 添加新事件时，需保持同一语义域的一致前缀（如与收藏相关的继续使用 `Fav` 前缀）。
- 事件参数设计：
  - 参数类型使用独立 `interface` 暴露，并在注释中说明字段含义及使用场景（如埋点 `emitPosition`）。
  - 业务方若需扩展参数字段，应在确保兼容性的前提下新增可选字段，避免破坏现有监听方。
- 类型导出策略：
  - 对外仅暴露必要的参数类型与 `cozeMitt` 实例，不在本包内暴露具体业务逻辑函数，保证其作为纯粹的「事件契约中心」。
  - 如其他包需要对某类事件进行统一封装（例如封装常用 emit 函数），建议在对应业务包中实现，而不是回写到本包。

## 对其他子包的集成方式
- 常见使用路径（示例）：
  - `import { cozeMitt } from '@coze-common/coze-mitt';`
  - `cozeMitt.emit('refreshFavList', { id, numDelta, emitPosition });`
  - `cozeMitt.on('refreshFavList', handler);`
- 依赖关系：
  - 社区组件、workspace、space-ui 等多个包在其 [tsconfig.build.json] 中通过 `project reference` 指向本包的 `tsconfig.build.json`，并在 `package.json` 中声明 `"@coze-common/coze-mitt": "workspace:*"`。
  - 因为本包是「平台级事件总线」，变更事件名或参数类型会对多处调用方造成影响，修改前应在仓库内使用全局搜索确认所有引用并评估兼容性。
- 外部通信：
  - 本包不直接与后端或浏览器 API 通信，所有外部交互都发生在调用方；因此这里的改动主要影响前端不同组件间的数据流，而非网络协议。

## 开发流程与协作注意事项
- 分支与提交：
  - 遵循仓库统一的分支策略与提交规范（详见仓库根部文档，如 README、CONTRIBUTING 等），本包不单独定义分支流程。
  - 修改事件定义时，建议在提交信息中明确标注涉及的事件名（例如 `feat(coze-mitt): add refreshFavList emitPosition`），方便代码审查。
- 回归与验证建议：
  - 在对 `EventMap` 或参数类型进行变更后，除了跑本包的 `lint`/`test`，还应在依赖该事件的上层包中做一次基本场景自测（例如收藏列表刷新、模板创建项目）以确认行为未被破坏。
  - 涉及埋点相关字段（如 `emitPosition`）的改动，需要与埋点/数据团队约定后再修改，避免统计数据断裂。

## 非常规特性与注意点
- 本包当前不执行实际构建（`build` 脚本为 no-op），主要作为类型与事件中心存在，未来如需产出独立 bundle，应检查所有依赖包的构建链路。
- 尽管存在 React 相关 dev/peer 依赖，本包自身不导出 React 组件；这是由通用前端包模板演化而来，新增代码时不要误以为必须以组件形式组织。
- 由于被多个高层 UI 包共享使用，保持 API 的向后兼容尤为重要；添加新事件或字段远优于直接修改/删除既有定义。
