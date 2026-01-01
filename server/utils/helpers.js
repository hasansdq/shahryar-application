import { Type } from '@google/genai';

const AI_TIMEOUT_MS = 30000;

export const runWithTimeout = (promise) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("AI_TIMEOUT"));
        }, AI_TIMEOUT_MS);
    });
    return Promise.race([
        promise.finally(() => clearTimeout(timeoutId)),
        timeoutPromise
    ]);
};

export const getLocalKnowledge = (query) => {
    return `اطلاعات یافت شده در پایگاه داده داخلی برای "${query}":
    رفسنجان یکی از شهرهای مهم استان کرمان و مرکز پسته ایران است.
    مکان‌های دیدنی شامل: خانه حاج آقا علی (بزرگترین خانه خشتی جهان)، دره راگه، و بازار قدیم.
    پسته رفسنجان شهرت جهانی دارد و ارقام اکبری، کله‌قوچی و احمدآقایی معروف‌ترین آنها هستند.`;
};

export const vectorSearchTool = {
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