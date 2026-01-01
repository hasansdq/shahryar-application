import { User, ChatSession, Task, TaskCategory } from '../types';

const USER_KEY = 'shahryar_active_user_id'; // Only store ID locally
const API_BASE = '/api';

export const storageService = {
  
  login: async (phone: string, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login Failed");
    }

    const user = await response.json();
    localStorage.setItem(USER_KEY, user.id);
    return user;
  },

  register: async (phone: string, password: string, name: string): Promise<User> => {
    const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, name })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration Failed");
    }

    const user = await response.json();
    localStorage.setItem(USER_KEY, user.id);
    return user;
  },

  getUser: async (): Promise<User | null> => {
      const userId = localStorage.getItem(USER_KEY);
      if (!userId) return null;

      try {
          const response = await fetch(`${API_BASE}/user/${userId}`);
          if (!response.ok) {
              localStorage.removeItem(USER_KEY);
              return null;
          }
          return await response.json();
      } catch (e) {
          console.error("Failed to fetch user", e);
          return null;
      }
  },

  saveUser: async (user: User) => {
      await fetch(`${API_BASE}/user/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
      });
  },

  logout: () => {
      localStorage.removeItem(USER_KEY);
  },

  getSessions: async (userId: string): Promise<ChatSession[]> => {
      try {
          const response = await fetch(`${API_BASE}/sessions/${userId}`);
          if (!response.ok) return [];
          return await response.json();
      } catch (e) { return []; }
  },

  createSession: async (userId: string): Promise<ChatSession> => {
      const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'گفتگوی جدید',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
      };
      // We pass userId manually to helper logic on backend, or attach it here
      await storageService.saveSession(newSession, userId);
      return newSession;
  },

  saveSession: async (session: ChatSession, userId: string) => {
      // Backend expects session object. We inject userId to ensure link
      const sessionWithUser = { ...session, userId };
      await fetch(`${API_BASE}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionWithUser)
      });
  },

  deleteSession: async (id: string) => {
      await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
  },

  // --- Task Management ---

  getCategories: async (userId: string): Promise<TaskCategory[]> => {
      try {
          const response = await fetch(`${API_BASE}/categories/${userId}`);
          if (!response.ok) return [];
          return await response.json();
      } catch (e) { return []; }
  },

  saveCategories: async (userId: string, categories: TaskCategory[]) => {
      // Not implemented in backend bulk save for this specific prompt scope 
      // as frontend doesn't actively edit categories in bulk yet, 
      // but if needed, we'd add an endpoint. 
      // For now, categories are read-only defaults or added automatically.
  },

  getTasks: async (userId: string): Promise<Task[]> => {
      try {
          const response = await fetch(`${API_BASE}/tasks/${userId}`);
          if (!response.ok) return [];
          return await response.json();
      } catch (e) { return []; }
  },

  saveTask: async (userId: string, task: Task) => {
      await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
      });
  },

  deleteTask: async (userId: string, taskId: string) => {
      await fetch(`${API_BASE}/tasks/${userId}/${taskId}`, { method: 'DELETE' });
  }
};
