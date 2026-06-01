/**
 * Flow Pilot — MCP Server Setup
 * Creates and configures the MCP server with tool registration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { scanWorkspace } from './codebaseScanner';
import { generateFlowHandler } from './generateFlowTool';
import { createAiFlowHandler } from './aiFlowTool';
import { buildFlowContextResponse } from './flowContextTool';
import { getNodeDetailHandler, getRelationshipDetailHandler } from './detailTools';
import { getWorkspacePath } from '../extension';

const evidenceSchema = z.object({
  kind: z.enum(['file', 'symbol', 'snippet', 'filename', 'prompt', 'relationship']),
  file: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  symbolName: z.string().optional(),
  snippet: z.string().optional(),
  reason: z.string().min(1),
});

const aiNodeSchema = z.object({
  id: z.string().min(1).describe('Stable node id, unique within this flow.'),
  label: z.string().min(1).describe('Human-readable label to show in the diagram.'),
  type: z.string().optional().describe('Node type such as ui, api, process, decision, success, error, repository, datasource, model.'),
  file: z.string().nullable().optional().describe('Relative source file path for this node, when known.'),
  lineStart: z.number().int().positive().nullable().optional().describe('1-based start line in file. Required when file is set.'),
  lineEnd: z.number().int().positive().nullable().optional().describe('1-based end line in file. Defaults to lineStart.'),
  description: z.string().optional(),
  symbolName: z.string().optional(),
  reason: z.string().optional().describe('Why the AI included this node in the flow.'),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(evidenceSchema).optional(),
});

const aiEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
  reason: z.string().optional().describe('Why this relationship belongs in the flow.'),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(evidenceSchema).optional(),
});

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

  server.tool(
    'get_flow_context',
    'Return relevant source files with line-numbered snippets for the AI to inspect before authoring a general Flow Pilot graph. After using this, call create_ai_flow with the AI-decided nodes, edges, line mappings, and evidence.',
    {
      prompt: z.string().min(1).max(2000).describe('Natural language description of the flow to understand.'),
    },
    async ({ prompt }) => {
      const workspacePath = getWorkspacePath();
      const files = workspacePath ? await scanWorkspace(prompt, workspacePath) : [];
      const result = buildFlowContextResponse(prompt, files);

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

  server.tool(
    'create_ai_flow',
    'Save an AI-authored Flow Pilot diagram after the AI has inspected the code and decided the nodes, relationships, file mappings, line ranges, and evidence. Use this for general use cases where semantic understanding should come from the AI rather than a template.',
    {
      prompt: z.string().min(1).max(2000).describe('Original user request or flow intent.'),
      title: z.string().optional().describe('Optional display title for the saved flow.'),
      nodes: z.array(aiNodeSchema).min(1).describe('AI-decided flow nodes. Each code-backed node should include file, lineStart, lineEnd, and evidence.'),
      edges: z.array(aiEdgeSchema).describe('AI-decided relationships/process transitions between nodes.'),
      flowchartMermaidSource: z.string().optional().describe('Optional AI-authored flowchart Mermaid. If omitted, Flow Pilot generates one from nodes/edges.'),
      sequenceMermaidSource: z.string().optional().describe('Optional AI-authored sequence Mermaid using ids that correspond to nodes. If omitted, Flow Pilot generates one from nodes/edges.'),
      warnings: z.array(z.string()).optional(),
    },
    async (args) => {
      const workspacePath = getWorkspacePath();
      const result = createAiFlowHandler(args, workspacePath);

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

  server.tool(
    'get_node_detail',
    'Return source metadata, relationships, evidence, and optional code snippet for a node in a saved Flow Pilot flow.',
    {
      flowId: z.string().min(1).describe('Flow id returned by generate_flow.'),
      nodeId: z.string().min(1).describe('Node id from the generated flow.'),
      includeCodeSnippet: z.boolean().optional().describe('Whether to include the source code snippet. Defaults to true.'),
    },
    async ({ flowId, nodeId, includeCodeSnippet }) => {
      const workspacePath = getWorkspacePath();
      const result = getNodeDetailHandler({ flowId, nodeId, includeCodeSnippet }, workspacePath);

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

  server.tool(
    'get_relationship_detail',
    'Return evidence and endpoint context for a relationship between two nodes in a saved Flow Pilot flow.',
    {
      flowId: z.string().min(1).describe('Flow id returned by generate_flow.'),
      from: z.string().min(1).describe('Source node id.'),
      to: z.string().min(1).describe('Target node id.'),
    },
    async ({ flowId, from, to }) => {
      const workspacePath = getWorkspacePath();
      const result = getRelationshipDetailHandler({ flowId, from, to }, workspacePath);

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
