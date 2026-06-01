// Flow Pilot — Flow Viewer Logic
// Handles: Mermaid rendering, native SVG fallback, zoom, pan, tabs, node click, inspector
// Inspector pattern matches Graph Pilot: always visible, direct content update on node tap

(function () {
  const vscode = acquireVsCodeApi();

  function log(level, message, data) {
    const payload = {
      level,
      message,
      data: data || null,
      diagramType: currentDiagramType,
      hasFlowData: Boolean(flowData),
      timestamp: new Date().toISOString(),
    };
    if (level === 'error') {
      console.error('[Flow Pilot Viewer]', message, data || '');
    } else {
      console.log('[Flow Pilot Viewer]', message, data || '');
    }
    vscode.postMessage({ type: 'viewerLog', payload });
  }

  // State
  let flowData = null;
  let currentDiagramType = 'flowchart';
  let selectedNodeId = null;
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMoved = false;
  let renderNonce = 0;

  // Inspector resize state
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;

  // Elements
  const diagramContainer = document.getElementById('diagram-container');
  const diagramDiv = document.getElementById('diagram');
  const legendEl = document.getElementById('legend');
  const inspectorContent = document.getElementById('inspector-content');
  const inspectorPanel = document.getElementById('inspector');
  const resizeHandle = document.getElementById('inspector-resize-handle');
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomFitBtn = document.getElementById('zoom-fit');
  const zoomResetBtn = document.getElementById('zoom-reset');
  const zoomLevel = document.getElementById('zoom-level');
  const progressDiv = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const errorBanner = document.getElementById('error-banner');
  const errorText = document.getElementById('error-text');
  const tabBtns = document.querySelectorAll('.tab-btn');

  diagramDiv.innerHTML = '<div class="diagram-loading">Waiting for flow data...</div>';
  log('info', 'viewerScriptLoaded', {
    mermaidGlobal: typeof window.mermaid,
    flowPilotMermaid: typeof window.FlowPilotMermaid,
    hasDiagramContainer: Boolean(diagramContainer),
    hasDiagramDiv: Boolean(diagramDiv),
    hasInspector: Boolean(inspectorContent),
    tabCount: tabBtns.length,
  });

  // ─── Messages from Extension Host ───

  window.addEventListener('message', (event) => {
    const msg = event.data;
    log('info', 'messageReceived', {
      type: msg && msg.type,
      hasPayload: Boolean(msg && msg.payload),
      flowId: msg && msg.payload && msg.payload.flowId,
      nodeCount: msg && msg.payload && msg.payload.nodes ? msg.payload.nodes.length : undefined,
      edgeCount: msg && msg.payload && msg.payload.edges ? msg.payload.edges.length : undefined,
      diagramCount: msg && msg.payload && msg.payload.diagrams ? msg.payload.diagrams.length : undefined,
      diagramTypes: msg && msg.payload && msg.payload.diagramTypes,
    });
    switch (msg.type) {
      case 'flowLoaded':
        flowData = msg.payload;
        currentDiagramType = flowData.diagramTypes[0] || 'flowchart';
        renderLegend();
        renderDiagram();
        updateInspectorPlaceholder();
        break;
      case 'generationProgress':
        showProgress(msg.payload.step, msg.payload.progress);
        break;
      case 'nodeDetail':
        // Extension host sent enriched detail (with codeSnippet) — update inspector
        updateInspectorFromDetail(msg.payload);
        break;
      case 'errorMessage':
        showError(msg.payload.message);
        break;
    }
  });

  // ─── Diagram Rendering ───

  async function renderDiagram() {
    if (!flowData) {
      log('warn', 'renderDiagramSkippedNoFlowData');
      return;
    }

    const nonce = ++renderNonce;
    diagramDiv.innerHTML = '<div class="diagram-loading">Rendering diagram...</div>';
    log('info', 'renderDiagramStart', {
      nonce,
      flowId: flowData.flowId,
      currentDiagramType,
      nodeCount: flowData.nodes ? flowData.nodes.length : 0,
      edgeCount: flowData.edges ? flowData.edges.length : 0,
      diagramCount: flowData.diagrams ? flowData.diagrams.length : 0,
      mermaidGlobal: typeof window.mermaid,
      flowPilotMermaid: typeof window.FlowPilotMermaid,
    });

    try {
      const diagram = getCurrentDiagram();
      if (!diagram || !diagram.mermaidSource) {
        throw new Error(`No Mermaid source found for ${currentDiagramType}`);
      }
      if (!window.FlowPilotMermaid || typeof window.FlowPilotMermaid.render !== 'function') {
        throw new Error('Mermaid renderer is not available');
      }

      const renderId = `flowpilot-${flowData.flowId || 'flow'}-${currentDiagramType}-${Date.now()}`;
      log('info', 'mermaidRenderCall', {
        renderId,
        type: diagram.type,
        sourceLength: diagram.mermaidSource.length,
        sourcePreview: diagram.mermaidSource.slice(0, 240),
      });
      const svg = await window.FlowPilotMermaid.render(renderId, diagram.mermaidSource);
      if (nonce !== renderNonce) return;

      diagramDiv.innerHTML = svg;
      const svgEl = diagramDiv.querySelector('svg');
      ensureSvgVisible(svgEl);
      resetViewToOrigin();
      log('info', 'mermaidRenderSuccess', {
        svgLength: svg.length,
        hasSvg: Boolean(svgEl),
      });
      hydrateMermaidNodes();
    } catch (err) {
      console.error('[Flow Pilot] Mermaid render failed, using native fallback:', err);
      log('error', 'mermaidRenderFailedUsingNativeFallback', {
        message: err && err.message ? err.message : String(err),
      });
      showError(`Mermaid render failed: ${err && err.message ? err.message : String(err)}`);
      if (currentDiagramType === 'sequence') {
        renderNativeSequence();
      } else {
        renderNativeFlowchart();
      }
    }

    attachNodeClickHandlers();
    applyTransform();
  }

  function getCurrentDiagram() {
    const diagrams = flowData.diagrams || [];
    return diagrams.find((diagram) => diagram.type === currentDiagramType) || diagrams[0];
  }

  function ensureSvgVisible(svg) {
    if (!svg) return;
    const viewBox = svg.getAttribute('viewBox');
    if ((!svg.getAttribute('width') || !svg.getAttribute('height')) && viewBox) {
      const parts = viewBox.split(/\s+/).map(Number);
      if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
        svg.setAttribute('width', String(Math.max(1, parts[2])));
        svg.setAttribute('height', String(Math.max(1, parts[3])));
      }
    }
    svg.style.display = 'block';
    svg.style.overflow = 'visible';
    svg.style.visibility = 'visible';
    svg.style.opacity = '1';
    svg.style.minWidth = `${Math.max(1, Number.parseFloat(svg.getAttribute('width') || '400'))}px`;
    svg.style.minHeight = `${Math.max(1, Number.parseFloat(svg.getAttribute('height') || '300'))}px`;
    diagramDiv.style.visibility = 'visible';
    diagramDiv.style.opacity = '1';
  }

  function resetViewToOrigin() {
    scale = 1.0;
    translateX = 0;
    translateY = 0;
    applyTransform();
  }

  function hydrateMermaidNodes() {
    const svg = diagramDiv.querySelector('svg');
    if (!svg || !flowData) return;

    const candidates = new Set([
      ...svg.querySelectorAll('g.node'),
      ...svg.querySelectorAll('g[class*="node"]'),
      // Sequence diagrams: Mermaid renders actors/participants as rect.actor /
      // text.actor carrying a `name` attribute (the node id), NOT as g.node.
      ...svg.querySelectorAll('.actor'),
      ...svg.querySelectorAll('[name]'),
      ...svg.querySelectorAll('g[class*="actor"]'),
      ...svg.querySelectorAll('g[class*="participant"]'),
    ]);

    let mappedCount = 0;
    candidates.forEach((group) => {
      const renderedId =
        group.getAttribute('name') || group.getAttribute('data-id') || group.id || '';
      const labelText = normalizeText(group.textContent || '');
      const nodeId = resolveFlowNodeId(renderedId, labelText);
      if (!nodeId) return;
      mappedCount++;

      const node = flowData.nodes.find((item) => item.id === nodeId);
      group.setAttribute('data-id', nodeId);
      group.classList.add('mermaid-clickable-node');
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute(
        'aria-label',
        node && node.file ? `Open ${node.label} in source code` : `Inspect ${node ? node.label : nodeId}`
      );
    });

    log('info', 'hydrateMermaidNodesDone', { candidateCount: candidates.size, mappedCount });
  }

  function renderNativeFlowchart() {
    const nodes = flowData.nodes || [];
    const edges = flowData.edges || [];
    if (nodes.length === 0) {
      diagramDiv.innerHTML = '<div class="empty-diagram">No nodes available for this flow.</div>';
      return;
    }

    const cardW = 220;
    const cardH = 76;
    const gapX = 96;
    const gapY = 76;
    const margin = 36;
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(nodes.length))));
    const rows = Math.ceil(nodes.length / cols);
    const width = Math.max(900, margin * 2 + cols * cardW + Math.max(0, cols - 1) * gapX);
    const height = Math.max(360, margin * 2 + rows * cardH + Math.max(0, rows - 1) * gapY);

    const positions = new Map();
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      positions.set(node.id, { x: margin + col * (cardW + gapX), y: margin + row * (cardH + gapY) });
    });

    const edgeSvg = edges.map((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return '';
      const fromCenter = { x: from.x + cardW / 2, y: from.y + cardH / 2 };
      const toCenter = { x: to.x + cardW / 2, y: to.y + cardH / 2 };
      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const x1 = horizontal && dx > 0 ? from.x + cardW : horizontal ? from.x : fromCenter.x;
      const y1 = horizontal ? fromCenter.y : dy > 0 ? from.y + cardH : from.y;
      const x2 = horizontal && dx > 0 ? to.x : horizontal ? to.x + cardW : toCenter.x;
      const y2 = horizontal ? toCenter.y : dy > 0 ? to.y : to.y + cardH;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const label = edge.label
        ? `<text x="${midX}" y="${midY - 8}" class="native-edge-label">${escapeSvg(edge.label)}</text>`
        : '';
      return `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" class="native-edge" marker-end="url(#arrow)" />${label}`;
    }).join('');

    const nodeSvg = nodes.map((node) => {
      const pos = positions.get(node.id);
      const title = escapeSvg(node.label);
      const type = escapeSvg(node.type || 'unknown');
      const file = escapeSvg(node.file || 'No source mapping');
      return `<g class="native-node node" data-id="${escapeAttr(node.id)}" transform="translate(${pos.x}, ${pos.y})">
          <rect width="${cardW}" height="${cardH}" rx="6" />
          <text x="14" y="24" class="native-node-title">${truncateSvg(title, 28)}</text>
          <text x="14" y="45" class="native-node-type">${type}</text>
          <text x="14" y="62" class="native-node-file">${truncateSvg(file, 34)}</text>
        </g>`;
    }).join('');

    diagramDiv.innerHTML = `<svg class="native-diagram" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="native-arrow" /></marker></defs>
        ${edgeSvg}${nodeSvg}</svg>`;
  }

  function renderNativeSequence() {
    const nodes = flowData.nodes || [];
    const edges = flowData.edges || [];
    if (nodes.length === 0) {
      diagramDiv.innerHTML = '<div class="empty-diagram">No participants available for this sequence.</div>';
      return;
    }

    const margin = 36;
    const laneGap = 180;
    const top = 44;
    const step = 58;
    const participantW = 138;
    const participantH = 44;
    const width = Math.max(900, margin * 2 + (nodes.length - 1) * laneGap + participantW);
    const height = Math.max(360, top + participantH + edges.length * step + 86);

    const xFor = new Map();
    nodes.forEach((node, index) => {
      xFor.set(node.id, margin + index * laneGap + participantW / 2);
    });

    const participants = nodes.map((node) => {
      const x = xFor.get(node.id) - participantW / 2;
      return `<g class="sequence-participant native-node node" data-id="${escapeAttr(node.id)}" transform="translate(${x}, ${top})">
          <rect width="${participantW}" height="${participantH}" rx="6" />
          <text x="${participantW / 2}" y="27" text-anchor="middle" class="native-node-title">${truncateSvg(escapeSvg(node.label), 18)}</text>
        </g>
        <line x1="${xFor.get(node.id)}" y1="${top + participantH}" x2="${xFor.get(node.id)}" y2="${height - 32}" class="sequence-lifeline" />`;
    }).join('');

    const messages = edges.map((edge, index) => {
      const fromX = xFor.get(edge.from);
      const toX = xFor.get(edge.to);
      if (fromX === undefined || toX === undefined) return '';
      const y = top + participantH + 34 + index * step;
      const labelX = (fromX + toX) / 2;
      const label = escapeSvg(edge.label || 'message');
      return `<line x1="${fromX}" y1="${y}" x2="${toX}" y2="${y}" class="sequence-message" marker-end="url(#arrow)" />
        <text x="${labelX}" y="${y - 8}" text-anchor="middle" class="native-edge-label">${truncateSvg(label, 28)}</text>`;
    }).join('');

    diagramDiv.innerHTML = `<svg class="native-diagram" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="native-arrow" /></marker></defs>
        ${participants}${messages}</svg>`;
  }

  // =====================================================================
  // Node Click Handling (matches Graph Pilot pattern)
  // Uses mouseup-based detection to avoid setPointerCapture conflicts
  // =====================================================================

  function attachNodeClickHandlers() {
    const svg = diagramDiv.querySelector('svg');
    if (!svg) return;
    log('info', 'attachNodeClickHandlers', {
      dataIdCount: svg.querySelectorAll('[data-id]').length,
      nodeClassCount: svg.querySelectorAll('g.node').length,
    });

    // Keyboard handler for accessibility
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const nodeGroup = e.target.closest('g.node,[data-id]');
      if (!nodeGroup) return;
      e.preventDefault();
      handleNodeClick(nodeGroup);
    });
  }

  function handleNodeClick(nodeGroup) {
    if (!flowData) return;

    const nodeId = resolveFlowNodeId(
      nodeGroup.getAttribute('data-id') || nodeGroup.id,
      normalizeText(nodeGroup.textContent || '')
    );
    if (!nodeId) return;

    selectedNodeId = nodeId;
    log('info', 'nodeClicked', { nodeId });

    // Highlight selected node
    diagramDiv.querySelectorAll('.node-highlight').forEach((n) => n.classList.remove('node-highlight'));
    nodeGroup.classList.add('node-highlight');

    // Update inspector directly from flowData (like Graph Pilot)
    const node = flowData.nodes.find((n) => n.id === nodeId);
    if (node) {
      updateInspector(node, flowData);
    }

    // Notify extension host (for editor auto-highlight + code snippet enrichment)
    vscode.postMessage({ type: 'nodeClick', payload: { nodeId } });
  }

  function resolveFlowNodeId(renderedId, labelText) {
    if (!flowData) return null;
    const id = renderedId || '';

    const exact = flowData.nodes.find((node) => node.id === id);
    if (exact) return exact.id;

    const normalized = id.replace(/^flowchart-/, '').replace(/-\d+$/, '');
    const normalizedExact = flowData.nodes.find((node) => node.id === normalized);
    if (normalizedExact) return normalizedExact.id;

    const sanitizedExact = flowData.nodes.find((node) => {
      const safeId = sanitizeMermaidId(node.id);
      return safeId === id || safeId === normalized;
    });
    if (sanitizedExact) return sanitizedExact.id;

    const byLength = [...flowData.nodes].sort((a, b) => b.id.length - a.id.length);
    const contained = byLength.find((node) => id.includes(node.id));
    if (contained) return contained.id;

    if (labelText) {
      const labelExact = flowData.nodes.find((node) => normalizeText(node.label) === labelText);
      if (labelExact) return labelExact.id;

      const labelContained = flowData.nodes.find((node) => {
        const normalizedLabel = normalizeText(node.label);
        return normalizedLabel && (labelText.includes(normalizedLabel) || normalizedLabel.includes(labelText));
      });
      if (labelContained) return labelContained.id;
    }

    return null;
  }

  // =====================================================================
  // Node Inspector — Graph Pilot Style (always visible, direct update)
  // =====================================================================

  function updateInspector(nodeData, data) {
    if (!inspectorContent) return;

    const edges = data.edges || [];
    const nodes = data.nodes || [];
    const incoming = edges.filter((e) => e.to === nodeData.id);
    const outgoing = edges.filter((e) => e.from === nodeData.id);

    let html = '';

    // NAME
    html += '<div class="inspector-field">' +
      '<span class="inspector-label">Name</span>' +
      '<span class="inspector-value inspector-value-strong">' + esc(nodeData.label) + '</span>' +
      '</div>';

    // TYPE
    html += '<div class="inspector-field">' +
      '<span class="inspector-label">Type</span>' +
      '<span class="inspector-badge">' + esc(nodeData.type) + '</span>' +
      '</div>';

    // FILE
    if (nodeData.file) {
      html += '<div class="inspector-field">' +
        '<span class="inspector-label">File</span>' +
        '<span class="inspector-value inspector-value-path">' + esc(nodeData.file) + '</span>' +
        '</div>';
    }

    // LINES
    if (nodeData.lineStart) {
      html += '<div class="inspector-field">' +
        '<span class="inspector-label">Lines</span>' +
        '<span class="inspector-value">' + nodeData.lineStart + '–' + (nodeData.lineEnd || nodeData.lineStart) + '</span>' +
        '</div>';
    }

    // DESCRIPTION
    if (nodeData.description) {
      html += '<div class="inspector-field">' +
        '<span class="inspector-label">Description</span>' +
        '<span class="inspector-value">' + esc(nodeData.description) + '</span>' +
        '</div>';
    }

    // SYMBOL
    if (nodeData.symbolName) {
      html += '<div class="inspector-field">' +
        '<span class="inspector-label">Symbol</span>' +
        '<span class="inspector-value inspector-value-strong">' + esc(nodeData.symbolName) + '</span>' +
        '</div>';
    }

    // REASON
    if (nodeData.reason) {
      html += '<div class="inspector-field">' +
        '<span class="inspector-label">Reason</span>' +
        '<span class="inspector-value">' + esc(nodeData.reason) + '</span>' +
        '</div>';
    }

    // CONFIDENCE
    if (typeof nodeData.confidence === 'number') {
      html += '<div class="inspector-field">' +
        '<span class="inspector-label">Confidence</span>' +
        '<span class="inspector-confidence ' + getConfidenceClass(nodeData.confidence) + '">' +
        Math.round(nodeData.confidence * 100) + '%</span>' +
        '</div>';
    }

    // EVIDENCE
    if (Array.isArray(nodeData.evidence) && nodeData.evidence.length > 0) {
      html += renderEvidence(nodeData.evidence);
    }

    // INCOMING
    if (incoming.length > 0) {
      html += '<div class="inspector-section">' +
        '<span class="inspector-section-title">Incoming (' + incoming.length + ')</span>';
      for (const edge of incoming) {
        const fromNode = nodes.find((n) => n.id === edge.from);
        html += '<div class="inspector-edge">← ' + esc(fromNode ? fromNode.label : edge.from) +
          ' <span class="inspector-edge-label">' + esc(edge.label || '') + '</span></div>';
      }
      html += '</div>';
    }

    // OUTGOING
    if (outgoing.length > 0) {
      html += '<div class="inspector-section">' +
        '<span class="inspector-section-title">Outgoing (' + outgoing.length + ')</span>';
      for (const edge of outgoing) {
        const toNode = nodes.find((n) => n.id === edge.to);
        html += '<div class="inspector-edge">→ ' + esc(toNode ? toNode.label : edge.to) +
          ' <span class="inspector-edge-label">' + esc(edge.label || '') + '</span></div>';
      }
      html += '</div>';
    }

    // ACTION BUTTONS
    if (nodeData.file) {
      html += '<div class="inspector-actions">' +
        '<button class="inspector-btn primary" id="inspectorOpenCodeBtn">Open Code</button>' +
        '<button class="inspector-btn secondary" id="inspectorHighlightBtn">Highlight Line</button>' +
        '</div>';
    }

    inspectorContent.innerHTML = html;

    // Wire action buttons
    const openBtn = document.getElementById('inspectorOpenCodeBtn');
    const highlightBtn = document.getElementById('inspectorHighlightBtn');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'openFile',
          payload: { file: nodeData.file, lineStart: nodeData.lineStart, lineEnd: nodeData.lineEnd },
        });
      });
    }

    if (highlightBtn) {
      highlightBtn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'highlightCode',
          payload: { file: nodeData.file, lineStart: nodeData.lineStart, lineEnd: nodeData.lineEnd },
        });
      });
    }
  }

  // ─── Legend (maps node-type icons to meanings for types present) ───

  const LEGEND_ITEMS = [
    { type: 'external', icon: '👤', label: 'User / Actor' },
    { type: 'ui', icon: '🖥️', label: 'Screen / Page' },
    { type: 'api', icon: '🔌', label: 'API Endpoint' },
    { type: 'controller', icon: '🎮', label: 'Controller' },
    { type: 'service', icon: '⚙️', label: 'Service / Logic' },
    { type: 'sdk', icon: '🧩', label: 'SDK / Client' },
    { type: 'repository', icon: '🗄️', label: 'Repository' },
    { type: 'datasource', icon: '🗄️', label: 'Data Source' },
    { type: 'model', icon: '📦', label: 'Model / Data' },
    { type: 'function', icon: '🔧', label: 'Function' },
    { type: 'method', icon: '🔧', label: 'Method' },
    { type: 'class', icon: '🏛️', label: 'Class' },
  ];

  function renderLegend() {
    if (!legendEl) return;
    if (!flowData || !Array.isArray(flowData.nodes) || flowData.nodes.length === 0) {
      legendEl.innerHTML = '';
      return;
    }
    const present = new Set(flowData.nodes.map((n) => n.type));
    const items = LEGEND_ITEMS.filter((item) => present.has(item.type));
    // Any node type not in the known list falls back to the code/file icon.
    const known = new Set(LEGEND_ITEMS.map((item) => item.type));
    if ([...present].some((t) => !known.has(t))) {
      items.push({ type: 'file', icon: '📄', label: 'Code / File' });
    }
    legendEl.innerHTML = items
      .map(
        (item) =>
          '<span class="legend-item"><span class="legend-icon">' +
          item.icon +
          '</span>' +
          esc(item.label) +
          '</span>'
      )
      .join('');
  }

  function updateInspectorPlaceholder() {
    if (inspectorContent) {
      inspectorContent.innerHTML = '<div class="inspector-placeholder"><p>Click a node to inspect</p></div>';
    }
  }

  // Extension host can send enriched detail (with codeSnippet) — update inspector with extra data
  function updateInspectorFromDetail(detail) {
    if (!inspectorContent || !detail) return;

    // If we already have the node displayed, just append code snippet if available
    if (detail.codeSnippet && selectedNodeId === detail.nodeId && !inspectorContent.querySelector('.code-snippet')) {
      const existing = inspectorContent.querySelector('.inspector-actions');
      if (existing) {
        const snippetHtml = '<div class="inspector-field">' +
          '<span class="inspector-label">Code</span>' +
          '<div class="code-snippet">' + esc(detail.codeSnippet) + '</div>' +
          '</div>';
        existing.insertAdjacentHTML('beforebegin', snippetHtml);
      }
    }
  }

  function renderEvidence(evidence) {
    let html = '<div class="inspector-section">' +
      '<span class="inspector-section-title">Evidence (' + evidence.length + ')</span>';
    for (const item of evidence) {
      const location = item.file
        ? item.file + (item.lineStart ? ':' + item.lineStart + (item.lineEnd ? '-' + item.lineEnd : '') : '')
        : item.kind;
      html += '<div class="inspector-evidence">' +
        '<span class="inspector-evidence-path">' + esc(location) + '</span>' +
        '<span class="inspector-evidence-reason">' + esc(item.reason || item.snippet || '') + '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function getConfidenceClass(c) {
    if (c >= 0.9) return 'confidence-high';
    if (c >= 0.7) return 'confidence-medium';
    return 'confidence-low';
  }

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Inspector Resize ───

  function isBottomMode() {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  if (resizeHandle) {
    resizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      resizeHandle.classList.add('active');
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartWidth = inspectorPanel.offsetWidth;
      resizeStartHeight = inspectorPanel.offsetHeight;
      document.body.style.cursor = isBottomMode() ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      resizeHandle.setPointerCapture(e.pointerId);
    });

    resizeHandle.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      e.preventDefault();
      if (isBottomMode()) {
        const delta = resizeStartY - e.clientY;
        const newHeight = Math.max(140, Math.min(window.innerHeight * 0.7, resizeStartHeight + delta));
        inspectorPanel.style.height = newHeight + 'px';
      } else {
        const delta = resizeStartX - e.clientX;
        const newWidth = Math.max(220, Math.min(600, resizeStartWidth + delta));
        inspectorPanel.style.width = newWidth + 'px';
      }
    });

    resizeHandle.addEventListener('pointerup', () => {
      if (!isResizing) return;
      isResizing = false;
      resizeHandle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    resizeHandle.addEventListener('lostpointercapture', () => {
      if (isResizing) {
        isResizing = false;
        resizeHandle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // ─── Zoom & Pan ───

  function applyTransform() {
    diagramDiv.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  }

  function clampScale(value) {
    return Math.max(0.25, Math.min(3.0, value));
  }

  function getViewportCenterPoint() {
    const rect = diagramContainer.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  function getContainerPoint(clientX, clientY) {
    const rect = diagramContainer.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function setZoom(newScale, focusPoint) {
    const nextScale = clampScale(newScale);
    const focus = focusPoint || getViewportCenterPoint();
    const diagramX = (focus.x - translateX) / scale;
    const diagramY = (focus.y - translateY) / scale;

    scale = nextScale;
    translateX = focus.x - diagramX * scale;
    translateY = focus.y - diagramY * scale;
    applyTransform();
  }

  function getNormalizedWheelDelta(e) {
    const multiplier = e.deltaMode === 1
      ? 16
      : e.deltaMode === 2
      ? Math.max(1, diagramContainer.clientHeight)
      : 1;
    return {
      x: e.deltaX * multiplier,
      y: e.deltaY * multiplier,
    };
  }

  function getSvgLocalBounds() {
    const svg = diagramDiv.querySelector('svg');
    if (!svg) return null;
    const svgRect = svg.getBoundingClientRect();
    const divRect = diagramDiv.getBoundingClientRect();
    if (svgRect.width <= 0 || svgRect.height <= 0 || scale <= 0) return null;

    return {
      x: (svgRect.left - divRect.left) / scale,
      y: (svgRect.top - divRect.top) / scale,
      width: svgRect.width / scale,
      height: svgRect.height / scale,
    };
  }

  function centerSvgAtCurrentScale(svgBounds) {
    const bounds = svgBounds || getSvgLocalBounds();
    if (!bounds) {
      translateX = 0;
      translateY = 0;
      return;
    }

    const container = diagramContainer.getBoundingClientRect();
    translateX = container.width / 2 - (bounds.x + bounds.width / 2) * scale;
    translateY = container.height / 2 - (bounds.y + bounds.height / 2) * scale;
  }

  function fitDiagramToViewport() {
    const bounds = getSvgLocalBounds();
    if (!bounds) return;

    const container = diagramContainer.getBoundingClientRect();
    const padding = 48;
    const scaleX = (container.width - padding) / bounds.width;
    const scaleY = (container.height - padding) / bounds.height;
    scale = clampScale(Math.min(scaleX, scaleY, 1.0));
    centerSvgAtCurrentScale(bounds);
    applyTransform();
  }

  zoomInBtn.addEventListener('click', () => setZoom(scale * 1.15));
  zoomOutBtn.addEventListener('click', () => setZoom(scale / 1.15));
  zoomFitBtn.addEventListener('click', fitDiagramToViewport);

  zoomResetBtn.addEventListener('click', () => {
    scale = 1.0;
    translateX = 0;
    translateY = 0;
    applyTransform();
  });

  diagramContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = getNormalizedWheelDelta(e);
    const isZoomGesture = e.ctrlKey || e.metaKey;

    if (isZoomGesture) {
      const focus = getContainerPoint(e.clientX, e.clientY);
      const zoomFactor = Math.exp(-delta.y * 0.0015);
      setZoom(scale * zoomFactor, focus);
      return;
    }

    const panX = e.shiftKey && Math.abs(delta.x) < 1 ? delta.y : delta.x;
    translateX -= panX;
    translateY -= delta.y;
    applyTransform();
  }, { passive: false });

  // Pan with mouse drag (NO setPointerCapture — allows SVG node clicks to work)
  let mouseDownX = 0;
  let mouseDownY = 0;

  diagramContainer.addEventListener('mousedown', (e) => {
    if (isResizing) return;
    if (e.button !== 0) return; // Left click only
    isDragging = true;
    dragMoved = false;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    dragStartX = e.clientX - translateX;
    dragStartY = e.clientY - translateY;
    diagramContainer.classList.add('grabbing');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging || isResizing) return;
    const dx = e.clientX - mouseDownX;
    const dy = e.clientY - mouseDownY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    translateX = e.clientX - dragStartX;
    translateY = e.clientY - dragStartY;
    applyTransform();
  });

  document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    diagramContainer.classList.remove('grabbing');

    // If mouse didn't move → this is a click, detect node under cursor
    if (!dragMoved) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el) {
        const nodeGroup = el.closest('g.node,[data-id]');
        if (nodeGroup) {
          handleNodeClick(nodeGroup);
        } else {
          // Clicked empty space → reset inspector
          selectedNodeId = null;
          updateInspectorPlaceholder();
        }
      }
    }
  });

  // ─── Diagram Type Tabs ───

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentDiagramType = btn.getAttribute('data-type');
      renderDiagram();
    });
  });

  // ─── Progress ───

  function showProgress(step, progress) {
    progressDiv.classList.remove('hidden');
    progressFill.style.width = `${progress}%`;
    progressText.textContent = step;
  }

  // ─── Error ───

  function showError(message) {
    errorBanner.classList.remove('hidden');
    errorText.textContent = message;
    setTimeout(() => errorBanner.classList.add('hidden'), 5000);
  }

  // ─── Helpers ───

  function escapeSvg(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(text) {
    return escapeSvg(text).replace(/'/g, '&#39;');
  }

  function truncateSvg(text, maxLength) {
    const value = String(text || '');
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .trim()
      .toLowerCase();
  }

  function sanitizeMermaidId(id) {
    const clean = String(id || '').replace(/[^a-zA-Z0-9_]/g, '_');
    return /^[a-zA-Z_]/.test(clean) ? clean : `n_${clean}`;
  }

  log('info', 'postingReady');
  vscode.postMessage({ type: 'ready', payload: {} });
})();
