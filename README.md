# 6. 终端与网关通信机制

## 6.1 通信协议

| 通信场景 | 协议 | 端口 | 用途 |
|----------|------|------|------|
| 终端→网关 | TCP/IP | 8080 | 设备控制指令传输 |
| 网关→终端 | WebSocket | 8081 | 设备状态实时推送 |
| 网关→云服务器 | MQTT | 1883 | 设备数据上传 |
| 云服务器→网关 | MQTT | 1883 | 远程指令下发 |

## 6.2 指令格式

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

## 6.3 状态上报格式

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
