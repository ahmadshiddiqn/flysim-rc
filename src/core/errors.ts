/** Error thrown when an aircraft model or script fails to load in JSBSim. */
export class JSBSimLoadError extends Error {
  readonly model?: string;
  readonly detail?: unknown;
  constructor(message: string, opts?: { model?: string; detail?: unknown }) {
    super(message);
    this.name = 'JSBSimLoadError';
    this.model = opts?.model;
    this.detail = opts?.detail;
  }
}

/** Error thrown when a JSBSim property is missing in strict access mode. */
export class JSBSimPropertyError extends Error {
  readonly path: string;
  constructor(path: string) {
    super(`JSBSim property not found: ${path}`);
    this.name = 'JSBSimPropertyError';
    this.path = path;
  }
}
