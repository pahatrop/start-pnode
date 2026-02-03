#!/usr/bin/env node

import { config } from "dotenv";
import { Option, program } from "commander";
import { version } from "./types/version";
import { createTempProject } from "./lib/temp-project";
import { Tunnel } from "./lib/tunnel";
import { DEFAULT_CONFIG } from "./config/default";
import { CreateTunnelOptions, PNodeError, TunnelInstance } from "./types";

config({ quiet: true });

/**
 * Create and start a tunnel
 */
async function createTunnel(
  options: CreateTunnelOptions
): Promise<TunnelInstance> {
  const {
    localPort,
    localHost = "localhost",
    token,
    testMode = false,
  } = options;

  if (!testMode && !(localPort > 0 && localPort < 65535)) {
    throw new PNodeError("Invalid port number");
  }

  let projectId: string | undefined = undefined;
  let agentId: string | undefined = undefined;
  let agentAccessToken: string | undefined = token;

  if (!agentAccessToken) {
    console.log("Starting temporary tunnel");
    const tmpProject = await createTempProject(DEFAULT_CONFIG.apiDomain);
    projectId = tmpProject.id || undefined;
    agentId = tmpProject.agentId || undefined;
    agentAccessToken = tmpProject.agentAccessToken || undefined;
    console.log(
      `Created project https://${tmpProject.name}.${DEFAULT_CONFIG.mainDomain}`
    );
  }

  return new Tunnel({
    domain: DEFAULT_CONFIG.mainDomain,
    gatewayPort: DEFAULT_CONFIG.gatewayPort,
    localPort,
    localHost,
    projectId,
    agentId,
    agentAccessToken,
    rejectUnauthorized: true,
    testMode,
  });
}

/**
 * Create and start a tunnel with automatic cleanup
 */
async function startTunnel(
  options: CreateTunnelOptions
): Promise<TunnelInstance> {
  const tunnel = await createTunnel(options);

  tunnel.start();

  // Setup graceful shutdown
  const stopApp = () => {
    tunnel.stop();
    setTimeout(() => process.exit(0), 3_000);
  };

  process.on("exit", stopApp);
  process.on("SIGINT", stopApp);
  process.on("SIGTERM", stopApp);

  return tunnel;
}

// CLI functionality - always run when called as bin
program
  .name("pnode")
  .description("CLI for launching http tunnel")
  .version(version);

program
  .command("run", { isDefault: true })
  .description("Start local tunnel")
  .addOption(new Option("--token <token>", "Agent token").env("AGENT_TOKEN"))
  .addOption(
    new Option("--port <port>", "Local forwarded port")
      .default(3000)
      .env("LOCAL_PORT")
  )
  .addOption(
    new Option("--host <host>", "Local forwarded host")
      .default("localhost")
      .env("LOCAL_HOST")
  )
  .addOption(new Option("-t, --test", "Test mode").env("TEST_MODE"))
  .action(
    async (options: {
      token?: string;
      port?: number;
      host?: string;
      test?: boolean;
    }) => {
      try {
        const tunnelOptions = {
          localPort: options.port || 3000,
          localHost: options.host || "localhost",
          token: options.token,
          testMode: options.test || false,
        };

        const tunnel = await startTunnel(tunnelOptions);

        tunnel.on("started", () => {
          console.log("Tunnel started successfully");
        });

        tunnel.on("stopped", () => {
          console.log("Tunnel stopped");
        });

        tunnel.on("error", (error: Error) => {
          console.error("Tunnel error:", error.message);
          process.exit(1);
        });
      } catch (error) {
        console.error(
          "Failed to start tunnel:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    }
  );

program.parse();
