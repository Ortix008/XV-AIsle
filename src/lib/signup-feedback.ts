export type SignupFeedback =
  | { kind: "notice"; message: string }
  | { kind: "error"; message: string };

export function signupFeedbackState(result: SignupFeedback) {
  switch (result.kind) {
    case "notice":
      return { notice: result.message, error: null };
    case "error":
      return { notice: null, error: result.message };
    default: {
      const unexpected: never = result;
      throw new Error(`Unexpected signup feedback: ${JSON.stringify(unexpected)}`);
    }
  }
}
