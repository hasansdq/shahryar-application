import ai from '../config/ai.js';
import { runWithTimeout, getLocalKnowledge, vectorSearchTool } from '../utils/helpers.js';

export const chat = async (req, res) => {
    if (!ai) return res.status(500).json({ error: "AI not configured" });
    try {
        const { history, user, tasks } = req.body; 
        const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const tasksSummary = tasks ? tasks.map(t => `- ${t.title} (${t.status}, ${t.date})`).join('\n') : 'هیچ';

        const systemInstruction = `
          شما "شهریار" هستید، هوش مصنوعی بومی رفسنجان.
          تاریخ: ${today}.
          دستورالعمل کاربر: ${user.customInstructions || 'ندارد'}
          اخبار: استفاده از googleSearch.
          اطلاعات محلی: استفاده از search_knowledge_base.
          وظایف کاربر: ${tasksSummary}
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
        const response = await runWithTimeout(ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Task planner (Jalali). Categories: ${JSON.stringify(categories)}. Input: "${prompt}". Output JSON Array.`,
            config: { responseMimeType: 'application/json' }
        }));
        res.json(JSON.parse(response.text || "[]"));
    } catch (e) { res.status(500).json({ error: "Generation failed" }); }
};

export const generateHomeContent = async (req, res) => {
    try {
        const { tasks, chats, type, input } = req.body; 
        let prompt = "", config = {};
        if (type === 'suggestion') prompt = `Based on [${tasks}] and [${chats}], short friendly Persian suggestion.`;
        else if (type === 'fact') prompt = `Short interesting fact about Rafsanjan in Persian.`;
        else if (type === 'notification') prompt = `Urgent/motivating notification based on [${tasks}]. Persian.`;
        else if (type === 'smart-task') {
             prompt = `Convert "${input}" to task JSON (cat_todo, Jalali date).`;
             config = { responseMimeType: 'application/json' };
        }
        const response = await runWithTimeout(ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config }));
        
        if (type === 'smart-task') res.json(JSON.parse(response.text || '{}'));
        else res.json({ text: response.text });
    } catch (e) { res.status(500).json({ error: "Content failed" }); }
};