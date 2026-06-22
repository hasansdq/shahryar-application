import express from 'express';
import * as aiController from '../controllers/aiController.js';

const router = express.Router();

// --- AI Endpoints ---
router.post('/chat', aiController.chat);
router.post('/profile/analyze', aiController.analyzeProfile);
router.post('/planning/generate', aiController.generatePlanning);
router.post('/home/content', aiController.generateHomeContent);

// --- Firebase REST APIs Compatibility Helpers (Iranian ISP Sanctions/CORS Bypass) ---
const FIREBASE_REST_BASE = "https://firestore.googleapis.com/v1/projects/shahryar-462406/databases/ai-studio-f4d9a5ba-e324-4ffc-8344-039ab7000527/documents";
const API_KEY = "AIzaSyCkPBjWmNpktCeCJ7QbkdmVFpE1zeT6eTo";
const SECRET_PASSWORD = "shahryarSecretVerifyPassKey2026!";

function unwrapValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => unwrapValue(v));
  }
  if ('mapValue' in val) {
    const mapRes = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      mapRes[k] = unwrapValue(v);
    }
    return mapRes;
  }
  if ('nullValue' in val) return null;
  return null;
}

function fromFirestore(doc) {
  if (!doc) return null;
  if (doc.fields) {
    const result = {};
    for (const [key, val] of Object.entries(doc.fields)) {
      result[key] = unwrapValue(val);
    }
    if (doc.name) {
      const parts = doc.name.split('/');
      result.id = parts[parts.length - 1];
    }
    return result;
  }
  return doc;
}

function wrapValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(wrapValue) } };
  }
  if (typeof val === 'object') {
    const mapFields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        mapFields[k] = wrapValue(v);
      }
    }
    return { mapValue: { fields: mapFields } };
  }
  return { nullValue: null };
}

function toFirestore(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key !== 'id' && val !== undefined) {
      fields[key] = wrapValue(val);
    }
  }
  return { fields };
}

// REST SDK Worker Driver
const firestoreDb = {
  get: async (collection, docId) => {
    const url = `${FIREBASE_REST_BASE}/${collection}/${docId}?key=${API_KEY}`;
    const response = await fetch(url);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Firestore GET failed: ${await response.text()}`);
    }
    const data = await response.json();
    return fromFirestore(data);
  },
  
  set: async (collection, docId, data) => {
    const url = `${FIREBASE_REST_BASE}/${collection}/${docId}?key=${API_KEY}`;
    const mapped = toFirestore(data);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapped)
    });
    if (!response.ok) {
      throw new Error(`Firestore PATCH failed: ${await response.text()}`);
    }
    const resData = await response.json();
    return fromFirestore(resData);
  },

  delete: async (collection, docId) => {
    const url = `${FIREBASE_REST_BASE}/${collection}/${docId}?key=${API_KEY}`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Firestore DELETE failed: ${await response.text()}`);
    }
    return true;
  },

  query: async (collectionName, field, op, value) => {
    const url = `https://firestore.googleapis.com/v1/projects/shahryar-462406/databases/ai-studio-f4d9a5ba-e324-4ffc-8344-039ab7000527/documents:runQuery?key=${API_KEY}`;
    const opMap = {
      '==': 'EQUAL',
      '=': 'EQUAL',
      '<': 'LESS_THAN',
      '<=': 'LESS_THAN_OR_EQUAL',
      '>': 'GREATER_THAN',
      '>=': 'GREATER_THAN_OR_EQUAL',
    };
    const mappedOp = opMap[op] || 'EQUAL';

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: mappedOp,
            value: wrapValue(value)
          }
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody)
    });

    if (!response.ok) {
      throw new Error(`Firestore QUERY failed: ${await response.text()}`);
    }

    const results = await response.json();
    const list = [];
    if (Array.isArray(results)) {
      for (const item of results) {
        if (item.document) {
          list.push(fromFirestore(item.document));
        }
      }
    }
    return list;
  }
};

const getMockEmail = (phone) => {
  const cleanPhone = phone.trim().replace(/\D/g, '');
  return `${cleanPhone}@shahryar.local`;
};

// --- AUTH Proxy Endpoints ---
router.post('/auth/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    const users = await firestoreDb.query('users', 'phone', '==', phone.trim());
    return res.json({ exists: users.length > 0 });
  } catch (e) {
    return res.json({ exists: false, error: e.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { phone } = req.body;
    const email = getMockEmail(phone);
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SECRET_PASSWORD, returnSecureToken: true })
    });
    
    if (!response.ok) {
      const errData = await response.json();
      const code = errData.error?.message || "AUTH_FAILED";
      return res.status(401).json({ error: code === 'EMAIL_NOT_FOUND' ? 'USER_NOT_FOUND' : 'خطا در فرآیند ورود. نام کاربری یا رمز عبور اشتباه است.' });
    }
    
    const credentials = await response.json();
    const userId = credentials.localId;
    
    const userDoc = await firestoreDb.get('users', userId);
    if (!userDoc) {
      return res.status(404).json({ error: 'اطلاعات کاربری یافت نشد.' });
    }
    
    return res.json({ user: userDoc, token: credentials.idToken });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const { phone, name } = req.body;
    const email = getMockEmail(phone);
    const signupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
    
    const response = await fetch(signupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SECRET_PASSWORD, returnSecureToken: true })
    });
    
    if (!response.ok) {
      const errData = await response.json();
      const code = errData.error?.message || "SIGNUP_FAILED";
      if (code === 'EMAIL_EXISTS') {
        return res.status(400).json({ error: 'این شماره موبایل قبلا ثبت‌نام شده است.' });
      }
      return res.status(500).json({ error: 'خطا در ثبت‌نام کاربر.' });
    }
    
    const credentials = await response.json();
    const userId = credentials.localId;
    
    const newUser = {
      id: userId,
      phone: phone.trim(),
      name: name.trim(),
      joinedDate: new Date().toISOString(),
      learnedData: [],
      traits: []
    };
    
    await firestoreDb.set('users', userId, newUser);
    
    const now = Date.now();
    const defaultCategories = [
      { id: `cat_todo_${now}`, userId, title: 'برای انجام', color: '#0d9488' },
      { id: `cat_inprog_${now}`, userId, title: 'در حال انجام', color: '#eab308' },
      { id: `cat_done_${now}`, userId, title: 'انجام شده', color: '#22c55e' }
    ];
    for (const cat of defaultCategories) {
      await firestoreDb.set('categories', cat.id, cat);
    }
    
    return res.json({ user: newUser, token: credentials.idToken });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/auth/googleLogin', async (req, res) => {
  try {
    const { id, name, email } = req.body;
    const mockEmail = `google-${id.toLowerCase()}@google.shahryar.local`;
    const signupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
    
    let userId = "";
    let idToken = "";
    
    const signupRes = await fetch(signupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mockEmail, password: SECRET_PASSWORD, returnSecureToken: true })
    });
    
    if (signupRes.ok) {
      const creds = await signupRes.json();
      userId = creds.localId;
      idToken = creds.idToken;
      
      const newUser = {
        id: userId,
        name: name || `شهروند گوگل`,
        phone: '', 
        email: email || undefined,
        joinedDate: new Date().toISOString(),
        learnedData: [],
        traits: []
      };
      
      await firestoreDb.set('users', userId, newUser);
      
      const now = Date.now();
      const defaultCategories = [
        { id: `cat_todo_${now}`, userId, title: 'برای انجام', color: '#0d9488' },
        { id: `cat_inprog_${now}`, userId, title: 'در حال انجام', color: '#eab308' },
        { id: `cat_done_${now}`, userId, title: 'انجام شده', color: '#22c55e' }
      ];
      for (const cat of defaultCategories) {
        await firestoreDb.set('categories', cat.id, cat);
      }
      
      return res.json({ user: newUser, token: idToken });
    } else {
      const loginUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mockEmail, password: SECRET_PASSWORD, returnSecureToken: true })
      });
      
      if (!loginRes.ok) {
        return res.status(401).json({ error: "خطا در فرآیند ورود گوگل." });
      }
      
      const creds = await loginRes.json();
      userId = creds.localId;
      idToken = creds.idToken;
      
      let userDoc = await firestoreDb.get('users', userId);
      if (!userDoc) {
        userDoc = {
          id: userId,
          name: name || `شهروند گوگل`,
          phone: '',
          email: email || undefined,
          joinedDate: new Date().toISOString(),
          learnedData: [],
          traits: []
        };
        await firestoreDb.set('users', userId, userDoc);
      }
      
      return res.json({ user: userDoc, token: idToken });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// --- DATABASE Proxy Endpoints ---
router.post('/db/get', async (req, res) => {
  try {
    const { collectionName, docId } = req.body;
    const doc = await firestoreDb.get(collectionName, docId);
    return res.json(doc);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/db/set', async (req, res) => {
  try {
    const { collectionName, docId, data } = req.body;
    const result = await firestoreDb.set(collectionName, docId, data);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/db/delete', async (req, res) => {
  try {
    const { collectionName, docId } = req.body;
    await firestoreDb.delete(collectionName, docId);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/db/query', async (req, res) => {
  try {
    const { collectionName, field, op, value } = req.body;
    const results = await firestoreDb.query(collectionName, field, op, value);
    return res.json(results);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
