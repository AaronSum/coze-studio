# @coze-arch/bot-icons 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/bot-icons）中安全、高效地协作开发。

## 1. 子包职责与整体结构
- 子包定位：为 Coze Studio 前端提供统一的「图标组件层」，在 Semi Icons 之上封装，输出成型的 React 图标组件，供上层应用/组件库直接使用。
- 技术栈：React 18 + TypeScript，依赖 `@douyinfe/semi-icons` 作为底层 Icon 组件，实现统一的尺寸、样式和可定制能力。
- 入口结构：
  - `src/factory.tsx`：唯一工厂方法 `IconFactory`，接收一个 SVG ReactNode，返回带 `ref` 的 Semi Icon 组件。
  - `src/index.tsx`：集中引入所有 SVG 资源，并通过 `IconFactory` 导出大量 `IconXXX` 命名的 React 组件，是本包的唯一对外 API 入口 (`main: src/index.tsx`)。
  - `src/global.d.ts`：定义 `*.svg` / `*.png` 的模块声明，支持以 `ReactComponent` 方式引入 SVG。
- 静态资源：
  - `src/assets`：按功能/域划分 SVG 图标（如 `icons/`, `arena/`, `analytics/`, `file-type/`, `knowledge/`, `shortcut-icons/` 等），用于构建领域化的图标组件。
  - 资源文件命名多为英文语义 + 下划线/短横线，组件命名时再统一转为驼峰式 PascalCase。
- 架构要点：
  - 单向数据流极其简单：**SVG 文件 → ReactComponent import → IconFactory 包装 → 导出 Icon 组件**。
  - 没有业务逻辑和状态管理，本子包纯粹是「展示组件库的一部分」，只承担图标封装职责。

## 2. 开发与常用命令
- 运行环境：
  - Node.js >= 21（与整个 frontend 一致）。
  - 包管理使用 Rush + PNPM，但子包本身脚本通过 npm/rushx 调用。
- 子包级脚本（在 `frontend/packages/components/bot-icons` 目录下执行）：
  - `npm test`：使用 Vitest 运行单元测试（当前 `__tests__` 为空，脚本使用 `--passWithNoTests`，因此常用于快速回归或 CI 占位）。
  - `npm run test:cov`：生成覆盖率报告；对应 Rush 配置中 `operationName: test:cov`，输出目录为 `coverage/`。
  - `npm run lint`：使用 `@coze-arch/eslint-config` 对整个子包做 ESLint 检查。
  - `npm run build`：当前是 `exit 0` 占位，不做真实构建；构建行为由上层应用或打包工具（Rsbuild）负责。
- Rush 相关：
  - `config/rush-project.json` 中定义了额外的 Rush operation 输出目录（如 coverage、dist），方便 monorepo 统一处理产物；不建议在本子包中随意更改 operationName，否则会影响 CI 流程。
- 建议的本地调试流程：
  - 在此子包中新增/修改图标后，**优先通过 TypeScript 类型检查及 ESLint 保证无错**，再在上层应用（如 `frontend/apps/coze-studio`）中实际引用图标验证视觉效果。

## 3. 代码与命名约定
- 导入 SVG 方式：
  - 统一使用 `import { ReactComponent as XxxSvg } from '.../xxx.svg';` 形式，然后传入 `IconFactory`。
  - 类型由 `src/global.d.ts` 提供，**不要改动 `ReactComponent` 的声明签名**，以免影响整个 frontend 的 SVG 引用方式。
- Icon 组件命名：
  - 统一使用 `Icon` 前缀 + 语义化 PascalCase，如：`IconWorkflowRunning`、`IconBotIcon`、`IconCozeEN`。
  - 若底层 SVG 命名包含前缀（如 `Svg`、`Svt`），**组件命名不保留前缀**，只体现功能语义：
    - 例：`SvgArenaBattle` → `IconCozeBattle`。
  - 若语义在其他地方已有约定（如「Workflow」、「Dataset」、「Arena」等），应复用现有词汇，避免产生近义、重复的 Icon 名称。
- 文件/目录命名：
  - 按业务域拆分子目录：`arena/`、`analytics/`、`file-type/`、`knowledge/`、`shortcut-icons/`、`third-party-icons/` 等；
  - 新增 SVG 时，如隶属已有域，优先放入对应目录，保持结构稳定。
- 导出规则：
  - 所有对外可用的 Icon 都必须在 `src/index.tsx` 中以 `export const IconXXX = IconFactory(<SvgYYY />);` 形式导出；
  - **不要在其他文件中重新导出 IconFactory 包装后的组件**，否则会造成 API 入口分散。
- 样式行为：
  - 具体尺寸、颜色、hover 等样式能力都由上层通过 `@douyinfe/semi-icons` 的 `IconProps` 控制，本包不附加额外样式逻辑；
  - 如需特殊样式，应在使用侧通过 className / style 覆盖，而非在本包中写死。

## 4. 与外部依赖和上层应用的集成
- Semi Icons 集成：
  - `src/factory.tsx` 中的 `IconFactory` 是唯一集成点：
    - 通过 `forwardRef` 将 `ref` 传递给内层 `<Icon />`，保持与 Semi Icons 原有 API 兼容；
    - 组件 props 为 `Omit<IconProps, 'svg' | 'ref'>`，保证上层无法修改内部 svg，只能控制大小、颜色等表现属性。
  - 修改 `IconFactory` 会影响所有导出的图标组件，应极度谨慎；若要调整行为（例如统一设置默认尺寸），请在此处集中处理。
- 与上层包的耦合：
  - 本子包被视作「稳定基础库」，广泛被 `packages/components` 其他组件包和 `apps/coze-studio` 消费；
  - 在删除/重命名某个 `IconXXX` 导出前，应先在全仓范围内搜索引用，避免破坏其他子包。
- 资源版权与使用：
  - 所有 SVG 资源当前视为项目内部资产；新增外部来源图标时需确保符合项目 License（Apache-2.0）及设计规范，避免引入带有第三方版权风险的素材。

## 5. 测试与质量保证策略
- 测试框架：Vitest（配置由上层 `@coze-arch/vitest-config` 统一管理）。
- 当前状态：`__tests__` 目录仅有 `.gitkeep`，默认无具体用例；CI 通过 `vitest --passWithNoTests` 保证流水线稳定。
- 为避免重复劳动，在为本包补充测试时建议：
  - 重点验证：`IconFactory` 的行为（props 透传、ref 传递、渲染 SVG）。
  - 图标本身通常无需逐一写快照测试，除非存在特别复杂的逻辑（本项目中暂不存在）。
- 代码风格：
  - 使用 `eslint.config.js` + `@coze-arch/eslint-config`，遵循 monorepo 统一规则，包括最大行数、命名风格等；
  - `src/index.tsx` 因导出极多组件，已通过 `/* eslint-disable max-lines */` 关闭单文件行数限制，**不要随意移除此配置**。

## 6. 变更实践与注意事项
- 新增图标的推荐步骤：
  1. 将 SVG 资源放入合适的子目录（如 `src/assets/icons/arena/xxx.svg`）。
  2. 在 `src/index.tsx` 顶部按区域统一位置引入：`import { ReactComponent as SvgXxx } from './assets/...'`。
  3. 在文件底部相邻区域添加导出：`export const IconXxx = IconFactory(<SvgXxx />);`。
  4. 本地运行 `npm run lint`、`npm test` 确保无错误。
  5. 在上层应用中实际引用验证视觉效果（例如在某个页面或 Storybook 中）。
- 修改/删除现有图标时的约束：
  - 避免修改已有 `IconXXX` 的语义含义或视觉含义，除非是设计规范变更；
  - 删除前需全仓检索引用；如需替换，建议先新增新 Icon，并在上层逐步迁移，最后清理旧导出。
- 性能与体积：
  - 此包导出图标数量巨大，但在打包时通常通过 tree-shaking 只引入实际用到的部分；
  - 新增图标不会自动被全部加载，前提是上层按需导入（`import { IconXxx } from '@coze-arch/bot-icons';`）。

## 7. 分支、发布与协作规范（子包视角）
- 分支与提交流程：
  - 遵循仓库根部的贡献指南和分支策略（见根目录 `CONTRIBUTING.md`），本子包不自定义额外分支规范；
  - 与其他前端子包改动一起合并，避免为单一图标变更单独发布版本。
- 版本与发布：
  - `package.json` 的 `version` 由 monorepo 统一管理；不要在子包内单独手动 bump 版本号；
  - 发布通常由 CI / Release 流程统一完成，本子包作为内部组件库的一部分，不单独发包到公共 registry。

## 8. 本子包的特殊/非典型点
- 极高行数的入口文件：
  - `src/index.tsx` 非常长，集中导出数百个 Icon，属于刻意设计以提升「集中维护度」的反常规做法；
  - 在对该文件做自动格式化时要小心，避免引入无意义 diff。
- 无构建脚本：
  - `npm run build` 为 no-op，说明本子包在构建链路中完全依赖上层工具，而非自行产出构建产物；
  - 若未来需要添加构建逻辑，应与 `frontend/config/rsbuild-config` 等统一方案保持一致。
- 资源声明集中在 `global.d.ts`：
  - SVG/PNG 声明对整个 frontend 生效（只要 TS 配置包含本文件）；
  - 修改此处声明会影响其他子包的静态资源导入方式，因此在做任何调整前应全仓评估影响。
