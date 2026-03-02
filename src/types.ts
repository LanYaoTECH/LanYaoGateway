// ===== Device Types =====

export interface Device {
  id: string;
  name: string;
  type: 'pump';
  ip: string;
  port: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceCreateInput {
  name: string;
  type: 'pump';
  ip: string;
  port?: number;
}

export interface DeviceUpdateInput {
  name?: string;
  ip?: string;
  port?: number;
}

// ===== Log Types =====

export interface LogEntry {
  id: number;
  device_id: string | null;
  device_name: string | null;
  action: string;
  details: string | null;
  result: 'success' | 'error';
  created_at: string;
}

export interface LogQueryParams {
  device_id?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedLogs {
  logs: LogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ===== WebSocket Protocol (Frontend <-> Gateway) =====

export type FrontendMessage =
  | { type: 'command'; deviceId: string; payload: Record<string, unknown> }
  | { type: 'subscribe'; deviceId: string }
  | { type: 'unsubscribe'; deviceId: string };

export type GatewayMessage =
  | { type: 'device_status'; deviceId: string; data: PumpStatus }
  | { type: 'device_connection'; deviceId: string; connected: boolean }
  | { type: 'error'; message: string };

// ===== Pump Status (from ESP32 firmware) =====

export interface MotorStatus {
  id: number;
  speed: number;
  pos: number;
  state: number; // 0=OFFLINE,1=FAULT,2=READY,3=STARTING,4=RUNNING,5=E-STOP
  calibrated: boolean;
  pos_min: number;
  pos_max: number;
  direction_inverted: boolean;
}

export interface PeriodStatus {
  enabled: boolean;
  current_cycle: number;
  cycle_progress: number;
  speed_a: number;
  cycles_completed: number;
}

export interface PumpStatus {
  type: 'status';
  uptime: number;
  wifi: boolean;
  mode: 'raw' | 'period';
  period?: PeriodStatus;
  motors: MotorStatus[];
}

export interface PumpListResponse {
  type: 'list';
  motors: Array<{ id: number; state: number }>;
}

// ===== Motor State Enum =====

export const MotorStateNames: Record<number, string> = {
  0: 'OFFLINE',
  1: 'FAULT',
  2: 'READY',
  3: 'STARTING',
  4: 'RUNNING',
  5: 'E-STOP',
};
