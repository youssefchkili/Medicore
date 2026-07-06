import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderCron } from './reminder.cron';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, ReminderCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
