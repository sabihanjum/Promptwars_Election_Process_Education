import { marked } from 'marked';
import DOMPurify from 'dompurify';

document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const chatHistory = document.getElementById('chat-history');
  const loadingIndicator = document.getElementById('loading-indicator');
  const sendButton = document.getElementById('send-button');

  // Store chat history to send context to the backend
  let history = [];

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    // 1. Add user message to UI
    appendMessage('user', message);
    userInput.value = '';
    
    // Disable input while loading
    userInput.disabled = true;
    sendButton.disabled = true;
    loadingIndicator.classList.remove('hidden');

    try {
      // 2. Send request to backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, history }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch response');
      }

      // 3. Update history context
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: data.response });

      // 4. Add assistant response to UI (parsing Markdown securely)
      const parsedHTML = DOMPurify.sanitize(marked.parse(data.response));
      appendMessage('assistant', parsedHTML, true);

    } catch (error) {
      console.error('Error:', error);
      appendMessage('assistant', `<p style="color: red;">Error: ${error.message}</p>`, true);
    } finally {
      // 5. Reset UI state
      loadingIndicator.classList.add('hidden');
      userInput.disabled = false;
      sendButton.disabled = false;
      userInput.focus();
    }
  });

  function appendMessage(role, content, isHTML = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isHTML) {
      contentDiv.innerHTML = content;
    } else {
      const p = document.createElement('p');
      p.textContent = content;
      contentDiv.appendChild(p);
    }

    messageDiv.appendChild(contentDiv);
    chatHistory.appendChild(messageDiv);
    
    // Scroll to bottom
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
});
