import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AnalyticsModule } from '../analytics/analytics.module';
import { InstallmentsModule } from '../installments/installments.module';
import { CardsModule } from '../cards/cards.module';

@Module({
  imports: [AnalyticsModule, InstallmentsModule, CardsModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
