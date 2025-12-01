# @coze-data/database-v2-adapter 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/memory/database-v2-adapter）中安全、高效地协作开发。

## 1. 子包定位与全局架构

- 本包是「数据库 V2」前端能力的适配层，包名为 @coze-data/database-v2-adapter，物理路径为 frontend/packages/data/memory/database-v2-adapter。
- 职责非常聚焦：
  - 对外统一导出若干数据库相关 UI 能力，主要来源于上游基础包 @coze-data/database-v2-base；
  - 为上层应用提供更清晰的导入路径（adapter 层），避免直接依赖底层 base 包；
  - 预留少量适配组件，如 DatabaseModeSelect / FormDatabaseModeSelect，便于与 Coze 表单系统集成。
- 对外导出结构（见 package.json.exports 与 src）：
  - "." → src/index.tsx：当前仅 re-export DatabaseDetailWaring；
  - "./components/*" → src/components/*/index.tsx：将 create-table-modal/base-info-modal 等组件透出；
  - "./features/*" 预留给未来 features 子目录使用，目前仓库中尚未创建对应实现文件。
- 与上游依赖关系：
  - @coze-data/database-v2-base：核心数据库业务组件与逻辑的所在，当前所有组件导出都直接从该包 re-export；
  - @coze-arch/bot-api：数据库相关 API 类型（memory 领域）；
  - @coze-arch/bot-semi、@coze-arch/coze-design：表单/设计体系基础能力；
  - @coze-arch/i18n、@coze-studio/bot-detail-store 等：提供国际化与 Bot 详情上下文支持（通过上游 base 包间接使用）。

## 2. 代码结构与模块说明

- 入口文件 [src/index.tsx](frontend/packages/data/memory/database-v2-adapter/src/index.tsx)：
  - 仅一行导出：DatabaseDetailWaring 来自 @coze-data/database-v2-base/features/database-detail-waring；
  - 若需要在 adapter 层新增公共导出，应集中在此文件维护，并同步更新 package.json.exports / typesVersions。
- 组件目录 [src/components](frontend/packages/data/memory/database-v2-adapter/src/components)：
  - create-table-modal/index.tsx：
    - re-export 自 @coze-data/database-v2-base/components/create-table-modal：
      - DatabaseCreateTableModal：创建数据库表的弹窗组件；
      - useDatabaseCreateTableModal：驱动该弹窗的 hook（内部包含显隐状态、默认值、回调封装等逻辑，由 base 包实现）。
  - base-info-modal/index.tsx：
    - re-export 自 @coze-data/database-v2-base/components/base-info-modal：
      - DatabaseBaseInfoModal：用于编辑数据库基础信息的弹窗组件；
      - useDatabaseInfoModal：控制弹窗逻辑的 hook；
      - ModalMode：模式枚举（如 create/edit 等）；
      - DatabaseBaseInfoModalProps / FormData 类型。
  - database-mode-select/index.tsx：
    - 唯一在本包内定义的 UI 组件：
      - DatabaseModeSelect：FC<DatabaseModeSelectProps>，目前实现是空节点 <></>，属于占位/待实现状态；
      - FormDatabaseModeSelect：通过 withField(DatabaseModeSelect) 包装后的表单字段版组件，适配 Coze 表单系统；
    - props 与依赖：
      - value / onChange 类型为 BotTableRWMode（读写模式），来自 @coze-arch/bot-api/memory；
      - options?: BotTableRWMode[] 允许限制可选模式；
      - type?: 'button' | 'select' 预留不同交互形态；
      - disabled?: boolean 控制禁用态；
      - FormDatabaseModeSelect 通过 CommonFieldProps & Omit<DatabaseModeSelectProps, keyof CommonexcludeType> 与表单上下文融合（类型来自 @coze-arch/bot-semi/Form 与 @coze-arch/coze-design）。
- 类型声明 [src/typings.d.ts](frontend/packages/data/memory/database-v2-adapter/src/typings.d.ts)：
  - 仅包含对 @coze-arch/bot-typings 的引用；保证 TS 能解析跨包共享的全局类型（例如 HTTP 响应、通用实体等），无额外逻辑。
- Storybook：[.storybook/main.js](frontend/packages/data/memory/database-v2-adapter/.storybook/main.js)：
  - 基于 @storybook/react-vite，支持 Vite + SVGR；
  - stories 匹配 ../stories/**/*.mdx 与 .stories.tsx，本包目前仅有示例 hello.mdx，可按需补充数据库相关演示故事。

## 3. 构建、测试与 Lint 流程

- 包管理与基础命令：
  - 使用 Rush + workspace:* 管理依赖，首次开发需在仓库根目录执行 rush update。
- 脚本（见 package.json.scripts）：
  - build："exit 0"，本子包不单独产出 JS/CSS 资源，实际打包由上层应用/构建系统（如 Rspack/Vite）统一完成；
  - lint：eslint ./ --cache，规则由 eslint.config.js + @coze-arch/eslint-config(web preset) 提供；
  - test：vitest --run --passWithNoTests；
  - test:cov：在 test 基础上开启覆盖率统计。
- 测试配置 [vitest.config.ts](frontend/packages/data/memory/database-v2-adapter/vitest.config.ts)：
  - 使用 defineConfig({ dirname: __dirname, preset: 'web' })，完全沿用 @coze-arch/vitest-config 预设；
  - 当前没有业务逻辑或 hooks 实现在本包内，单测重点通常在未来为 DatabaseModeSelect 等适配组件补充用例。
- TypeScript 配置 [tsconfig.build.json](frontend/packages/data/memory/database-v2-adapter/tsconfig.build.json)：
  - 继承 @coze-arch/ts-config/tsconfig.web.json；
  - rootDir: src，outDir: dist，moduleResolution: 'bundler'，lib: ["DOM","ESNext"]，target: ES2020；
  - references 显式依赖 arch/bot-api、bot-typings、i18n、bot-semi、config/*、database-v2-base、bot-detail-store 等包，以配合 Rush 的 tsc --build。

## 4. 项目约定与编码风格

- 语言与框架：
  - TypeScript + React 18，仅使用函数组件；
  - 业务逻辑几乎全部在 @coze-data/database-v2-base 中，本包保持极薄适配层，不在此复制业务实现。
- 导出与路径约定：
  - 所有公共能力必须通过 package.json.exports ＋ src 下的 index.tsx / components/*/index.tsx 导出；
  - typesVersions 对 components/* 与 features/* 做了类型映射，确保 TS 使用源文件类型；新增导出时应同步维护 exports 与 typesVersions，避免编译与运行时路径不一致。
- 样式与 UI：
  - 当前本包未直接包含样式或 UI 实现（除 DatabaseModeSelect 占位），视觉风格全部继承自上游组件包；
  - 若未来在 adapter 层补充 UI，需优先复用 @coze-arch/coze-design 与 @coze-arch/bot-semi 组件，保证与 Studio 其他部分一致。

## 5. 与上游/下游系统的集成细节

- 上游：@coze-data/database-v2-base
  - 该包实现所有与数据库 V2 相关的核心逻辑和 UI，包括：
    - 数据库详情告警（DatabaseDetailWaring）、
    - 创建表弹窗（DatabaseCreateTableModal + useDatabaseCreateTableModal）、
    - 基础信息编辑弹窗（DatabaseBaseInfoModal + useDatabaseInfoModal 等）。
  - adapter 层仅 re-export，不应在这里改变这些组件的行为；如需自定义行为，应在上游 base 包扩展能力后再在本包暴露新的封装。
- 与表单系统的集成：
  - DatabaseModeSelect / FormDatabaseModeSelect：
    - 通过 withField 与 Coze 表单系统（bot-semi + coze-design）集成，遵守 valueKey = 'value' 与 onKeyChangeFnName = 'onChange' 的约定；
    - CommonexcludeType / CommonFieldProps 约束了哪些 props 为表单系统专用字段，适配层通过 Omit 排除这些字段，避免冲突；
    - 未来实现 DatabaseModeSelect 时，应保持 props 与当前声明兼容，并通过 FormDatabaseModeSelect 在 form 中复用。

## 6. 项目流程与协作规范

- 变更范围控制：
  - 由于本包是纯适配层，修改时应尽量保持无业务逻辑，引导功能性改动在 @coze-data/database-v2-base 中进行；
  - 新增导出（组件/feature）时：
    - 先在 base 包新增实现；
    - 再在本包对应 src/components 或 src/features 目录下创建 index.tsx 做 re-export；
    - 最后更新 package.json.exports 与 typesVersions。
- Lint 与测试：
  - 任何新增 TSX/TS 文件需确保通过 eslint.config.js 约束的规则；
  - 若为 DatabaseModeSelect 等组件补充实际实现，建议使用 Vitest + Testing Library 在本包内新增基础用例，验证受控行为与 form 集成是否正常。

## 7. 对 AI 助手的特别提示

- 修改 / 扩展对外 API 时：
  - 必须同时检查：
    - src/index.tsx 及 src/components/*/index.tsx 是否需要更新；
    - package.json.exports 与 typesVersions 是否同步；
    - 上游 base 包是否已经提供对应实现。
- 不要在本包实现复杂业务逻辑：
  - adapter 层的目标是「稳定封装 + 便于替换上游实现」，避免在此处新增难以迁移的逻辑；
  - 对数据库行为、表单校验、API 交互等改动，应优先在 @coze-data/database-v2-base 或 arch 层完成。
- 在实现 DatabaseModeSelect 时：
  - 保持现有 props/类型不变；
  - 根据 BotTableRWMode 的含义选择合适的交互方式（button / select），并通过 FormDatabaseModeSelect 验证表单场景；
  - 确保在 disabled、options 为空等边界条件下表现合理。
