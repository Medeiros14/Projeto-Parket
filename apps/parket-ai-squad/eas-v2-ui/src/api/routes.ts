export const APIRoutes = {
  GetAgents: (agentOSUrl: string) => `${agentOSUrl}/agents`,
  AgentRun: (agentOSUrl: string) => `${agentOSUrl}/agents/{agent_id}/runs`,
  AgentContinueRun: (agentOSUrl: string, agentId: string, runId: string) =>
    `${agentOSUrl}/agents/${agentId}/runs/${runId}/continue`,
  Status: (agentOSUrl: string) => `${agentOSUrl}/health`,
  GetSessions: (agentOSUrl: string) => `${agentOSUrl}/sessions`,
  GetSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${sessionId}/runs`,

  DeleteSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${sessionId}`,

  GetTeams: (agentOSUrl: string) => `${agentOSUrl}/teams`,
  TeamRun: (agentOSUrl: string, teamId: string) =>
    `${agentOSUrl}/teams/${teamId}/runs`,
  DeleteTeamSession: (agentOSUrl: string, teamId: string, sessionId: string) =>
    `${agentOSUrl}/v1//teams/${teamId}/sessions/${sessionId}`,

  // Painéis (Métricas / Memórias / Knowledge)
  GetMetrics: (agentOSUrl: string) => `${agentOSUrl}/metrics`,
  RefreshMetrics: (agentOSUrl: string) => `${agentOSUrl}/metrics/refresh`,
  GetMemories: (agentOSUrl: string) => `${agentOSUrl}/memories`,
  Memory: (agentOSUrl: string, memoryId: string) =>
    `${agentOSUrl}/memories/${memoryId}`,
  GetMemoryTopics: (agentOSUrl: string) => `${agentOSUrl}/memory_topics`,
  KnowledgeConfig: (agentOSUrl: string) => `${agentOSUrl}/knowledge/config`,
  KnowledgeContent: (agentOSUrl: string) => `${agentOSUrl}/knowledge/content`,
  KnowledgeContentItem: (agentOSUrl: string, contentId: string) =>
    `${agentOSUrl}/knowledge/content/${contentId}`,
  KnowledgeSearch: (agentOSUrl: string) => `${agentOSUrl}/knowledge/search`,

  // Painéis fase 4 (Evals / Schedules / Learnings)
  GetEvalRuns: (agentOSUrl: string) => `${agentOSUrl}/eval-runs`,
  GetSchedules: (agentOSUrl: string) => `${agentOSUrl}/schedules`,
  Schedule: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${scheduleId}`,
  ScheduleAction: (
    agentOSUrl: string,
    scheduleId: string,
    action: 'enable' | 'disable' | 'trigger'
  ) => `${agentOSUrl}/schedules/${scheduleId}/${action}`,
  ScheduleRuns: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${scheduleId}/runs`,
  GetLearnings: (agentOSUrl: string) => `${agentOSUrl}/learnings`,
  Learning: (agentOSUrl: string, learningId: string) =>
    `${agentOSUrl}/learnings/${learningId}`,

  // Workflows
  GetWorkflows: (agentOSUrl: string) => `${agentOSUrl}/workflows`,
  WorkflowRun: (agentOSUrl: string, workflowId: string) =>
    `${agentOSUrl}/workflows/${workflowId}/runs`,

  // Toolkits (Nível 2 — ativação pela UI)
  GetToolkits: (agentOSUrl: string) => `${agentOSUrl}/toolkits`,
  Toolkit: (agentOSUrl: string, toolkitId: string) =>
    `${agentOSUrl}/toolkits/${toolkitId}`,
  ApplyToolkits: (agentOSUrl: string) => `${agentOSUrl}/toolkits/apply`,
  ToolkitCatalog: (agentOSUrl: string) => `${agentOSUrl}/toolkits/catalog`
}
