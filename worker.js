import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const KIE_API_BASE = "https://api.kie.ai/api/v1/jobs";

function sendText(text) {
  return {
    content: [{ type: "text", text }]
  };
}

function getResultUrls(data) {
  if (Array.isArray(data?.data?.response?.resultUrls)) {
    return data.data.response.resultUrls;
  }

  try {
    const result = JSON.parse(data?.data?.resultJson || "{}");
    return Array.isArray(result.resultUrls) ? result.resultUrls : [];
  } catch {
    return [];
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

function createServer(env) {
  const server = new McpServer({
    name: "kie-ai-mcp",
    version: "1.1.0"
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
      try {
        const response = await fetch(
          `${KIE_API_BASE}/createTask`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.KIE_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              input
            })
          }
        );

        const data = await response.json();

        if (!response.ok || data?.code !== 200) {
          return sendText(
            `Erreur KIE.ai : ${data?.msg || response.status}`
          );
        }

        const taskId = data?.data?.taskId;

        return sendText(
          `Tâche KIE.ai créée. taskId: ${taskId}`
        );
      } catch (error) {
        return sendText(
          `Erreur de création : ${error.message}`
        );
      }
    }
  );

  server.registerTool(
    "kie_get_task",
    {
      description:
        "Vérifier une tâche et afficher directement l’image ou la vidéo Kie.ai",
      inputSchema: {
        taskId: z.string()
      }
    },
    async ({ taskId }) => {
      try {
        const response = await fetch(
          `${KIE_API_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`,
          {
            headers: {
              Authorization: `Bearer ${env.KIE_API_KEY}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok || data?.code !== 200) {
          return sendText(
            `Erreur KIE.ai : ${data?.msg || response.status}`
          );
        }

        const state = data?.data?.state || "inconnu";

        if (state === "fail" || state === "failed") {
          return sendText(
            `La génération a échoué : ${
              data?.data?.failMsg || "raison inconnue"
            }`
          );
        }

        const resultUrls = getResultUrls(data);

        if (state !== "success" || resultUrls.length === 0) {
          return sendText(
            `Statut KIE.ai : ${state}. Le résultat n’est pas encore prêt.`
          );
        }

        const content = [];

        for (const fileUrl of resultUrls) {
          const pathname = new URL(fileUrl).pathname.toLowerCase();

          const isImage =
            pathname.endsWith(".png") ||
            pathname.endsWith(".jpg") ||
            pathname.endsWith(".jpeg") ||
            pathname.endsWith(".webp") ||
            pathname.endsWith(".gif");

          if (isImage) {
            const imageResponse = await fetch(fileUrl);

            if (!imageResponse.ok) {
              content.push({
                type: "text",
                text: `Télécharger l’image : ${fileUrl}`
              });

              continue;
            }

            const mimeType =
              imageResponse.headers
                .get("content-type")
                ?.split(";")[0] || "image/png";

            const buffer = await imageResponse.arrayBuffer();

            content.push({
              type: "image",
              data: arrayBufferToBase64(buffer),
              mimeType
            });

            content.push({
              type: "resource_link",
              uri: fileUrl,
              name: "image-kie",
              title: "Télécharger l’image KIE.ai",
              mimeType
            });
          } else {
            content.push({
              type: "resource_link",
              uri: fileUrl,
              name: "video-kie.mp4",
              title: "Voir ou télécharger la vidéo KIE.ai",
              mimeType: "video/mp4"
            });
          }
        }

        return { content };
      } catch (error) {
        return sendText(
          `Erreur de vérification : ${error.message}`
        );
      }
    }
  );

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        "Kie AI MCP Bridge is running",
        { status: 200 }
      );
    }

    return createMcpHandler(
      () => createServer(env)
    )(request, env, ctx);
  }
};
