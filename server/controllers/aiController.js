import ai from '../config/ai.js';
import { runWithTimeout, getLocalKnowledge, vectorSearchTool } from '../utils/helpers.js';

// Helper to get today's date in Jalali for AI Context
const getJalaliToday = () => {
    return new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export const chat = async (req, res) => {
    if (!ai) return res.status(500).json({ error: "AI not configured" });
    try {
        const { history, user, tasks } = req.body; 
        const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        // Enhance task summary to be more descriptive for the AI
        const tasksSummary = tasks && tasks.length > 0
            ? tasks.map(t => {
                const statusMap = { 'todo': 'انجام نشده', 'in-progress': 'در حال انجام', 'done': 'انجام شده' };
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
        let collectedSources = [];
        
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
                    config: { systemInstruction, tools: selectedTools }
                })
            );

            const functionCalls = response.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                if (call.name === 'search_knowledge_base') {
                    const result = getLocalKnowledge(call.args.query);
                    currentHistory.push({ role: 'model', parts: [{ functionCall: call }] });
                    currentHistory.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: { result } } }] });
                    continue; 
                }
            }

            if (response.text) finalResponseText = response.text;
            
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const newSources = groundingChunks.filter(c => c.web?.uri && c.web?.title).map(c => ({ title: c.web.title, uri: c.web.uri }));
                collectedSources = [...collectedSources, ...newSources];
            }
            break; 
        }

        res.json({ text: finalResponseText, sources: collectedSources });

    } catch (error) {
        if (error.message === 'AI_TIMEOUT') return res.status(504).json({ error: "Timeout" });
        res.status(500).json({ error: "AI Error" });
    }
};

export const analyzeProfile = async (req, res) => {
    try {
        const response = await runWithTimeout(ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze traits. JSON Array of strings (Persian). Input: ${req.body.messages.slice(0, 5000)}`,
            config: { responseMimeType: 'application/json' }
        }));
        res.json(JSON.parse(response.text || "[]"));
    } catch (e) { res.status(500).json({ error: "Analysis failed" }); }
};

export const generatePlanning = async (req, res) => {
    try {
        const { prompt, categories } = req.body;
        const today = getJalaliToday();

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
        
        res.json(JSON.parse(response.text || "[]"));
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Generation failed" }); 
    }
};

export const generateHomeContent = async (req, res) => {
    try {
        const { tasks, chats, type, input } = req.body; 
        let prompt = "", config = {};
        
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
        else if (type === 'fact') prompt = `Short interesting fact about Rafsanjan in Persian. Max 1 sentence.`;
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
             const today = getJalaliToday();
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
        
        if (type === 'smart-task') res.json(JSON.parse(response.text || '{}'));
        else res.json({ text: response.text });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Content failed" }); 
    }
};