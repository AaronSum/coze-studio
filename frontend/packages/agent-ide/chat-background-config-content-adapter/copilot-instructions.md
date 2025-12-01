# @coze-agent-ide/chat-background-config-content-adapter 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-background-config-content-adapter）中安全、高效地协作开发。

## 全局架构与职责

- 本包是一个「适配层（adapter）子包」，作用是把 chat 背景配置内容组件通过独立 npm 包形式暴露给上层应用。
- 对外唯一导出位于 src/index.ts：
  - BackgroundConfigContent
  - BackgroundConfigContentProps 类型
- 以上导出全部直接 re-export 自 @coze-agent-ide/chat-background-config-content，本包不实现任何 UI、业务逻辑或样式。
- 设计动机：将真正的业务组件放在核心包 chat-background-config-content 内维护，本包只作为轻量封装，便于在不同 app 或构建系统中按需引入且保持 API 稳定。

## 代码结构与依赖

- 目录结构（关键文件）：
  - package.json：包元信息与 npm script 定义，main 指向 src/index.ts。
  - src/index.ts：单文件导出入口，仅做 re-export。
  - tsconfig.build.json：TS 编译配置，继承 @coze-arch/ts-config/tsconfig.web.json，并通过 references 声明对上游包的依赖。
  - vitest.config.ts：测试配置，通过 @coze-arch/vitest-config.defineConfig 使用 "web" 预设。
  - eslint.config.js / .stylelintrc.js（存在于包根目录）：分别继承前端统一 eslint、stylelint 规则。
- 运行时依赖：
  - @coze-agent-ide/chat-background-config-content：真正的 React 组件实现与类型定义所在包。
  - classnames：若上游组件内部使用该库，保持依赖一致以避免重复打包；本适配层本身不直接使用。
- 开发依赖：React/ReactDOM 18、Vitest、@testing-library/*、@coze-arch/* 工具配置包，仅用于类型、测试和规范，不在运行时代码中直接使用。

## 构建、测试与开发流程

- 包管理依赖 Rush + PNPM 工作区，首次开发需在仓库根目录执行：
  - rush update（或 scripts/setup_fe.sh 里封装的初始化脚本）。
- 本子包 npm 脚本（在本包目录运行）：
  - lint：npm run lint → eslint ./ --cache。
  - test：npm test → vitest --run --passWithNoTests，当前没有测试文件也会直接通过。
  - test:cov：npm run test:cov → 在 test 基础上增加 coverage 统计。
  - build：npm run build → exit 0；本包不产出独立构建产物，实际打包由上层应用或统一构建流程处理。
- TypeScript：
  - tsconfig.build.json 将 rootDir 设为 src，outDir 为 dist，moduleResolution 为 bundler，适配现代前端打包工具。
  - references 中显式依赖 bot-typings、chat-background-config-content 以及各类 config 包，确保在 Rush 的 tsc --build 下按正确顺序编译。

## 项目约定与使用方式

- 对外 API：
  - 所有导出都应集中在 src/index.ts；若未来需要增加额外导出（例如再 re-export 某些辅助类型），务必保持文件仅做导出聚合，不在其中编写业务逻辑。
  - 新增导出前，应先确认上游包 @coze-agent-ide/chat-background-config-content 已经提供对应组件/类型，并直接从该包 re-export，避免在本包重复声明类型或包装实现。
- 版本与行为：
  - 由于本包只是 re-export，上游包行为的变更会直接影响本包；在调整上游组件时，建议同时在依赖本适配层的应用中做回归测试。
- React 约定：
  - peerDependencies 中声明 react/react-dom >=18.2.0，调用方需确保运行环境满足要求；本包自身不创建 React context 或全局状态。

## 与上游组件的集成细节

- BackgroundConfigContent：
  - 来自 @coze-agent-ide/chat-background-config-content，是一个用于配置聊天背景内容的 React 组件，通常被嵌入到 Agent IDE 的设置面板中。
  - Props 类型 BackgroundConfigContentProps 也从同一包 re-export，本子包不做裁剪或重新定义。
- 使用建议：
  - 在应用中统一依赖本包（@coze-agent-ide/chat-background-config-content-adapter）而不是直接依赖内容包，可以在内部自由演进上游实现而不影响外部 import 路径。
  - 如需组合其他业务逻辑，请在上层应用中包装新的组件（例如 App 内的 SettingsPanel），不要在本适配层增加定制。

## 开发与协作注意事项（针对 AI 助手）

- 变更范围控制：
  - 本包设计为“超薄层”，禁止在 src/index.ts 中加入任何副作用逻辑（包括样式引入、运行时初始化等）。
  - 如需扩展功能，应在上游实现包（chat-background-config-content）中修改或新增能力，然后在此处按需增加 re-export。
- 公共接口维护：
  - 修改导出名称或删除已有导出时，需要先全仓库搜索引用，确认所有调用方已迁移；推荐采用向后兼容策略（新增而非替换）以降低影响。
- 配置文件：
  - tsconfig.build.json、vitest.config.ts 等由上层共享配置驱动，仅在确有必要时才修改；优先遵循 @coze-arch/* 统一约定。
- 文件风格：
  - 源文件需保留 Apache-2.0 版权头；新增文件时请沿用现有头注释格式。
