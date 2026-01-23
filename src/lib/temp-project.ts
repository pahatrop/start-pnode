import axios, { AxiosError } from "axios";
import * as os from "os";
import * as crypto from "crypto";
import { version } from "../types/version";
import { DeviceInfo, TempProjectResponse, ProjectError } from "../types";

function getDeviceInfo(): DeviceInfo {
  const nets = os.networkInterfaces();
  const macs = Object.values(nets)
    .flat()
    .filter((net): net is os.NetworkInterfaceInfo => Boolean(net))
    .map((n) => n.mac)
    .filter(
      (mac): mac is string => Boolean(mac) && mac !== "00:00:00:00:00:00"
    );

  const meta = JSON.stringify({
    hostname: os.hostname(),
    arch: os.arch(),
    platform: os.platform(),
    tz: new Date().getTimezoneOffset(),
    version,
  });

  const deviceId = crypto
    .createHash("sha256")
    .update([meta, ...macs].join())
    .digest("hex");

  return { deviceId, meta };
}

export async function createTempProject(
  apiUrl: string
): Promise<TempProjectResponse> {
  const { deviceId, meta } = getDeviceInfo();

  try {
    const response = await axios.post<TempProjectResponse>(
      `${apiUrl}/projects/ephemeral`,
      {
        deviceId,
        meta,
      }
    );

    const { id, name, agentId, agentAccessToken, expiredTimestamp } =
      response.data;

    if (!id || !agentId || !agentAccessToken) {
      throw new ProjectError("Incorrect response from server");
    }

    return { id, name, agentId, agentAccessToken, expiredTimestamp };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        console.error(axiosError.response.data);
      }

      throw new ProjectError(
        `Project creation failed: ${axiosError.message}`,
        axiosError.response?.status
      );
    }

    throw new ProjectError(
      `Project creation error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
