#!/usr/bin/env node

const tls = require("tls");
const net = require("net");
const https = require("https");

const API_URL = "https://agent-gateway.pnode.site/resolve";
const REMOTE_PORT = 90;
const CONTROL_CONNECTION_TYPE = "1";
const SESSION_CONNECTION_TYPE = "2";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].substring(2);
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        console.error(`Missing value for argument --${key}`);
        process.exit(1);
      }
      args[key] = value;
      i++;
    } else if (argv[i].startsWith("-")) {
      const key = argv[i].substring(1);

      args[key] = true;
      i++;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: node script.js --project <projectId> --port <localPort>

Environment variables required:
  AGENT_ID       Agent identifier
  AGENT_TOKEN    Agent authentication token

Arguments:
  --project       Project ID to connect to
  --port          Local port to forward traffic to
  -test           Test client response
`);
  process.exit(0);
}

const args = parseArgs(process.argv);

if (
  !args.project ||
  (!args.port && !args.test) ||
  !process.env.AGENT_ID ||
  !process.env.AGENT_TOKEN
) {
  printHelp();
}

const projectId = args.project;
const localPort = parseInt(args.port, 10);
const agentId = process.env.AGENT_ID;
const agentToken = process.env.AGENT_TOKEN;

function fetchProxyAddress() {
  return new Promise((resolve, reject) => {
    https
      .get(API_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch address: ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.address) {
              reject(new Error("Invalid JSON response: missing 'address'"));
              return;
            }
            resolve(parsed.address);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function createProxySession(remoteHost, sessionId) {
  const tlsOptions = {
    rejectUnauthorized: true,
    servername: remoteHost,
  };

  const remoteSocket = tls.connect(REMOTE_PORT, remoteHost, tlsOptions, () => {
    remoteSocket.write(SESSION_CONNECTION_TYPE + sessionId);

    if (args.test) {
      remoteSocket.on("data", () => {
        const now = new Date().toISOString();
        const html = `
<!DOCTYPE html>
<html>
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
    <tr><th>Agent ID</th><td>${agentId}</td></tr>
    <tr><th>Project ID</th><td>${projectId}</td></tr>
    <tr><th>API URL</th><td>${API_URL}</td></tr>
    <tr><th>Remote Host</th><td>${remoteHost}</td></tr>
    <tr><th>Current Time</th><td>${now}</td></tr>
  </table>
</body>
</html>
        `;
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
      const localSocket = net.connect(localPort, "localhost");

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
  });

  remoteSocket.on("error", (err) => {
    console.error("Session connection error:", err.message);
  });
}

function startControlConnection(remoteHost) {
  const tlsOptions = {
    rejectUnauthorized: true,
    servername: remoteHost,
  };

  const remoteSocket = tls.connect(REMOTE_PORT, remoteHost, tlsOptions, () => {
    console.log(`Connected to ${remoteHost} via TLS`);
    remoteSocket.write(
      CONTROL_CONNECTION_TYPE + projectId + agentId + agentToken
    );
  });

  remoteSocket.on("data", (data) => {
    const idLength = 36;
    const message = data.toString();

    for (let i = 0; i + idLength <= message.length; i += idLength) {
      const sessionId = message.slice(i, i + idLength);
      console.log(`Session ID: ${sessionId}`);
      createProxySession(remoteHost, sessionId);
    }
  });

  remoteSocket.on("close", () => {
    console.log("Control connection closed");
  });

  remoteSocket.on("error", (err) => {
    console.error("Control connection error:", err.message);
  });
}

fetchProxyAddress()
  .then((remoteHost) => {
    console.log(`Resolved proxy address: ${remoteHost}`);
    startControlConnection(remoteHost);
  })
  .catch((err) => {
    console.error("Failed to resolve proxy address:", err.message);
    process.exit(1);
  });
