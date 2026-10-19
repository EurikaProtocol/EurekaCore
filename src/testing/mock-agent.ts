import type { AgentProvider, AgentTaskRequest } from '../core/agent';

/**
 * TEST ONLY. Deterministic stand-in for an AI agent; not a real integration and not exported by the SDK.
 */
export class MockAgentProvider implements AgentProvider {
  readonly name = 'mock-agent';
  constructor(private readonly respond: (request: AgentTaskRequest) => unknown = defaultResponse) {}
  async execute(request: AgentTaskRequest): Promise<unknown> {
    return this.respond(request);
  }
}

function defaultResponse(request: AgentTaskRequest) {
  return {
    contractVersion: '1.0',
    taskId: request.id,
    status: 'completed',
    output: { text: `mock:${request.kind}`, proposedActions: [] },
    toolsUsed: [],
  };
}
