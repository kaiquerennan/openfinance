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

  /**
   * GET /analytics/series — renda, consumo e categorias por mes.
   * ?months=12 (default) e ?accountId= opcionais.
   */
  @Get('series')
  series(@Query('months') months?: string, @Query('accountId') accountId?: string) {
    const take = Math.min(Math.max(Number(months) || 12, 1), 36);
    return this.analytics.series(take, accountId);
  }

  /** GET /analytics/months — meses disponiveis para analise. */
  @Get('months')
  months(@Query('accountId') accountId?: string) {
    return this.analytics.availableMonths(accountId);
  }
}
