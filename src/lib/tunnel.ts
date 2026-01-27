import dns2 from "dns2";
import * as tls from "tls";
import * as net from "net";
import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import { TunnelOptions } from "../types";
import { DEFAULT_CONFIG } from "../config/default";
import { measureSpeed } from "../utils/measure-speed";
import { htmlTemplate } from "../utils/html-template";

const SESSION_CONNECTION_CODE = "2";
const CONTROL_CONNECTION_CODE_FULL_AUTH = "1";
const CONTROL_CONNECTION_CODE_TOKEN_ONLY = "3";

interface TunnelEvents {
  started: [];
  stopped: [];
  error: [Error];
}

export class Tunnel extends EventEmitter<TunnelEvents> {
  private isWorking = false;
  private gatewaySubdomain = "agent-gateway";
  private readonly rootDomain: string;
  private readonly gatewayPort: number;
  private readonly localPort: number;
  private readonly localHost: string;
  private readonly projectId?: string;
  private readonly agentId?: string;
  private readonly agentAccessToken?: string;
  private sessionId?: string;
  private readonly rejectUnauthorized: boolean;
  private readonly testMode: boolean;
  private reconnection: { timeout: number; retries: number };
  private remoteSocket?: tls.TLSSocket;

  constructor(options: TunnelOptions) {
    super();
    this.rootDomain = options.domain || DEFAULT_CONFIG.domain;
    this.gatewayPort = options.gatewayPort || DEFAULT_CONFIG.gatewayPort;
    this.localPort = options.localPort;
    this.localHost = options.localHost || "localhost";
    this.projectId = options.projectId || undefined;
    this.agentId = options.agentId || undefined;
    this.agentAccessToken = options.agentAccessToken || undefined;
    this.rejectUnauthorized = options.rejectUnauthorized ?? true;
    this.testMode = options.testMode ?? false;
    this.reconnection = options.reconnection ?? {
      timeout: 3_000,
      retries: 3,
    };
  }

  start(remoteHost?: string): void {
    this.isWorking = true;

    if (remoteHost) {
      this.startControlConnection([remoteHost]);
      return;
    }

    this.findGateways().then((hosts) => this.startControlConnection(hosts));
  }

  stop(): void {
    this.isWorking = false;

    if (this.remoteSocket) {
      this.remoteSocket.end();
    }
  }

  private startControlConnection(hosts: string[], retry = 0): void {
    const [host] = hosts;

    console.log(`Trying to start connection ${host}`);
    this.sessionId = uuidv4();

    const options = {
      host,
      ...this.getTlsOptions(),
    };
    this.remoteSocket = tls.connect(options, () => {
      this.emit("started");
      console.log(`Connected to ${options.servername} (${host}) via TLS`);

      if (this.projectId && this.agentId && this.agentAccessToken) {
        this.remoteSocket!.write(
          CONTROL_CONNECTION_CODE_FULL_AUTH +
            this.projectId +
            this.agentId +
            this.agentAccessToken
        );
      } else {
        this.remoteSocket!.write(
          CONTROL_CONNECTION_CODE_TOKEN_ONLY + this.agentAccessToken
        );
      }
    });

    this.remoteSocket.on("data", (data) => {
      const idLength = 36;
      const message = data.toString();

      for (let i = 0; i + idLength <= message.length; i += idLength) {
        const sessionId = message.slice(i, i + idLength);
        console.log(`Session ID: ${sessionId}`);
        this.createSession(host!, sessionId);
      }
    });

    this.remoteSocket.on("close", () => {
      console.log("Control connection closed");
      this.emit("stopped");
    });

    this.remoteSocket.on("error", (err) => {
      console.error("Control connection error:", err.message);

      if (this.isWorking && retry <= this.reconnection.retries) {
        console.log(`Reconnection timeout at: ${this.reconnection.timeout}ms`);

        setTimeout(
          () =>
            this.startControlConnection(
              [...hosts.slice(1), hosts[0]!],
              retry + 1
            ),
          this.reconnection.timeout
        );
      }
    });
  }

  private async findGateways(): Promise<string[]> {
    const timeout = 2000;
    const resolver = new dns2();
    const { answers } = await resolver.resolveA(
      `${this.gatewaySubdomain}.${this.rootDomain}`
    );

    const liveGateways: string[] = [];

    await Promise.all(
      answers
        .filter((answer: any) => answer.address)
        .map(async (answer: any) => {
          let alive = false;

          try {
            alive = await measureSpeed(
              answer.address!,
              this.gatewayPort,
              timeout
            ).then((result) => result.success);

            if (alive) {
              liveGateways.push(answer.address!);
            }
          } finally {
            if (!alive) {
              console.log(
                `Gateway ${answer.address} is not responding. Skipping...`
              );
            }
          }
        })
    );

    return liveGateways;
  }

  private createSession(remoteHost: string, sessionId: string): void {
    const remoteSocket = tls.connect(
      {
        host: remoteHost,
        ...this.getTlsOptions(),
      },
      () => {
        remoteSocket.write(SESSION_CONNECTION_CODE + sessionId);

        if (this.testMode) {
          remoteSocket.on("data", () => {
            const html = htmlTemplate(
              remoteHost,
              this.agentId,
              this.projectId,
              this.rootDomain
            );
            const response =
              "HTTP/1.1 200 OK\r\n" +
              "Content-Type: text/html; charset=UTF-8\r\n" +
              `Content-Length: ${Buffer.byteLength(html)}\r\n` +
              "Connection: close\r\n" +
              "\r\n" +
              html;

            remoteSocket.write(response);
            remoteSocket.end();
          });
        } else {
          const localSocket = net.connect(this.localPort, this.localHost);
          remoteSocket.pipe(localSocket);
          localSocket.pipe(remoteSocket);

          localSocket.on("error", (err) => {
            console.error("Local service error:", err.message);
          });

          remoteSocket.on("error", (err) => {
            console.error("Remote proxy error:", err.message);
          });

          remoteSocket.on("close", () => localSocket.end());
          localSocket.on("close", () => remoteSocket.end());
        }
      }
    );

    remoteSocket.on("error", (err) => {
      console.error("Session connection error:", err.message);
    });
  }

  private getTlsOptions(): {
    rejectUnauthorized: boolean;
    servername: string;
    port: number;
  } {
    return {
      rejectUnauthorized: this.rejectUnauthorized,
      servername: `${this.gatewaySubdomain}-${this.sessionId || "unknown"}.${
        this.rootDomain
      }`,
      port: this.gatewayPort,
    };
  }
}
