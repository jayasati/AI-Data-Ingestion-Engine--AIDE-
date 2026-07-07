export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}
