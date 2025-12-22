# LanYaoGateway Mock Server ✅

这是一个简单的测试服务器，用于在前端开发时返回符合 `readme.md` 中 API 规范的 mock 响应。

## 快速开始

1. 进入目录：

```bash
cd mock-server
```

2. 安装依赖：

```bash
npm install
```

3. 启动服务：

```bash
npm start
```

默认端口为 `3000`，可通过设置环境变量 `PORT` 覆盖（例如：`PORT=4000 npm start`）。

## 支持的接口（示例）

- POST `/api/v1/auth/login` 登录
- POST `/api/v1/auth/logout` 登出
- GET `/api/v1/devices` 设备列表
- GET `/api/v1/devices/:id/status` 设备状态
- POST `/api/v1/devices/:id/actions/reboot` 重启设备
- GET `/api/v1/logs/operations` 操作日志

所有响应使用统一格式：

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "requestId": "..."
}
```

如需添加新的 mock 数据或接口，请编辑 `index.js`。