import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.API_KEY || process.env.REACT_APP_API_KEY; 

let ai = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
} else {
    console.warn("WARNING: API_KEY is missing.");
}

export default ai;