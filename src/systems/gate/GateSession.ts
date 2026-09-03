import type {
  GateAction,
  GateSessionPort,
  GateSnapshot,
  GateTransition,
} from './contracts';

const SECRET_CODE = 'basic' as const;

/**
 * Pure, session-scoped implementation of the David gate.
 *
 * The secret is deliberately not treated as authentication. It is a product
 * joke and therefore remains in the client bundle by design.
 */
export class GateSession implements GateSessionPort {
  private current: GateSnapshot = { step: 'question-1' };

  public snapshot(): GateSnapshot {
    // Every variant is immutable, but return a fresh object so callers cannot
    // accidentally retain an object that later appears to change.
    return { ...this.current };
  }

  public dispatch(action: GateAction): GateTransition {
    if (action.type === 'RESET') {
      this.reset();
      return this.advanced();
    }

    switch (this.current.step) {
      case 'question-1':
        return this.fromQuestionOne(action);
      case 'question-2':
        return this.fromQuestionTwo(action);
      case 'secret-code':
        return this.fromSecretCode(action);
      case 'passed':
      case 'rejected':
        return this.fromTerminal(action);
    }
  }

  public reset(): GateSnapshot {
    this.current = { step: 'question-1' };
    return this.snapshot();
  }

  /** Alias useful to callers that model the gate as a state transition. */
  public transition(action: GateAction): GateTransition {
    return this.dispatch(action);
  }

  private fromQuestionOne(action: GateAction): GateTransition {
    if (action.type !== 'ANSWER_Q1_YES') {
      return this.invalid();
    }

    this.current = { step: 'question-2' };
    return this.advanced();
  }

  private fromQuestionTwo(action: GateAction): GateTransition {
    if (action.type !== 'ANSWER_Q2') {
      return this.invalid();
    }

    if (action.answer === 'no') {
      this.current = { step: 'rejected', reason: 'question-2-no' };
      return { status: 'rejected', snapshot: this.snapshot() };
    }

    this.current = { step: 'secret-code' };
    return this.advanced();
  }

  private fromSecretCode(action: GateAction): GateTransition {
    if (action.type !== 'SUBMIT_CODE') {
      return this.invalid();
    }

    if (action.value.trim() !== SECRET_CODE) {
      this.current = { step: 'secret-code', error: 'incorrect-code' };
      return { status: 'invalid-action', snapshot: this.snapshot() };
    }

    this.current = { step: 'passed' };
    return { status: 'passed', snapshot: this.snapshot() };
  }

  private fromTerminal(_action: GateAction): GateTransition {
    // Rejection is terminal for this session. The only way out is reset,
    // which the App Flow owner may expose as a return-to-opening action.
    return this.invalid();
  }

  private invalid(): GateTransition {
    return { status: 'invalid-action', snapshot: this.snapshot() };
  }

  private advanced(): GateTransition {
    return { status: 'advanced', snapshot: this.snapshot() };
  }
}

export const createGateSession = (): GateSession => new GateSession();
