import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Optimization Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disabled for local development, adjust for prod
}));
app.use(cors());
app.use(compression());
app.use(express.json());

// Rate Limiting to prevent abuse and protect Gemini API quota
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Load the system prompt
const SYSTEM_PROMPT_PATH = path.join(__dirname, 'ultimate_prompt.txt');
let systemPrompt = '';
try {
  systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
} catch (error) {
  console.error("Failed to load ultimate_prompt.txt. Make sure the file exists.", error);
  // Fallback prompt just in case
  systemPrompt = 'You are a helpful election education assistant.';
}

// Initialize Google Gemini API
// Make sure to pass API_KEY as environment variable in Cloud Run
const apiKey = process.env.GEMINI_API_KEY || 'MISSING_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

// Using gemini-pro
const model = genAI.getGenerativeModel({
  model: 'gemini-pro',
  systemInstruction: systemPrompt,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { history, message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (apiKey === 'MISSING_API_KEY') {
        return res.status(500).json({ error: 'Gemini API Key is not configured. Please set the GEMINI_API_KEY environment variable.' });
    }

    // Convert frontend history format to Gemini format
    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    res.json({ response: responseText });
  } catch (error) {
    console.error('Error generating AI response:', error);
    res.status(500).json({ error: 'Failed to generate response. Please try again.' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
