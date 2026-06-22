import { User, ChatSession, Task, TaskCategory } from '../types';

async function apiRequest<T>(url: string, body: any): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json() as any;
    throw new Error(err.error || 'خطایی در ارتباط با سرور رخ داد.');
  }
  return response.json() as Promise<T>;
}

export const storageService = {
  checkPhoneExists: async (phone: string): Promise<boolean> => {
    try {
      const res = await apiRequest<{ exists: boolean }>('/api/auth/check-phone', { phone });
      return res.exists;
    } catch {
      return false;
    }
  },

  firebaseLogin: async (phone: string): Promise<User> => {
    const res = await apiRequest<{ user: User, token: string }>('/api/auth/login', { phone });
    localStorage.setItem('firebase_id_token', res.token);
    return res.user;
  },

  firebaseRegister: async (phone: string, name: string): Promise<User> => {
    const res = await apiRequest<{ user: User, token: string }>('/api/auth/register', { phone, name });
    localStorage.setItem('firebase_id_token', res.token);
    return res.user;
  },

  googleLogin: async (mockPayload?: { id: string, name: string, email: string }): Promise<User> => {
    // Fallback google credentials if none provided
    const payload = mockPayload || {
      id: `gl_${Math.random().toString(36).substring(2, 11)}`,
      name: `کاربر گوگل ${Math.floor(Math.random() * 9000) + 1000}`,
      email: `user.${Math.random().toString(36).substring(2, 7)}@gmail.com`
    };
    const res = await apiRequest<{ user: User, token: string }>('/api/auth/googleLogin', payload);
    localStorage.setItem('firebase_id_token', res.token);
    return res.user;
  },

  getUser: async (): Promise<User | null> => {
    try {
      const cached = localStorage.getItem('shahryar_user_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const user = await apiRequest<User | null>('/api/db/get', { collectionName: 'users', docId: parsed.id });
        return user;
      }
    } catch {}
    return null;
  },

  saveUser: async (user: User) => {
    await apiRequest('/api/db/set', { collectionName: 'users', docId: user.id, data: user });
  },

  logout: async () => {
    localStorage.removeItem('firebase_id_token');
    localStorage.removeItem('shahryar_user_cache');
  },

  getSessions: async (userId: string): Promise<ChatSession[]> => {
    try {
      const sessions = await apiRequest<ChatSession[]>('/api/db/query', {
        collectionName: 'sessions',
        field: 'userId',
        op: '==',
        value: userId
      });
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },

  createSession: async (userId: string): Promise<ChatSession> => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'گفتگوی جدید',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storageService.saveSession(newSession, userId);
    return newSession;
  },

  saveSession: async (session: ChatSession, userId: string) => {
    const sessionWithUser = { ...session, userId };
    await apiRequest('/api/db/set', { collectionName: 'sessions', docId: session.id, data: sessionWithUser });
  },

  deleteSession: async (id: string) => {
    await apiRequest('/api/db/delete', { collectionName: 'sessions', docId: id });
  },

  getCategories: async (userId: string): Promise<TaskCategory[]> => {
    try {
      return await apiRequest<TaskCategory[]>('/api/db/query', {
        collectionName: 'categories',
        field: 'userId',
        op: '==',
        value: userId
      });
    } catch {
      return [];
    }
  },

  saveCategories: async (userId: string, categories: TaskCategory[]) => {
    for (const cat of categories) {
      await apiRequest('/api/db/set', { collectionName: 'categories', docId: cat.id, data: cat });
    }
  },

  getTasks: async (userId: string): Promise<Task[]> => {
    try {
      const tasks = await apiRequest<Task[]>('/api/db/query', {
        collectionName: 'tasks',
        field: 'userId',
        op: '==',
        value: userId
      });
      return tasks.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      return [];
    }
  },

  saveTask: async (userId: string, task: Task) => {
    const taskWithUser = { ...task, userId };
    await apiRequest('/api/db/set', { collectionName: 'tasks', docId: task.id, data: taskWithUser });
  },

  deleteTask: async (userId: string, taskId: string) => {
    await apiRequest('/api/db/delete', { collectionName: 'tasks', docId: taskId });
  }
};
