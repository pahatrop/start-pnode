# Pnode launcher

Pnode allows you to host and expose your local web applications securely and effortlessly. 

With just a few clicks, you can share your frontend and backend through automatically assigned domains. 

All traffic is securely tunneled from the internet to your local machine via a lightweight agent.

This is ideal for resource-intensive applications like AI models or ML inference engines — no need to rent a VPS or cloud infrastructure.
## Environment variables

- PROJECT_ID
- AGENT_ID
- AGENT_TOKEN
- LOCAL_PORT

## Usage

```shell
  npx start-pnode --project <id> --agent <id>  --token <token> --port <local-port>
```

