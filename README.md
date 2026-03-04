# RayCore Gateway 鳐芯终端后端网关

作为前端（RayCore Terminal）与设备之间的中间层，提供设备管理、命令转发、状态聚合和操作日志记录等功能。

## 架构

```
前端 (React/Electron)
  │
  ├─ HTTP REST API ──► Gateway (Express, port 3210)
  └─ WebSocket ──────► Gateway
                          │
                          └─ WebSocket ──► 设备 (ws://<IP>/ws)
```

- **前端 ↔ Gateway**：通过 HTTP REST 管理设备增删改查、查询日志；通过 WebSocket 实时订阅设备状态、发送控制命令。
- **Gateway ↔ 设备**：每个已添加的设备维护一条 WebSocket 长连接，自动重连，转发状态和命令。

## 技术栈

- **Runtime**: Node.js 18+ (ESM)
- **Web 框架**: Express 5
- **WebSocket**: ws
- **数据库**: SQLite (better-sqlite3)
- **语言**: TypeScript 5.9

## 目录结构

```
src/
├── index.ts                         # 主入口：Express + WebSocket Server
├── database.ts                      # SQLite 初始化、设备表 + 日志表
├── types.ts                         # TypeScript 类型定义
├── routes/
│   ├── devices.ts                   # 设备 CRUD + 命令发送 API
│   └── logs.ts                      # 日志查询/筛选/清除 API
└── services/
    ├── DeviceConnectionManager.ts   # 管理到泵的 WebSocket 连接池
    └── LogService.ts                # 操作日志写入与查询
```

## 安装与运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm start
```

>默认端口3210，可通过环境变量PORT修改。

## REST API

### 设备管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/devices` | 获取所有设备（含连接状态和最新状态） |
| `GET` | `/api/devices/:id` | 获取单个设备详情 |
| `POST` | `/api/devices` | 添加新设备 |
| `PUT` | `/api/devices/:id` | 更新设备信息 |
| `DELETE` | `/api/devices/:id` | 删除设备 |
| `POST` | `/api/devices/:id/command` | 向设备发送控制命令 |
| `GET` | `/api/devices/:id/status` | 获取设备连接状态 |

#### 添加设备请求体

```json
{
  "name": "注射泵-P01",
  "type": "pump",
  "ip": "192.168.1.100",
  "port": 80
}
```

#### 发送命令请求体

直接传递设备固件所支持的 WebSocket 命令 JSON：

```json
{ "cmd": "move", "m_idx": 0, "dir": "fwd", "val": 100 }
```

```json
{ "cmd": "set_mode", "mode": "period" }
```

```json
{ "cmd": "period_control", "action": "start", "speed_a": 100 }
```

### 日志管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/logs` | 查询日志 |
| `GET` | `/api/logs/actions` | 获取所有操作类型 |
| `DELETE` | `/api/logs` | 清除所有日志 |

#### 日志查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `device_id` | string | 按设备 ID 筛选 |
| `action` | string | 按操作类型筛选 |
| `page` | number | 页码 |
| `limit` | number | 每页条数 |

### 状态检查

```
GET /health → { "status": "ok", "uptime": 123.45 }
```

## WebSocket 协议

地址：`ws://localhost:3210/ws`

### 前端发送

```json
{ "type": "subscribe", "deviceId": "<设备ID>" }
{ "type": "unsubscribe", "deviceId": "<设备ID>" }
{ "type": "command", "deviceId": "<设备ID>", "payload": { "cmd": "move", ... } }
```

### Gateway 推送

```json
{ "type": "device_status", "deviceId": "<设备ID>", "data": { ... } }
{ "type": "device_connection", "deviceId": "<设备ID>", "connected": true }
{ "type": "command_result", "deviceId": "<设备ID>", "success": true }
```

## 设备协议

Gateway 直连设备的 WebSocket (`ws://<IP>:<Port>/ws`)，支持以下命令：

| 命令 | 参数 | 说明 |
|------|------|------|
| `set_mode` | `mode: "raw" \| "period"` | 切换操作模式 |
| `list` | 无 | 查询电机列表 |
| `bind` | `m_idx, can_id` | 重新绑定电机 CAN ID |
| `move` | `m_idx, dir, val` | 速度控制 (正转/停止/反转) |
| `angle` | `m_idx, val, speed` | 绝对位置定位 |
| `period_control` | `action, speed_a` | 周期模式启停 |
| `calibrate` | `m_idx, action` | 电机校准 |
| `invert_direction` | `m_idx, inverted` | 反转电机方向 |

>设备每 500ms 广播一次 `type: "status"` 状态数据，包含运行时间、WiFi 状态、模式、周期进度及各电机的转速、位置、状态。

## 数据库

SQLite 数据库位于 `data/gateway.db`。

**设备表 (devices)**：id, name, type, ip, port, created_at, updated_at

**日志表 (logs)**：id, device_id, device_name, action, details (JSON), result, created_at

## 自动记录的操作日志

| action | 触发时机 |
|--------|----------|
| `gateway_started` | 网关启动 |
| `device_added` | 添加设备 |
| `device_updated` | 更新设备 |
| `device_deleted` | 删除设备 |
| `device_connected` | 设备 WebSocket 连接成功 |
| `device_disconnected` | 设备 WebSocket 断开 |
| `move` / `set_mode` / `calibrate` 等 | 向设备发送的每条命令 |
