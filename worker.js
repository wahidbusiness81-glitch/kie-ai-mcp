import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer(env) {
  const server = new McpServer({
    name: "kie-ai-mcp",
    version: "1.0.0"
  });

  server.registerTool(
    "kie_create_task",
    {
      description: "Créer une tâche de génération Kie.ai",
      inputSchema: {
        model: z.string(),
        input: z.record(z.any())
      }
    },
    async ({ model, input }) => {
      const response = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.KIE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input
        })
      });

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data)
          }
        ]
      };
    }
  );

  server.registerTool(
    "kie_get_task",
    {
      description: "Vérifier le statut et le résultat d'une tâche Kie.ai",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      const response = await fetch(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        {
          headers: {
            "Authorization": `Bearer ${env.KIE_API_KEY}`
          }
        }
      );

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data)
          }
        ]
      };
    }
  );

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("Kie AI MCP Bridge is running", {
        status: 200
      });
    }

    return createMcpHandler(() => createServer(env))(request, env, ctx);
  }
};
