import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { PluggyModule } from '../pluggy/pluggy.module';

@Module({
  imports: [PluggyModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
