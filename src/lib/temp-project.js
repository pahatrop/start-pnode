import axios from "axios";
import os from "os";
import crypto from "crypto";
import { version } from "./version.js";

function getDeviceInfo() {
  const nets = os.networkInterfaces();
  const macs = Object.values(nets)
    .flat()
    .filter(Boolean)
    .map((n) => n.mac)
    .filter((mac) => mac && mac !== "00:00:00:00:00:00");

  const meta = JSON.stringify({
    hostname: os.hostname(),
    arch: os.arch(),
    platform: os.platform(),
    tz: new Date().getTimezoneOffset(),
    version,
  });

  const deviceId = crypto
    .createHash("sha1")
    .update([meta, ...macs].join())
    .digest("hex");

  return { deviceId, meta };
}

export async function createTempProject(apiUrl) {
  const { deviceId, meta } = getDeviceInfo();

  try {
    const { id, name, agentId, agentAccessToken, expiredTimestamp } =
      await axios
        .post(`${apiUrl}/projects/ephemeral`, {
          deviceId,
          meta,
        })
        .then((response) => response.data);

    if (!id || !agentId || !agentAccessToken) {
      throw new Error("Incorrect response");
    }

    return { id, name, agentId, agentAccessToken, expiredTimestamp };
  } catch (error) {
    console.error(error.response.data);
    throw new Error("Project creating error");
  }
}
