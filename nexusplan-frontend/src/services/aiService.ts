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
};
