export class BotError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export const botFailure = code => { throw new BotError(code); };
