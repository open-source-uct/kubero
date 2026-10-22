import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';
import { MetricsAuthGuard } from './metrics-auth.guard';

@Controller('metrics')
export class StatusController extends PrometheusController {
  @Get()
  @UseGuards(MetricsAuthGuard)
  async index(@Res({ passthrough: true }) response: Response) {
    return super.index(response);
  }
}

// The Prometheus module historically mounted the custom controller at /metrics.
// Keep that scrape URL and expose /status with exactly the same guarded method.
@Controller('status')
export class StatusAliasController extends StatusController {}
