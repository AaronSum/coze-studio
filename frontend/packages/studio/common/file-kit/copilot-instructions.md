# @coze-studio/file-kit 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/common/file-kit）中安全、高效地协作开发。

## 1. 子包定位与职责
- 本包是 Coze Studio 前端 monorepo 中的一个独立工具包，位置：`frontend/packages/studio/common/file-kit`。
- 职责：统一管理「文件类型」相关的判定逻辑、配置与展示信息，为上层上传组件、文件管理模块等提供：
  - 文件类型枚举与配置（扩展名 / MIME 匹配规则）；
  - 根据 File 对象推断文件类型的工具函数；
  - 结合 i18n 的展示文案与图标配置（用于 UI）。
- 包本身不包含 React 组件，只提供纯逻辑与配置，可在多处 UI/业务中复用。

## 2. 代码结构与导出
- 入口配置见 `package.json`：
  - `exports.logic` → `src/exports/logic.ts`
  - `exports.config` → `src/exports/config.ts`
- 核心源码结构：
  - `src/const.ts`：定义 `FileTypeEnum`、`TFileTypeConfig` 等基础类型与枚举；
  - `src/types/util.ts`：通用类型工具 `EnumToUnion`；
  - `src/file-type.ts`：声明只读 `FILE_TYPE_CONFIG` 数组，描述各文件类型的 `accept` 列表与 `judge` 判定函数；
  - `src/util.ts`：对外逻辑工具 `getFileInfo(file: File)`，基于 `FILE_TYPE_CONFIG` 推断文件类型配置；
  - `src/accept.ts`：基于 `FileTypeEnum` 与 i18n 文案构建 `ACCEPT_UPLOAD_TYPES`，用于 UI 中文案和图标展示；
  - `src/icon/`：各文件类型对应的图标导出（`ZipIcon`、`VideoIcon` 等，作为字符串/组件使用）；
  - `src/assets/`：静态资源（若存在）；
  - `src/exports/config.ts` / `src/exports/logic.ts`：对外二次导出统一 API（请优先从这里导出公共能力）。
- 设计上将「类型判断逻辑」与「展示配置」分离：
  - `file-type.ts` + `util.ts` 只处理 File 对象和类型推断；
  - `accept.ts` 只负责 i18n 文案与图标绑定，方便在非 UI 环境中仅复用逻辑层。

## 3. 关键数据流与调用关系
- 典型调用链：
  1. 上层上传组件拿到浏览器 `File` 对象；
  2. 调用 `getFileInfo(file)`：
     - 遍历 `FILE_TYPE_CONFIG` 中的每个配置；
     - 若配置存在 `judge`，优先使用 `judge(file)`；否则回退到 `accept.some(ext => file.name.endsWith(ext))`；
     - 返回匹配到的 `TFileTypeConfig`，若无匹配则返回 `null`；
  3. 上层可结合 `FileTypeEnum` 与 `ACCEPT_UPLOAD_TYPES`，根据 `fileType` 决定图标 + 文案展示。
- I18n 集成：
  - `accept.ts` 依赖 `@coze-arch/i18n` 的 `I18n.t(key)` 获取文案，所有文案 key 需要在上游 i18n 包配置；
  - 本子包不维护文案源，只使用 key，因此新增/修改文案时需同时更新 i18n 仓库。

## 4. 开发与测试工作流
- 本包使用 Rush + PNPM 统一管理：
  - 在 monorepo 根目录安装依赖：`rush install` / `rush update`；
  - 本包内不单独维护 lock 文件，依赖版本由 workspace 统一控制。
- 在本子包目录 `frontend/packages/studio/common/file-kit` 内常用命令：
  - `npm run lint`：使用根部的 `eslint.config.js` 及 `@coze-arch/eslint-config` 规则进行 TypeScript/JS 代码检查；
  - `npm test`：通过 Vitest 运行单元测试，配置来源于 workspace 公共 vitest 配置；
  - `npm run test:cov`：在 `test` 基础上增加覆盖率统计；
  - `npm run build`：当前为 `exit 0` 占位实现，真实构建通常由上层 rsbuild / bundler 统一处理，不建议在此包内实现复杂构建逻辑。
- 若从 Rush 直接调用，可使用：
  - `rushx test` / `rushx lint` 等（需在 Rush 配置中声明）。

## 5. 项目特有约定与模式
- 类型与常量：
  - 使用 `export const enum FileTypeEnum`，确保编译后枚举被内联，避免运行时开销；
  - 通过 `EnumToUnion<typeof FileTypeEnum>` 生成 `FileType` 字面量联合类型，提升类型安全；
  - 文件类型配置统一通过只读数组 `FILE_TYPE_CONFIG: readonly TFileTypeConfig[]` 管理，禁止在运行时修改。
- 文件类型判定策略：
  - 优先使用 MIME type (`file.type.startsWith('image/')` 等)；
  - 对没有可靠 MIME 的类型（如 `.zip`、`.rar` 等）使用扩展名匹配；
  - `DEFAULT_UNKNOWN` 配置的 `judge` 始终返回 `true`，并将 `accept` 设为 `['*']` 作为兜底匹配；
  - 新增文件类型时，必须同时更新：
    - `FileTypeEnum` 与 `TFileTypeConfig`；
    - `FILE_TYPE_CONFIG` 中的配置项；
    - `ACCEPT_UPLOAD_TYPES` 中的展示配置（含 i18n key 与 icon）。
- i18n 与展示：
  - 所有展示文案使用 `I18n.t('xxx')`，不得写死中文/英文；
  - 图标通过 `src/icon/index.ts` 统一导出，`ACCEPT_UPLOAD_TYPES` 只引用导入名，不直接引用文件路径。
- 目录约定：
  - `src/types/` 下仅放纯类型工具或声明，不包含运行时代码；
  - 所有公共导出能力应通过 `src/exports/` 统一整理，对外消费包方只依赖 `@coze-studio/file-kit/config` 与 `@coze-studio/file-kit/logic`。

## 6. 与外部模块的集成
- 依赖 `@coze-arch/i18n`：
  - 用于多语言文案；
  - AI 编程助手在重构时应保留现有 i18n key，不随意修改字符串 key；如需新增 key，请遵循项目 i18n 约定，并在对应仓库补充配置。
- 与上层 UI/业务代码的典型集成方式（示意）：
  - 上传组件中：
    - 使用 `FILE_TYPE_CONFIG` 的 `accept` 列表生成 `<input type="file" accept="..." />` 的 accept 字符串；
    - 在 `onChange` 中通过 `getFileInfo(file)` 获取类型，再结合 `ACCEPT_UPLOAD_TYPES[fileType].icon` 与 `label` 渲染列表；
  - 文件管理页：
    - 可以只使用 `ACCEPT_UPLOAD_TYPES` 与 `FileTypeEnum` 做列表图标与标签展示，而不必接触具体 MIME/扩展名逻辑。

## 7. 代码风格与质量要求
- 统一使用 TypeScript，类型尽量显式声明，避免使用 `any`；
- 所有源码文件顶部均带有 Apache-2.0 版权头，新建文件时应保持一致；
- 遵循 monorepo 根目录的 ESLint/TSConfig 规范，不在子包内重复配置；
- 单元测试框架为 Vitest，推荐对 `getFileInfo`、`FILE_TYPE_CONFIG` 的新增行为补充测试用例。

## 8. 对 AI 编程助手的具体提示
- 修改或新增文件类型支持时：
  - 始终同步更新 `FileTypeEnum`、`FILE_TYPE_CONFIG`、`ACCEPT_UPLOAD_TYPES` 三处，保持逻辑判定、上传限制、UI 展示一致；
  - 对于新的音频/视频/压缩等类型，优先结合 MIME type + 扩展名双重判定；
  - 请不要擅自改变已有 i18n key 名称或删除配置项，以免影响其他包的运行。
- 引入新公共函数或类型时：
  - 将实现文件放在 `src/` 适当位置，并通过 `src/exports/logic.ts` / `src/exports/config.ts` 暴露；
  - 保持与现有函数风格一致（小而单一职责，命名语义化）。
- 若需要新增构建能力或配置，请优先查阅 monorepo 顶层 frontend README 与 config 包，保持与现有 Rsbuild / Vitest / ESLint 体系兼容。
