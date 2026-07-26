import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /analytics/report — relatorio completo de consultor.
   * ?month=YYYY-MM (default: ultimo mes) e ?accountId= opcionais.
   */
  @Get('report')
  report(@Query('month') month?: string, @Query('accountId') accountId?: string) {
    return this.analytics.report(month, accountId);
  }

  /** GET /analytics/months — meses disponiveis para analise. */
  @Get('months')
  months(@Query('accountId') accountId?: string) {
    return this.analytics.availableMonths(accountId);
  }
}
