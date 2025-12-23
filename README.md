
# PNode Launcher

PNode allows you to securely expose local web applications, APIs, or development servers to the Internet.

It creates an encrypted tunnel from a public domain to your local machine using a lightweight agent — no firewall rules, NAT configuration, or VPS required.

PNode is well suited for:
- local backend APIs
- frontend development servers
- resource-intensive workloads (AI models, ML inference, etc.)

---

## How it works

You run a local agent that forwards traffic from a public domain to a port on your machine.

PNode supports two modes:

- **Anonymous mode** — no account, temporary domain
- **Authorized mode** — fixed domain tied to your project

---

## Anonymous Mode

Anonymous mode requires no registration and no credentials.

```sh
npx start-pnode@latest --port 3000
````

* A temporary domain like `tmp-abc123.pnode.site` is assigned automatically
* The domain is valid for 12 hours
* The port must be explicitly specified

---

## Authorized Mode

Authorized mode uses a single **Agent Token** generated for your project.

The token identifies the project and grants access to its fixed domain.

```sh
export AGENT_TOKEN=your-agent-token
export LOCAL_PORT=3000

npx start-pnode@latest
```

Or using CLI arguments:

```sh
npx start-pnode@latest --token your-agent-token --port 3000
```

Authorized mode provides:

* a fixed public domain (e.g. `yourname.pnode.site`)
* higher usage limits
* optional frontend / backend separation

---

## Environment Variables

### Anonymous Mode

No variables required.

Optional:

* `LOCAL_PORT` — local forwarded port

### Authorized Mode

* `AGENT_TOKEN` — project access token
* `LOCAL_PORT` — local forwarded port

---

## CLI Options

```text
Options:
  --token <token>   Agent token (env: AGENT_TOKEN)
  --port <port>     Local forwarded port (env: LOCAL_PORT)
  -t, --test        Test mode
  -h, --help        Display help
```

---

## Example

Expose a local API running on port 5000:

```sh
node server.js --port 5000

npx start-pnode@latest --port 5000
```

Or with a project token:

```sh
export AGENT_TOKEN=...
npx start-pnode@latest --port 5000
```

---

## Security

All traffic between the agent and PNode servers is encrypted.
Only users with a valid Agent Token can start authorized tunnels.

---

## Links

* Website: [https://pnode.site](https://pnode.site)
* Documentation: [https://pnode.site/docs](https://pnode.site/docs)
