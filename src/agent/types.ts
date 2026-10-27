export type AgentCall = { callId: string; name: string; arguments: string };
export type ModelTurn = { responseId: string; calls: AgentCall[]; text: string };
export type ToolResult = { callId: string; output: string };
export interface AgentModel {
  next(input: { question: string; previousResponseId?: string; toolResults?: ToolResult[] }): Promise<ModelTurn>;
}
export type AgentEvent = { type: 'tool_call' | 'tool_result' | 'final'; name?: string; detail: string };
export type AgentAnswer = { answer: string; toolCalls: number; events: AgentEvent[] };
