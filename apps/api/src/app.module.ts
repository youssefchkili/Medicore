import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { AdminModule } from './admin/admin.module';
import { AiProxyModule } from './ai-proxy/ai-proxy.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SpecialtiesModule,
    AppointmentsModule,
    NotificationsModule,
    MedicalRecordsModule,
    AdminModule,
    AiProxyModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
