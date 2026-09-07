export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return new Response("Kie AI MCP Bridge is running", {
        status: 200
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json();

    if (body.method === "initialize") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: {
            name: "kie-ai-mcp",
            version: "1.0.0"
          }
        }
      });
    }

    if (body.method === "tools/list") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [
            {
              name: "kie_create_task",
              description: "Create an AI generation task with Kie.ai",
              inputSchema: {
                type: "object",
                properties: {
                  model: { type: "string" },
                  input: { type: "object" }
                },
                required: ["model", "input"]
              }
            },
            {
              name: "kie_get_task",
              description: "Get the status and result of a Kie.ai task",
              inputSchema: {
                type: "object",
                properties: {
                  taskId: { type: "string" }
                },
                required: ["taskId"]
              }
            }
          ]
        }
      });
    }

    return Response.json({
      jsonrpc: "2.0",
      id: body.id ?? null,
      error: {
        code: -32601,
        message: "Method not found"
      }
    });
  }
};
