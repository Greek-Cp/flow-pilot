import '@xyflow/react/dist/style.css';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import dagre from 'dagre';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  Edge,
  EdgeLabelRenderer,
  EdgeProps,
  Handle,
  MarkerType,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  getBezierPath,
} from '@xyflow/react';
import {
  Archive,
  Box,
  Boxes,
  Braces,
  CircleHelp,
  Cloud,
  Component,
  Cylinder,
  Database,
  DatabaseZap,
  FileCode,
  Flag,
  FolderCode,
  GitBranch,
  Globe,
  HardDrive,
  LayoutDashboard,
  Layers,
  Monitor,
  MousePointerClick,
  Network,
  PanelTop,
  PanelsTopLeft,
  PlayCircle,
  Plug,
  RadioTower,
  Route,
  Save,
  Server,
  Shuffle,
  SlidersHorizontal,
  TableProperties,
  WandSparkles,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';

type Direction = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';
type DiagramMode = 'flowchart' | 'sequence';
type NodeKind =
  | 'trigger'
  | 'page'
  | 'ui_component'
  | 'controller'
  | 'service'
  | 'repository'
  | 'datasource'
  | 'model'
  | 'database'
  | 'external'
  | 'utility'
  | 'file'
  | 'unknown';

type FlowNodeLike = {
  id: string;
  label?: string;
  type?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  symbolName?: string;
  description?: string;
  reason?: string;
  confidence?: number;
  evidence?: EvidenceLike[];
};

type FlowEdgeLike = {
  from: string;
  to: string;
  label?: string;
  reason?: string;
  confidence?: number;
  evidence?: EvidenceLike[];
};

type EvidenceLike = {
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  kind?: string;
  reason?: string;
  snippet?: string;
};

type FlowDataLike = {
  nodes?: FlowNodeLike[];
  edges?: FlowEdgeLike[];
};

type ParsedNode = {
  id: string;
  label: string;
  shape?: string;
};

type ParsedEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

type SemanticNodeMeta = {
  id: string;
  label: string;
  symbol: string;
  nodeKind: NodeKind;
  domainArea: string;
  layer: string;
  role: string;
  confidence: number;
  reason: string;
  filePath: string;
  evidence: EvidenceLike[];
  incoming: Array<{ from: string; label?: string }>;
  outgoing: Array<{ to: string; label?: string }>;
};

type RoadmapNodeData = SemanticNodeMeta & {
  accent: string;
  direction: Direction;
};

type SequenceMessage = {
  id: string;
  from: string;
  to: string;
  label: string;
  order: number;
  messageKind: string;
  reason?: string;
  evidence?: EvidenceLike[];
};

type RendererCallbacks = {
  onNodeClick?: (nodeId: string, metadata?: SemanticNodeMeta) => void;
  onMessageClick?: (message: SequenceMessage) => void;
  onPaneClick?: () => void;
  onZoomChange?: (zoom: number) => void;
  onLog?: (level: string, message: string, data?: unknown) => void;
};

type RenderInput = {
  container: HTMLElement;
  mermaidSource: string;
  flowData?: FlowDataLike;
  mode?: DiagramMode;
  showDomainAreas?: boolean;
  callbacks?: RendererCallbacks;
};

const roots = new WeakMap<HTMLElement, Root>();
let currentControls: null | {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  reset: () => void;
} = null;

const NODE_WIDTH = 300;
const NODE_HEIGHT = 132;
const SEQUENCE_CARD_W = 238;
const SEQUENCE_CARD_H = 86;
const SEQUENCE_X_GAP = 306;
const SEQUENCE_TOP = 64;
const SEQUENCE_STEP = 86;

function RoadmapNode({ data, selected }: NodeProps<Node<RoadmapNodeData>>) {
  const isHorizontal = data.direction === 'LR' || data.direction === 'RL';
  const Icon = iconForKind(data.nodeKind);

  return (
    <div
      className={`fp-roadmap-node kind-${data.nodeKind} ${selected ? 'selected' : ''}`}
      style={{ '--fp-node-accent': data.accent } as React.CSSProperties}
    >
      <Handle className="fp-roadmap-handle" type="target" position={isHorizontal ? Position.Left : Position.Top} />
      <div className="fp-roadmap-icon">
        <Icon size={19} strokeWidth={2.1} />
      </div>
      <div className="fp-roadmap-copy">
        <div className="fp-roadmap-eyebrow">{labelForKind(data.nodeKind)}</div>
        <div className="fp-roadmap-title">{data.label}</div>
        <div className="fp-roadmap-subtitle">{data.symbol || data.filePath || data.role}</div>
        <div className="fp-roadmap-meta">
          <span>{data.domainArea}</span>
          <span>{Math.round(data.confidence * 100)}%</span>
        </div>
      </div>
      <div className="fp-roadmap-arrow" aria-hidden="true">{'->'}</div>
      <Handle className="fp-roadmap-handle" type="source" position={isHorizontal ? Position.Right : Position.Bottom} />
    </div>
  );
}

function RoadmapEdge(props: EdgeProps<Edge<{ label?: string }>>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.34,
  });
  const label = props.label || props.data?.label;

  return (
    <>
      <BaseEdge path={path} markerEnd={props.markerEnd} className="fp-roadmap-edge-path" />
      {label ? (
        <EdgeLabelRenderer>
          <div className="fp-roadmap-edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function GraphRenderer({
  mermaidSource,
  flowData,
  callbacks,
  mode = 'flowchart',
  showDomainAreas = false,
}: RenderInput) {
  const model = useMemo(() => {
    return mode === 'sequence'
      ? buildSequenceModel(mermaidSource, flowData || {})
      : buildRoadmapGraph(mermaidSource, flowData || {});
  }, [mermaidSource, flowData, mode]);

  if (mode === 'sequence') {
    return (
      <SequenceCanvas
        model={model as SequenceModel}
        callbacks={callbacks}
        showDomainAreas={showDomainAreas}
      />
    );
  }

  return (
    <ReactFlowProvider>
      <RoadmapCanvas
        graph={model as RoadmapGraph}
        callbacks={callbacks}
        showDomainAreas={showDomainAreas}
      />
    </ReactFlowProvider>
  );
}

type RoadmapGraph = {
  nodes: Node<RoadmapNodeData>[];
  edges: Edge[];
  direction: Direction;
  domainAreas: DomainAreaBox[];
};

type DomainAreaBox = {
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function RoadmapCanvas({
  graph,
  callbacks,
  showDomainAreas,
}: {
  graph: RoadmapGraph;
  callbacks?: RendererCallbacks;
  showDomainAreas: boolean;
}) {
  const flow = useReactFlow();

  useEffect(() => {
    currentControls = {
      zoomIn: () => void flow.zoomIn({ duration: 180 }),
      zoomOut: () => void flow.zoomOut({ duration: 180 }),
      fitView: () => void flow.fitView({ padding: 0.2, duration: 320 }),
      reset: () => void flow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 220 }),
    };

    window.requestAnimationFrame(() => {
      void flow.fitView({ padding: 0.24, duration: 360 });
      callbacks?.onZoomChange?.(flow.getViewport().zoom);
    });

    return () => {
      currentControls = null;
    };
  }, [callbacks, flow, graph]);

  return (
    <ReactFlow
      className="fp-roadmap-flow"
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={{ roadmap: RoadmapNode }}
      edgeTypes={{ roadmap: RoadmapEdge }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      fitView
      fitViewOptions={{ padding: 0.24 }}
      minZoom={0.18}
      maxZoom={2.2}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, node) => callbacks?.onNodeClick?.(node.id, node.data as RoadmapNodeData)}
      onPaneClick={() => callbacks?.onPaneClick?.()}
      onMove={(_, viewport) => callbacks?.onZoomChange?.(viewport.zoom)}
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={0.9} className="fp-roadmap-background" />
      {showDomainAreas ? (
        <ViewportPortal>
          <DomainOverlay boxes={graph.domainAreas} />
        </ViewportPortal>
      ) : null}
      {showDomainAreas ? <DomainLegend boxes={graph.domainAreas} /> : null}
      <Controls className="fp-roadmap-controls" showInteractive={false} />
    </ReactFlow>
  );
}

function DomainOverlay({ boxes }: { boxes: DomainAreaBox[] }) {
  return (
    <div className="fp-domain-overlay">
      {boxes.map((box) => (
        <div
          key={box.name}
          className="fp-domain-box"
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
            '--fp-domain-color': box.color,
          } as React.CSSProperties}
        >
          <span>{box.name}</span>
        </div>
      ))}
    </div>
  );
}

function DomainLegend({ boxes }: { boxes: DomainAreaBox[] }) {
  if (boxes.length <= 1) return null;
  return (
    <div className="fp-domain-legend">
      {boxes.map((box) => (
        <span key={box.name}>
          <i style={{ background: box.color }} />
          {box.name}
        </span>
      ))}
    </div>
  );
}

type SequenceModel = {
  participants: Array<SemanticNodeMeta & { x: number; y: number; color: string }>;
  messages: SequenceMessage[];
  domainAreas: DomainAreaBox[];
  width: number;
  height: number;
};

function SequenceCanvas({
  model,
  callbacks,
  showDomainAreas,
}: {
  model: SequenceModel;
  callbacks?: RendererCallbacks;
  showDomainAreas: boolean;
}) {
  const [viewport, setViewport] = useState({ x: 48, y: 42, zoom: 1 });
  const [drag, setDrag] = useState<null | { x: number; y: number; startX: number; startY: number }>(null);
  const [selected, setSelected] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fitView = () => {
    const el = containerRef.current;
    if (!el) return;
    const zoom = Math.max(0.22, Math.min(1.15, Math.min((el.clientWidth - 96) / model.width, (el.clientHeight - 96) / model.height)));
    setViewport({ x: 48, y: 42, zoom });
    callbacks?.onZoomChange?.(zoom);
  };

  useEffect(() => {
    currentControls = {
      zoomIn: () => setViewport((v) => ({ ...v, zoom: Math.min(2.2, v.zoom * 1.15) })),
      zoomOut: () => setViewport((v) => ({ ...v, zoom: Math.max(0.18, v.zoom / 1.15) })),
      fitView,
      reset: () => {
        setViewport({ x: 48, y: 42, zoom: 1 });
        callbacks?.onZoomChange?.(1);
      },
    };
    window.requestAnimationFrame(fitView);
    return () => {
      currentControls = null;
    };
  }, [model.width, model.height]);

  const participantById = new Map(model.participants.map((participant) => [participant.id, participant]));

  return (
    <div
      ref={containerRef}
      className="fp-sequence-view"
      onWheel={(event) => {
        event.preventDefault();
        const next = Math.max(0.18, Math.min(2.2, viewport.zoom * Math.exp(-event.deltaY * 0.001)));
        setViewport((v) => ({ ...v, zoom: next }));
        callbacks?.onZoomChange?.(next);
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        setDrag({ x: event.clientX, y: event.clientY, startX: viewport.x, startY: viewport.y });
      }}
      onMouseMove={(event) => {
        if (!drag) return;
        setViewport((v) => ({
          ...v,
          x: drag.startX + event.clientX - drag.x,
          y: drag.startY + event.clientY - drag.y,
        }));
      }}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => setDrag(null)}
      onClick={(event) => {
        if (event.target === event.currentTarget) callbacks?.onPaneClick?.();
      }}
    >
      <div
        className="fp-sequence-stage"
        style={{
          width: model.width,
          height: model.height,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {showDomainAreas ? <DomainOverlay boxes={model.domainAreas} /> : null}
        {showDomainAreas ? <DomainLegend boxes={model.domainAreas} /> : null}
        <svg className="fp-sequence-svg" width={model.width} height={model.height}>
          <defs>
            <marker id="fp-sequence-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          {model.participants.map((participant) => (
            <line
              key={`life-${participant.id}`}
              className="fp-sequence-lifeline"
              x1={participant.x + SEQUENCE_CARD_W / 2}
              x2={participant.x + SEQUENCE_CARD_W / 2}
              y1={SEQUENCE_TOP + SEQUENCE_CARD_H + 14}
              y2={model.height - 36}
            />
          ))}
          {model.messages.map((message) => {
            const from = participantById.get(message.from);
            const to = participantById.get(message.to);
            if (!from || !to) return null;
            const y = SEQUENCE_TOP + SEQUENCE_CARD_H + 58 + message.order * SEQUENCE_STEP;
            const x1 = from.x + SEQUENCE_CARD_W / 2;
            const x2 = to.x + SEQUENCE_CARD_W / 2;
            const labelX = (x1 + x2) / 2;
            return (
              <g
                key={message.id}
                className={`fp-sequence-message ${selected === message.id ? 'selected' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected(message.id);
                  callbacks?.onMessageClick?.(message);
                }}
              >
                <line x1={x1} x2={x2} y1={y} y2={y} markerEnd="url(#fp-sequence-arrow)" />
                <rect className="fp-sequence-activation" x={Math.min(x1, x2) - 4} y={y - 18} width={8} height={38} rx={4} />
                <text x={labelX} y={y - 12} textAnchor="middle">{message.label}</text>
              </g>
            );
          })}
        </svg>
        {model.participants.map((participant) => {
          const Icon = iconForKind(participant.nodeKind);
          return (
            <button
              key={participant.id}
              className={`fp-sequence-participant kind-${participant.nodeKind}`}
              style={{ left: participant.x, top: participant.y, '--fp-node-accent': participant.color } as React.CSSProperties}
              onClick={(event) => {
                event.stopPropagation();
                setSelected(participant.id);
                callbacks?.onNodeClick?.(participant.id, participant);
              }}
            >
              <span className="fp-sequence-icon"><Icon size={17} /></span>
              <span>
                <small>{labelForKind(participant.nodeKind)} / {participant.domainArea}</small>
                <strong>{participant.label}</strong>
                <em>{participant.symbol || participant.filePath || participant.role}</em>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildRoadmapGraph(source: string, flowData: FlowDataLike): RoadmapGraph {
  const parsed = parseMermaidFlowchart(source);
  const direction = parsed.direction;
  const enriched = enrichParsedGraph(parsed, flowData);
  return layoutGraph(enriched.nodes, enriched.edges, direction);
}

function parseMermaidFlowchart(source: string): { direction: Direction; nodes: ParsedNode[]; edges: ParsedEdge[] } {
  const direction = getDirection(source);
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];

  for (const rawLine of String(source || '').split(/\r?\n/)) {
    const line = cleanupLine(rawLine);
    if (!line || shouldIgnoreMermaidLine(line)) continue;

    const edge = parseEdgeLine(line);
    if (edge) {
      nodes.set(edge.sourceNode.id, edge.sourceNode);
      nodes.set(edge.targetNode.id, edge.targetNode);
      edges.push({
        id: `edge-${edge.sourceNode.id}-${edge.targetNode.id}-${edges.length}`,
        source: edge.sourceNode.id,
        target: edge.targetNode.id,
        label: edge.label,
      });
      continue;
    }

    const node = parseNodeRef(line);
    if (node) nodes.set(node.id, node);
  }

  return { direction, nodes: [...nodes.values()], edges };
}

function enrichParsedGraph(
  parsed: { nodes: ParsedNode[]; edges: ParsedEdge[]; direction: Direction },
  flowData: FlowDataLike
) {
  const fallbackNodes = flowData.nodes || [];
  const fallbackEdges = flowData.edges || [];
  const flowNodeById = new Map(fallbackNodes.map((node) => [node.id, node]));
  const edgeList = parsed.edges.length > 0
    ? parsed.edges
    : fallbackEdges.map((edge, index) => ({
        id: `edge-${edge.from}-${edge.to}-${index}`,
        source: edge.from,
        target: edge.to,
        label: edge.label,
      }));
  const nodes = parsed.nodes.length > 0
    ? parsed.nodes
    : fallbackNodes.map((node) => ({ id: node.id, label: node.label || node.id }));

  return {
    nodes: nodes.map((node) => classifyNode(node, flowNodeById.get(node.id), edgeList, flowData)),
    edges: edgeList,
  };
}

function layoutGraph(parsedNodes: SemanticNodeMeta[], parsedEdges: ParsedEdge[], direction: Direction): RoadmapGraph {
  const rankdir = direction === 'TD' ? 'TB' : direction;
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir,
    ranksep: rankdir === 'LR' || rankdir === 'RL' ? 188 : 132,
    nodesep: rankdir === 'LR' || rankdir === 'RL' ? 104 : 92,
    marginx: 86,
    marginy: 72,
  });

  for (const node of parsedNodes) graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of parsedEdges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);

  const isHorizontal = rankdir === 'LR' || rankdir === 'RL';
  const nodes: Node<RoadmapNodeData>[] = parsedNodes.map((node) => {
    const position = graph.node(node.id) || { x: 0, y: 0 };
    const accent = colorForKind(node.nodeKind);
    return {
      id: node.id,
      type: 'roadmap',
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      data: { ...node, accent, direction },
    };
  });

  const edges: Edge[] = parsedEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'roadmap',
    label: edge.label,
    data: { label: edge.label },
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: 'var(--fp-roadmap-edge)' },
  }));

  return { nodes, edges, direction, domainAreas: computeDomainBoxes(nodes) };
}

function buildSequenceModel(source: string, flowData: FlowDataLike): SequenceModel {
  const parsed = parseMermaidSequence(source);
  const fallbackEdges = flowData.edges || [];
  const graphEdges = parsed.messages.length > 0
    ? parsed.messages.map((message) => ({ id: message.id, source: message.from, target: message.to, label: message.label }))
    : fallbackEdges.map((edge, index) => ({ id: `message-${index}`, source: edge.from, target: edge.to, label: edge.label || 'calls' }));
  const participantIds = parsed.participants.length > 0
    ? parsed.participants.map((p) => p.id)
    : unique(graphEdges.flatMap((edge) => [edge.source, edge.target]));
  const flowNodeById = new Map((flowData.nodes || []).map((node) => [node.id, node]));
  const participantLabel = new Map(parsed.participants.map((participant) => [participant.id, participant.label]));

  const participants = participantIds.map((id, index) => {
    const semantic = classifyNode(
      { id, label: participantLabel.get(id) || flowNodeById.get(id)?.label || id },
      flowNodeById.get(id),
      graphEdges,
      flowData
    );
    return {
      ...semantic,
      x: 48 + index * SEQUENCE_X_GAP,
      y: SEQUENCE_TOP,
      color: colorForKind(semantic.nodeKind),
    };
  });

  const messages = (parsed.messages.length > 0 ? parsed.messages : graphEdges.map((edge, index) => ({
    id: edge.id,
    from: edge.source,
    to: edge.target,
    label: edge.label || 'message',
    order: index,
    messageKind: 'call',
  }))).map((message, index) => ({ ...message, order: index }));

  const width = Math.max(900, 96 + Math.max(1, participants.length) * SEQUENCE_X_GAP);
  const height = Math.max(520, SEQUENCE_TOP + SEQUENCE_CARD_H + 126 + messages.length * SEQUENCE_STEP);
  const domainAreas = computeSequenceDomainBoxes(participants, height);
  return { participants, messages, width, height, domainAreas };
}

function parseMermaidSequence(source: string): {
  participants: Array<{ id: string; label: string }>;
  messages: SequenceMessage[];
} {
  const participants = new Map<string, string>();
  const messages: SequenceMessage[] = [];

  for (const rawLine of String(source || '').split(/\r?\n/)) {
    const line = cleanupLine(rawLine);
    if (!line || /^sequenceDiagram/i.test(line) || /^autonumber/i.test(line)) continue;

    const participant = line.match(/^(?:actor|participant)\s+([A-Za-z_][\w.$:-]*)\s*(?:as\s+(.+))?$/i);
    if (participant) {
      participants.set(participant[1], cleanLabel(participant[2] || participant[1]));
      continue;
    }

    const message = line.match(/^([A-Za-z_][\w.$:-]*)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([A-Za-z_][\w.$:-]*)\s*:\s*(.+)$/);
    if (message) {
      const from = message[1];
      const to = message[3];
      participants.set(from, participants.get(from) || from);
      participants.set(to, participants.get(to) || to);
      messages.push({
        id: `message-${messages.length}`,
        from,
        to,
        label: cleanLabel(message[4]),
        order: messages.length,
        messageKind: message[2].includes('--') ? 'async' : 'call',
      });
    }
  }

  return {
    participants: [...participants.entries()].map(([id, label]) => ({ id, label })),
    messages,
  };
}

function classifyNode(
  parsed: ParsedNode,
  flowNode: FlowNodeLike | undefined,
  edges: Array<ParsedEdge | { source: string; target: string; label?: string }>,
  flowData: FlowDataLike
): SemanticNodeMeta {
  const filePath = flowNode?.file || firstEvidenceFile(flowNode?.evidence) || '';
  const symbol = flowNode?.symbolName || inferSymbol(parsed.label || flowNode?.label || parsed.id, filePath);
  const label = flowNode?.label || parsed.label || symbol || parsed.id;
  const evidence = flowNode?.evidence || [];
  const incoming = edges.filter((edge) => edge.target === parsed.id).map((edge) => ({ from: edge.source, label: edge.label }));
  const outgoing = edges.filter((edge) => edge.source === parsed.id).map((edge) => ({ to: edge.target, label: edge.label }));
  const context = [
    parsed.id,
    label,
    symbol,
    filePath,
    flowNode?.type,
    flowNode?.description,
    flowNode?.reason,
    evidence.map((item) => `${item.file || ''} ${item.kind || ''} ${item.reason || ''} ${item.snippet || ''}`).join(' '),
    incoming.map((edge) => edge.label).join(' '),
    outgoing.map((edge) => edge.label).join(' '),
  ].join(' ').toLowerCase();

  const direct = normalizeKnownKind(flowNode?.type || '');
  const kind = direct || inferKind(context, filePath, parsed.shape, incoming.length, outgoing.length);
  const domainArea = inferDomainArea(filePath, symbol || label);
  const layer = inferLayer(kind, filePath);
  const confidence = confidenceFor(kind, direct, flowNode?.confidence, context);

  return {
    id: parsed.id,
    label,
    symbol,
    nodeKind: kind,
    domainArea,
    layer,
    role: roleFor(kind, incoming.length, outgoing.length),
    confidence,
    reason: flowNode?.reason || reasonFor(kind, filePath, context),
    filePath,
    evidence,
    incoming,
    outgoing,
  };
}

function normalizeKnownKind(type: string): NodeKind | '' {
  const value = String(type || '').toLowerCase();
  const map: Record<string, NodeKind> = {
    api: 'external',
    controller: 'controller',
    datasource: 'datasource',
    repository: 'repository',
    service: 'service',
    model: 'model',
    ui: 'page',
    external: 'external',
    function: 'service',
    method: 'service',
    class: 'file',
    file: 'file',
    success: 'trigger',
    error: 'trigger',
    decision: 'trigger',
    process: 'service',
  };
  return map[value] || '';
}

function inferKind(context: string, filePath: string, shape = '', incoming = 0, outgoing = 0): NodeKind {
  if (/trigger|start|init|tap|click|press|submit|completion|callback|event|lifecycle|on[a-z]/.test(context) || (incoming === 0 && outgoing > 0)) return 'trigger';
  if (/page|screen|route|view\b|dashboard|workspace|home|profile|login/.test(context) || /\/pages?\/|\/screens?\/|\/routes?\//.test(filePath)) return 'page';
  if (/widget|component|button|card|modal|dialog|scaffold|frame|layout/.test(context) || /\/widgets?\/|\/components?\//.test(filePath)) return 'ui_component';
  if (/controller|bloc|cubit|viewmodel|view_model|notifier|provider|riverpod|redux|state/.test(context)) return 'controller';
  if (/repository|repo\b|persistence abstraction/.test(context) || /\/repositories?\//.test(filePath)) return 'repository';
  if (/datasource|data_source|remote|local|client|fetch|http|graphql/.test(context) || /\/data_sources?\//.test(filePath)) return 'datasource';
  if (/database|sqlite|drift|isar|realm|hive|query|transaction|save|insert|update|delete|persist/.test(context) || /\/database\//.test(filePath) || shape.startsWith('[(')) return 'database';
  if (/entity|model|dto|schema|value object|value_object|payload|response|request/.test(context) || /\/models?\//.test(filePath) || /\/entities?\//.test(filePath)) return 'model';
  if (/api|sdk|package|third.?party|external|firebase|stripe|supabase|endpoint|cloud/.test(context) || shape.startsWith('{{')) return 'external';
  if (/helper|util|mapper|formatter|adapter|parser|serializer|transform|convert|shuffle/.test(context) || /\/utils?\//.test(filePath) || /\/helpers?\//.test(filePath)) return 'utility';
  if (/usecase|use_case|service|manager|handler|interactor|application|workflow|orchestrate|calculate|compute/.test(context)) return 'service';
  if (/\.([tj]sx?|dart|kt|swift|go|py|java|rb)$/.test(filePath)) return 'file';
  return 'service';
}

function inferDomainArea(filePath: string, symbol: string): string {
  const clean = String(filePath || '').replace(/\\/g, '/');
  const feature = clean.match(/(?:^|\/)(?:features?|feature|modules?|module|app)\/([^/]+)/i);
  if (feature) return titleCase(feature[1]);
  if (/\/core\/database|\/database\//i.test(clean)) return 'Core Database';
  if (/\/core\//i.test(clean)) return 'Core';
  if (/\/shared\/widgets|\/components\//i.test(clean)) return 'Shared UI';
  if (/\/shared\//i.test(clean)) return 'Shared';
  const meaningful = clean.split('/').filter((part) => part && !/^(lib|src|app|pages|screens|widgets|components|data|domain|presentation|infra|infrastructure|core)$/i.test(part));
  if (meaningful.length > 1) return titleCase(meaningful[0].replace(/\.[^.]+$/, ''));
  const symbolArea = String(symbol || '').match(/([A-Z][a-z]+)(?:Controller|Bloc|Cubit|Service|Repository|Page|Screen|Widget|Model|Entity)/);
  return symbolArea ? symbolArea[1] : 'Application';
}

function inferLayer(kind: NodeKind, filePath: string): string {
  if (/\/presentation\/|\/ui\/|\/widgets?\//i.test(filePath)) return 'Presentation';
  if (/\/domain\/|\/usecases?\//i.test(filePath)) return 'Domain';
  if (/\/data\/|\/infra|\/repositories?|\/data_sources?\//i.test(filePath)) return 'Data';
  const map: Record<NodeKind, string> = {
    trigger: 'Interaction',
    page: 'Presentation',
    ui_component: 'Presentation',
    controller: 'State',
    service: 'Application',
    repository: 'Data',
    datasource: 'Data',
    model: 'Domain',
    database: 'Persistence',
    external: 'External',
    utility: 'Support',
    file: 'Module',
    unknown: 'Needs review',
  };
  return map[kind];
}

function roleFor(kind: NodeKind, incoming: number, outgoing: number): string {
  if (kind === 'trigger') return 'Starts or resumes the flow';
  if (kind === 'controller') return 'Coordinates state and UI events';
  if (kind === 'repository') return 'Abstracts persistence or remote access';
  if (kind === 'datasource') return 'Reads or writes concrete data sources';
  if (kind === 'database') return 'Persists local data';
  if (kind === 'model') return 'Carries domain or transport data';
  if (incoming === 0) return 'Entry point';
  if (outgoing === 0) return 'Terminal step';
  return 'Flow step';
}

function confidenceFor(kind: NodeKind, direct: string, sourceConfidence: number | undefined, context: string): number {
  if (typeof sourceConfidence === 'number') return Math.max(0.4, Math.min(1, sourceConfidence));
  if (direct) return 0.86;
  if (kind === 'unknown') return 0.32;
  if (/controller|repository|datasource|database|widget|model|entity|service|usecase|page|screen/.test(context)) return 0.78;
  return 0.52;
}

function reasonFor(kind: NodeKind, filePath: string, context: string): string {
  if (filePath) return `Classified as ${labelForKind(kind)} from file path and symbol naming.`;
  if (context) return `Classified as ${labelForKind(kind)} from node label, edges, and naming pattern.`;
  return 'Needs review: limited source metadata was available.';
}

function firstEvidenceFile(evidence?: EvidenceLike[]): string {
  return evidence?.find((item) => item.file)?.file || '';
}

function inferSymbol(label: string, filePath: string): string {
  if (label && !label.includes('/')) return label;
  const file = filePath.split('/').pop() || '';
  return file.replace(/\.[^.]+$/, '');
}

function computeDomainBoxes(nodes: Node<RoadmapNodeData>[]): DomainAreaBox[] {
  const groups = new Map<string, Node<RoadmapNodeData>[]>();
  for (const node of nodes) {
    const name = node.data.domainArea || 'Application';
    groups.set(name, [...(groups.get(name) || []), node]);
  }

  return [...groups.entries()].map(([name, group], index) => {
    const minX = Math.min(...group.map((node) => node.position.x)) - 42;
    const minY = Math.min(...group.map((node) => node.position.y)) - 48;
    const maxX = Math.max(...group.map((node) => node.position.x + NODE_WIDTH)) + 42;
    const maxY = Math.max(...group.map((node) => node.position.y + NODE_HEIGHT)) + 50;
    return { name, color: domainColor(index), x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });
}

function computeSequenceDomainBoxes(participants: SequenceModel['participants'], height: number): DomainAreaBox[] {
  const groups = new Map<string, SequenceModel['participants']>();
  for (const participant of participants) {
    const name = participant.domainArea || 'Application';
    groups.set(name, [...(groups.get(name) || []), participant]);
  }
  return [...groups.entries()].map(([name, group], index) => {
    const minX = Math.min(...group.map((p) => p.x)) - 34;
    const maxX = Math.max(...group.map((p) => p.x + SEQUENCE_CARD_W)) + 34;
    return { name, color: domainColor(index), x: minX, y: 28, width: maxX - minX, height: height - 56 };
  });
}

function getDirection(source: string): Direction {
  const match = String(source || '').match(/^\s*(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/im);
  return (match?.[1]?.toUpperCase() as Direction) || 'TD';
}

function cleanupLine(line: string): string {
  return line.replace(/%%.*$/g, '').replace(/;$/g, '').trim();
}

function shouldIgnoreMermaidLine(line: string): boolean {
  return /^(flowchart|graph|subgraph|end|classDef|class|style|click|linkStyle|direction)\b/i.test(line);
}

function parseEdgeLine(line: string): null | { sourceNode: ParsedNode; targetNode: ParsedNode; label?: string } {
  const labeledMiddle = line.match(/^(.+?)\s+--\s+(.+?)\s+-->\s+(.+)$/);
  if (labeledMiddle) return edgeFromParts(labeledMiddle[1], labeledMiddle[3], labeledMiddle[2]);

  const pipeLabel = line.match(/^(.+?)\s*(-->|==>|-.->|--x|--o|---)\s*\|(.+?)\|\s*(.+)$/);
  if (pipeLabel) return edgeFromParts(pipeLabel[1], pipeLabel[4], pipeLabel[3]);

  const plain = line.match(/^(.+?)\s*(-->|==>|-.->|--x|--o|---)\s*(.+)$/);
  if (plain) return edgeFromParts(plain[1], plain[3]);

  return null;
}

function edgeFromParts(source: string, target: string, label?: string) {
  const sourceNode = parseNodeRef(source);
  const targetNode = parseNodeRef(target);
  if (!sourceNode || !targetNode) return null;
  return { sourceNode, targetNode, label: cleanLabel(label || '') };
}

function parseNodeRef(value: string): ParsedNode | null {
  const token = value.trim();
  if (!token) return null;
  const match = token.match(/^([A-Za-z0-9_.$:-]+)\s*(.*)$/);
  if (!match) return null;
  const id = match[1];
  const shapeText = match[2] || '';
  return { id, label: extractLabel(shapeText) || id, shape: shapeText ? shapeText.slice(0, 2) : '' };
}

function extractLabel(shapeText: string): string {
  const text = shapeText.trim();
  if (!text) return '';
  const patterns = [
    /\{\{\s*(.+?)\s*\}\}/,
    /\(\(\s*(.+?)\s*\)\)/,
    /\(\[\s*(.+?)\s*\]\)/,
    /\[\(\s*(.+?)\s*\)\]/,
    /\[\[\s*(.+?)\s*\]\]/,
    /\[\s*(.+?)\s*\]/,
    /\(\s*(.+?)\s*\)/,
    /\{\s*(.+?)\s*\}/,
    /\/\s*(.+?)\s*\//,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return cleanLabel(match[1]);
  }
  return cleanLabel(text);
}

function cleanLabel(value: string): string {
  return String(value || '').replace(/^["'`]|["'`]$/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
}

function labelForKind(kind: NodeKind): string {
  const labels: Record<NodeKind, string> = {
    trigger: 'TRIGGER',
    page: 'PAGE',
    ui_component: 'UI COMPONENT',
    controller: 'STATE',
    service: 'SERVICE',
    repository: 'REPOSITORY',
    datasource: 'DATA SOURCE',
    model: 'MODEL',
    database: 'DATABASE',
    external: 'EXTERNAL',
    utility: 'UTILITY',
    file: 'FILE',
    unknown: 'NEEDS REVIEW',
  };
  return labels[kind];
}

function colorForKind(kind: NodeKind): string {
  const colors: Record<NodeKind, string> = {
    trigger: '#d97706',
    page: '#2787a7',
    ui_component: '#4f8aa8',
    controller: '#7c5cc4',
    service: '#3b7f55',
    repository: '#4f6f52',
    datasource: '#2f9e44',
    model: '#0f9f9a',
    database: '#2f80ed',
    external: '#7c3aed',
    utility: '#b7791f',
    file: '#64748b',
    unknown: '#7a7a7a',
  };
  return colors[kind];
}

function iconForKind(kind: NodeKind) {
  const icons: Record<NodeKind, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
    trigger: Zap,
    page: Monitor,
    ui_component: Component,
    controller: SlidersHorizontal,
    service: Workflow,
    repository: Archive,
    datasource: HardDrive,
    model: Boxes,
    database: Database,
    external: Globe,
    utility: Wrench,
    file: FileCode,
    unknown: CircleHelp,
  };
  return icons[kind] || CircleHelp;
}

function domainColor(index: number): string {
  const palette = ['#2f855a', '#2b6cb0', '#b7791f', '#805ad5', '#0f766e', '#be4b49', '#4a6f8a', '#6b7f3f'];
  return palette[index % palette.length];
}

function titleCase(value: string): string {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function render(input: RenderInput) {
  let root = roots.get(input.container);
  if (!root) {
    root = createRoot(input.container);
    roots.set(input.container, root);
  }
  input.container.classList.add('fp-roadmap-root');
  root.render(<GraphRenderer {...input} />);
}

function unmount(container: HTMLElement) {
  const root = roots.get(container);
  if (!root) return;
  root.unmount();
  roots.delete(container);
  container.classList.remove('fp-roadmap-root');
  currentControls = null;
}

declare global {
  interface Window {
    FlowPilotRoadmapRenderer?: {
      render: (input: RenderInput) => void;
      unmount: (container: HTMLElement) => void;
      zoomIn: () => void;
      zoomOut: () => void;
      fitView: () => void;
      reset: () => void;
    };
  }
}

window.FlowPilotRoadmapRenderer = {
  render,
  unmount,
  zoomIn: () => currentControls?.zoomIn(),
  zoomOut: () => currentControls?.zoomOut(),
  fitView: () => currentControls?.fitView(),
  reset: () => currentControls?.reset(),
};
