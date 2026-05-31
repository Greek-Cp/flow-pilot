// Flow Pilot — Mermaid Initialization for Webview

(function () {
  // Mermaid is loaded from the extension bundle.
  // Configuration uses VS Code theme variables.

  function getThemeVariables() {
    const style = getComputedStyle(document.documentElement);
    const isLight = document.body.classList.contains('vscode-light');
    const foreground = style.getPropertyValue('--vscode-foreground').trim() || (isLight ? '#1f2328' : '#cccccc');
    const background = style.getPropertyValue('--vscode-editor-background').trim() || (isLight ? '#ffffff' : '#1e1e1e');
    const border = style.getPropertyValue('--vscode-panel-border').trim() || (isLight ? '#8c8c8c' : '#404040');
    const accent = style.getPropertyValue('--vscode-button-background').trim() || '#0e639c';
    const nodeFill = isLight ? '#f8fbff' : '#1f2933';
    const noteFill = isLight ? '#fff8dc' : '#2f2a16';

    return {
      primaryColor: nodeFill,
      primaryTextColor: foreground,
      primaryBorderColor: accent,
      lineColor: accent,
      secondaryColor: background,
      tertiaryColor: nodeFill,
      background,
      mainBkg: nodeFill,
      secondBkg: background,
      nodeBorder: accent,
      clusterBkg: background,
      titleColor: foreground,
      edgeLabelBackground: background,
      textColor: foreground,
      actorBkg: nodeFill,
      actorBorder: accent,
      actorTextColor: foreground,
      noteBkgColor: noteFill,
      noteTextColor: foreground,
      activationBkgColor: nodeFill,
      activationBorderColor: border,
      fontSize: '14px',
    };
  }

  function getMermaidConfig() {
    return {
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
    };
  }

  // Initialize Mermaid with theme
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize(getMermaidConfig());
  }

  /** Render a Mermaid diagram and return SVG string */
  window.FlowPilotMermaid = {
    render: async function (id, source) {
      if (typeof mermaid === 'undefined') {
        throw new Error('Mermaid.js not loaded');
      }
      try {
        // Refresh theme variables before each render
        mermaid.initialize(getMermaidConfig());
        const { svg } = await mermaid.render(id, source);
        return svg;
      } catch (err) {
        console.error('[Flow Pilot] Mermaid render error:', err);
        throw err;
      }
    },
  };
})();
