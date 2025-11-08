const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  msgDiv.textContent = text;
  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userMsg = chatInput.value.trim();
  if (!userMsg) return;
  appendMessage(userMsg, 'user');
  chatInput.value = '';
  appendMessage('...', 'bot');

  // Send to backend
  try {
  const res = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg })
    });
    const data = await res.json();
    // Remove placeholder
    chatWindow.lastChild.remove();
    appendMessage(data.response, 'bot');
  } catch (err) {
    chatWindow.lastChild.remove();
    appendMessage('Error connecting to backend.', 'bot');
  }
});
