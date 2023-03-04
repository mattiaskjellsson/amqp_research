import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IcnService } from './icn.service';
import * as https from 'https';
import * as fs from 'fs';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (config: ConfigService) => {
        const keyFile = config.get<string>('key_file');
        const certFile = config.get<string>('cert_file');
        const chainFile = config.get<string>('chain_file');
        const ca = fs.readFileSync(chainFile);
        const c = fs.readFileSync(certFile).toString();
        const k = fs.readFileSync(keyFile).toString();
        const port = +config.get<string>('icn_rest_port');
        const host = config.get<string>('icn_base_url');

        console.log(`Port: ${port}`);
        console.log(`Host: ${host}`);

        return {
          baseURL: `https://${host}:${port}`,
          httpsAgent: new https.Agent({
            host: host,
            port: port,
            cert: c,
            key: k,
            ca: ca,
            rejectUnauthorized: true,
          }),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [IcnService,],
  exports: [IcnService],
})

export class IcnModule {}
