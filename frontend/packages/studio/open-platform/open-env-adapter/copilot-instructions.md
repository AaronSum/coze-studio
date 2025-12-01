# @coze-studio/open-env-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/open-platform/open-env-adapter）中安全、高效地协作开发。

## 总体架构与角色定位

- 本包是 Coze Studio 单体仓库中的「开放环境适配层」，仅提供纯函数/常量，不包含 UI 组件或运行时副作用。
- 入口文件为 src/index.ts，通过 re-export 将 src/chat/index.ts 中的导出统一暴露给使用方。
- chat/index.ts 定义与「开放平台 Web Chat SDK」相关的环境配置：域名、CDN 地址、SDK 路径、事件上报元数据等。
- package.json 中通过 exports 和 typesVersions 暴露两个入口：
  - '.' -> src/index.ts：默认导出环境配置。
  - './chat' -> src/chat/index.ts：直接访问 chat 相关导出，方便按需 tree-shaking。
- __tests__/chat.test.ts 负责对环境配置做基础校验，vitest.config.ts 统一使用 @coze-arch/vitest-config 的 monorepo 预设，保证测试行为与其他子包一致。

## 源码结构概览

- src/index.ts
  - 单一职责：从 ./chat 聚合导出 iframeAppHost、cozeOfficialHost、openApiCdnUrlByRegion、openApiHostByRegion、openApiHostByRegionWithToken、openSdkPrefix、getOpenSDKUrl、getOpenSDKPath、eventMeta。
  - 不新增逻辑，避免循环依赖或环境耦合，AI 助手在这里仅应做导出层调整（例如新增导出）。
- src/chat/index.ts
  - sdkRegion：当前 SDK 区域标识（默认 'cn'），同时用于 eventMeta.region。
  - iframeAppHost / cozeOfficialHost：预留给宿主页面和官方站点域名的常量，默认空字符串，实际接入方覆盖。
  - openApiCdnUrlByRegion：根据是否为海外环境（IS_OVERSEA）选择不同 CDN 基础 URL。
  - openApiHostByRegion / openApiHostByRegionWithToken：开放 API 基础域名，默认 location.origin 或占位 https://api.xxx.com，需要业务方改为真实域名。
  - openSdkPrefix / getOpenSDKUrl / getOpenSDKPath：SDK 静态资源路径相关占位配置，当前实现返回空值，由业务接入方或上层包组装完整 URL。
  - eventMeta：上报事件的环境元信息（region、is_release、dev），用于埋点/监控等。
- __tests__/
  - chat.test.ts：对以上导出做行为/结构测试，是新增导出或调整行为时需要同步更新的重点文件。
  - setup.ts：vitest 运行前的统一初始化脚本（如 jsdom、全局变量注入等），在 vitest.config.ts 中通过 test.setupFiles 引入。

## 构建、测试与调试流程

- 构建
  - package.json 中的 scripts.build 当前实现为 "exit 0"，即占位脚本，真正打包通常由上层工具链（Rush / 构建流水线）统一处理。
  - AI 助手在本子包内无须新增独立打包逻辑，如需变更构建流程，应遵循 monorepo 顶层约定，修改公共构建脚本而非本地脚本。
- 测试
  - 本包使用 Vitest，配置位于 vitest.config.ts，并通过 @coze-arch/vitest-config.defineConfig 继承统一预设：
    - dirname: __dirname
    - preset: 'web'
    - test.setupFiles: ['__tests__/setup.ts']
  - 主要命令：
    - pnpm test / rushx test：在当前包内执行 vitest --run --passWithNoTests。
    - pnpm test:cov：执行 vitest run --coverage，利用 @vitest/coverage-v8 输出覆盖率。
  - 修改 src/chat/index.ts 或新增导出后，应为关键分支/配置增加对应测试用例，确保在 web 预设下行为稳定。
- Lint
  - ESLint 配置入口为 eslint.config.js，继承 @coze-arch/eslint-config；执行 scripts.lint 运行 eslint ./ --cache。
  - Stylelint/Tailwind/PostCSS 等前端规范由 monorepo 统一配置（@coze-arch/stylelint-config、@coze-arch/tailwind-config、@coze-arch/postcss-config），本包如需添加样式相关逻辑时应直接复用这些预设。

## 项目特有约定与模式

- 环境常量与占位实现
  - 多数导出（iframeAppHost、cozeOfficialHost、openSdkPrefix、getOpenSDKUrl、getOpenSDKPath）为占位实现，默认值为空或空字符串。
  - 这些常量和方法的真正值通常在应用层或部署配置中注入，AI 助手不要在本包中硬编码具体业务域名或线上环境信息。
- 全局变量 IS_OVERSEA
  - openApiCdnUrlByRegion 使用 IS_OVERSEA 判断国内/海外 CDN 源，该标志并未在本子包定义，通常由上层打包器或运行时注入。
  - 在测试或本地调试中，如需覆盖该行为，应通过 __tests__/setup.ts 或 vitest 的环境注入来模拟 IS_OVERSEA，而不是在源码内定义。
- 运行环境探测
  - openApiHostByRegion 使用 typeof location !== 'undefined' 做浏览器环境探测，非浏览器环境下回退到占位 URL。
  - AI 助手在改动时应保持这种「优先运行时 / 其次默认占位」的策略，不引入 Node 专用 API，确保代码可在浏览器与 SSR 环境中安全导入。
- 事件元信息结构
  - eventMeta 的字段（region, is_release, dev）是其他子包/上层 SDK 依赖的固定结构，新增字段需确保向后兼容，并在 README.md 与对应测试中体现。

## 外部依赖与集成点

- 开发依赖
  - @coze-arch/ts-config：统一 TS 配置，tsconfig.json / tsconfig.build.json / tsconfig.misc.json 均基于该预设。
  - @coze-arch/vitest-config：统一 Vitest 配置与测试预设，避免各包重复配置测试环境。
  - @coze-arch/eslint-config / @coze-arch/stylelint-config / @coze-arch/tailwind-config / @coze-arch/postcss-config：统一代码风格与样式规范。
  - webpack、@rspack/plugin-react-refresh、tailwindcss 等依赖多为跨包共用工具，本子包当前未直接使用 React 组件或打包入口，但需保持版本兼容性。
- 运行时依赖
  - 本包在 dependencies 字段中为空，所有逻辑仅依赖 TS/JS 内置对象（如 location）与构建时宏（如 IS_OVERSEA）。
  - 这使得 open-env-adapter 可被多端环境直接消费，上层项目只需关心如何注入环境变量与实际域名。

## 仓库流程与协作规范

- 本包受 Rush monorepo 统一管理，常见流程：
  - 在根目录执行 rush update 安装依赖。
  - 开发本子包时通常通过 rushx <script> 调用 package.json 中定义的脚本（如 rushx test、rushx lint）。
- 版本与发布
  - package.json.version 当前为 0.0.1，真实版本管理与发布由 monorepo 顶层工具链处理（如 change log、build pipeline），AI 助手不应在此子包直接改版本号或发布配置，除非用户明确要求。
  - botPublishConfig.main 指向 dist/index.js，说明对外发布时将使用构建产物而非 src/index.ts；构建产物生成过程在仓库其他位置统一配置。
- 代码规范
  - 所有源码文件头部都包含 Apache-2.0 版权声明，新增文件时需保持一致格式。
  - 严格使用 TypeScript，遵循 tsconfig 中的编译选项；新增导出需同时考虑类型友好性（例如合理的返回类型、避免 any）。

## 为 AI 助手准备的操作建议

- 修改或新增导出时：
  - 在 src/chat/index.ts 中实现具体常量或函数，再在 src/index.ts 中统一 re-export，保证对外 API 集中管理。
  - 同步更新 README.md 中的 API 列表与简单说明，保持文档与实现一致。
  - 为关键行为添加/更新 __tests__/chat.test.ts 中的用例，覆盖浏览器/非浏览器环境与 IS_OVERSEA 开关的主要分支。
- 集成其他子包或上层需求时：
  - 如需增加更多环境变量（例如不同区域的 host 映射），优先以「纯数据配置 + 只读导出」的形式实现，避免引入复杂逻辑或副作用。
  - 若必须依赖全局变量或构建宏，应在 README.md 与本说明中明确依赖关系，并在测试 setup 中给出合理默认值。
- 安全与兼容性：
  - 不在本包内写入真实生产域名、密钥或环境敏感信息，保留占位或从运行时读取。
  - 避免在顶层执行与环境相关的副作用（如直接访问 window.localStorage 等），确保本包在 Node/SSR 环境中只是惰性加载常量。
