import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server.js';

// Mock the Gemini API so we don't actually hit the network during tests
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          startChat: () => ({
            sendMessage: async () => ({
              response: { text: () => "Mocked AI response" }
            })
          })
        };
      }
    },
    HarmCategory: {
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT'
    },
    HarmBlockThreshold: {
      BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH'
    }
  };
});

describe('CivicGuide Backend API Tests', () => {
  describe('POST /api/chat', () => {
    it('should return 400 if message is missing', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ history: [] });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('message string is required');
    });

    it('should return 400 if message exceeds length limit', async () => {
      const longMessage = 'a'.repeat(600);
      const res = await request(app)
        .post('/api/chat')
        .send({ message: longMessage });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('exceeds maximum length');
    });

    it('should return 400 if history is not an array', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'Hello', history: 'not an array' });
      
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('History must be an array');
    });

    it('should return 200 and a mocked response for a valid request', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: 'What is an election?', history: [] });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('response');
      expect(res.body.response).toBe('Mocked AI response');
    });
  });

  describe('Security Headers', () => {
    it('should include Helmet security headers', async () => {
      const res = await request(app).post('/api/chat').send({ message: 'Hello' });
      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers).toHaveProperty('x-xss-protection');
    });
  });
});
