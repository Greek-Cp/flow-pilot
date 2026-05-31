/**
 * Flow Pilot — MCP Server Setup
 * Creates and configures the MCP server with tool registration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateFlowHandler } from './generateFlowTool';
import { getWorkspacePath } from '../extension';

/** Create and configure the MCP server */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'flow-pilot',
    version: '0.1.0',
  });

  // Register generate_flow tool
  server.tool(
    'generate_flow',
    'Analyze the current workspace codebase and generate an interactive code flow diagram from a natural language prompt.',
    {
      prompt: z.string().min(1).max(2000).describe(
        'Natural language description of the code flow to visualize. Example: "Show the payment flow from booking to completion"'
      ),
    },
    async ({ prompt }) => {
      const workspacePath = getWorkspacePath();
      const result = await generateFlowHandler({ prompt }, workspacePath);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

/** Start the MCP server with stdio transport */
export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
