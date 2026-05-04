export const TaskStatus = {
  TODO:        'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW:      'REVIEW',
  DONE:        'DONE',
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW:    'LOW',
  MEDIUM: 'MEDIUM',
  HIGH:   'HIGH',
  URGENT: 'URGENT',
} as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeIds: string[];   
  creatorId: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeIds?: string[];
  dueDate?: string | null;
}

export interface UserMeta {
  id: string;
  username: string | null;
  email: string | null;
  avatar: string | null;
}
