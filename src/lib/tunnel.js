import dns from "dns2";
import tls from "tls";
import net from "net";
import { EventEmitter } from "node:events";

const CONTROL_CONNECTION_TYPE = "1";
const SESSION_CONNECTION_TYPE = "2";

export class Tunnel extends EventEmitter {
  #isWorking = false;
  #gatewaySubdomain = "agent-gateway";
  #domain;
  #gatewayPort;
  #localPort;
  #projectId;
  #agentId;
  #agentAccessToken;
  #rejectUnauthorized;
  #testMode;
  #reconnection;

  constructor(options) {
    super();
    this.#domain = options.domain;
    this.#gatewayPort = options.gatewayPort;
    this.#localPort = options.localPort;
    this.#projectId = options.projectId;
    this.#agentId = options.agentId;
    this.#agentAccessToken = options.agentAccessToken;
    this.#rejectUnauthorized = options.rejectUnauthorized ?? true;
    this.#testMode = options.testMode ?? false;
    this.#reconnection = options.reconnection ?? {
      timeout: 5_000,
      retries: 3,
    };
  }

  start(remoteHost) {
    this.#isWorking = true;

    if (remoteHost) {
      this.#startControlConnection(remoteHost);
      return;
    }

    this.#findFastestGateway().then((host) =>
      this.#startControlConnection(host)
    );
  }

  stop() {
    this.#isWorking = false;

    if (this.remoteSocket) {
      this.remoteSocket.end();
    }
  }

  #startControlConnection(remoteHost, retry = 0) {
    this.remoteSocket = tls.connect(
      {
        host: remoteHost,
        ...this.#getTlsOptions(),
      },
      () => {
        this.emit("started");
        console.log(`Connected to ${remoteHost} via TLS`);
        this.remoteSocket.write(
          CONTROL_CONNECTION_TYPE +
            this.#projectId +
            this.#agentId +
            this.#agentAccessToken
        );
      }
    );

    this.remoteSocket.on("data", (data) => {
      const idLength = 36;
      const message = data.toString();

      for (let i = 0; i + idLength <= message.length; i += idLength) {
        const sessionId = message.slice(i, i + idLength);
        console.log(`Session ID: ${sessionId}`);
        this.#createSession(remoteHost, sessionId);
      }
    });

    this.remoteSocket.on("close", () => {
      console.log("Control connection closed");
      this.emit("stopped");

      if (this.#isWorking && retry <= this.#reconnection.retries) {
        console.log(`Reconnection timeout at: ${this.#reconnection.timeout}ms`);
        setTimeout(
          () => this.#startControlConnection(remoteHost, retry + 1),
          this.#reconnection.timeout
        );
      }
    });

    this.remoteSocket.on("error", (err) => {
      console.error("Control connection error:", err);
      this.emit("error", err);
    });
  }

  async #findFastestGateway() {
    const timeout = 1000;
    const resolver = new dns();
    const { answers } = await resolver.resolveA(
      `${this.#gatewaySubdomain}.${this.#domain}`
    );

    return Promise.race(
      answers
        .filter((answer) => answer.address)
        .map(async (answer) => {
          let ok = false;
          try {
            ok = await this.#measureSpeed(
              answer.address,
              this.#gatewayPort,
              timeout
            ).then((result) => result.ok);
          } finally {
            if (!ok) {
              await new Promise((resolve) => setTimeout(resolve, timeout));
            }
          }
          return answer.address;
        })
    );
  }

  #createSession(remoteHost, sessionId) {
    const remoteSocket = tls.connect(
      {
        host: remoteHost,
        ...this.#getTlsOptions(),
      },
      () => {
        remoteSocket.write(SESSION_CONNECTION_TYPE + sessionId);

        if (this.#testMode) {
          remoteSocket.on("data", () => {
            const html = this.#htmlTemplate(remoteHost);
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
          const localSocket = net.connect(this.#localPort, "localhost");

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

  #getTlsOptions() {
    return {
      rejectUnauthorized: this.#rejectUnauthorized,
      servername: `${this.#gatewaySubdomain}-${this.#agentId}.${this.#domain}`,
      port: this.#gatewayPort,
    };
  }

  async #measureSpeed(ip, port, timeout) {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();

      let finished = false;

      const end = (result) => {
        if (finished) {
          return;
        }
        finished = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(timeout);

      socket.once("connect", () => {
        end({ ip, time: Date.now() - start, ok: true });
      });

      socket.once("timeout", () => {
        end({ ip, time: timeout, ok: false });
      });

      socket.once("error", () => {
        end({ ip, time: timeout, ok: false });
      });

      socket.connect(port, ip);
    });
  }

  #htmlTemplate(remoteHost) {
    const now = new Date().toISOString();

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>Agent Test Info</title>
              <style>
                table { border-collapse: collapse; }
                td, th { border: 1px solid #000; padding: 6px; }
              </style>
            </head>
            <body>
              <h2>Agent Test Information</h2>
              <table>
                <tr><th>Agent ID</th><td>${this.#agentId}</td></tr>
                <tr><th>Project ID</th><td>${this.#projectId}</td></tr>
                <tr><th>Domain</th><td>${this.#domain}</td></tr>
                <tr><th>Remote Host</th><td>${remoteHost}</td></tr>
                <tr><th>Current Time</th><td>${now}</td></tr>
              </table>
            </body>
            </html>
        `;
  }
}
