import * as net from "net";

export interface SpeedTestResult {
  ip: string;
  time: number;
  success: boolean;
}

export async function measureSpeed(
  ip: string,
  port: number,
  timeout: number,
): Promise<SpeedTestResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    let finished = false;

    const end = (result: SpeedTestResult) => {
      if (finished) {
        return;
      }
      finished = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeout);

    socket.once("connect", () => {
      end({ ip, time: Date.now() - start, success: true });
    });

    socket.once("timeout", () => {
      end({ ip, time: timeout, success: false });
    });

    socket.once("error", () => {
      end({ ip, time: timeout, success: false });
    });

    socket.connect(port, ip);
  });
}
