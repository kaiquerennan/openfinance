import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PluggyModule } from '../pluggy/pluggy.module';
import { AlertsModule } from '../alerts/alerts.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [PluggyModule, AlertsModule, CategoriesModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
