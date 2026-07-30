import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
