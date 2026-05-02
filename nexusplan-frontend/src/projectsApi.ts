import api from './api';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  projectId: string;
  userId: string;
  role: 'VIEWER' | 'CONTRIBUTOR' | 'MANAGER';
  joinedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
}

export interface InvitePayload {
  email: string;
  role?: 'VIEWER' | 'CONTRIBUTOR' | 'MANAGER';
}

export const projectsApi = {
  list: (params?: { ownerId?: string; status?: string }) =>
    api.get<Project[]>('/projects/', { params }).then(r => r.data),

  get: (id: string) =>
    api.get<Project>(`/projects/${id}/`).then(r => r.data),

  create: (payload: CreateProjectPayload, userId: string) =>
    api.post<Project>('/projects/', payload, {
      headers: { 'X-User-Id': userId },
    }).then(r => r.data),

  update: (id: string, payload: Partial<CreateProjectPayload>) =>
    api.patch<Project>(`/projects/${id}/`, payload).then(r => r.data),

  archive: (id: string) =>
    api.patch<Project>(`/projects/${id}/archive/`).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/projects/${id}/`),

  getMembers: (id: string) =>
    api.get<Membership[]>(`/projects/${id}/members/`).then(r => r.data),

  inviteMember: (projectId: string, payload: InvitePayload) =>
    api.post(`/projects/${projectId}/invite/`, payload).then(r => r.data),
};
