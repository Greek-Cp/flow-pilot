// Flow Pilot — Mermaid Initialization for Webview

(function () {
  // Mermaid is loaded via CDN or bundled script
  // Configuration uses VS Code theme variables

  function getThemeVariables() {
    const style = getComputedStyle(document.documentElement);
    return {
      primaryColor: style.getPropertyValue('--vscode-button-background').trim() || '#4ec9b0',
      primaryTextColor: style.getPropertyValue('--vscode-button-foreground').trim() || '#ffffff',
      primaryBorderColor: style.getPropertyValue('--vscode-panel-border').trim() || '#404040',
      lineColor: style.getPropertyValue('--vscode-foreground').trim() || '#cccccc',
      secondaryColor: style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e',
      tertiaryColor: style.getPropertyValue('--vscode-sideBar-background').trim() || '#252526',
      background: style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e',
      mainBkg: style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e',
      nodeBorder: style.getPropertyValue('--vscode-panel-border').trim() || '#404040',
      clusterBkg: style.getPropertyValue('--vscode-sideBar-background').trim() || '#252526',
      titleColor: style.getPropertyValue('--vscode-foreground').trim() || '#cccccc',
      edgeLabelBackground: style.getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e',
      textColor: style.getPropertyValue('--vscode-foreground').trim() || '#cccccc',
      fontSize: '14px',
    };
  }

  // Initialize Mermaid with theme
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: getThemeVariables(),
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
      },
      sequence: {
        useMaxWidth: false,
        actorMargin: 50,
      },
    });
  }

  /** Render a Mermaid diagram and return SVG string */
  window.FlowPilotMermaid = {
    render: async function (id, source) {
      if (typeof mermaid === 'undefined') {
        throw new Error('Mermaid.js not loaded');
      }
      try {
        // Refresh theme variables before each render
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: getThemeVariables(),
          securityLevel: 'loose',
        });
        const { svg } = await mermaid.render(id, source);
        return svg;
      } catch (err) {
        console.error('[Flow Pilot] Mermaid render error:', err);
        throw err;
      }
    },
  };
})();
