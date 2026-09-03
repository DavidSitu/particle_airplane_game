/** Actions accepted by the David verification gate. */
export type GateAction =
  | { readonly type: 'ANSWER_Q1_YES' }
  | { readonly type: 'ANSWER_Q2'; readonly answer: 'yes' | 'no' }
  | { readonly type: 'SUBMIT_CODE'; readonly value: string }
  | { readonly type: 'RESET' };

/** The complete externally visible state of one gate session. */
export type GateSnapshot =
  | { readonly step: 'question-1' }
  | { readonly step: 'question-2' }
  | { readonly step: 'secret-code'; readonly error?: 'incorrect-code' }
  | { readonly step: 'passed' }
  | { readonly step: 'rejected'; readonly reason: 'question-2-no' };

/** Result of applying an action. Invalid actions are explicit no-ops. */
export type GateTransition =
  | { readonly status: 'advanced'; readonly snapshot: GateSnapshot }
  | { readonly status: 'rejected'; readonly snapshot: GateSnapshot }
  | { readonly status: 'invalid-action'; readonly snapshot: GateSnapshot }
  | { readonly status: 'passed'; readonly snapshot: GateSnapshot };

export interface GateSessionPort {
  snapshot(): GateSnapshot;
  dispatch(action: GateAction): GateTransition;
  reset(): GateSnapshot;
}
