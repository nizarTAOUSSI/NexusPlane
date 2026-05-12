import api from '../api';


export interface GenerateTasksPayload {
  description: string;
  projectId?: string | null;
}

export interface AIGeneratedTask {
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GenerateTasksResponse {
  tasks: AIGeneratedTask[];
  tokensUsed: number;
  modelUsed: string;
  logId: string;
}


export interface TaskContext {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
}

export interface SummarizeProjectPayload {
  projectId: string;
  projectName?: string;
  tasks?: TaskContext[];
}

export interface SummarizeProjectResponse {
  summary: string;
  tokensUsed: number;
  modelUsed: string;
  logId: string;
}

// ─── Copilot Chat ─────────────────────────────────────────────────────────────

export interface CopilotContext {
  projectId?: string;
  projectName?: string;
  task?: TaskContext & { title: string };
  recentTasks?: TaskContext[];
  [key: string]: unknown;
}

export interface CopilotPayload {
  message: string;
  context?: CopilotContext;
}

export interface CopilotResponse {
  reply: string;
  tokensUsed: number;
  modelUsed: string;
  logId: string;
}


export interface DashboardTaskContext {
  title?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
}

export interface DashboardSummarizePayload {
  username?: string;
  activeTasks: number;
  overdueTasks: number;
  activeProjects: number;
  tasks?: DashboardTaskContext[];
}

export interface DashboardSummarizeResponse {
  summary: string;
  tokensUsed: number;
  modelUsed: string;
  logId: string;
}


const BASE = '/ai';

export const aiService = {
  generateTasks: (
    payload: GenerateTasksPayload,
    userId: string,
  ): Promise<GenerateTasksResponse> =>
    api
      .post<GenerateTasksResponse>(`${BASE}/generate-tasks/`, payload, {
        headers: { 'X-User-Id': userId },
      })
      .then((r) => r.data),

  summarizeProject: (
    payload: SummarizeProjectPayload,
    userId: string,
  ): Promise<SummarizeProjectResponse> =>
    api
      .post<SummarizeProjectResponse>(`${BASE}/summarize/`, payload, {
        headers: { 'X-User-Id': userId },
      })
      .then((r) => r.data),

  copilot: (
    payload: CopilotPayload,
    userId: string,
  ): Promise<CopilotResponse> =>
    api
      .post<CopilotResponse>(`${BASE}/copilot/`, payload, {
        headers: { 'X-User-Id': userId },
      })
      .then((r) => r.data),

  summarizeDashboard: (
    payload: DashboardSummarizePayload,
    userId: string,
  ): Promise<DashboardSummarizeResponse> =>
    api
      .post<DashboardSummarizeResponse>(`${BASE}/summarize-dashboard/`, payload, {
        headers: { 'X-User-Id': userId },
      })
      .then((r) => r.data),
};
