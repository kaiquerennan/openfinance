import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AnalyticsModule } from '../analytics/analytics.module';
import { InstallmentsModule } from '../installments/installments.module';

@Module({
  imports: [AnalyticsModule, InstallmentsModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
