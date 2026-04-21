// ===== Device Types =====

export type DeviceType = 'pump' | 'treadmill';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  ip: string;
  port: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceCreateInput {
  name: string;
  type: DeviceType;
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
  | { type: 'device_status'; deviceId: string; data: DeviceStatus }
  | { type: 'device_connection'; deviceId: string; connected: boolean }
  | { type: 'error'; message: string };

// ===== Device Status (generic; type-discriminated by device_type) =====

// Any JSON status object (gateway is pass-through)
export type DeviceStatus = PumpStatus | TreadmillStatus | Record<string, unknown>;

// ===== Pump Status (from ESP32 pump firmware) =====

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
  device_type?: 'pump';
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

// ===== Treadmill Status (小动物跑步机固件) =====

export type TreadmillState = 'idle' | 'running' | 'paused' | 'estopped';

export interface TreadmillSettings {
  target_speed_mps: number;
  fwd: boolean;
  target_time_sec: number;
}

export interface TreadmillRuntime {
  cur_speed_mps: number;
  elapsed_sec: number;
  distance_m: number;
  target_distance_m: number;
}

export interface TreadmillStatus {
  type: 'status';
  device_type: 'treadmill';
  uptime: number;
  wifi: boolean;
  state: TreadmillState;
  settings: TreadmillSettings;
  runtime: TreadmillRuntime;
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
