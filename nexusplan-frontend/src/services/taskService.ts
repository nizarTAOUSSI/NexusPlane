import api from '../api';
import { type CreateTaskPayload, type Task, TaskStatus } from '../types/task';

const BASE = '/tasks'; 

export const taskService = {
  getTasksByProject: (projectId: string): Promise<Task[]> =>
    api.get<Task[]>(`${BASE}/`, { params: { projectId } }).then(r => r.data),

  getTasksByAssignee: (assigneeId: string): Promise<Task[]> =>
    api.get<Task[]>(`${BASE}/`, { params: { assigneeId } }).then(r => r.data),

  getTask: (taskId: string): Promise<Task> =>
    api.get<Task>(`${BASE}/${taskId}/`).then(r => r.data),

  createTask: (data: CreateTaskPayload, userId: string): Promise<Task> =>
    api.post<Task>(`${BASE}/`, data, {
      headers: { 'X-User-Id': userId },
    }).then(r => r.data),

  updateTask: (taskId: string, data: Partial<CreateTaskPayload>): Promise<Task> =>
    api.patch<Task>(`${BASE}/${taskId}/`, data).then(r => r.data),

  updateTaskStatus: (taskId: string, status: TaskStatus): Promise<Task> =>
    api.patch<Task>(`${BASE}/${taskId}/status/`, { status }).then(r => r.data),

  assignTask: (taskId: string, assigneeIds: string[]): Promise<Task> =>
    api.patch<Task>(`${BASE}/${taskId}/assign/`, { assigneeIds }).then(r => r.data),

  deleteTask: (taskId: string): Promise<void> =>
    api.delete(`${BASE}/${taskId}/`).then(() => undefined),
};
