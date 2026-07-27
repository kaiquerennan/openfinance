import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [AnalyticsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
