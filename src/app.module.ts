import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IcnModule } from './icn/icn.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [IcnModule, LoggerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
