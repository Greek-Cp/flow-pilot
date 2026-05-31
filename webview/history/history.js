// Flow Pilot — History Page Logic

(function () {
  const vscode = acquireVsCodeApi();

  const emptyState = document.getElementById('empty-state');
  const historyList = document.getElementById('history-list');
  const loading = document.getElementById('loading');

  // Handle messages from extension host
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'historyLoaded':
        renderHistory(message.entries);
        break;
    }
  });

  function renderHistory(entries) {
    loading.classList.add('hidden');

    if (!entries || entries.length === 0) {
      emptyState.classList.remove('hidden');
      historyList.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    historyList.classList.remove('hidden');
    historyList.innerHTML = '';

    for (const entry of entries) {
      const item = createFlowItem(entry);
      historyList.appendChild(item);
    }
  }

  function createFlowItem(entry) {
    const item = document.createElement('div');
    item.className = 'flow-item';
    item.setAttribute('data-flow-id', entry.flowId);

    const date = new Date(entry.createdAt);
    const dateStr = date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    item.innerHTML = `
      <div class="flow-item-header">
        <span class="flow-item-title">${escapeHtml(entry.title)}</span>
        <span class="flow-item-date">${dateStr}</span>
      </div>
      <div class="flow-item-description">${escapeHtml(entry.description)}</div>
      <div class="flow-item-meta">
        <span class="meta-badge"><span class="status-dot status-${entry.status}"></span> ${entry.status}</span>
        <span class="meta-badge">${entry.diagramTypes.join(', ')}</span>
        <span class="meta-badge">${entry.nodeCount} nodes</span>
        <span class="meta-badge">${entry.sourceFileCount} files</span>
      </div>
      <div class="flow-item-actions">
        <button class="action-btn" data-action="openFlow" data-id="${entry.flowId}">Open</button>
        <button class="action-btn" data-action="renameFlow" data-id="${entry.flowId}">Rename</button>
        <button class="action-btn" data-action="copyPrompt" data-id="${entry.flowId}">Copy Prompt</button>
        <button class="action-btn danger" data-action="deleteFlow" data-id="${entry.flowId}">Delete</button>
      </div>
    `;

    // Click on item to open
    item.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn')) return; // Don't open when clicking actions
      vscode.postMessage({ type: 'openFlow', payload: { flowId: entry.flowId } });
    });

    // Action buttons
    item.querySelectorAll('.action-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const flowId = btn.getAttribute('data-id');
        const payload = { flowId };

        if (action === 'renameFlow') {
          const nextTitle = window.prompt('Rename flow', entry.title);
          if (!nextTitle || nextTitle.trim() === entry.title) return;
          payload.newTitle = nextTitle.trim();
        }

        vscode.postMessage({ type: action, payload });
      });
    });

    return item;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  vscode.postMessage({ type: 'ready', payload: {} });
})();
