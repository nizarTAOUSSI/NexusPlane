import api from './api';


export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  username: string | null;
  email: string | null;
  avatar: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
}

export interface InviteToTeamPayload {
  email: string;
  role?: 'MEMBER' | 'ADMIN';
}

export interface InviteTeamToProjectPayload {
  projectId: string;
  role?: 'VIEWER' | 'CONTRIBUTOR' | 'MANAGER';
}

export interface InviteTeamToProjectResult {
  added: number;
  skipped: number;
  teamId: string;
  projectId: string;
  role: string;
}


const BASE = '/teams';

export const teamsApi = {
  list: (userId?: string): Promise<Team[]> =>
    api.get<Team[]>(`${BASE}/`, { params: userId ? { userId } : undefined })
      .then(r => r.data),

  get: (teamId: string): Promise<Team> =>
    api.get<Team>(`${BASE}/${teamId}/`).then(r => r.data),

  create: (payload: CreateTeamPayload, userId: string): Promise<Team> =>
    api.post<Team>(`${BASE}/`, payload, {
      headers: { 'X-User-Id': userId },
    }).then(r => r.data),

  update: (teamId: string, payload: Partial<CreateTeamPayload>): Promise<Team> =>
    api.patch<Team>(`${BASE}/${teamId}/`, payload).then(r => r.data),

  delete: (teamId: string): Promise<void> =>
    api.delete(`${BASE}/${teamId}/`).then(() => undefined),

  getMembers: (teamId: string): Promise<TeamMember[]> =>
    api.get<TeamMember[]>(`${BASE}/${teamId}/members/`).then(r => r.data),

  invite: (teamId: string, payload: InviteToTeamPayload): Promise<unknown> =>
    api.post(`${BASE}/${teamId}/invite/`, payload).then(r => r.data),

  kick: (teamId: string, userId: string): Promise<void> =>
    api.post(`${BASE}/${teamId}/kick/`, { userId }).then(() => undefined),

  quit: (teamId: string): Promise<void> =>
    api.post(`${BASE}/${teamId}/quit/`).then(() => undefined),

  inviteToProject: (
    teamId: string,
    payload: InviteTeamToProjectPayload,
  ): Promise<InviteTeamToProjectResult> =>
    api
      .post<InviteTeamToProjectResult>(`${BASE}/${teamId}/invite-to-project/`, payload)
      .then(r => r.data),
};
