# @coze-data/knowledge-common-services 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/common/services）中安全、高效地协作开发。

## 全局架构与职责

- 本包提供「知识库 IDE」相关的通用前端服务函数，目前聚焦于：
  - 解析当前页面 URL 查询参数，生成知识 IDE 上下文查询对象 `getKnowledgeIDEQuery`。
  - 在知识页面内，根据业务来源判断是否处于「全屏模式」`getKnowledgeIsFullModeByBiz`。
- 代码全部位于 `src` 目录：
  - `src/index.tsx`：包入口，仅聚合导出 use-case 中的函数。
  - `src/use-case/get-knowledge-ide-query.ts`：解析 URL 查询参数生成结构化查询对象。
  - `src/use-case/get-knowledge-is-full-mode-by-biz.ts`：基于 pathname 与 biz 参数判断是否为知识全屏模式。
  - `src/use-case/index.tsx`：use-case 层入口，对外统一导出 use-case 方法。
- 对外导出通过 `package.json` 的 `exports` 配置：
  - `"."` → `src/index.tsx`（默认入口）。
  - `"./use-case"` → `src/use-case/index.tsx`（直接使用 use-case 能力）。

## 开发与测试工作流

- 包管理由 Rush + PNPM 统一：
  - 在仓库根目录先执行 `rush update` 安装依赖。
- 本包脚本（在本目录执行）：
  - `npm run build`：当前实现为 `exit 0`，真实打包由上层构建系统统一处理，本包主要作为 TS 源码与类型提供方。
  - `npm run lint`：使用 `eslint ./ --cache`，规则来自 `eslint.config.js`（基于 `@coze-arch/eslint-config` 的 `web` 预设）。
  - `npm test`：运行 Vitest（`vitest --run --passWithNoTests`），配置见 `vitest.config.ts`，通过 `@coze-arch/vitest-config` 统一管理。
  - `npm run test:cov`：在上述测试基础上增加覆盖率统计。
- TypeScript：
  - 顶层 `tsconfig.json` 仅声明 composite 与 references，实际编译配置在 `tsconfig.build.json` / `tsconfig.misc.json` 中，由上层 `tsc --build` 使用。
  - `tsconfig.build.json` 继承 `@coze-arch/ts-config/tsconfig.web.json`，`rootDir: src`，`outDir: dist`，目标环境为浏览器（`lib: ["DOM", "ESNext"]`，`moduleResolution: bundler`）。

## 代码组织与约定

- 入口与导出：
  - 所有对外 API 应集中通过 `src/index.tsx` 与 `src/use-case/index.tsx` 导出，并同步维护 `package.json.exports` 与 `typesVersions`。
  - 新增 use-case 时：
    - 在 `src/use-case` 下创建独立文件。
    - 在 `src/use-case/index.tsx` 聚合导出。
    - 如需默认入口暴露，再在 `src/index.tsx` 转发导出。
- 类型与结构：
  - `get-knowledge-ide-query.ts` 内部定义 `KnowledgeIDEQuery` 接口，约束 URL 查询参数：
    - `biz?: 'agentIDE' | 'workflow' | 'library' | 'project'`。
    - `bot_id?` / `workflow_id?` / `agent_id?` / `page_mode?: 'modal' | 'normal'`。
  - 返回值通过 `URLSearchParams(location.search)` 解析并过滤空值，最终以 `Record<string, string>` 形式返回（运行时）但在 TS 层保持 `KnowledgeIDEQuery` 类型约束。
- 浏览器环境假设：
  - 所有 use-case 默认运行在浏览器中，直接访问 `location.search` / `location.pathname`。
  - 在 Node / SSR 环境使用时，需要调用方自行在上层做环境判断或注入 polyfill，本包不做环境探测。

## 关键 use-case 行为说明

- `getKnowledgeIDEQuery`（`src/use-case/get-knowledge-ide-query.ts`）：
  - 数据来源：当前页面的 `location.search`。
  - 行为：
    - 使用 `URLSearchParams` 读取 `biz`、`bot_id`、`workflow_id`、`agent_id`、`page_mode`。
    - 将结果映射到 `KnowledgeIDEQuery` 对象，并通过 `Object.entries().filter(e => !!e[1])` 移除值为空的字段，避免生成多余 query 字段。
  - 使用建议：
    - 作为「知识 IDE 场景判断」与「后续跳转拼参」的统一入口，避免在各处手写 `new URLSearchParams` 与 key 名。
    - 若后续需要扩展 query 字段，应先在 `KnowledgeIDEQuery` 中补充类型，再更新解析逻辑与调用方。
- `getKnowledgeIsFullModeByBiz`（`src/use-case/get-knowledge-is-full-mode-by-biz.ts`）：
  - 判定目标：当前是否在「知识全屏模式」下渲染。
  - 步骤：
    - `isKnowledgePathname()` 通过正则 `^/space/[0-9]+/knowledge(/[0-9]+)*` 匹配当前 `location.pathname`，非知识页面直接返回 `false`。
    - 调用 `getKnowledgeIDEQuery()` 拿到 `biz` 字段，当 `biz` 为 `'agentIDE'` 或 `'workflow'` 时返回 `true`，否则 `false`。
  - 使用建议：
    - 上层布局组件可据此判断是否隐藏其他面板、进入 IDE 风格全屏；
    - 调整规则时，请确保正则与后端路由保持一致，且同时更新所有依赖 `biz` 枚举的逻辑。

## 工程规范与依赖

- 运行时依赖：
  - 仅依赖 `classnames`（目前源码未实际使用，可能为模板遗留，保留以兼容未来样式类拼接需求）。
- 开发依赖：
  - 使用 `@coze-arch/*` 系列包统一 TS/Vitest/ESLint/Stylelint 配置，保持与前端 monorepo 其它子包一致的工程规范。
  - React 18 作为 peerDependency，虽然本包当前仅导出纯函数，但在 monorepo 下保持统一 React 版本约束。
- 版权与 License：
  - 所有 TS/TSX 源文件头部使用 Apache-2.0 版权声明，新文件需保持相同头注释格式。

## 对 AI 助手的特别提示

- 新增能力时：
  - 优先以「小而纯」的 use-case 函数形式存在，禁止在本包中引入跨域业务逻辑或网络请求；
  - 避免对 `location` 以外的全局状态产生副作用（如直接修改 `history`、`document`）。
- 修改导出时：
  - 同步更新 `src/index.tsx`、`src/use-case/index.tsx`、`package.json.exports` 与 `typesVersions`，保证类型与运行时路径一致；
  - 在其它包需要新增引用路径时，统一本包导出的子路径（例如 `@coze-data/knowledge-common-services/use-case`）。
- 在测试中使用浏览器 API：
  - Vitest 运行环境依赖 `@coze-arch/vitest-config` 的 web 预设，允许直接访问 `window`/`location`；
  - 如需定制行为，建议在测试中通过 `vi.spyOn(window, 'location', ...)` 或设置 `jsdom` URL，而不是在源码中加入测试分支。
