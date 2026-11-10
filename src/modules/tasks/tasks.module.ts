import { Module } from '@nestjs/common';
import { SystemQueueModule } from 'src/modules/queue/system/system-queue.module';
import { SystemTask } from './system/system.task';

@Module({
  imports: [SystemQueueModule],
  providers: [SystemTask],
})
export class TasksModule {}
