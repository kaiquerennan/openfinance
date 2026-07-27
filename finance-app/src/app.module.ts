import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { PluggyModule } from './pluggy/pluggy.module';
import { SyncModule } from './sync/sync.module';
import { ConnectModule } from './connect/connect.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PlanningModule } from './planning/planning.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    PrismaModule,
    PluggyModule,
    SyncModule,
    ConnectModule,
    AnalyticsModule,
    PlanningModule,
  ],
})
export class AppModule {}
