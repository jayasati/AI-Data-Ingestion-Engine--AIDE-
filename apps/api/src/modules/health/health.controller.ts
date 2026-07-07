import type { Request, Response } from "express";
import { buildSuccess, requestMetadata } from "@/core/http/api-response";
import type { IHealthService } from "@/modules/health/health.service";

export class HealthController {
  constructor(private readonly healthService: IHealthService) {}

  getHealth = (req: Request, res: Response): void => {
    res
      .status(200)
      .json(buildSuccess(req.requestId, this.healthService.getHealth(), requestMetadata(req)));
  };
}
