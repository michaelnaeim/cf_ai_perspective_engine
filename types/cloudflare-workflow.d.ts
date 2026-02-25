declare module 'cloudflare:workers' {
  export abstract class WorkflowStep {
    do<T>(name: string, callback: () => Promise<T>): Promise<T>;
    do<T>(name: string, config: unknown, callback: () => Promise<T>): Promise<T>;
  }

  export type WorkflowEvent<T> = {
    payload: Readonly<T>;
    timestamp: Date;
    instanceId?: string;
  };

  export abstract class WorkflowEntrypoint<Env = unknown, T = unknown> {
    protected ctx: unknown;
    protected env: Env;
    constructor(ctx: unknown, env: Env);
    run(event: Readonly<WorkflowEvent<T>>, step: WorkflowStep): Promise<unknown>;
  }
}

// Minimal ambient types used by the project
type D1Database = any;
type WorkflowBinding = any;
