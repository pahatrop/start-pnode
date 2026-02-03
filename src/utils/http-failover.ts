import dns2 from "dns2";
import axios, { Method } from "axios";
import https from "https";

const dnsResolver = new dns2();

export async function httpFailover<T>(options: {
  domain: string;
  method: Method;
  path: string;
  data?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const { domain, method, path, data, timeoutMs = 4000 } = options;

  const { answers } = await dnsResolver.resolveA(domain);

  const ips = answers.reduce<string[]>(
    (acc, { address }) => (address ? [address, ...acc] : acc),
    []
  );

  if (ips.length === 0) {
    throw new Error("DNS A-records not found");
  }

  let lastError: unknown;

  for (const ip of ips) {
    try {
      const agent = new https.Agent({
        servername: domain,
      });

      const response = await axios.request<T>({
        method,
        url: `https://${ip}${path}`,
        data,
        timeout: timeoutMs,
        httpsAgent: agent,
        headers: {
          Host: domain,
        },
      });

      return response.data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("All IPs failed");
}
