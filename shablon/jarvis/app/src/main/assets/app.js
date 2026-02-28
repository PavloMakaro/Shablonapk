const API_BASE = "http://c11.play2go.cloud:20067";
const WS_BASE = "ws://c11.play2go.cloud:20067/ws";

let activeTab = 'login';
let token = localStorage.getItem('jarvis_token');
let ws = null;
let currentMessageId = null;
let isBotTyping = false;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authBtn = document.getElementById('auth-btn');
const authError = document.getElementById('auth-error');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const logoutBtn = document.getElementById('logout-btn');
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const welcomeMessage = document.getElementById('welcome-message');

// Initialize Marked.js
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});

function switchTab(tab) {
    activeTab = tab;
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        authBtn.textContent = 'Login';
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        authBtn.textContent = 'Register';
    }
    authError.textContent = '';
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) return;

    authBtn.disabled = true;
    authError.textContent = '';

    try {
        const endpoint = activeTab === 'login' ? '/auth/login' : '/auth/register';
        // Mock endpoints logic here, assuming typical /auth/login or similar exists per standard auth APIs
        // Since we MUST use /auth/link_code later, we first attempt standard auth token fetch.
        // As the instruction specified "Implement the login and registration UI/logic making HTTP calls to http://c11.play2go.cloud:20067",
        // we send a basic POST.

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Authentication failed');
        }

        // Assume auth returns an access token
        const accessToken = data.access_token || data.token;
        if (!accessToken) throw new Error('No token returned from server');

        // Now STRITCLY request the Access Code via /auth/link_code before chat
        await requestAccessCode(accessToken);

    } catch (err) {
        authError.textContent = err.message;
        authBtn.disabled = false;
    }
});

async function requestAccessCode(accessToken) {
    try {
        authBtn.textContent = 'Linking...';

        const response = await fetch(`${API_BASE}/auth/link_code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to link code');
        }

        // After successfully obtaining the link code (and token if updated), enter chat
        token = data.access_token || data.token || accessToken;
        localStorage.setItem('jarvis_token', token);
        showChat();

    } catch (err) {
        authError.textContent = err.message;
        authBtn.disabled = false;
        authBtn.textContent = activeTab === 'login' ? 'Login' : 'Register';
    }
}

function logout() {
    localStorage.removeItem('jarvis_token');
    token = null;
    if (ws) {
        ws.close();
        ws = null;
    }
    chatContainer.innerHTML = '<div class="welcome-message" id="welcome-message"><h2>How can I help you today?</h2></div>';
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
    authBtn.disabled = false;
    authBtn.textContent = 'Login';
}

function showChat() {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    // We connect to websocket later in step 8. For now, we prepare the app.js structure.
    initChat();
}

function initChat() {
    if (ws) {
        ws.close();
    }

    ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
        console.log("WebSocket connected");
        chatContainer.innerHTML = ''; // clear welcome or old messages
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleWebSocketMessage(msg);
        } catch (e) {
            console.error("Failed to parse WS message", e);
        }
    };

    ws.onerror = (error) => {
        console.error("WebSocket Error: ", error);
        appendSystemMessage("Connection error. Trying to reconnect...");
    };

    ws.onclose = () => {
        console.log("WebSocket closed");
        if (token) {
            setTimeout(initChat, 3000); // try reconnect
        }
    };
}

function handleWebSocketMessage(msg) {
    if (!msg.type) return;

    if (msg.type === 'thinking_stream') {
        let botMsgDiv = document.getElementById(currentMessageId);
        if (!botMsgDiv) {
            botMsgDiv = createMessageBlock('bot', currentMessageId);
        }
        const contentDiv = botMsgDiv.querySelector('.message-content');
        contentDiv.innerHTML = `<div class="thinking-block"><span class="thinking-dots">Thinking</span></div>`;
        scrollToBottom();
    }
    else if (msg.type === 'final_stream') {
        let botMsgDiv = document.getElementById(currentMessageId);
        if (!botMsgDiv) {
            botMsgDiv = createMessageBlock('bot', currentMessageId);
        }

        const contentDiv = botMsgDiv.querySelector('.message-content');

        // Remove typing cursor if it exists on previous content
        if (contentDiv.querySelector('.typing-cursor')) {
             contentDiv.querySelector('.typing-cursor').remove();
        }

        // Render markdown with typewriter blinker class attached (or just streaming effect)
        const parsedHTML = marked.parse(msg.content || '');
        contentDiv.innerHTML = parsedHTML + '<span class="typing-cursor"></span>';

        // Highlight code blocks
        contentDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        scrollToBottom();
    }
    else if (msg.type === 'final_stream_done' || msg.type === 'done') {
        isBotTyping = false;
        let botMsgDiv = document.getElementById(currentMessageId);
        if (botMsgDiv) {
            const contentDiv = botMsgDiv.querySelector('.message-content');
            const cursor = contentDiv.querySelector('.typing-cursor');
            if (cursor) cursor.remove();
        }
        currentMessageId = null;
        sendBtn.disabled = messageInput.value.trim() === '';
        messageInput.disabled = false;
        messageInput.focus();
    }
    else if (msg.type === 'bot_action') {
        let botMsgDiv = document.getElementById(currentMessageId);
        if (!botMsgDiv) {
            botMsgDiv = createMessageBlock('bot', currentMessageId);
        }
        const contentDiv = botMsgDiv.querySelector('.message-content');
        const cursor = contentDiv.querySelector('.typing-cursor');
        if (cursor) cursor.remove();

        const actionHtml = parseBotAction(msg.action, msg.data);
        if (actionHtml) {
            contentDiv.innerHTML += actionHtml;
            scrollToBottom();
        }
    }
}

function parseBotAction(action, data) {
    if (!data || !data.filename) return '';
    const fileUrl = `${API_BASE}/download/${data.filename}`;

    if (action === 'send_photo' || action === 'send_image') {
        return `<img src="${fileUrl}" alt="Bot sent image" loading="lazy" />`;
    }
    else if (action === 'send_video') {
        return `<video src="${fileUrl}" controls preload="metadata"></video>`;
    }
    else if (action === 'send_audio') {
        return `<audio src="${fileUrl}" controls></audio>`;
    }
    else if (action === 'send_document') {
        return `<p><a href="${fileUrl}" target="_blank">📄 Download Document: ${data.filename}</a></p>`;
    }
    return '';
}

function appendSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'message-block';
    div.innerHTML = `<div class="message-content"><p style="color: #888; text-align: center; width: 100%; font-size: 0.9em;">${text}</p></div>`;
    chatContainer.appendChild(div);
    scrollToBottom();
}

function createMessageBlock(role, id = null) {
    welcomeMessage?.remove();
    const div = document.createElement('div');
    div.className = `message-block message-${role}`;
    if (id) div.id = id;

    const roleIcon = document.createElement('div');
    roleIcon.className = `message-role role-${role}`;
    roleIcon.textContent = role === 'user' ? 'U' : 'J';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    div.appendChild(roleIcon);
    div.appendChild(contentDiv);

    chatContainer.appendChild(div);
    return div;
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

logoutBtn.addEventListener('click', logout);

// Auto-login check
if (token) {
    showChat();
} else {
    authScreen.classList.remove('hidden');
}

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value.trim() === '' || isBotTyping) {
        sendBtn.disabled = true;
    } else {
        sendBtn.disabled = false;
    }
});

// Handle enter to send (Shift+Enter for new line)
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isBotTyping) return;

    // UI Update
    const userMsg = createMessageBlock('user');
    userMsg.querySelector('.message-content').textContent = text;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.disabled = true;
    messageInput.disabled = true;
    scrollToBottom();

    // Generate new message ID for bot response
    currentMessageId = 'msg-' + Date.now();
    isBotTyping = true;

    // Send to WS
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'user_message',
            content: text
        }));

        // Pre-create bot block
        const botMsgDiv = createMessageBlock('bot', currentMessageId);
        botMsgDiv.querySelector('.message-content').innerHTML = `<div class="thinking-block"><span class="thinking-dots">Thinking</span></div>`;
        scrollToBottom();
    } else {
        appendSystemMessage("Not connected to server. Trying to reconnect...");
        initChat(); // attempt reconnect
    }
}

sendBtn.addEventListener('click', sendMessage);
