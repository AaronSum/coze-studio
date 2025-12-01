# Coze Studio Backend

这是 Coze Studio 的后端项目，提供 Agent 编排、知识库、会话、工作流等核心能力，基于 Go 语言实现，可通过 Docker 一键启动，也可本地开发调试。

## 🏗️ 项目架构

### 核心技术栈

- **语言**: Go 1.22+（具体版本以 go.mod 为准）
- **Web 框架**: 标准库 + 内部封装
- **RPC / IDL**: Thrift（见 idl/ 目录）
- **数据库**: 可集成 MySQL / OceanBase 等（参考 docs/ 中集成文档）
- **缓存**: Redis（默认通过 docker-compose 提供）
- **消息 / 事件总线**: 支持 NATS、Pulsar 等（参考 docs/ 中集成文档）

### 目录结构

```bash
backend/
├── main.go                 # 程序入口
├── build.sh                # 构建脚本
├── Dockerfile              # 后端服务镜像构建文件
├── conf/                   # 配置模版与默认配置
│   ├── admin/              # 管理后台相关配置
│   ├── model/              # 模型相关配置
│   ├── plugin/             # 插件配置
│   ├── prompt/             # Prompt 配置
│   └── workflow/           # 工作流配置
├── api/                    # HTTP / RPC 接口层
│   ├── handler/            # 具体业务 Handler
│   ├── internal/           # 接口内部封装
│   ├── middleware/         # 中间件
│   ├── model/              # 接口层数据模型
│   └── router/             # 路由注册
├── application/            # 应用服务层
│   ├── application.go      # 应用初始化与装配
│   ├── app/                # 应用域服务
│   ├── base/               # 公共应用基础能力
│   ├── connector/          # 外部连接器
│   ├── conversation/       # 会话相关
│   ├── knowledge/          # 知识库相关
│   ├── memory/             # 记忆系统
│   ├── modelmgr/           # 模型管理
│   ├── openauth/           # 第三方授权
│   ├── permission/         # 权限系统
│   ├── plugin/             # 插件系统
│   ├── prompt/             # Prompt 管理
│   ├── search/             # 搜索相关
│   ├── shortcutcmd/        # 快捷命令
│   ├── singleagent/        # 单 Agent 能力
│   ├── template/           # 模板系统
│   ├── upload/             # 上传能力
│   ├── user/               # 用户域
│   └── workflow/           # 工作流编排
├── domain/                 # 领域模型与领域服务
├── crossdomain/            # 跨领域组合能力
├── bizpkg/                 # 业务通用包
│   ├── config/             # 配置解析
│   ├── debugutil/          # 调试工具
│   ├── fileutil/           # 文件工具
│   └── llm/                # LLM 调用封装
├── infra/                  # 基础设施层
│   ├── cache/              # 缓存实现
│   ├── checkpoint/         # Checkpoint / 状态存储
│   ├── coderunner/         # 代码执行相关
│   └── ...                 # 其他基础设施能力
├── internal/               # 内部共享代码
├── pkg/                    # 对外公共包
└── types/                  # 公共类型定义
```

## 🚀 快速开始

### 前置依赖

- Go 1.22+
- Docker 与 Docker Compose（推荐使用根目录 docker/ 下的编排）
- （可选）OceanBase / MySQL、Redis、NATS / Pulsar 等组件

### 通过 Docker 启动（推荐）

在仓库根目录执行：

```bash
# 启动默认开发环境（包括数据库、Redis 等依赖）
cd docker
docker compose up -d
```

默认会启动后端服务、数据库等依赖，具体端口请参考 [docker/docker-compose.yml](docker/docker-compose.yml) 与同目录下其他 compose 文件。

### 本地开发启动

在 backend 目录下开发调试：

```bash
cd backend

# 安装 Go 依赖
go mod tidy

# 本地运行（使用默认配置或通过环境变量覆盖）
go run ./...

# 或使用构建脚本
./build.sh
```

配置文件默认位于 conf/ 目录，可通过环境变量或启动参数指定不同环境配置（如开发 / 测试 / 生产）。

## 📦 核心模块

- **Agent / Workflow**: Agent 运行与工作流编排核心逻辑
- **Knowledge**: 知识库管理与检索
- **Memory**: 会话记忆、长期记忆等
- **Connector**: 外部系统接入（如三方 API、数据库等）
- **Plugin**: 插件系统与扩展能力
- **Search**: 全文搜索与向量检索集成
- **Permission**: 权限与多租户能力

更多领域说明可参考 docs/domain/ 下的文档（如有）。

## 🔧 开发规范

- 统一使用 Go Modules 管理依赖
- 建议使用 gofmt / golangci-lint 进行代码格式化与静态检查
- 领域驱动设计分层：api / application / domain / infra
- 优先通过单元测试与集成测试保障核心模块质量

## 📄 License

Apache License 2.0

