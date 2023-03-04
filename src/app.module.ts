import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IcnmoduleModule } from './icnmodule/icnmodule.module';
import { IcnModule } from './icn/icn.module';

@Module({
  imports: [IcnmoduleModule, IcnModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
