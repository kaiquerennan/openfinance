import { Controller, Get } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /**
   * GET /alerts/anomalies — gastos recentes fora do padrao do proprio
   * historico.
   *
   * O aviso tambem sai por notificacao, mas depender so dela deixaria a
   * deteccao invisivel para quem nao configurou canal nenhum — e o dado
   * continua util na tela.
   */
  @Get('anomalies')
  anomalies() {
    return this.alerts.anomalies();
  }
}
