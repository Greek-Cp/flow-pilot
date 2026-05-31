// Flow Pilot — Flow Viewer Logic
// Handles: diagram rendering, zoom, pan, tabs, node click, inspector

(function () {
  const vscode = acquireVsCodeApi();

  // State
  let flowData = null;
  let currentDiagramType = 'flowchart';
  let scale = 1.0;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMoved = false;

  // Elements
  const diagramContainer = document.getElementById('diagram-container');
  const diagramDiv = document.getElementById('diagram');
  const inspectorPanel = document.getElementById('inspector');
  const inspectorContent = document.getElementById('inspector-content');
  const inspectorTitle = document.getElementById('inspector-title');
  const inspectorClose = document.getElementById('inspector-close');
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

  // ─── Messages from Extension Host ───

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'flowLoaded':
        flowData = msg.payload;
        currentDiagramType = flowData.diagramTypes[0] || 'flowchart';
        renderDiagram();
        break;
      case 'generationProgress':
        showProgress(msg.payload.step, msg.payload.progress);
        break;
      case 'nodeDetail':
        showNodeDetail(msg.payload);
        break;
      case 'errorMessage':
        showError(msg.payload.message);
        break;
    }
  });

  // ─── Diagram Rendering ───

  async function renderDiagram() {
    if (!flowData) return;

    const diagram = flowData.diagrams.find((d) => d.type === currentDiagramType);
    if (!diagram) {
      diagramDiv.innerHTML = `<p>No ${currentDiagramType} diagram available.</p>`;
      return;
    }

    try {
      const svgId = `mermaid-${Date.now()}`;
      const svg = await FlowPilotMermaid.render(svgId, diagram.mermaidSource);
      diagramDiv.innerHTML = svg;

      // Attach node click handlers via event delegation
      attachNodeClickHandlers();
      applyTransform();
    } catch (err) {
      diagramDiv.innerHTML = `
        <div style="padding: 16px;">
          <p style="color: var(--vscode-errorForeground);">Failed to render diagram.</p>
          <pre style="margin-top: 8px; font-size: 0.85em;">${escapeHtml(diagram.mermaidSource)}</pre>
        </div>`;
    }
  }

  // ─── Node Click Handling ───

  function attachNodeClickHandlers() {
    const svg = diagramDiv.querySelector('svg');
    if (!svg) return;

    svg.addEventListener('click', (e) => {
      if (dragMoved) return; // Ignore if was a drag

      // Find the closest node group element with data-id
      const nodeGroup = e.target.closest('[id]');
      if (!nodeGroup) return;

      const nodeId = nodeGroup.id;
      // Send node click to extension
      vscode.postMessage({ type: 'nodeClick', payload: { nodeId } });
    });
  }

  // ─── Inspector ───

  function showNodeDetail(detail) {
    inspectorPanel.classList.remove('hidden');

    let html = '';

    html += `<div class="inspector-field">
      <div class="inspector-label">Label</div>
      <div class="inspector-value"><strong>${escapeHtml(detail.label)}</strong></div>
    </div>`;

    html += `<div class="inspector-field">
      <div class="inspector-label">Type</div>
      <div class="inspector-value"><span class="inspector-badge">${escapeHtml(detail.type)}</span></div>
    </div>`;

    if (detail.file) {
      html += `<div class="inspector-field">
        <div class="inspector-label">File</div>
        <div class="inspector-value">${escapeHtml(detail.file)}</div>
      </div>`;

      html += `<div class="inspector-field">
        <div class="inspector-label">Line Range</div>
        <div class="inspector-value">${detail.lineStart} – ${detail.lineEnd}</div>
      </div>`;
    }

    if (detail.description) {
      html += `<div class="inspector-field">
        <div class="inspector-label">Description</div>
        <div class="inspector-value">${escapeHtml(detail.description)}</div>
      </div>`;
    }

    if (detail.codeSnippet) {
      html += `<div class="inspector-field">
        <div class="inspector-label">Code</div>
        <div class="code-snippet">${escapeHtml(detail.codeSnippet)}</div>
      </div>`;
    }

    if (!detail.file) {
      html += `<div class="no-mapping">This node does not have source code mapping yet.</div>`;
    } else {
      html += `<div class="inspector-actions">
        <button class="inspector-btn" id="btn-open-file">Open File</button>
        <button class="inspector-btn secondary" id="btn-highlight">Highlight Code</button>
      </div>`;
    }

    inspectorContent.innerHTML = html;

    // Wire action buttons
    const openBtn = document.getElementById('btn-open-file');
    const highlightBtn = document.getElementById('btn-highlight');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'openFile',
          payload: { file: detail.file, lineStart: detail.lineStart, lineEnd: detail.lineEnd },
        });
      });
    }

    if (highlightBtn) {
      highlightBtn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'highlightCode',
          payload: { file: detail.file, lineStart: detail.lineStart, lineEnd: detail.lineEnd },
        });
      });
    }
  }

  inspectorClose.addEventListener('click', () => {
    inspectorPanel.classList.add('hidden');
  });

  // ─── Zoom & Pan ───

  function applyTransform() {
    diagramDiv.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  }

  function setZoom(newScale) {
    scale = Math.max(0.25, Math.min(3.0, newScale));
    applyTransform();
  }

  zoomInBtn.addEventListener('click', () => setZoom(scale + 0.1));
  zoomOutBtn.addEventListener('click', () => setZoom(scale - 0.1));

  zoomFitBtn.addEventListener('click', () => {
    const container = diagramContainer.getBoundingClientRect();
    const diagram = diagramDiv.getBoundingClientRect();
    if (diagram.width > 0 && diagram.height > 0) {
      const scaleX = (container.width - 48) / diagram.width;
      const scaleY = (container.height - 48) / diagram.height;
      scale = Math.min(scaleX, scaleY, 1.0);
      translateX = 0;
      translateY = 0;
      applyTransform();
    }
  });

  zoomResetBtn.addEventListener('click', () => {
    scale = 1.0;
    translateX = 0;
    translateY = 0;
    applyTransform();
  });

  // Mouse wheel zoom
  diagramContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(scale + delta);
  }, { passive: false });

  // Pan with drag
  diagramContainer.addEventListener('pointerdown', (e) => {
    isDragging = true;
    dragMoved = false;
    dragStartX = e.clientX - translateX;
    dragStartY = e.clientY - translateY;
    diagramContainer.classList.add('grabbing');
    diagramContainer.setPointerCapture(e.pointerId);
  });

  diagramContainer.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX - translateX;
    const dy = e.clientY - dragStartY - translateY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 5) dragMoved = true;
    translateX = e.clientX - dragStartX;
    translateY = e.clientY - dragStartY;
    applyTransform();
  });

  diagramContainer.addEventListener('pointerup', (e) => {
    isDragging = false;
    diagramContainer.classList.remove('grabbing');
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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
