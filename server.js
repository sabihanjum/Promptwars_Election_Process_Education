/**
 * @fileoverview Express server for CivicGuide, providing a secure backend for the Gemini API.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Cloud Run (required for rate limiting behind load balancers)
app.set('trust proxy', 1);

/**
 * Configure Helmet with a strict Content Security Policy.
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"]
    }
  }
}));

// Restrict CORS to specific origins in production, allow all for local dev
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL || '*' : '*'
};
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10kb' })); // Limit JSON payload size to prevent payload exhaustion

/**
 * Rate Limiting to prevent abuse and protect Gemini API quota.
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Load the system prompt securely
const SYSTEM_PROMPT_PATH = path.join(__dirname, 'ultimate_prompt.txt');
let systemPrompt;
try {
  systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
} catch (error) {
  console.error("Failed to load ultimate_prompt.txt. Make sure the file exists.", error);
  systemPrompt = 'You are a helpful election education assistant.';
}

// Initialize Google Gemini API
const apiKey = process.env.GEMINI_API_KEY || 'MISSING_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Advanced Gemini Model Configuration
 * Includes strict safety settings and optimized generation config.
 */
const app_model = genAI.getGenerativeModel({
  model: 'gemini-flash-latest',
  systemInstruction: systemPrompt,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    }
  ],
  generationConfig: {
    temperature: 0.2, // Low temperature for more factual, non-partisan responses
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  }
});

/**
 * @route POST /api/chat
 * @desc Handles chat interactions with the Gemini API
 * @access Public (Rate Limited)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { history, message } = req.body;

    // Strict Input Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Valid message string is required' });
    }
    
    if (message.length > 500) {
      return res.status(400).json({ error: 'Message exceeds maximum length of 500 characters' });
    }

    if (history && !Array.isArray(history)) {
       return res.status(400).json({ error: 'History must be an array' });
    }

    if (apiKey === 'MISSING_API_KEY') {
        return res.status(500).json({ error: 'Gemini API Key is not configured.' });
    }

    // Sanitize and convert frontend history format to Gemini format securely
    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(msg.content).substring(0, 2000) }] // Cap history context length
    }));

    const chat = app_model.startChat({
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
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Export app for testing
export { app };

// Only listen if not being imported by tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}
