const API_BASE = "http://c11.play2go.cloud:20067";
const WS_BASE = "ws://c11.play2go.cloud:20067/ws";

let activeTab = 'login';
let token = localStorage.getItem('jarvis_token');
let ws = null;
let currentMessageId = null;
let isBotTyping = false;
let currentChatId = `chat_${Date.now()}`;
let uploadedFileRefs = [];

// DOM Elements
const authScreen = document.getElementById('auth-screen');
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

// Chat Elements
const chatContainer = document.getElementById('chat-container');
const newChatState = document.getElementById('newChatState');
const activeChatState = document.getElementById('activeChatState');
const messageInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const newChatBtn = document.getElementById('newChatBtn');
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

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
        tabLogin.classList.add('border-black', 'text-black');
        tabLogin.classList.remove('border-transparent', 'text-gray-500');
        tabRegister.classList.add('border-transparent', 'text-gray-500');
        tabRegister.classList.remove('border-black', 'text-black');
        authBtn.textContent = 'Login';
    } else {
        tabRegister.classList.add('border-black', 'text-black');
        tabRegister.classList.remove('border-transparent', 'text-gray-500');
        tabLogin.classList.add('border-transparent', 'text-gray-500');
        tabLogin.classList.remove('border-black', 'text-black');
        authBtn.textContent = 'Register';
    }
    authError.textContent = '';
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const accessCode = accessCodeInput.value.trim();
    const isAccessCodeVisible = !accessCodeInput.classList.contains('hidden');

    if (!username || !password) {
        authError.textContent = 'Username and password required';
        return;
    }

    if (isAccessCodeVisible && !accessCode) {
        authError.textContent = 'Access Code required';
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
            const errText = data.message || data.error || 'Authentication failed';
            if (errText.toLowerCase().includes('code') && errText.toLowerCase().includes('required')) {
                accessCodeInput.classList.remove('hidden');
                throw new Error('Please enter your Access Code and try again.');
            }
            throw new Error(errText);
        }

        const accessToken = data.access_token || data.token;
        if (!accessToken) throw new Error('No token returned from server');

        if (isAccessCodeVisible && accessCode) {
            await requestAccessCode(accessToken, accessCode, username);
        } else {
            token = accessToken;
            localStorage.setItem('jarvis_token', token);
            localStorage.setItem('jarvis_username', username);
            showChat();
        }

    } catch (err) {
        authError.textContent = err.message;
        authBtn.disabled = false;
        authBtn.textContent = activeTab === 'login' ? 'Login' : 'Register';
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
            throw new Error(data.message || data.error || 'Invalid access code');
        }

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

    mainApp.classList.add('hidden');
    mainApp.classList.remove('flex');
    authScreen.classList.remove('hidden');
    authScreen.classList.add('flex');

    activeChatState.classList.add('hidden');
    activeChatState.classList.remove('flex');
    newChatState.classList.remove('hidden');
    newChatState.classList.add('flex');

    usernameInput.value = '';
    passwordInput.value = '';
    accessCodeInput.value = '';
    authBtn.disabled = false;
    authBtn.textContent = 'Login';

    toggleSidebar(false);
}

function showChat() {
    authScreen.classList.add('hidden');
    authScreen.classList.remove('flex');
    mainApp.classList.remove('hidden');
    mainApp.classList.add('flex');
    initChat();
}

const toggleSidebar = (show) => {
    if(show) {
        sidebar.classList.remove('-translate-x-full');
        sidebarBackdrop.classList.remove('hidden', 'opacity-0');
        sidebarBackdrop.classList.add('opacity-100');
    } else {
        sidebar.classList.add('-translate-x-full');
        sidebarBackdrop.classList.remove('opacity-100');
        sidebarBackdrop.classList.add('opacity-0', 'hidden');
    }
};

menuBtn.addEventListener('click', () => toggleSidebar(true));
sidebarBackdrop.addEventListener('click', () => toggleSidebar(false));

// Dynamic textarea height
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';

    if(this.value.trim() === '' || isBotTyping) {
        sendBtn.classList.add('hidden');
    } else {
        sendBtn.classList.remove('hidden');
    }
});

messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

newChatBtn.addEventListener('click', () => {
    currentChatId = `chat_${Date.now()}`;
    activeChatState.innerHTML = '';
    activeChatState.classList.add('hidden');
    activeChatState.classList.remove('flex');
    newChatState.classList.remove('hidden');
    newChatState.classList.add('flex');
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.classList.add('hidden');
    toggleSidebar(false);
});

// File Upload directly from attachment icon
attachBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '*/*';
    input.onchange = async (e) => {
        if (e.target.files.length === 0) return;
        const file = e.target.files[0];
        appendSystemMessage(`Uploading: ${file.name}...`);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed');

            const refType = file.type.startsWith('image/') ? 'Image' :
                            file.type.startsWith('video/') ? 'Video' : 'File';
            uploadedFileRefs.push(`[${refType}: ${data.filepath}]`);
            appendSystemMessage(`✓ Attached: ${data.filename}`);
        } catch (err) {
            appendSystemMessage(`❌ Upload Error: ${err.message}`);
        }
    };
    input.click();
});

function sendMessage() {
    const text = messageInput.value.trim();
    if ((!text && uploadedFileRefs.length === 0) || isBotTyping) return;

    if (!newChatState.classList.contains('hidden')) {
        newChatState.classList.add('hidden');
        newChatState.classList.remove('flex');
        activeChatState.classList.remove('hidden');
        activeChatState.classList.add('flex');
    }

    let displayContent = text;
    let messageContent = text;
    if (uploadedFileRefs.length > 0) {
        messageContent += (text ? "\n\n" : "") + uploadedFileRefs.join("\n");
        displayContent += (text ? "\n" : "") + `<span class="text-sm text-gray-500 italic">[Attached files]</span>`;
        uploadedFileRefs = [];
    }

    const userMsg = createMessageBlock('user');
    userMsg.querySelector('.message-content').innerHTML = `<p>${displayContent}</p>`;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendBtn.classList.add('hidden');
    messageInput.disabled = true;
    scrollToBottom();

    currentMessageId = 'msg-' + Date.now();
    isBotTyping = true;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'chat',
            chat_id: currentChatId,
            message: messageContent
        }));

        const botMsgDiv = createMessageBlock('bot', currentMessageId);
        botMsgDiv.querySelector('.message-content').innerHTML = `
            <div class="thinking-block">
                <span class="thinking-dots">Thinking</span>
            </div>`;
        scrollToBottom();
    } else {
        appendSystemMessage("Connection error. Reconnecting...");
        initChat();
    }
}

sendBtn.addEventListener('click', sendMessage);

function appendSystemMessage(text) {
    if (!newChatState.classList.contains('hidden')) {
        newChatState.classList.add('hidden');
        newChatState.classList.remove('flex');
        activeChatState.classList.remove('hidden');
        activeChatState.classList.add('flex');
    }
    const div = document.createElement('div');
    div.className = 'flex justify-center my-2';
    div.innerHTML = `<div class="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">${text}</div>`;
    activeChatState.appendChild(div);
    scrollToBottom();
}

function createMessageBlock(role, id = null) {
    const div = document.createElement('div');
    div.className = 'message w-full';
    if (id) div.id = id;

    if (role === 'user') {
        div.classList.add('message-user');
        div.innerHTML = `<div class="message-content text-[15px]"></div>`;
    } else {
        div.classList.add('message-bot');
        div.innerHTML = `<div class="message-content text-[15px]"></div>`;
    }

    activeChatState.appendChild(div);
    return div;
}

function scrollToBottom() {
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

function initChat() {
    fetchChats();
    if (ws) ws.close();

    ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleWebSocketMessage(msg);
        } catch (e) {
            console.error("Failed to parse WS message", e);
        }
    };

    ws.onerror = () => appendSystemMessage("Connection error. Retrying...");
    ws.onclose = () => { if (token) setTimeout(initChat, 3000); };
}

function handleWebSocketMessage(msg) {
    if (!msg.type) return;

    let botMsgDiv = document.getElementById(currentMessageId);
    if (!botMsgDiv && (msg.type === 'thinking_stream' || msg.type === 'final_stream' || msg.type === 'agent_state')) {
        botMsgDiv = createMessageBlock('bot', currentMessageId);
    }
    const contentDiv = botMsgDiv ? botMsgDiv.querySelector('.message-content') : null;

    if (msg.type === 'agent_state' && contentDiv) {
        const state = msg.data.status;
        const content = msg.data.content;

        const cursor = contentDiv.querySelector('.typing-cursor');
        if (cursor) cursor.remove();

        if (state === 'thinking' || state === 'thinking_stream') {
            contentDiv.innerHTML = `
                <div class="thinking-block">
                    <span class="thinking-dots">Thinking</span>
                </div>`;
        }
        else if (state === 'final_stream' || state === 'final') {
            contentDiv.innerHTML = marked.parse(content || '') + (state === 'final_stream' ? '<span class="typing-cursor"></span>' : '');
            contentDiv.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));

            if (state === 'final') finishBotMessage();
        }
    }
    else if (msg.type === 'thinking_stream' && contentDiv) {
        contentDiv.innerHTML = `
            <div class="thinking-block">
                <span class="thinking-dots">Thinking</span>
            </div>`;
    }
    else if (msg.type === 'final_stream' && contentDiv) {
        const cursor = contentDiv.querySelector('.typing-cursor');
        if (cursor) cursor.remove();
        contentDiv.innerHTML = marked.parse(msg.content || '') + '<span class="typing-cursor"></span>';
        contentDiv.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));
    }
    else if ((msg.type === 'final_stream_done' || msg.type === 'done')) {
        if (contentDiv) {
            const cursor = contentDiv.querySelector('.typing-cursor');
            if (cursor) cursor.remove();
        }
        finishBotMessage();
    }
    else if (msg.type === 'bot_action') {
        if (!botMsgDiv) botMsgDiv = createMessageBlock('bot', currentMessageId);
        const actionContentDiv = botMsgDiv.querySelector('.message-content');
        const cursor = actionContentDiv.querySelector('.typing-cursor');
        if (cursor) cursor.remove();

        const actionHtml = parseBotAction(msg.action, msg.filename ? {filename: msg.filename} : msg.data);
        if (actionHtml) {
            actionContentDiv.innerHTML += actionHtml;
            scrollToBottom();
        }
        if (window.AndroidJS && window.AndroidJS.vibrate) window.AndroidJS.vibrate(100);
    }
    scrollToBottom();
}

function finishBotMessage() {
    isBotTyping = false;
    currentMessageId = null;
    messageInput.disabled = false;
    messageInput.focus();
    if (window.AndroidJS && window.AndroidJS.vibrate) window.AndroidJS.vibrate(50);
    fetchChats();
}

function parseBotAction(action, data) {
    if (!data || !data.filename) return '';
    const fileUrl = `${API_BASE}/download/${data.filename}`;

    if (action === 'send_photo' || action === 'send_image') {
        return `<img src="${fileUrl}" alt="Bot sent image" loading="lazy" class="message-media" />`;
    } else if (action === 'send_video') {
        return `<video src="${fileUrl}" controls preload="metadata" class="message-media"></video>`;
    } else if (action === 'send_audio') {
        return `<audio src="${fileUrl}" controls class="w-full mt-2"></audio>`;
    } else if (action === 'send_document') {
        return `<a href="${fileUrl}" target="_blank" class="inline-flex items-center gap-2 mt-2 bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 text-sm font-medium">
            <svg class="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            ${data.filename}
        </a>`;
    }
    return '';
}

async function fetchChats() {
    try {
        const res = await fetch(`${API_BASE}/api/chats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const chats = await res.json();

        const historyList = document.getElementById('sidebar-history-list');
        historyList.innerHTML = '';

        if (!chats || chats.length === 0) {
            historyList.innerHTML = '<div class="text-sm text-gray-400 py-2">No history yet</div>';
            return;
        }

        chats.forEach(chat => {
            const chatDiv = document.createElement('div');
            chatDiv.className = 'cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors text-sm text-gray-700 truncate';
            chatDiv.textContent = chat.title || chat.id;
            chatDiv.onclick = () => loadChatHistory(chat.id || chat.chat_id);
            historyList.appendChild(chatDiv);
        });
    } catch(e) { console.error("Failed to load chats", e); }
}

async function loadChatHistory(chatId) {
    try {
        const res = await fetch(`${API_BASE}/api/chats/${chatId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load history');
        const data = await res.json();

        currentChatId = chatId;
        activeChatState.innerHTML = '';
        toggleSidebar(false);

        newChatState.classList.add('hidden');
        newChatState.classList.remove('flex');
        activeChatState.classList.remove('hidden');
        activeChatState.classList.add('flex');

        if (data.messages) {
            data.messages.forEach(m => {
                const msgBlock = createMessageBlock(m.role);
                const contentDiv = msgBlock.querySelector('.message-content');
                if (m.role === 'assistant') {
                    contentDiv.innerHTML = marked.parse(m.content || '');
                    contentDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
                } else {
                    contentDiv.innerHTML = `<p>${m.content}</p>`;
                }
            });
            scrollToBottom();
        }
    } catch(e) {
        appendSystemMessage("Failed to load chat history.");
    }
}

logoutBtn.addEventListener('click', logout);

if (token) {
    showChat();
} else {
    authScreen.classList.remove('hidden');
    authScreen.classList.add('flex');
}
