# Gateway API 文档

## 1. 测试环境

- 运行方式: `npm run dev`
- 监听端口: `3210`
- Base URL: `http://localhost:3210`

## 2. 启动命令

```bash
npm install
npm run dev
```

## 3. API 明细

### 3.1 健康检查

API: `GET /health`

终端命令:

```bash
curl -s -i http://localhost:3210/health
```

返回:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"status":"ok","uptime":6.075435125}
```

### 3.2 获取设备列表

API: `GET /api/devices`

终端命令:

```bash
curl -s -i http://localhost:3210/api/devices
```

返回:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[]
```

### 3.3 添加设备（成功）

API: `POST /api/devices`

终端命令:

```bash
curl -s -i -X POST http://localhost:3210/api/devices \
  -H 'Content-Type: application/json' \
  -d '{"name":"API测试泵","type":"pump","ip":"127.0.0.1","port":65535}'
```

返回:

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":"6607ca57-3547-4213-9fbe-e3c570c4120f","name":"API测试泵","type":"pump","ip":"127.0.0.1","port":65535,"created_at":"2026-03-09 12:13:19","updated_at":"2026-03-09 12:13:19"}
```

### 3.4 添加设备（参数校验失败）

API: `POST /api/devices`

终端命令:

```bash
curl -s -i -X POST http://localhost:3210/api/devices \
  -H 'Content-Type: application/json' \
  -d '{"ip":"127.0.0.1"}'
```

返回:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"error":"设备名称和IP地址不能为空"}
```

### 3.5 获取单个设备

API: `GET /api/devices/:id`

终端命令:

```bash
curl -s -i http://localhost:3210/api/devices/6607ca57-3547-4213-9fbe-e3c570c4120f
```

返回:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":"6607ca57-3547-4213-9fbe-e3c570c4120f","name":"API测试泵","type":"pump","ip":"127.0.0.1","port":65535,"created_at":"2026-03-09 12:13:19","updated_at":"2026-03-09 12:13:19","connected":false,"lastStatus":null}
```

### 3.6 获取设备状态

API: `GET /api/devices/:id/status`

终端命令:

```bash
curl -s -i http://localhost:3210/api/devices/6607ca57-3547-4213-9fbe-e3c570c4120f/status
```

返回:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"connected":false,"lastStatus":null}
```

### 3.7 更新设备

API: `PUT /api/devices/:id`

终端命令:

```bash
curl -s -i -X PUT http://localhost:3210/api/devices/6607ca57-3547-4213-9fbe-e3c570c4120f \
  -H 'Content-Type: application/json' \
  -d '{"name":"API测试泵-已更新","ip":"127.0.0.1","port":65534}'
```

返回:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":"6607ca57-3547-4213-9fbe-e3c570c4120f","name":"API测试泵-已更新","type":"pump","ip":"127.0.0.1","port":65534,"created_at":"2026-03-09 12:13:19","updated_at":"2026-03-09 12:13:28"}
```

### 3.8 发送设备命令（设备离线）

API: `POST /api/devices/:id/command`

终端命令:

```bash
curl -s -i -X POST http://localhost:3210/api/devices/6607ca57-3547-4213-9fbe-e3c570c4120f/command \
  -H 'Content-Type: application/json' \
  -d '{"cmd":"move","m_idx":0,"dir":"fwd","val":100}'
```

返回:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json; charset=utf-8

{"success":false,"error":"设备未连接"}
```

### 3.9 发送设备命令（参数校验失败）

API: `POST /api/devices/:id/command`

终端命令:

```bash
curl -s -i -X POST http://localhost:3210/api/devices/6607ca57-3547-4213-9fbe-e3c570c4120f/command \
  -H 'Content-Type: application/json' \
  -d '{}'
```

返回:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{"error":"命令不能为空"}
```

### 3.10 获取单个设备（不存在）

API: `GET /api/devices/:id`

终端命令:

```bash
curl -s -i http://localhost:3210/api/devices/not-exist-id
```

返回:

```http
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8

{"error":"设备不存在"}
```

### 3.11 删除设备（成功）

API: `DELETE /api/devices/:id`

终端命令:

```bash
curl -s -i -X DELETE http://localhost:3210/api/devices/6607ca57-3547-4213-9fbe-e3c570c4120f
```

返回（成功）:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"message":"设备已删除","id":"6607ca57-3547-4213-9fbe-e3c570c4120f"}
```

返回（不存在设备）:

```http
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8

{"error":"设备不存在"}
```

### 3.12 查询日志

API: `GET /api/logs`

终端命令:

```bash
curl -s -i http://localhost:3210/api/logs
```

返回(清理前):

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"logs":[...],"total":52,"page":1,"limit":50,"totalPages":2}
```

返回(清理后):

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"logs":[],"total":0,"page":1,"limit":50,"totalPages":0}
```

### 3.13 获取日志动作类型

API: `GET /api/logs/actions`

终端命令:

```bash
curl -s -i http://localhost:3210/api/logs/actions
```

返回:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

["device_added","device_connected","device_disconnected","device_updated","gateway_started","move","period_control","set_mode"]
```

### 3.14 清空日志

API: `DELETE /api/logs`

终端命令:

```bash
curl -s -i -X DELETE http://localhost:3210/api/logs
```

返回:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"message":"日志已清除"}
```

---

## 4. API 成功/失败对照

### 4.1 `GET /health`

- 成功: `200`，`{"status":"ok","uptime":...}`
- 失败: 服务未启动时执行同命令，终端报连接失败(例如 `curl: (7) Failed to connect`)

### 4.2 `GET /api/devices`

- 成功: `200`，返回设备数组(空或非空)
- 失败: 服务异常/未启动时连接失败(`curl: (7) ...`)

### 4.3 `POST /api/devices`

- 成功: `201`，返回新建设备 JSON
- 失败: `400`，`{"error":"设备名称和IP地址不能为空"}`

### 4.4 `GET /api/devices/:id`

- 成功: `200`，返回设备详情 + `connected` + `lastStatus`
- 失败: `404`，`{"error":"设备不存在"}`

### 4.5 `GET /api/devices/:id/status`

- 成功: `200`，`{"connected":false,"lastStatus":null}`
- 失败: 服务异常/未启动时连接失败(`curl: (7) ...`)

### 4.6 `PUT /api/devices/:id`

- 成功: `200`，返回更新后的设备 JSON
- 失败:
  - `404` 设备不存在
  - `400` 未提供任何更新字段(`{"error":"没有提供更新字段"}`)

### 4.7 `POST /api/devices/:id/command`

- 成功(前置条件: 设备 WebSocket 已连接): `200`，`{"success":true,"message":"命令已发送"}`
- 失败:
  - `503`，`{"success":false,"error":"设备未连接"}`
  - `400`，`{"error":"命令不能为空"}`

### 4.8 `DELETE /api/devices/:id`

- 成功: `200`，`{"message":"设备已删除","id":"..."}`
- 失败: `404`，`{"error":"设备不存在"}`

### 4.9 `GET /api/logs`

- 成功: `200`，`{"logs":[...],"total":...}` 或空日志结构
- 失败: 服务异常/未启动时连接失败(`curl: (7) ...`)

### 4.10 `GET /api/logs/actions`

- 成功: `200`，返回动作字符串数组
- 失败: 服务异常/未启动时连接失败(`curl: (7) ...`)

### 4.11 `DELETE /api/logs`

- 成功: `200`，`{"message":"日志已清除"}`
- 失败: 服务异常/未启动时连接失败(`curl: (7) ...`)
