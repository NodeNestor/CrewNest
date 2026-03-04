import { Hono } from 'hono';
import { getChatHistory, clearChatHistory } from '../db.js';
import { chat } from '../orchestrator.js';

const app = new Hono();

// Send a message to the orchestrator
app.post('/', async (c) => {
  const { message } = await c.req.json();
  if (!message || typeof message !== 'string') {
    return c.json({ error: 'message is required' }, 400);
  }

  try {
    const response = await chat(message);
    return c.json({ response });
  } catch (err: any) {
    console.error('Chat error:', err);
    return c.json({ error: err.message || 'Chat failed' }, 500);
  }
});

// Get chat history
app.get('/history', (c) => {
  const limit = parseInt(c.req.query('limit') || '100');
  const messages = getChatHistory(limit).reverse();
  return c.json(messages);
});

// Clear chat history
app.delete('/history', (c) => {
  clearChatHistory();
  return c.json({ success: true });
});

export default app;
