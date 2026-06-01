import { describe, expect, it } from 'vitest';
import { buildMermaidSequence } from '../../src/mcp/mermaidBuilder';
import type { Node } from '../../src/types/flow';

describe('mermaidBuilder', () => {
  it('summarizes auth-to-note sequence diagrams into a small participant set', () => {
    const nodes = [
      node('user', 'User', 'external'),
      node('auth_gate', 'AuthGate checks getCurrentUser()', 'ui'),
      node('auth_impl_login', 'AuthRepositoryImpl.login()', 'repository'),
      node('auth_impl_register', 'AuthRepositoryImpl.register()', 'repository'),
      node('note_impl_save', 'NoteRepositoryImpl.saveNote()', 'repository'),
      node('save_notes', 'LocalDatasources.saveNotes()', 'datasource'),
      node('extra_detail', 'RegisterParam(email, password)', 'model'),
    ];

    const sequence = buildMermaidSequence(nodes, [
      { from: 'user', to: 'auth_gate', label: 'Open app' },
      { from: 'auth_gate', to: 'auth_impl_login', label: 'login()' },
    ]);

    expect(sequence).toContain('participant app as');
    expect(sequence).toContain('alt Session exists');
    expect(sequence).toContain('app->>notes: saveNote()');
    expect(sequence).not.toContain('participant extra_detail');
    expect(sequence.match(/participant /g)?.length).toBe(4);
  });
});

function node(id: string, label: string, type: Node['type']): Node {
  return {
    id,
    label,
    type,
    file: null,
    lineStart: null,
    lineEnd: null,
  };
}
