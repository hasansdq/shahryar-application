import { User, ChatSession, Task, TaskCategory } from '../types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, orderBy } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const getMockEmail = (phone: string) => {
  // Normalize phone to clean string
  const cleanPhone = phone.trim().replace(/\D/g, '');
  return `${cleanPhone}@shahryar.local`;
};

const SECRET_PASSWORD = `shahryarSecretVerifyPassKey2026!`;

export const storageService = {
  
  googleLogin: async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as User;
    } else {
      const newUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || `شهروند ${firebaseUser.uid.slice(-4)}`,
        phone: '', // To be filled optionally in profile completion
        email: firebaseUser.email || undefined,
        joinedDate: new Date().toISOString(),
        learnedData: [],
        traits: []
      };
      
      await setDoc(userDocRef, newUser);

      // Create default planning categories for this user
      const defaultCategories: TaskCategory[] = [
        { id: `cat_todo_${Date.now()}`, userId: firebaseUser.uid, title: 'برای انجام', color: '#0d9488' },
        { id: `cat_inprog_${Date.now()}`, userId: firebaseUser.uid, title: 'در حال انجام', color: '#eab308' },
        { id: `cat_done_${Date.now()}`, userId: firebaseUser.uid, title: 'انجام شده', color: '#22c55e' }
      ];
      for (const cat of defaultCategories) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }

      return newUser;
    }
  },

  checkPhoneExists: async (phone: string): Promise<boolean> => {
    try {
      const q = query(collection(db, 'users'), where('phone', '==', phone.trim()));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (e) {
      console.warn("Check phone exists failed: ", e);
      return false;
    }
  },

  firebaseLogin: async (phone: string): Promise<User> => {
    const email = getMockEmail(phone);
    const userCredential = await signInWithEmailAndPassword(auth, email, SECRET_PASSWORD);
    const userId = userCredential.user.uid;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
       throw new Error("اطلاعات کاربری یافت نشد.");
    }
    return userDoc.data() as User;
  },

  firebaseRegister: async (phone: string, name: string): Promise<User> => {
    const email = getMockEmail(phone);
    const userCredential = await createUserWithEmailAndPassword(auth, email, SECRET_PASSWORD);
    const userId = userCredential.user.uid;
    
    const newUser: User = {
        id: userId,
        phone: phone.trim(),
        name: name.trim(),
        joinedDate: new Date().toISOString(),
        learnedData: [],
        traits: []
    };
    
    await setDoc(doc(db, 'users', userId), newUser);

    // Create default planning categories for this user
    const defaultCategories: TaskCategory[] = [
      { id: `cat_todo_${Date.now()}`, userId, title: 'برای انجام', color: '#0d9488' },
      { id: `cat_inprog_${Date.now()}`, userId, title: 'در حال انجام', color: '#eab308' },
      { id: `cat_done_${Date.now()}`, userId, title: 'انجام شده', color: '#22c55e' }
    ];
    for (const cat of defaultCategories) {
      await setDoc(doc(db, 'categories', cat.id), cat);
    }

    return newUser;
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
