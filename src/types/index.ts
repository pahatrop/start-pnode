import { EventEmitter } from "node:events";

export interface DeviceInfo {
  deviceId: string;
  meta: string;
}

export interface TempProjectResponse {
  id: string;
  name: string;
  agentId: string;
  agentAccessToken: string;
  expiredTimestamp?: number;
}

export interface TunnelOptions {
  domain?: string;
  gatewayPort?: number;
  localPort: number;
  localHost?: string;
  projectId?: string;
  agentId?: string;
  agentAccessToken?: string;
  rejectUnauthorized?: boolean;
  testMode?: boolean;
  reconnection?: { timeout: number; retries: number };
}

export interface TunylConfig {
  apiUrl: string;
  domain: string;
  gatewayPort: number;
}

export interface CreateTunnelOptions {
  localPort: number;
  localHost?: string;
  token?: string;
  testMode?: boolean;
}

export interface TunnelInstance extends EventEmitter {
  start(remoteHost?: string): void;
  stop(): void;
}

export class TunylError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "TunylError";
  }
}

export class TunnelError extends TunylError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "TunnelError";
  }
}

export class ProjectError extends TunylError {
  constructor(message: string, statusCode?: number) {
    super(message, "PROJECT_ERROR", statusCode);
    this.name = "ProjectError";
  }
}
