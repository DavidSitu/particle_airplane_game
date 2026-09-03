import { describe, expect, it } from 'vitest';
import { GateSession, type GateAction } from '../../src/systems/gate';

describe('GateSession', () => {
  it('exposes only the expected Q1 action and treats other actions as no-ops', () => {
    const gate = new GateSession();
    const initial = gate.snapshot();

    for (const action of [
      { type: 'ANSWER_Q2', answer: 'yes' },
      { type: 'SUBMIT_CODE', value: 'basic' },
    ] satisfies readonly GateAction[]) {
      const transition = gate.dispatch(action);
      expect(transition.status).toBe('invalid-action');
      expect(transition.snapshot).toEqual(initial);
    }
  });

  it('advances Q1 Yes, then accepts both Q2 answers with the correct outcomes', () => {
    const passingGate = new GateSession();
    expect(passingGate.dispatch({ type: 'ANSWER_Q1_YES' })).toMatchObject({
      status: 'advanced',
      snapshot: { step: 'question-2' },
    });
    expect(passingGate.dispatch({ type: 'ANSWER_Q2', answer: 'yes' })).toMatchObject({
      status: 'advanced',
      snapshot: { step: 'secret-code' },
    });

    const rejectedGate = new GateSession();
    rejectedGate.dispatch({ type: 'ANSWER_Q1_YES' });
    expect(rejectedGate.dispatch({ type: 'ANSWER_Q2', answer: 'no' })).toEqual({
      status: 'rejected',
      snapshot: { step: 'rejected', reason: 'question-2-no' },
    });
  });

  it('keeps rejection terminal until reset', () => {
    const gate = new GateSession();
    gate.dispatch({ type: 'ANSWER_Q1_YES' });
    gate.dispatch({ type: 'ANSWER_Q2', answer: 'no' });

    const invalid = gate.dispatch({ type: 'ANSWER_Q1_YES' });
    expect(invalid.status).toBe('invalid-action');
    expect(invalid.snapshot).toEqual({ step: 'rejected', reason: 'question-2-no' });

    expect(gate.dispatch({ type: 'RESET' })).toMatchObject({
      status: 'advanced',
      snapshot: { step: 'question-1' },
    });
  });

  it.each([
    [' basic ', true],
    ['basic', true],
    ['Basic', false],
    ['BASIC', false],
    ['', false],
    [' basic\n', true],
  ])('handles code %j with trim and case-sensitive comparison', (value, passes) => {
    const gate = new GateSession();
    gate.dispatch({ type: 'ANSWER_Q1_YES' });
    gate.dispatch({ type: 'ANSWER_Q2', answer: 'yes' });

    const transition = gate.dispatch({ type: 'SUBMIT_CODE', value });
    expect(transition.snapshot.step).toBe(passes ? 'passed' : 'secret-code');
    if (passes) {
      expect(transition.status).toBe('passed');
    } else {
      expect(transition.status).toBe('invalid-action');
      expect(transition.snapshot).toEqual({ step: 'secret-code', error: 'incorrect-code' });
    }
  });

  it('allows reset from any step without retaining an error', () => {
    const gate = new GateSession();
    gate.dispatch({ type: 'ANSWER_Q1_YES' });
    gate.dispatch({ type: 'ANSWER_Q2', answer: 'yes' });
    gate.dispatch({ type: 'SUBMIT_CODE', value: 'wrong' });

    expect(gate.reset()).toEqual({ step: 'question-1' });
    expect(gate.snapshot()).toEqual({ step: 'question-1' });
  });
});
