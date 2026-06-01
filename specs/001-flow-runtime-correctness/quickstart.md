# Quickstart: Flow Runtime Correctness And Traceable MCP Details

## Verify Extension Runtime

1. Run `npm run compile`.
2. Open VS Code Run and Debug.
3. Launch `Run Extension`.
4. Generate or open a saved Flow Pilot flow.
5. On the diagram:
   - Drag empty canvas space; diagram should pan.
   - Use Mac touchpad horizontal/vertical scroll; diagram should pan and zoom label should not change.
   - Use toolbar zoom buttons; visible center should remain stable.
   - Use modified/pinch zoom gesture; pointer focus should remain stable.
   - Click a source-backed node; VS Code should open the source file and reveal the mapped lines.
   - Click a conceptual node; inspector should update without opening an editor.

## Verify MCP Runtime

1. Compile with `npm run compile`.
2. Start the standalone server through VS Code MCP or run the configured MCP server.
3. Call `generate_flow` with a prompt such as `show flow for extension activation`.
4. Read `flow.nodes[0]`; confirm optional metadata fields exist when source is available.
5. Call `get_node_detail` with the returned `flowId` and a node id.
6. Call `get_relationship_detail` with the returned `flowId` and connected node ids.

## Verification Commands

```bash
npm run compile
npm run test:unit
```
