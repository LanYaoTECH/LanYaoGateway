# 6. 终端与网关通信机制

## 6.1 通信协议

| 通信场景 | 协议 | 端口 | 用途 |
|----------|------|------|------|
| 终端→网关 | TCP/IP | 8080 | 设备控制指令传输 |
| 网关→终端 | WebSocket | 8081 | 设备状态实时推送 |
| 网关→云服务器 | MQTT | 1883 | 设备数据上传 |
| 云服务器→网关 | MQTT | 1883 | 远程指令下发 |

# 7.网关与设备通信

## 7.1 指令格式

```json
{
  "cmd": "control",
  "device_id": "dev_001",
  "action": "switch",
  "params": {
    "status": "off"
  },
  "timestamp": 1620000000000
}
```

## 7.2 状态上报格式

```json
{
  "device_id": "dev_001",
  "status": "on",
  "data": {
    "power": 12.5,
    "voltage": 220,
    "current": 0.057
  },
  "timestamp": 1620000000000
}
```

# 7.网关（后端）与前端通讯

## 一、总体通信约定

### 1. 通信协议

* **协议**：HTTPS
* **风格**：RESTful API
* **数据格式**：`application/json`
* **字符集**：UTF-8
* **时间格式**：ISO 8601

  ```text
  2025-01-01T10:30:00+08:00
  ```

---

### 2. 请求头（Request Headers）

```http
Content-Type: application/json
Authorization: Bearer <access_token>
X-Request-Id: <uuid>
```

---

### 3. 统一响应格式（非常关键）

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "requestId": "a1b2c3d4"
}
```

| 字段        | 说明          |
| --------- | ----------- |
| code      | 业务状态码（0=成功） |
| message   | 人类可读的提示     |
| data      | 实际返回数据      |
| requestId | 便于排查问题      |

#### 常见业务状态码约定

```text
0        成功
1001     参数校验失败
1002     未登录 / Token 失效
1003     权限不足
2001     用户不存在
3001     设备不存在
9000     系统内部错误
```

---

## 二、认证与登录模块

### 1. 用户登录

**POST** `/api/v1/auth/login`

#### 请求体

```json
{
  "username": "admin",
  "password": "123456",
  "captcha": "a8xk"   // 可选
}
```

#### 响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 7200,
    "user": {
      "id": 1,
      "username": "admin",
      "role": "ADMIN"
    }
  }
}
```

---

### 2. 用户登出

**POST** `/api/v1/auth/logout`

```json
{}
```

```json
{
  "code": 0,
  "message": "logout success"
}
```

---

## 四、设备管理 & 状态查询

### 1. 设备列表

**GET** `/api/v1/devices`

```text
page=1
pageSize=10
status=ONLINE
type=ROUTER
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": "dev-001",
        "name": "设备01",
        "type": "SWITCH",
        "status": "ONLINE",
        "ip": "192.168.1.1",
        "lastHeartbeat": "2025-01-01T10:25:00+08:00"
      }
    ],
    "total": 8
  }
}
```

---

### 2. 单设备状态详情

**GET** `/api/v1/devices/{id}/status`

```json
{
  "code": 0,
  "data": {
    "cpuUsage": 35.6,
    "memoryUsage": 62.1,
    "diskUsage": 48.9,
    "online": true
  }
}
```

---

### 3. 设备操作（示例：重启）

**POST** `/api/v1/devices/{id}/actions/reboot`

```json
{
  "reason": "配置变更后重启"
}
```

---

## 五、操作日志 / 审计日志

### 1. 操作日志查询（重点）

**GET** `/api/v1/logs/operations`

```text
page=1
pageSize=20
userId=1
action=LOGIN
startTime=2025-01-01T00:00:00+08:00
endTime=2025-01-02T00:00:00+08:00
```

#### 响应

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1001,
        "userId": 1,
        "username": "admin",
        "action": "LOGIN",
        "target": "SYSTEM",
        "result": "SUCCESS",
        "ip": "192.168.1.100",
        "createdAt": "2025-01-01T09:58:00+08:00"
      }
    ],
    "total": 1200
  }
}
```

---

### 2. 常见日志 action 约定

```text
LOGIN
LOGOUT
CREATE_USER
UPDATE_USER
DELETE_USER
DEVICE_REBOOT
DEVICE_CONFIG_UPDATE
```

---

# 注意注意！

现在的内容只是一个测试用服务器，用来测试前端时候运行正常的，只会在请求api时返回固定数据。