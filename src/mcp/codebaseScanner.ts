/**
 * Flow Pilot — Codebase Scanner
 * Discovers relevant files in workspace based on prompt keywords
 */

import * as vscode from 'vscode';

export interface ScannedFile {
  path: string;
  content: string;
  reason: string;
}

/** Extract meaningful keywords from a natural language prompt */
export function extractKeywords(prompt: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'down',
    'show', 'find', 'generate', 'create', 'make', 'display', 'trace',
    'flow', 'diagram', 'chart', 'visualize', 'visualise', 'map',
    'pelajari', 'tunjukkan', 'cari', 'alur', 'dari', 'sampai', 'yang',
    'dan', 'di', 'ke', 'ini', 'itu', 'adalah', 'dengan', 'untuk',
  ]);

  // Extract words and camelCase/snake_case segments
  const words: string[] = [];

  // Split on whitespace and punctuation
  const tokens = prompt.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.length >= 2 && !stopWords.has(lower)) {
      words.push(lower);
    }

    // Split camelCase: paymentController → payment, controller
    const camelParts = token.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
    for (const part of camelParts) {
      const pLower = part.toLowerCase();
      if (pLower.length >= 3 && !stopWords.has(pLower)) {
        words.push(pLower);
      }
    }
  }

  // Deduplicate
  return [...new Set(words)];
}

/** Scan workspace for files relevant to the prompt */
export async function scanWorkspace(
  prompt: string,
  workspacePath: string
): Promise<ScannedFile[]> {
  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) {
    return [];
  }

  const scannedFiles: ScannedFile[] = [];
  const seenPaths = new Set<string>();

  // Build glob patterns from keywords
  const patterns = keywords.map((kw) => `**/*${kw}*`);

  // Search for files matching keywords
  for (const pattern of patterns) {
    try {
      const files = await vscode.workspace.findFiles(
        pattern,
        '**/node_modules/**',
        20 // limit per keyword
      );

      for (const fileUri of files) {
        const relativePath = vscode.workspace.asRelativePath(fileUri);
        if (seenPaths.has(relativePath)) continue;
        seenPaths.add(relativePath);

        try {
          const doc = await vscode.workspace.openTextDocument(fileUri);
          const content = doc.getText();

          // Skip very large files (>50KB)
          if (content.length > 50_000) continue;

          // Check if file content actually contains relevant keywords
          const contentLower = content.toLowerCase();
          const matchingKeywords = keywords.filter((kw) =>
            contentLower.includes(kw)
          );

          if (matchingKeywords.length > 0) {
            scannedFiles.push({
              path: relativePath,
              content: content.substring(0, 20_000), // Truncate for AI context
              reason: `Contains keywords: ${matchingKeywords.join(', ')}`,
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Skip failed pattern searches
    }
  }

  // Sort by relevance (more keyword matches = higher)
  scannedFiles.sort((a, b) => {
    const aMatches = keywords.filter((kw) =>
      a.content.toLowerCase().includes(kw)
    ).length;
    const bMatches = keywords.filter((kw) =>
      b.content.toLowerCase().includes(kw)
    ).length;
    return bMatches - aMatches;
  });

  // Limit to top 30 most relevant files
  return scannedFiles.slice(0, 30);
}
