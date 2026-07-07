import { AIDE_VERSION, type HealthResponse } from "@aide/shared-types";
import { SERVICE_NAME, type AppConfig } from "@/config";

export interface IHealthService {
  getHealth(): HealthResponse;
}

export class HealthService implements IHealthService {
  constructor(private readonly config: AppConfig) {}

  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: SERVICE_NAME,
      version: AIDE_VERSION,
      environment: this.config.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
