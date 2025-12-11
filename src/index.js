#!/usr/bin/env node

import { config } from "dotenv";
import { program, Option } from "commander";
import { version } from "./lib/version.js";
import { createTempProject } from "./lib/temp-project.js";
import { Tunnel } from "./lib/tunnel.js";

const domain = "pnode.site";
const apiUrl = `https://api.${domain}`;

config({ quiet: true });
program
  .name("pnode")
  .description("CLI for launching http tunnel")
  .version(version);

program
  .command("run", { isDefault: true })
  .description("Start local tunnel")
  .addOption(new Option("--project <id>", "Project id").env("PROJECT_ID"))
  .addOption(new Option("--agent <id>", "Agent id").env("AGENT_ID"))
  .addOption(new Option("--token <token>", "Agent token").env("AGENT_TOKEN"))
  .addOption(
    new Option("--port <port>", "Local forwarded port")
      .default(3000)
      .env("LOCAL_PORT")
  )
  .addOption(new Option("-t, --test", "Test mode").env("TEST_MODE"))
  .action(async (options) => {
    const testMode = !!options.test;
    const localPort = Number(options.port);

    if (!(localPort > 0 && localPort < 65535)) {
      throw new Error("Invalid port");
    }

    let projectId = options.project;
    let agentId = options.agent;
    let agentAccessToken = options.token;

    if (!projectId || !agentId || !agentAccessToken) {
      console.log("Starting temporary tunnel");

      const tmpProject = await createTempProject(apiUrl);
      projectId = tmpProject.id;
      agentId = tmpProject.agentId;
      agentAccessToken = tmpProject.agentAccessToken;

      console.log(`Created project https://${tmpProject.name}.${domain}`);
    }

    const proxy = new Tunnel({
      domain,
      gatewayPort: 50000,
      localPort,
      projectId,
      agentId,
      agentAccessToken,
      rejectUnauthorized: false,
      testMode,
    });

    proxy.start();

    process.on("exit", () => proxy.stop());
    process.on("SIGINT", () => proxy.stop());
  });

program.parse();
