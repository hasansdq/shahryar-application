import { User, ChatSession, Task, TaskCategory } from '../types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, orderBy } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const getMockEmail = (phone: string) => `${phone}@shahryar.local`;

export const storageService = {
  
  getOrCreateUser: async (userId: string, phone: string, name?: string): Promise<User> => {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as User;
    } else {
      const newUser: User = {
        id: userId,
        phone,
        name: name?.trim() || `شهروند ${phone.slice(-4)}`,
        joinedDate: new Date().toISOString(),
        learnedData: [],
        traits: []
      };
      
      await setDoc(userDocRef, newUser);

      // Create default categories for planning
      const defaultCategories: TaskCategory[] = [
        { id: `cat_todo_${Date.now()}`, userId, title: 'برای انجام', color: '#0d9488' },
        { id: `cat_inprog_${Date.now()}`, userId, title: 'در حال انجام', color: '#eab308' },
        { id: `cat_done_${Date.now()}`, userId, title: 'انجام شده', color: '#22c55e' }
      ];
      for (const cat of defaultCategories) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }

      return newUser;
    }
  },

  getUser: async (): Promise<User | null> => {
    await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            unsubscribe();
            resolve(u);
        }, () => {
            unsubscribe();
            resolve(null);
        });
    });
    const uid = auth.currentUser?.uid;
    if (!uid) return null;

    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            return null;
        }
        return userDoc.data() as User;
    } catch (e) {
        console.error("Failed to fetch user", e);
        return null;
    }
  },

  saveUser: async (user: User) => {
      await setDoc(doc(db, 'users', user.id), user, { merge: true });
  },

  logout: async () => {
      await signOut(auth);
  },

  getSessions: async (userId: string): Promise<ChatSession[]> => {
      try {
          const q = query(collection(db, 'sessions'), where('userId', '==', userId));
          const snapshot = await getDocs(q);
          const sessions = snapshot.docs.map(d => d.data() as ChatSession);
          return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
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
      await storageService.saveSession(newSession, userId);
      return newSession;
  },

  saveSession: async (session: ChatSession, userId: string) => {
      const sessionWithUser = { ...session, userId };
      await setDoc(doc(db, 'sessions', session.id), sessionWithUser, { merge: true });
  },

  deleteSession: async (id: string) => {
      await deleteDoc(doc(db, 'sessions', id));
  },

  // --- Task Management ---

  getCategories: async (userId: string): Promise<TaskCategory[]> => {
      try {
          const q = query(collection(db, 'categories'), where('userId', '==', userId));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(d => d.data() as TaskCategory);
      } catch (e) { return []; }
  },

  saveCategories: async (userId: string, categories: TaskCategory[]) => {
      for (const cat of categories) {
        await setDoc(doc(db, 'categories', cat.id), cat, { merge: true });
      }
  },

  getTasks: async (userId: string): Promise<Task[]> => {
      try {
          const q = query(collection(db, 'tasks'), where('userId', '==', userId));
          const snapshot = await getDocs(q);
          const tasks = snapshot.docs.map(d => d.data() as Task);
          return tasks.sort((a, b) => b.createdAt - a.createdAt);
      } catch (e) { return []; }
  },

  saveTask: async (userId: string, task: Task) => {
      const taskWithUser = { ...task, userId };
      await setDoc(doc(db, 'tasks', task.id), taskWithUser, { merge: true });
  },

  deleteTask: async (userId: string, taskId: string) => {
      await deleteDoc(doc(db, 'tasks', taskId));
  }
};
