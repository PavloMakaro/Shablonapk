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
const accessCodeInput = document.getElementById('accessCode');
const authBtn = document.getElementById('auth-btn');
const authError = document.getElementById('auth-error');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const logoutBtn = document.getElementById('logoutBtn');
const mainApp = document.getElementById('main-app');

// New App Container elements
const chatContainer = document.getElementById('chat-container');
const newChatState = document.getElementById('newChatState');
const activeChatState = document.getElementById('activeChatState');
const messageInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const profileName = document.getElementById('profile-name');
const profileInitial = document.getElementById('profile-initial');
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const newChatBtn = document.getElementById('newChatBtn');
const attachBtn = document.getElementById('attachBtn');
const attachSheet = document.getElementById('attachSheet');
const attachSheetBackdrop = document.getElementById('attachSheetBackdrop');
const closeAttachSheet = document.getElementById('closeAttachSheet');

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
    const accessCode = accessCodeInput.value.trim();

    if (!username || !password || !accessCode) {
        authError.textContent = 'All fields are required';
        return;
    }

    authBtn.disabled = true;
    authError.textContent = '';

    try {
        const endpoint = activeTab === 'login' ? '/auth/login' : '/auth/register';

        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Authentication failed');
        }

        const accessToken = data.access_token || data.token;
        if (!accessToken) throw new Error('No token returned from server');

        // Now request the Access Code via /auth/link_code
        await requestAccessCode(accessToken, accessCode, username);

    } catch (err) {
        authError.textContent = err.message;
        authBtn.disabled = false;
    }
});

async function requestAccessCode(accessToken, accessCode, username) {
    try {
        authBtn.textContent = 'Linking...';

        const response = await fetch(`${API_BASE}/auth/link_code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ code: accessCode })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || data.error || 'Code and valid session required');
        }

        // Save and update UI
        token = data.access_token || data.token || accessToken;
        localStorage.setItem('jarvis_token', token);
        localStorage.setItem('jarvis_username', username);

        showChat();

    } catch (err) {
        authError.textContent = err.message;
        authBtn.disabled = false;
        authBtn.textContent = activeTab === 'login' ? 'Login' : 'Register';
    }
}

function logout() {
    localStorage.removeItem('jarvis_token');
    localStorage.removeItem('jarvis_username');
    token = null;
    if (ws) {
        ws.close();
        ws = null;
    }
    activeChatState.innerHTML = '';

    // UI Reset
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');

    // Reset Chat State
    activeChatState.classList.add('hidden');
    activeChatState.classList.remove('flex');
    newChatState.classList.remove('hidden');

    // Auth Form Reset
    usernameInput.value = '';
    passwordInput.value = '';
    accessCodeInput.value = '';
    authBtn.disabled = false;
    authBtn.textContent = 'Login';

    toggleSidebar(false);
}

function showChat() {
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');

    const uName = localStorage.getItem('jarvis_username') || 'User';
    profileName.textContent = uName;
    profileInitial.textContent = uName.charAt(0).toUpperCase();

    initChat();
}

const toggleSidebar = (show) => {
    if(show) {
        sidebar.classList.remove('-translate-x-full');
        sidebarBackdrop.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        sidebar.classList.add('-translate-x-full');
        sidebarBackdrop.classList.add('opacity-0', 'pointer-events-none');
    }
};

const toggleSheet = (sheet, backdrop, show) => {
    if(show) {
        sheet.classList.remove('translate-y-full');
        backdrop.classList.remove('opacity-0', 'pointer-events-none');
    } else {
        sheet.classList.add('translate-y-full');
        backdrop.classList.add('opacity-0', 'pointer-events-none');
    }
};

// Sidebar Handlers
menuBtn.addEventListener('click', () => toggleSidebar(true));
sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

// Attach Handlers
attachBtn.addEventListener('click', () => toggleSheet(attachSheet, attachSheetBackdrop, true));
closeAttachSheet.addEventListener('click', () => toggleSheet(attachSheet, attachSheetBackdrop, false));
attachSheetBackdrop.addEventListener('click', () => toggleSheet(attachSheet, attachSheetBackdrop, false));

// New Chat state handler
newChatBtn.addEventListener('click', () => {
    activeChatState.classList.add('hidden');
    activeChatState.classList.remove('flex');
    newChatState.classList.remove('hidden');
    messageInput.value = '';
});


function initChat() {
    if (ws) {
        ws.close();
    }

    ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

    ws.onopen = () => {
        console.log("WebSocket connected");
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
        contentDiv.innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="w-6 h-6 text-[#c0846c] animate-spin" viewBox="0 0 24 24" fill="currentColor" style="animation-duration: 3s;">
                    <path d="M12 2L12 6M12 18L12 22M4.9282 4.9282L7.75664 7.75664M16.2434 16.2434L19.0718 19.0718M2 12L6 12M18 12L22 12M4.9282 19.0718L7.75664 16.2434M16.2434 7.75664L19.0718 4.9282" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
            </div>`;
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
        return `<img src="${fileUrl}" alt="Bot sent image" loading="lazy" class="rounded-xl mt-2 max-w-full" />`;
    }
    else if (action === 'send_video') {
        return `<video src="${fileUrl}" controls preload="metadata" class="rounded-xl mt-2 max-w-full"></video>`;
    }
    else if (action === 'send_audio') {
        return `<audio src="${fileUrl}" controls class="mt-2 w-full"></audio>`;
    }
    else if (action === 'send_document') {
        return `<a href="${fileUrl}" target="_blank" class="block mt-2 bg-[#2a2a2c] p-3 rounded-xl hover:bg-[#333] transition text-blue-400">📄 Download: ${data.filename}</a>`;
    }
    return '';
}

function appendSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'flex justify-center my-4';
    div.innerHTML = `<div class="text-[#888] text-[0.9em] italic">${text}</div>`;
    activeChatState.appendChild(div);
    scrollToBottom();
}

function createMessageBlock(role, id = null) {
    // Hide new chat state, show active chat
    if (!newChatState.classList.contains('hidden')) {
        newChatState.classList.add('hidden');
        activeChatState.classList.remove('hidden');
        activeChatState.classList.add('flex');
    }

    const div = document.createElement('div');
    if (id) div.id = id;

    if (role === 'user') {
        div.className = 'flex justify-end';
        div.innerHTML = `
            <div class="bg-[#2c2d2e] text-[#f1f1f1] px-4 py-3 rounded-[20px] max-w-[80%]">
                <div class="message-content text-[16px] leading-snug font-normal"></div>
            </div>
        `;
    } else {
        div.className = 'flex justify-start';
        div.innerHTML = `
            <div class="text-[#f1f1f1] w-full max-w-full">
                <div class="message-content text-[16px] leading-relaxed font-normal"></div>
            </div>
        `;
    }

    activeChatState.appendChild(div);
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

// Input dynamics
messageInput.addEventListener('input', function() {
    if(this.value.trim() === '' || isBotTyping) {
        micBtn.classList.remove('hidden');
        sendBtn.classList.add('hidden');
        sendBtn.disabled = true;
    } else {
        micBtn.classList.add('hidden');
        sendBtn.classList.remove('hidden');
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
    micBtn.classList.remove('hidden');
    sendBtn.classList.add('hidden');
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
        botMsgDiv.querySelector('.message-content').innerHTML = `
            <div class="flex items-center gap-3">
                <svg class="w-6 h-6 text-[#c0846c] animate-spin" viewBox="0 0 24 24" fill="currentColor" style="animation-duration: 3s;">
                    <path d="M12 2L12 6M12 18L12 22M4.9282 4.9282L7.75664 7.75664M16.2434 16.2434L19.0718 19.0718M2 12L6 12M18 12L22 12M4.9282 19.0718L7.75664 16.2434M16.2434 7.75664L19.0718 4.9282" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
            </div>`;
        scrollToBottom();
    } else {
        appendSystemMessage("Not connected to server. Trying to reconnect...");
        initChat(); // attempt reconnect
    }
}

sendBtn.addEventListener('click', sendMessage);
