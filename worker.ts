import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GoogleGenAI, Type, Modality } from '@google/genai';

// Initialize Hono Application
const app = new Hono();

// Enable Global CORS for easy integration
app.use('*', cors());

// --- Helper Functions and Types for AI ---
const AI_TIMEOUT_MS = 30000;

const runWithTimeout = <T>(promise: Promise<T>): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("AI_TIMEOUT"));
    }, AI_TIMEOUT_MS);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise
  ]);
};

const getLocalKnowledge = (query: string): string => {
  return `اطلاعات یافت شده در پایگاه داده داخلی برای "${query}":
  رفسنجان یکی از شهرهای مهم استان کرمان و مرکز پسته ایران است.
  مکان‌های دیدنی شامل: خانه حاج آقا علی (بزرگترین خانه خشتی جهان)، دره راگه، و بازار قدیم.
  پسته رفسنجان شهرت جهانی دارد و ارقام اکبری، کله‌قوچی و احمدآقایی معروف‌ترین آنها هستند.`;
};

const vectorSearchTool = {
  name: 'search_knowledge_base',
  parameters: {
    type: Type.OBJECT,
    description: 'Search for specific information about Rafsanjan in the knowledge base.',
    properties: {
      query: { type: Type.STRING, description: 'The search query.' },
    },
    required: ['query'],
  },
};

// --- Endpoints ---

// 1. Health Ping
app.get('/api/health', (c) => c.json({ status: "ok" }));

// 2. Chat Endpoint
app.post('/api/chat', async (c) => {
  const env = c.env as { GEMINI_API_KEY?: string };
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return c.json({ error: "AI not configured on Cloudflare Workers. Please define GEMINI_API_KEY" }, 500);
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const { history, user, tasks } = await c.req.json();
    const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const tasksSummary = tasks && tasks.length > 0
      ? tasks.map((t: any) => {
          const statusMap: Record<string, string> = { 'todo': 'انجام نشده', 'in-progress': 'در حال انجام', 'done': 'انجام شده' };
          return `- عنوان: ${t.title} | وضعیت: ${statusMap[t.status] || t.status} | تاریخ: ${t.date}`;
        }).join('\n') 
      : 'کاربر وظیفه ثبت شده‌ای ندارد.';

    const systemInstruction = `
      شما "شهریار" هستید، هوش مصنوعی بومی و دستیار شخصی کاربر در شهر رفسنجان.
      تاریخ امروز: ${today}.
      
      اطلاعات کاربر:
      - نام: ${user.name}
      - دستورالعمل‌های سفارشی کاربر: ${user.customInstructions || 'ندارد'}
      
      وضعیت وظایف و برنامه‌های کاربر (شما به این لیست کاملا آگاه هستید):
      ${tasksSummary}
      
      دستورالعمل‌های اصلی:
      1. شما به سوابق چت و وظایف کاربر آگاه هستید. در پاسخ‌هایتان در صورت لزوم به وظایف کاربر (چه انجام شده و چه باقی‌مانده) اشاره کنید.
      2. برای اخبار از ابزار googleSearch استفاده کنید.
      3. برای اطلاعات محلی رفسنجان از ابزار search_knowledge_base استفاده کنید.
      4. لحن شما باید دوستانه، محترمانه و کمک‌کننده باشد.
    `;

    let currentHistory = [...history];
    let finalResponseText = '';
    let collectedSources: any[] = [];
    
    const lastUserMsg = currentHistory[currentHistory.length - 1]?.parts?.[0]?.text || "";
    const isNewsRequest = /خبر|اخبار|news|رویداد|اتفاق/i.test(lastUserMsg);

    const selectedTools = isNewsRequest 
      ? [{ googleSearch: {} }] 
      : [{ functionDeclarations: [vectorSearchTool] }];

    for (let turn = 0; turn < 3; turn++) {
      const response = await runWithTimeout(
        ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: currentHistory,
          config: { systemInstruction, tools: selectedTools as any }
        })
      );

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'search_knowledge_base') {
          const result = getLocalKnowledge(call.args.query as string);
          currentHistory.push({ role: 'model', parts: [{ functionCall: call }] });
          currentHistory.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: { result } } }] });
          continue; 
        }
      }

      if (response.text) finalResponseText = response.text;
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        const newSources = groundingChunks.filter((chunk: any) => chunk.web?.uri && chunk.web?.title).map((chunk: any) => ({ title: chunk.web.title, uri: chunk.web.uri }));
        collectedSources = [...collectedSources, ...newSources];
      }
      break; 
    }

    return c.json({ text: finalResponseText, sources: collectedSources });

  } catch (error: any) {
    if (error.message === 'AI_TIMEOUT') return c.json({ error: "Timeout" }, 504);
    return c.json({ error: "AI Error", details: error.message }, 500);
  }
});

// 3. Profile Analysis
app.post('/api/profile/analyze', async (c) => {
  const env = c.env as { GEMINI_API_KEY?: string };
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: "AI not configured" }, 500);
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const { messages } = await c.req.json();
    const response = await runWithTimeout(ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze traits. JSON Array of strings (Persian). Input: ${messages.slice(0, 5000)}`,
      config: { responseMimeType: 'application/json' }
    }));
    return c.json(JSON.parse(response.text || "[]"));
  } catch (e) { 
    return c.json({ error: "Analysis failed" }, 500); 
  }
});

// 4. Planning Generator
app.post('/api/planning/generate', async (c) => {
  const env = c.env as { GEMINI_API_KEY?: string };
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: "AI not configured" }, 500);
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const { prompt, categories } = await c.req.json();
    const today = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });

    const fullPrompt = `
      Role: Expert Task Planner & Scheduler.
      Context: The user is Iranian (Persian language).
      Current Date: ${today} (Jalali/Shamsi).
      
      Available Categories: ${JSON.stringify(categories)}.
      
      User Request: "${prompt}"
      
      Mission:
      1. Break down the user's request into specific, actionable tasks.
      2. If the request implies a timeline (e.g., "schedule meetings for next week"), calculate specific Jalali dates relative to Today (${today}).
      3. Assign the most appropriate 'categoryId' from the available list.
      4. Write titles and descriptions in Persian.
      
      Output Schema (JSON Array):
      [
        {
          "title": "Task Title (Persian)",
          "description": "Detailed description (Persian)",
          "date": "YYYY/MM/DD (Jalali Date)",
          "categoryId": "Matching ID from available categories"
        }
      ]
    `;

    const response = await runWithTimeout(ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: fullPrompt,
      config: { responseMimeType: 'application/json' }
    }));
    
    return c.json(JSON.parse(response.text || "[]"));
  } catch (e) { 
    return c.json({ error: "Generation failed" }, 500); 
  }
});

// 5. Intelligent Home Content
app.post('/api/home/content', async (c) => {
  const env = c.env as { GEMINI_API_KEY?: string };
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return c.json({ error: "AI not configured" }, 500);
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const { tasks, chats, type, input } = await c.req.json(); 
    let prompt = "", config: any = {};
    const today = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    if (type === 'suggestion') {
      prompt = `
        Context:
        User's Pending Tasks: [${tasks}]
        Recent Chat Topics: [${chats}]
        
        Task: Generate a daily suggestion in Persian.
        Constraints:
        1. MUST be extremely short (Maximum 20 words / 1-2 lines).
        2. MUST be personalized based on the tasks or chat history provided above.
        3. Tone: Energetic and friendly.
        4. Do NOT use hashtags.
      `;
    }
    else if (type === 'fact') {
      prompt = `Short interesting fact about Rafsanjan in Persian. Max 1 sentence.`;
    }
    else if (type === 'notification') {
      prompt = `
        نقش: دستیار هوشمند شخصی.
        اطلاعات ورودی:
        - لیست کارهای کاربر: [${tasks || 'لیست خالی'}]
        - سابقه صحبت‌های اخیر: [${chats || 'بدون سابقه'}]

        ماموریت: نوشتن یک پیام نوتیفیکیشن هوشمند و شخصی‌سازی شده.
        
        قوانین حیاتی (باید رعایت شوند):
        1. زبان: **فقط و فقط فارسی**.
        2. طول متن: **دقیقا بین ۳۵ تا ۴۵ کلمه**. (خیلی کوتاه نباشد، خیلی طولانی نباشد).
        3. محتوا: با توجه به کارهای عقب‌افتاده کاربر یا موضوعاتی که اخیرا درباره‌شان صحبت کرده، یک تحلیل یا پیشنهاد هوشمندانه بده. اگر کاری ندارد، یک پیشنهاد برای استراحت یا یادگیری بده.
        4. لحن: صمیمی، دلسوزانه و انگیزشی. از سلام و احوال‌پرسی کلیشه‌ای پرهیز کن و مستقیم سر اصل مطلب برو.
      `;
    }
    else if (type === 'smart-task') {
      prompt = `
        Role: Smart Task Extractor.
        Current Date: ${today} (Jalali).
        User Input: "${input}"
        
        Mission:
        1. Extract a single actionable task from the input.
        2. Determine the deadline/date. If the user says "Tomorrow", "Next Week", etc., calculate the specific Jalali date based on Current Date. If no date is mentioned, use Current Date.
        3. Create a Persian title and description.
        
        Output Schema (JSON Object):
        {
            "title": "Task Title (Persian)",
            "description": "Details (Persian) - if implied in input, otherwise empty string",
            "date": "YYYY/MM/DD (Jalali)",
            "categoryId": "cat_todo"
        }
      `;
      config = { responseMimeType: 'application/json' };
    }
    
    const response = await runWithTimeout(ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config }));
    
    if (type === 'smart-task') {
      return c.json(JSON.parse(response.text || '{}'));
    } else {
      return c.json({ text: response.text });
    }
  } catch (e) { 
    return c.json({ error: "Content failed" }, 500); 
  }
});

// 6. Gemini Live Audio WebSockets
app.get('/live', async (c) => {
  const env = c.env as { GEMINI_API_KEY?: string };
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return c.text("Unauthorized - GEMINI_API_KEY not configured", 401);
  }

  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // Cloudflare WebSocket Pair Instantiation
  const pair = new (globalThis as any).WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
  
  // Set up connection logic
  server.accept();

  const ai = new GoogleGenAI({ apiKey });
  let geminiSessionPromise: Promise<any> | null = null;
  let isActive = true;

  try {
    // Initiate Realtime connection outward to Gemini Live Endpoint
    geminiSessionPromise = ai.live.connect({
      model: 'gemini-3.1-flash-live-preview',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: "You are Shahryar, a helpful assistant representing Rafsanjan.",
        tools: [{ functionDeclarations: [vectorSearchTool] }],
      },
      callbacks: {
        onopen: () => {
          if (isActive) {
            server.send(JSON.stringify({ type: 'connected' }));
          }
        },
        onmessage: async (msg: any) => {
          if (!isActive) return;
          const b64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (b64) {
            server.send(JSON.stringify({ type: 'audio', data: b64 }));
          }
          
          if (msg.toolCall) {
            for (const fc of msg.toolCall.functionCalls) {
              if (fc.name === 'search_knowledge_base') {
                const result = getLocalKnowledge(fc.args.query as string);
                if (geminiSessionPromise) {
                  const s = await geminiSessionPromise;
                  s.sendToolResponse({ 
                    functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] 
                  });
                }
              }
            }
          }
        },
        onclose: () => {
          isActive = false;
          try { server.close(); } catch(e) {}
        },
        onerror: (err: any) => {
          isActive = false;
          try { server.close(); } catch(e) {}
        }
      }
    });

    server.addEventListener('message', async (event) => {
      if (!isActive || !geminiSessionPromise) return;
      try {
        const d = JSON.parse(event.data as string);
        if (d.type === 'audio') {
          const s = await geminiSessionPromise;
          s.sendRealtimeInput({ audio: { mimeType: 'audio/pcm;rate=16000', data: d.data } });
        }
      } catch (err) {
        console.error("Error piping audio in CF worker:", err);
      }
    });

    server.addEventListener('close', async () => {
      isActive = false;
      if (geminiSessionPromise) {
        const s = await geminiSessionPromise;
        s.close();
      }
    });

  } catch (err) {
    console.error("Failed to connect live session", err);
    try { server.close(); } catch(e) {}
  }

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});

// 7. Static Asset & SPA Fallback Handler
app.all('*', async (c) => {
  const env = c.env as { ASSETS?: any };
  const assets = env.ASSETS;

  if (assets) {
    try {
      const res = await assets.fetch(c.req.raw);
      if (res.status !== 404) {
        return res;
      }
    } catch (e) {
      console.warn("Assets serving warning:", e);
    }
  }

  // SPA Fallback: Serve index.html if the requested asset is not found (e.g. for /profile, /chats, /planning)
  if (assets) {
    try {
      const indexRequest = new Request(new URL('/index.html', c.req.url), c.req.raw);
      return await assets.fetch(indexRequest);
    } catch (e) {
      return c.text("Fallback Error", 500);
    }
  }

  return c.text("Static ASSETS binding not matched. Build completed?", 404);
});

export default app;
