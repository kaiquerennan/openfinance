import { Controller, Get, Query } from '@nestjs/common';
import { InstallmentsService } from './installments.service';

@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installments: InstallmentsService) {}

  /**
   * GET /installments — compras parceladas em aberto e o quanto de cada mes
   * futuro elas ja ocupam. ?months=6 define o tamanho do cronograma.
   */
  @Get()
  overview(@Query('months') months?: string) {
    const horizon = Math.min(Math.max(Number(months) || 6, 1), 24);
    return this.installments.overview(horizon);
  }
}
