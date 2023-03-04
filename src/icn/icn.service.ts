import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, from, lastValueFrom, map } from 'rxjs';
import { setTimeout } from 'timers/promises';
import * as rhea from 'rhea';
import * as fs from 'fs';

enum ConnectionType {
  deliveries = 'deliveries',
  subscriptions = 'subscriptions',
}

@Injectable()
export class IcnService {
  private readonly clientCommonName: string;
  private container: rhea.Container;
  private connection: rhea.Connection;
  private sender: rhea.Sender;

  constructor(
    private readonly config: ConfigService,
    private readonly https: HttpService,
  ) {
    this.clientCommonName = this.config.get<string>('client_common_name');
  }

  public async insertMessage(
    message: Uint8Array,
  ): Promise<any> {
    const r1 = await lastValueFrom(this.https.get(`${this.clientCommonName}/${ConnectionType.deliveries}`));
    
    var host: string; 
    var port: number; 
    var target: string;
    if(r1.data[ConnectionType.deliveries]?.length > 0) {
      const address = r1.data.deliveries[0].path;
      const r3 = await this.getEndpointsWithRetries(address, 'endpoints');
      // { host, port, target} = r3.endpoints[0];
      host = r3.endpoints[0].host;
      port = r3.endpoints[0].port;
      target = r3.endpoints[0].target;
      
      // if (!this.container) {
      //   this.container = await this.createAMQPContainer(host, port, target);
      // }

      // if (!this.connection) {
      //   this.connection = await this.createAMQPConnection(host, port, target);
      // } 
       
      // if (!this.sender) {
      //   this.sender = this.connection.open_sender({target: { address: target, }});
      //   this.sender.set_target({ address: target })
      // }
    } else {
      const r2 = await lastValueFrom(
        this.https.post(
          `${this.clientCommonName}/${ConnectionType.deliveries}`, 
          { name: `${this.clientCommonName}`, 
            version: '1.1.0',
            deliveries: [{ selector: ''}]
          }));
      
      const d = r2.data[ConnectionType.deliveries][0];

      const r3 = await this.getEndpointsWithRetries(d.path, 'endpoints');
      // { host, port, target} = r3.endpoints[0];
      host = r3.endpoints[0].host;
      port = r3.endpoints[0].port;
      target = r3.endpoints[0].target;
      // this.container = await this.createAMQPContainer(host, port, target);
      // this.connection = await this.createAMQPConnection(host, port, target);
      // this.sender = this.connection.open_sender({ target: { address: target }});
      // this.sender.set_target({ address: target});
    }

    // this.sender.open();

    // if (!this.sender.is_open()) {
    //   this.sender.open();

    //   while(!this.sender.is_open()) {
    //     await setTimeout(1000);
    //   }
    // }

    // this.sender.send({ body: message.buffer});

    this.container = rhea.create_container();
    this.container.on('message', function (context) {
        console.log(context.message.body);
        context.connection.close();
    });
    this.container.once('sendable', function (context) {
        context.sender.send({body:'Hello World!'});
    });

    this.container.on('disconnect', (context) => {
      console.log('disconnect');
    });

    var connection = await this.createAMQPConnection(host, port, target); //this.container.connect({'port':5672});

    if (!connection.is_open()) {
      connection.open_sender(target);
    }
  }

  private async createAMQPConnection(host: string, port: number, target: string) {
    const keyFile = this.config.get<string>('key_file'); 
    const certFile = this.config.get<string>('cert_file');
    const caFile = this.config.get<string>('chain_file');

    const ca = fs.readFileSync(caFile);
    const cert = fs.readFileSync(certFile);
    const key = fs.readFileSync(keyFile);

    const opts: rhea.ConnectionOptions = {
      host: host,
      port: port,
      transport: 'tls',
      key: key,
      cert: cert,
      ca: [ca],
      hostname: `${host}`,
      sender_options: { 
        target: {
          address: target
        } 
      },
    };

    const connection = this.container.connect(opts);
    return connection;
  }

  private async createAMQPContainer(host: string, port: number, target: string) {
    const container = rhea.create_container();
    
    container.on('connection_open', function (context) {
      console.log('Connection open');
      // context.connection.open_sender({
      //   target: {
      //     address: target,
      //     dynamic: true, 
      //     durable: false,
      //   },
      // });
    });

    container.once('sendable', function (context) {
      // context.sender.send({body:'Hello World!'});
      console.log('Container is sendable');
    });
    
    container.on('connection_open', function (context) {
      console.log('Container connection is open');
      // context.connection.open_sender({
      //   target: {
      //     address: target,
      //     dynamic: false, // Set this to false if the exchange is pre-created
      //     durable: true, // Set this to true if the exchange is durable
      //     expiry_policy: 'session-end', // Set this to the desired expiry policy
      //   },
      // });
    });

    return Promise.resolve(container);
  }

  private async getEndpointsWithRetries(uri: string, value: string = 'endpoints') {
    let res = await lastValueFrom(this.https.get(uri));
    let ctr = 0;
    
    while (res.data[value]?.length === 0 || res.data.status !== 'CREATED') {
      res = await setTimeout((++ctr) * 1000, await lastValueFrom(this.https.get(uri)));
    }

    return res.data;
  }
}
