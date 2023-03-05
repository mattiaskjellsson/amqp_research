import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class Logger extends ConsoleLogger {
  constructor() {
    super();
  }

  error(message: any, stack?: string, context?: string) {
    // send emails and stuff
    super.error(message, stack, context);
  }
}