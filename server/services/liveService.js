import ai from '../config/ai.js';
import { getLocalKnowledge, vectorSearchTool } from '../utils/helpers.js';

export const setupLiveServer = (wss) => {
    wss.on('connection', async (ws) => {
        let session = null;
        let isActive = true;

        if (!ai) { ws.close(); return; }

        try {
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: "You are Shahryar, a helpful assistant.",
                    tools: [{ functionDeclarations: [vectorSearchTool] }],
                },
                callbacks: {
                    onopen: () => { if(ws.readyState===ws.OPEN) ws.send(JSON.stringify({type:'connected'})); },
                    onmessage: async (msg) => {
                        if(!isActive) return;
                        const b64 = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if(b64 && ws.readyState===ws.OPEN) ws.send(JSON.stringify({type:'audio', data: b64}));
                        
                        if (msg.toolCall) {
                            for (const fc of msg.toolCall.functionCalls) {
                                if (fc.name === 'search_knowledge_base') {
                                    const result = getLocalKnowledge(fc.args.query);
                                    sessionPromise.then(s => s.sendToolResponse({ functionResponses: [{id:fc.id, name:fc.name, response:{result}}] }));
                                }
                            }
                        }
                    }
                }
            });
            session = await sessionPromise;
            ws.on('message', (m) => {
                if(!isActive || !session) return;
                const d = JSON.parse(m);
                if(d.type === 'audio') session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: d.data } });
            });
            ws.on('close', () => { isActive = false; if(session) session.close(); });
        } catch(e) { ws.close(); }
    });
};