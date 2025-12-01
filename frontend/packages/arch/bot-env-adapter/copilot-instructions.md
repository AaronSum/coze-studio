# @coze-studio/bot-env-adapter Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-env-adapter）中安全、高效地协作开发。

## 1. 全局架构与职责边界
- 本包是「环境配置适配层」，为 bot 相关应用提供统一的、可多地域/多发布形态切换的配置访问能力。
- 核心入口 [src/index.ts](src/index.ts)：聚合 base 环境变量 ([src/base.ts](src/base.ts))、业务配置 ([src/configs.ts](src/configs.ts)) 和特性开关 ([src/features.ts](src/features.ts))，合并为 `GLOBAL_ENVS` 导出，并在初始化时做必填环境变量校验。
- `base` 负责将 `process.env` + Git 信息转换为规范化字段（`BUILD_TYPE`、`CUSTOM_VERSION`、`REGION`、`CDN`、`IS_OVERSEA` 等）并派生判断位；这些字段是后续所有配置选择的基础。
- `features` 以 `base` 中的布尔判断为输入，生成所有功能开关布尔量，例如 `FEATURE_ENABLE_SSO`、`FEATURE_GOOGLE_LOGIN`、`FEATURE_ENABLE_CODE_PYTHON` 等，统一挂到 `GLOBAL_ENVS` 上。
- `configs` 聚合所有「按地域/环境分支」的业务配置（AppID、第三方登录、发布平台、法务链接、TTS/音频服务等），通过 [src/utils/config-helper.ts](src/utils/config-helper.ts) 的 `extractEnvValue` 按当前 `REGION` + `BUILD_TYPE` + `CUSTOM_VERSION` 选出具体值，并统一导出为 `configs`，再被 `GLOBAL_ENVS` 合并。
- [src/runtime/index.ts](src/runtime/index.ts) 暴露 `runtimeEnv`（目前仅 `isPPE`），供运行时环境判断使用，避免直接依赖构建时细节。
- 整体模式：**构建时读取 `process.env` → 计算环境/地域/版本判断 → 按矩阵选择具体配置 → 导出统一只读对象 `GLOBAL_ENVS` 与少量 runtime 辅助对象**，上层应用只通过该入口读配置，不自行拼接环境变量。

## 2. 关键开发工作流
- 安装依赖（在 Rush 根目录）
  - `rush update`：安装/更新工作区依赖，包含本子包。
- 在本子包目录下的常用脚本（依赖 `npm` 或 `pnpm` 按工作区约定执行）：
  - `npm run build`
    - 先执行 `node -r sucrase/register scripts/index.ts`：读取 `envs`（`base + configs + features`），使用 `ts-morph` 等生成 [src/typings.d.ts](src/typings.d.ts) 类型声明。
    - 再执行 `tsc -b tsconfig.build.json`：基于工作区 tsconfig 预设进行 TypeScript 构建（典型为类型检查 + 生成构建产物，具体输出路径遵循根级 TS 配置）。
  - `npm run test`
    - 使用 [vitest.config.mts](vitest.config.mts) 配置，`@coze-arch/vitest-config` 预设，`preset: 'node'`。
    - 目前 [__tests__](__tests__) 为空，仅做「存在即过」的测试运行。
  - `npm run test:cov`
    - `npm run test -- --coverage`，基于 `@vitest/coverage-v8` 生成覆盖率。
  - `npm run lint`
    - 使用 [eslint.config.js](eslint.config.js) 和 `@coze-arch/eslint-config` 的 `node` 预设，自动带缓存。
- 构建脚本与 TS 构建紧耦合：**修改/新增环境字段后，应始终执行 `npm run build`，以确保 typings 自动同步更新**，否则其他包通过 `./typings` 或主导出类型引用时可能失配。

## 3. 项目特有约定与模式
- 环境矩阵抽象：
  - 统一类型 [src/utils/config-helper.ts](src/utils/config-helper.ts) 中的 `TConfigEnv<T>`：
    - `cn: { boe; inhouse; release }`
    - `sg: { inhouse; release }`
    - `va: { release }`
  - 所有需随地域/环境变化的配置必须使用 `extractEnvValue`，禁止直接 `if (REGION === 'cn')` 之类分支，保持配置集中可枚举。
- 环境判定规则：
  - `REGION`: `'cn' | 'sg' | 'va'`，默认为 `'cn'`。
  - `BUILD_TYPE`: `'online' | 'offline' | 'test' | 'local'`，默认为 `'local'`。
  - `CUSTOM_VERSION`: `'release' | 'inhouse'`，默认为 `'inhouse'`，用于区分「官网公开版本」与「内部版本」。
  - `extractEnvValue` 对 `cn` 的分支：`IS_BOE ? 'boe' : IS_RELEASE_VERSION ? 'release' : 'inhouse'`；对 `sg`：`IS_RELEASE_VERSION ? 'release' : 'inhouse'`；对 `va`：恒为 `'release'`。
- CDN 选择逻辑 ([src/base.ts](src/base.ts))：
  - `CDN` 由内部/外部 CDN 组合规则决定：
    - 开发模式(`IS_DEV_MODE`)：当前实现返回空字符串（后续可能接入本地静态资源）。
    - 线上正式发布(`IS_RELEASE_VERSION && BUILD_TYPE === 'online'`)：使用 `CDN_OUTER_${REGION}`。
    - 其他情况：使用 `CDN_INNER_${REGION}`。
  - 同时导出上传相关前缀 `UPLOAD_CDN_*`，按 REGION 从 `UPLOAD_CDN_CN/SG/VA` 映射。
- Git 分支注入：
  - `BUILD_BRANCH` 优先读取 `process.env.BUILD_BRANCH`，否则通过 [src/utils/current-branch.ts](src/utils/current-branch.ts) 使用 `git rev-parse --abbrev-ref HEAD` 获取当前分支；在 detached HEAD 下返回空字符串。
  - 因此在 CI 环境，推荐显式设置 `BUILD_BRANCH` 环境变量，避免 Git 命令失败。
- 运行时环境工具：
  - [src/runtime/index.ts](src/runtime/index.ts) 中 `runtimeEnv.isPPE` 直接基于 `IS_PROD`，当前语义即“生产环境检查”，如需扩展 runtime 状态，应在此类中追加只读 getter，而非到处访问 `GLOBAL_ENVS` 内部字段。
- 必填环境变量校验：
  - [src/index.ts](src/index.ts) 中：
    - `envs = { ...base, ...configs, ...features }`。
    - `COMMON_NULLABLE_VARS = ['CUSTOM_ENV_NAME', 'OUTER_CDN']`。
    - `NULLABLE_VARS = BUILD_TYPE === 'local' ? ['CDN', ...COMMON_NULLABLE_VARS] : [...COMMON_NULLABLE_VARS]`。
    - 将 `base + features` 的条目中过滤出 `value === undefined` 且不在 `NULLABLE_VARS` 内的键，如果存在则抛错：`Error(以下环境变量值为空：${emptyVars.join('、')})`。
  - 这意味着：**新增的基础字段或 feature flag 如果可能为 undefined，要么保证构造时有默认值，要么显式加入可空白名单**。

## 4. 重要组件与外部依赖集成
- 法务/文案链接 ([src/configs.ts](src/configs.ts))：
  - 定义 `legalEnvs`：多种 ToS / 隐私政策 / Volc 文档链接，作为常量挂到 `configs` 中，上层可以直接通过 `GLOBAL_ENVS.TERMS_OF_SERVICE` 等使用。
- 多平台/多渠道发布配置：
  - 一系列 `*_PUBLISH_ID` 字段（`FLOW_PUBLISH_ID`、`FEISHU_PUBLISH_ID`、`LARK_PUBLISH_ID`、`REDDIT_PUBLISH_ID`、`DISCORD_PUBLISH_ID` 等），全部封装为 `extractEnvValue<string>`。
  - 新增渠道时，应按现有命名和结构补充一个新的 `Xxx_PUBLISH_ID` 字段，并在 `configs` 末尾统一聚合导出。
- 登录与第三方账号集成：
  - `GOOGLE_CLIENT_ID`、`GOOGLE_PLATFORM_ID`、`FACEBOOK_APP_ID`、`AWEME_PLATFORM_ID`、`AWEME_PLATFORM_APP_KEY`、`AWEME_ORIGIN` 等，均通过 `extractEnvValue` 进行 region/build 切分。
  - 相应功能是否开启由 [src/features.ts](src/features.ts) 控制，例如 `FEATURE_GOOGLE_LOGIN`、`FEATURE_AWEME_LOGIN`，典型规则是「仅海外可用」或「仅非 release/inhouse 环境」。
- 媒体/语音服务：
  - `SAMI_APP_KEY`、`SAMI_WS_ORIGIN`、`SAMI_CHAT_WS_URL`、`COZE_API_TTS_BASE_URL` 等，提供语音和 TTS 相关配置；均为纯字符串或 URL，通过 `extractEnvValue` 按区域切换。
  - `BYTE_UPLOADER_REGION` 决定上传使用的区域标识，值域为 `'cn-north-1' | 'us-east-1' | 'ap-singapore-1' | 'us-east-red' | 'boe' | 'boei18n' | 'US-TTP' | 'gcp'`。
- 调研/满意度（Feel Good）系统：
  - `FEEL_GOOD_PID` + `FEEL_GOOD_HOST`（`survey.coze.com` 等），统一导出，供埋点/调研组件使用。
- 文档与开放平台：
  - `OPEN_WEB_SDK_BOT_ID`、`OPEN_DOCS_APP_ID`、`OPEN_DOCS_LIB_ID`、`CUSTOM_PLAT_APPLY_PUBLIC_PLAT_FORM_LINK` 等，集中定义与 Coze 文档和开放平台集成相关的 ID/URL。
- 代码编辑器与 IDE 生态：
  - `MONACO_EDITOR_PUBLIC_PATH` 固定 `'/';`，`PLUGIN_IDE_EDITION` 按区域与发布态区分版本号（如 `cn-internal-boe`、`cn-public-prod`），用于插件/IDE 版号识别。

## 5. 流程与协作规范
- 代码风格与 Lint：
  - 遵循 `@coze-arch/eslint-config` 的 Node 预设；文件头部普遍包含 Apache-2.0 版权声明。
  - `max-lines` 在 [src/configs.ts](src/configs.ts) 显式关闭以容纳大量配置，其他文件默认遵守规则，新增配置时倾向继续集中到该文件，而不是零散创建过多小文件。
- TypeScript 配置：
  - 使用工作区共享 TS 配置 `@coze-arch/ts-config`；子包内有 [tsconfig.json](tsconfig.json)、[tsconfig.build.json](tsconfig.build.json)、[tsconfig.misc.json](tsconfig.misc.json) 分别面向开发、构建和杂项脚本。
  - 新增脚本/工具时，优先复用现有 TS 预设（例如通过 `tsconfig.misc.json`）而非自定义编译参数。
- 分支与构建环境约定：
  - 实际 Git 分支名通过 `BUILD_BRANCH` 注入；在构建流程中若依赖此变量（例如上报版本信息），应确保 CI 显式配置，而不要指望 runtime 动态获取。
  - `IS_OPEN_SOURCE` 由 `process.env.IS_OPEN_SOURCE === 'true'` 决定，建议在开源构建管线中固定设置，用于在其他包做能力裁剪。

## 6. 开发建议与注意事项（面向 AI Agent）
- 修改或新增配置字段时：
  - 优先在 [src/configs.ts](src/configs.ts) 中按当前分类追加字段，保持矩阵结构（`TConfigEnv`）完整，避免出现「某区域缺 key」的情况。
  - 如果字段需要参与 UI/逻辑开关，而不仅是纯配置值，请在 [src/features.ts](src/features.ts) 中增加对应布尔开关，命名以 `FEATURE_` 前缀。
  - 更新后运行 `npm run build`，确保 [src/typings.d.ts](src/typings.d.ts) 自动更新。
- 使用 `GLOBAL_ENVS` 时：
  - 在上层项目中仅通过 `import { GLOBAL_ENVS } from '@coze-studio/bot-env-adapter';` 访问；不要从本包内部模块（如 `./base`、`./configs`）做深层导入，以免破坏封装。
  - 若只需运行时判断，可用 `@coze-studio/bot-env-adapter/runtime` 暴露的能力，避免强依赖构建时细节。
- 环境变量调试：
  - `process.env.VERBOSE === 'true'` 时 [src/index.ts](src/index.ts) 会打印整份 `envs` JSON 到控制台，有利于调试；在生产环境尽量保持关闭。
- 非常规特性：
  - 本包**无 runtime 依赖**（仅 devDependencies），可在 Node 服务端或浏览器打包环境中安全复用；若未来引入 runtime 依赖，请显式更新 `package.json` 并在此文档中补充说明。

上述约定均来源于当前代码实现，AI 助手在做结构性修改（拆分文件、改变导出结构）前，应优先保持现有 API 兼容：`GLOBAL_ENVS` 和 `runtimeEnv` 的导出路径与语义是上层依赖的关键。