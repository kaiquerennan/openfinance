import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { ManualController } from './manual.controller';

@Module({
  controllers: [PlanningController, ManualController],
})
export class PlanningModule {}
