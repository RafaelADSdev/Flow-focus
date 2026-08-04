import { describe, expect, it } from 'vitest';
import {
  getUnavailableRoletaFailure,
  isRoletaRefreshRequired,
  summarizeRoletaDraft,
} from './config-state';

describe('estado da configuracao de roletas', () => {
  it('trata roleta removida da selecao como conflito recuperavel', () => {
    const failure = getUnavailableRoletaFailure(
      [{ roletaIds: ['r1', 'removida'], roletaIdsAntes: ['r1'] }],
      new Set(['r1', 'r2']),
    );

    expect(failure?.code).toBe('conflict');
    expect(isRoletaRefreshRequired(failure?.code ?? '')).toBe(true);
    expect(isRoletaRefreshRequired('partial')).toBe(true);
    expect(isRoletaRefreshRequired('validation')).toBe(false);
  });

  it('tambem detecta uma roleta removida apenas do baseline', () => {
    const failure = getUnavailableRoletaFailure(
      [{ roletaIds: ['r1'], roletaIdsAntes: ['r1', 'removida'] }],
      new Set(['r1', 'r2']),
    );

    expect(failure?.code).toBe('conflict');
  });

  it('aceita o lote quando todas as roletas continuam gerenciaveis', () => {
    expect(getUnavailableRoletaFailure(
      [{ roletaIds: ['r2'], roletaIdsAntes: ['r1'] }],
      new Set(['r1', 'r2']),
    )).toBeNull();
  });

  it('nao marca mudanca quando apenas a ordem difere', () => {
    const summary = summarizeRoletaDraft({
      brokerIds: ['b1'],
      roletaIds: ['r1', 'r2', 'r3'],
      baseline: { b1: ['r1', 'r2'] },
      selected: { b1: ['r2', 'r1'] },
    });

    expect(summary).toMatchObject({ dirty: false, cellChanges: 0, brokersChanged: 0 });
  });

  it('conta celulas e corretores alterados', () => {
    const summary = summarizeRoletaDraft({
      brokerIds: ['b1', 'b2'],
      roletaIds: ['r1', 'r2', 'r3'],
      baseline: { b1: ['r1', 'r2'], b2: ['r1'] },
      selected: { b1: ['r2', 'r3'], b2: ['r1', 'r2'] },
    });

    expect(summary).toMatchObject({ dirty: true, cellChanges: 3, brokersChanged: 2 });
    expect([...summary.dirtyBrokerIds]).toEqual(['b1', 'b2']);
  });
});
