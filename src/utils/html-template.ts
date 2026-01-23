export function htmlTemplate(
  remoteHost: string,
  agentId?: string,
  projectId?: string,
  domain?: string,
): string {
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
              <tr><th>Agent ID</th><td>${agentId || "N/A"}</td></tr>
              <tr><th>Project ID</th><td>${projectId || "N/A"}</td></tr>
              <tr><th>Domain</th><td>${domain || "N/A"}</td></tr>
              <tr><th>Remote Host</th><td>${remoteHost}</td></tr>
              <tr><th>Current Time</th><td>${now}</td></tr>
            </table>
          </body>
          </html>
      `;
}
