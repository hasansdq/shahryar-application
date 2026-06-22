import { User, ChatSession, Task, TaskCategory } from '../types';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db, auth } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const storageService = {
  checkPhoneExists: async (phone: string): Promise<boolean> => {
    const pathName = 'users';
    try {
      const q = query(collection(db, pathName), where('phone', '==', phone.trim()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, pathName);
      return false;
    }
  },

  getUser: async (): Promise<User | null> => {
    const pathName = 'users';
    try {
      const cached = localStorage.getItem('shahryar_user_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const userDoc = await getDoc(doc(db, pathName, parsed.id));
        if (userDoc.exists()) {
          return userDoc.data() as User;
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, pathName);
    }
    return null;
  },

  saveUser: async (user: User) => {
    const pathName = 'users';
    try {
      await setDoc(doc(db, pathName, user.id), user, { merge: true });
      localStorage.setItem('shahryar_user_cache', JSON.stringify(user));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${pathName}/${user.id}`);
    }
  },

  logout: async () => {
    try {
      await auth.signOut();
    } catch {}
    localStorage.removeItem('shahryar_user_cache');
  },

  getSessions: async (userId: string): Promise<ChatSession[]> => {
    const pathName = 'sessions';
    try {
      const q = query(collection(db, pathName), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const list: ChatSession[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || '',
          messages: data.messages || [],
          createdAt: data.createdAt || 0,
          updatedAt: data.updatedAt || 0,
        } as ChatSession);
      });
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, pathName);
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
    const pathName = 'sessions';
    try {
      const sessionWithUser = { ...session, userId };
      await setDoc(doc(db, pathName, session.id), sessionWithUser);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${pathName}/${session.id}`);
    }
  },

  deleteSession: async (id: string) => {
    const pathName = 'sessions';
    try {
      await deleteDoc(doc(db, pathName, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${pathName}/${id}`);
    }
  },

  getCategories: async (userId: string): Promise<TaskCategory[]> => {
    const pathName = 'categories';
    try {
      const q = query(collection(db, pathName), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const list: TaskCategory[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          title: data.title || '',
          color: data.color || '',
        } as TaskCategory);
      });
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, pathName);
      return [];
    }
  },

  saveCategories: async (userId: string, categories: TaskCategory[]) => {
    const pathName = 'categories';
    try {
      for (const cat of categories) {
        await setDoc(doc(db, pathName, cat.id), { ...cat, userId });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, pathName);
    }
  },

  getTasks: async (userId: string): Promise<Task[]> => {
    const pathName = 'tasks';
    try {
      const q = query(collection(db, pathName), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const list: Task[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId || '',
          categoryId: data.categoryId || '',
          title: data.title || '',
          description: data.description || '',
          status: data.status || 'todo',
          date: data.date || '',
          createdAt: data.createdAt || 0,
        } as Task);
      });
      return list.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, pathName);
      return [];
    }
  },

  saveTask: async (userId: string, task: Task) => {
    const pathName = 'tasks';
    try {
      const taskWithUser = { ...task, userId };
      await setDoc(doc(db, pathName, task.id), taskWithUser);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${pathName}/${task.id}`);
    }
  },

  deleteTask: async (userId: string, taskId: string) => {
    const pathName = 'tasks';
    try {
      await deleteDoc(doc(db, pathName, taskId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${pathName}/${taskId}`);
    }
  }
};
