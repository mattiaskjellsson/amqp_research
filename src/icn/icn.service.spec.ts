import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from '../logger/logger.module';

import { IcnService } from './icn.service';
import * as fs from 'fs';
import * as https from 'https';

describe('IcnService', () => {
  let service: IcnService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IcnService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'client_common_name') { 
                return 'pilotinterchange.eu.tlex.se.dtnwi.digitaltvilling.se.se90009'; 
              } 
              else if (key == 'icn_rest_base_url') { 
                return 'https://nw3-interchange-a.tlex.se'; 
              }
              else if (key === 'key_file') { 
                return 'keys/pilotinterchange.eu.tlex.se.dtnwi.digitaltvilling.se.se90009.key.pem'; 
              }
              else if (key === 'cert_file') { 
                return 'keys/pilotinterchange.eu.tlex.se.dtnwi.digitaltvilling.se.se90009.crt.pem'; 
              }
              else if (key === 'ca_file') { 
                return 'keys/chain.pilotinterchange.eu.tlex.se.dtnwi.digitaltvilling.se.se90009.crt.pem'; 
              }

              return null;
            }
          )},
        },
      ],
      imports: [
        HttpModule.registerAsync({useFactory: () => {
          const keyFile = 'keys/pilotinterchange.eu.tlex.se.dtnwi.digitaltvilling.se.se90009.key.pem';
          const certFile = 'keys/pilotinterchange.eu.tlex.se.dtnwi.digitaltvilling.se.se90009.crt.pem';
          const chainFile = 'keys/chain.pilotinterchange.eu.tlex.se.dtnwi.digitaltvilling.se.se90009.crt.pem';
          
          const ca = fs.readFileSync(chainFile);
          const c = fs.readFileSync(certFile).toString();
          const k = fs.readFileSync(keyFile).toString();
          const port = 4443;
          const host = 'nw3-interchange-a.tlex.se'

          const options = {
            baseURL: `https://${host}:${port}`,
            baseUrl: `https://${host}:${port}`,
            httpsAgent: new https.Agent({
              host: host,
              port: port,
              cert: c,
              key: k,
              ca: ca,
              rejectUnauthorized: true,
            }),
          };
          return options;
        
        }}),
        LoggerModule, 
        ConfigModule, 
        HttpModule
      ], 
    })
    .compile();

    service = module.get<IcnService>(IcnService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Should send a message', async () => {
    jest.setTimeout(100000);
    const a =  await service.insertMessage(new Uint8Array(2).fill(1, 0, 1));
    expect(a).toBe(1); //
  });

  it("Test that environment variable is read", () => {
    const e = process.env.DEBUG;
    expect(e).toEqual('rhea:*,rhea-promise*');
  })
});
