import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { setTimeout } from 'timers/promises';
import { Logger } from '../logger/logger.service';
import { AwaitableSender, Connection, ConnectionOptions, Delivery, EventContext, Sender, SenderOptions } from 'rhea-promise';
import * as fs from 'fs';

enum ConnectionType {
  deliveries = 'deliveries',
  subscriptions = 'subscriptions',
}

@Injectable()
export class IcnService {
  private readonly clientCommonName: string;
  private readonly ca: Buffer;
  private readonly cert: Buffer;
  private readonly key: Buffer;
  private setupDone = false; 
  constructor(
    private readonly log: Logger,
    private readonly config: ConfigService,
    private readonly https: HttpService,
  ) {
    this.clientCommonName = this.config.get<string>('client_common_name');
    const keyFile = config.get<string>('key_file');
    const certFile = config.get<string>('cert_file');
    const chainFile = config.get<string>('ca_file');
    
    this.ca = fs.readFileSync(chainFile);
    this.cert = fs.readFileSync(certFile);
    this.key = fs.readFileSync(keyFile);

    this.clearDeliverables();
  }

  private async clearDeliverables() {
    const result = await lastValueFrom(this.https.get(`${this.clientCommonName}/${ConnectionType.deliveries}`));

    await Promise.all(result.data[ConnectionType.deliveries].map(d => {
      lastValueFrom(this.https.delete(d.path));
    }));

    this.setupDone = true;
  }

  private _messageId = 0;
  private messageId(): number {
    return this._messageId++;
  }
  public async insertMessage(
    message: Uint8Array,
  ): Promise<any> {
    while (!this.setupDone) {
      await setTimeout(1000);
    }

    const r1 = await lastValueFrom(this.https.get(`${this.clientCommonName}/${ConnectionType.deliveries}`));
    
    let address = '';
    if(r1.data[ConnectionType.deliveries]?.length > 0) {
      address = r1.data.deliveries[0].path;
    } else {
      const r2 = await lastValueFrom(
        this.https.post(
          `${this.clientCommonName}/${ConnectionType.deliveries}`, 
          { name: `${this.clientCommonName}`, 
            version: '1.1.0',
            deliveries: [{ selector: ''}]
          }));
      
      const d = r2.data[ConnectionType.deliveries][0];
      address = d.path; 
    }

    const r3 = await this.getEndpointsWithRetries(address);
    const {host, port, target} = r3.endpoints[0];

    return await this.sendMessage(host, port, target, message.buffer.slice(0, message.byteLength));
  }

  private async sendMessage(host: string, port: number, target: string, messageBuffer: ArrayBufferLike) {
    this.log.debug('Send message');

    const connection = new Connection(this.connectionOptions(host, port, target));
    
    await connection.open();
    
    this.log.debug('Connection open');
    
    const sender: AwaitableSender = await connection.createAwaitableSender(this.senderOptions('sender-1', target));

    this.log.debug('Sender created');

    const delivery: Delivery = await sender.send({
      body: messageBuffer,
      message_id: this.messageId(),
    });
    
    this.log.debug(`>>>>>[Delivery id: ${delivery.id}, settled: ${delivery.settled}`);

    await sender.close();
    await connection.close();

    this.log.debug('Close connection and sender');

    return delivery;
  }

  private connectionOptions(host: string, port: number, target: string) {
    const connectionOptions: ConnectionOptions = {
      transport: "tls",
      host: host,
      hostname: host,
      port: port,
      reconnect: true,
      key: this.key,
      cert: this.cert,
      ca: [this.ca],
      sender_options: { 
        target: {
          address: target
        } 
      },
    };
    return connectionOptions;
  }

  private senderOptions(senderName: string, target: any): SenderOptions {
    return {
      name: senderName,
      target: {
        address: target
      },
      onAccepted: (context: EventContext) => { this.log.debug(`${senderName} onAccepted`); },
      onClose: (context: EventContext) => { this.log.debug(`${senderName} onClose`); },
      onRejected: (context: EventContext) => { this.log.debug(`${senderName} onRejected`); },
      onReleased: (context: EventContext) => { this.log.debug(`${senderName} onReleased`); },
      onSessionClose: (context: EventContext) => { this.log.debug(`${senderName} onSessionClose`); },
      onError: (context: EventContext) => {
        const senderError = context.sender && context.sender.error;
        if (senderError) {
          this.log.debug(`>>>>> [An error occurred for sender '${senderName}': %O.`, senderError);
        }
      },
      onSessionError: (context: EventContext) => {
        const sessionError = context.session && context.session.error;
        if (sessionError) {
          this.log.debug(`>>>>> [An error occurred for session of sender '${senderName}': %O.`, sessionError);
        }
      }
    };
  }

  private async getEndpointsWithRetries(uri: string) {
    let res = await lastValueFrom(this.https.get(uri));
    
    while (res.data['endpoints']?.length === 0 || res.data.status !== 'CREATED') {
      res = await setTimeout(100, await lastValueFrom(this.https.get(uri)));
    }

    return res.data;
  }
}
