import { Module } from '@nestjs/common';
import { PluggyService } from './pluggy.service';
import { PluggyController } from './pluggy.controller';

@Module({
  controllers: [PluggyController],
  providers: [PluggyService],
  exports: [PluggyService],
})
export class PluggyModule {}
