# local-storage 子包开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/local-storage）中安全、高效地协作开发。

## 全局架构与角色定位
- 本子包提供浏览器 localStorage 的统一抽象：通过单例服务 localStorageService 与 React Hook useLocalStorageValue，为整个 Coze Studio 提供可订阅的本地缓存读写能力。
- 数据模型集中在 src/types.ts 与 src/config.ts：
  - LocalStorageCacheData 定义存储结构，主要分为 permanent（与账号无关的长期缓存）和 userRelated（与 userId 绑定的缓存）。
  - LOCAL_STORAGE_CACHE_KEYS 与 cacheConfig 用于声明允许的缓存 key 以及是否与账号绑定（bindAccount 等字段）。
- 核心类 LocalStorageService 位于 src/core/index.ts：
  - 继承 eventemitter3 的 EventEmitter，用事件 change、setUserId 通知订阅方状态变化。
  - 内部维护内存态 #state 与当前用户 #userId，并以 throttled 写入方式同步到 window.localStorage。
- Hook 层封装在 src/hooks/use-value.ts：
  - useValue(key)（对外导出为 useLocalStorageValue）通过 localStorageService.getValue 读取初始值，并订阅 change 事件实现响应式更新。
- 工具函数位于 src/utils/parse.ts：
  - paseLocalStorageValue 负责安全解析 localStorage 字符串并校验结构类型，确保只返回符合 LocalStorageCacheData 约定的数据。
  - filterCacheData 根据 LOCAL_STORAGE_CACHE_KEYS 过滤非法或过期 key，避免历史数据污染当前行为。
- src/index.ts 作为公共 API 出口：
  - 仅导出 localStorageService 与 useLocalStorageValue，外部依赖包一律通过 @coze-foundation/local-storage 访问本地缓存能力，不直接操作 localStorage。

## 目录结构与关键文件
- 根目录
  - package.json：定义包名 @coze-foundation/local-storage，声明依赖 eventemitter3、lodash-es，并提供 build/lint/test 脚本。
  - README.md：简要说明本包是 "global local storage service"，列出对外导出 API（localStorageService、useLocalStorageValue）。
  - eslint.config.js / tsconfig*.json / vitest.config.ts：均使用 @coze-arch/* 预设，说明本包和其他 frontend 子包遵循统一的 lint、构建与测试规范。
- src/
  - index.ts：公共导出入口，转导 localStorageService 与 useLocalStorageValue。
  - core/index.ts：本地缓存核心服务 LocalStorageService 实现，封装 localStorage 访问与事件分发，是本包的业务核心。
  - hooks/use-value.ts：为 React 使用场景提供的订阅型 Hook，供上层通过 useLocalStorageValue(key) 直接获取并响应 localStorage 缓存变化。
  - utils/parse.ts：封装 localStorage 原始值的 JSON 解析、类型校验与 key 过滤逻辑，保证本包对异常/历史数据具备容错能力。
  - config.ts：集中定义 LOCAL_STORAGE_CACHE_KEYS 与 cacheConfig 等配置，声明缓存 key 列表及其是否与账号绑定；扩展新 key 时只需在此文件维护。
  - types.ts / typings.d.ts：声明 LocalStorageCacheData、CacheDataItems 等类型，并对外补充必要的类型声明。
- __tests__/
  - core/local-storage-service.test.ts：针对 LocalStorageService 行为的单元测试，覆盖 userId 绑定、事件通知、存取逻辑等关键路径。
  - hooks/use-value.test.tsx：验证 useValue Hook 的订阅更新行为，确保 change 事件触发后 Hook 能正确刷新值。
  - utils/parse.test.ts：验证 paseLocalStorageValue 与 filterCacheData 对异常数据、非法 key 的处理逻辑。

## 数据流与行为细节
- 持久化格式：
  - 所有数据统一存储在 localStorage 的 __coz_biz_cache__ key 下，值为 JSON 字符串，对应 LocalStorageCacheData 结构：
    - permanent：不依赖账号的键值对缓存，适合公共开关或客户端级别状态。
    - userRelated：以 userId 为一级 key 的嵌套对象，存放与账号相关的缓存（如用户个性化配置、引导完成状态等）。
- 读写流程：
  - 初始化：LocalStorageService 构造函数中调用 #initState，从 localStorage 读取 __coz_biz_cache__，经 paseLocalStorageValue + filterCacheData 处理后写入内存 #state，并 emit('change') 通知订阅者。
  - 写入：setValue(key, value)
    - 根据 cacheConfig[key].bindAccount 判断写入 permanent 还是 userRelated；若绑定账号但当前未设置 userId，则直接返回（不写入）。
    - 通过 #setPermanent 或 #setUserRelated 更新内存 #state，并调用节流后的 #saveState 将 JSON 序列化写回 localStorage。
    - 最后 emit('change') 广播变更，驱动所有 Hook/监听方更新。
  - 读取：
    - getValue(key)：同步返回当前内存 #state 中的值；若 key 绑定账号且未设置 userId，在开发模式下可能抛出错误提示调用顺序不当。
    - getValueSync(key)：对绑定账号的 key 会在 userId 尚未就绪时等待 setUserId 事件（#waitUserId），适用于异步初始化场景。
- 多 Tab 同步策略：
  - 在 LocalStorageService 构造函数中监听 document.visibilitychange：当页面从后台重新变为 visible 时，重新执行 #initState，从 localStorage 读取最新值并触发 change。这样可以在用户在其他 Tab 修改缓存后同步当前 Tab 状态。
- 事件机制：
  - 继承自 EventEmitter 的 on/off/emit 用于：
    - 外部组件通过 localStorageService.on('change', cb) 订阅任意 key 变更。
    - 内部通过 emit('setUserId', userId) 支持 getValueSync 等场景等待 userId 初始化。

## 开发与测试工作流
- 依赖安装：
  - 在 monorepo 根目录执行 rush update，由 Rush 统一安装与链接所有子包依赖（本包通过 workspace:* 方式被其他前端包引用）。
- 本子包脚本（在 frontend/packages/foundation/local-storage 目录下）：
  - npm run build：当前实现为 exit 0，本包不负责独立打包，实际构建由上层 rsbuild / Rush 流程统一处理。
  - npm run lint：调用 ESLint（@coze-arch/eslint-config 预设）对 TS/TSX 源码进行校验，带缓存。
  - npm run test：使用 Vitest（@coze-arch/vitest-config preset: web）运行测试，默认 passWithNoTests，适配 CLI 集成流程。
  - npm run test:cov：在 npm run test 的基础上开启 coverage 统计（@vitest/coverage-v8）。
- 调试方式：
  - 推荐优先通过单元测试验证新 key、新行为；如需在实际页面验证，可在依赖本包的上层包（如 account-base、space-ui-base、workspace 相关包）中运行对应应用并通过浏览器 DevTools 观察 localStorage.__coz_biz_cache__ 的变化。

## 项目约定与编码风格
- 通用约定：
  - 统一采用 TypeScript + React 18 环境，React 仅用于 Hook 层（useValue），核心服务不依赖 React，可在非 React 环境中直接调用 localStorageService。
  - 所有源文件顶部保留 Apache-2.0 版权头，与 monorepo 其他前端包保持一致；新增文件时请复制现有头部格式。
- 本地存储约定：
  - 禁止在外部业务代码中直接读写 window.localStorage 中的业务 key，应统一使用 localStorageService，确保数据结构、账号绑定与多 Tab 同步逻辑一致。
  - 新增缓存项时：
    - 必须在 config.ts 中新增对应 key 至 LOCAL_STORAGE_CACHE_KEYS，并配置 cacheConfig[key]（至少声明 bindAccount）。
    - 类型上应同步更新 LocalStorageCacheKey 等类型定义，保证编译期约束。
  - 删除缓存项时：
    - 先移除 config.ts 中对应配置，再在使用方代码中完成迁移；filterCacheData 会自动在下次解析时丢弃旧 key，避免历史脏数据残留。
- 异常与健壮性：
  - paseLocalStorageValue 对 JSON.parse 异常与结构不匹配场景做了兜底处理，保证不会因为手工修改 / 历史版本数据导致运行时崩溃。
  - 对于绑定账号的 key，未设置 userId 时 getValue 可能在开发模式下抛出错误提示使用顺序问题；生产环境下则返回 undefined，调用方需做好空值处理。

## 与外部子包的集成
- 本包被多个基础与业务子包依赖，例如：
  - frontend/packages/foundation/account-base：用于同步账号 uid 至本地缓存，确保 userRelated 数据按账号隔离。
  - frontend/packages/foundation/space-ui-base：用于工作空间初始化与子菜单状态记忆（如最近访问空间列表、引导步骤完成状态等）。
  - frontend/packages/common/biz-components、prompt-kit 等：用于引导弹层、会话可见性等 UI 状态的持久化。
- 典型使用方式：
  - 读：const value = localStorageService.getValue('someKey'); 或 const v = await localStorageService.getValueSync('userKey');
  - 写：localStorageService.setValue('someKey', 'value');
  - React 订阅：const value = useLocalStorageValue('someKey');，在缓存变化时组件会自动重渲染。
- 对于依赖 userId 的流程：
  - 外部通常在账号初始化流程中调用 localStorageService.setUserId(uid)；
  - 之后所有 bindAccount 为 true 的 key 读写都会写入当前 uid 命名空间下，切换账号时只需重新调用 setUserId 即可实现逻辑隔离。

## 项目流程与协作规范
- 版本与依赖管理：
  - 由 Rush + pnpm workspace 统一管理，本包的 version 字段主要用于标记，与实际发布流程由仓库级 CI/CD 控制。
  - 对外 API（localStorageService、useLocalStorageValue）属基础能力，变更需谨慎，避免破坏 account-base、space-ui-base、workspace 等上层包的使用。
- 分支与提交：
  - 遵循仓库统一的分支策略（main + feature 分支），在本包内修改时应保持提交粒度清晰，并在 MR/PR 描述中注明是否涉及公共存储 key 的新增/变更，以便其他团队同步调整。
- 测试要求：
  - 涉及缓存结构或 key 列表的变更（修改 config.ts、types.ts、parse.ts）时，应同步更新或新增对应 Vitest 用例，确保不破坏现有读取兼容逻辑。

## 特殊/不寻常的特性说明
- 统一缓存桶设计：
  - 所有业务缓存聚合到同一个 localStorage key (__coz_biz_cache__) 下，而不是分散多个 key，便于集中控制版本兼容、清理与调试。
- 动态过滤历史 key：
  - filterCacheData 会在每次初始化时按 LOCAL_STORAGE_CACHE_KEYS 过滤不认识的 key，为长期演进预留空间，也降低历史实验字段残留的风险。
- 前端多 Tab 自恢复机制：
  - 利用 document.visibilitychange 事件在页面重新可见时刷新 #state，避免用户在其他页面修改配置后当前页仍使用旧值的问题。
- 异步 userId 等待能力：
  - 通过内部事件 setUserId 与 getValueSync 封装，支持“先请求再有账号态”的复杂初始化顺序，而不强迫所有调用方提前拿到 userId。
