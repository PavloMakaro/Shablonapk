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

// File Manager DOM & State
const fileManagerTabBtn = document.getElementById('fileManagerTabBtn');
const fileManagerContainer = document.getElementById('file-manager-container');
const fileGrid = document.getElementById('fileGrid');
const emptyFilesMsg = document.getElementById('emptyFilesMsg');
const fileCount = document.getElementById('fileCount');
let sharedFiles = []; // Array to keep track of shared media/files

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
            // Check if server demands an access code
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
            // User provided code, try to link it
            await requestAccessCode(accessToken, accessCode, username);
        } else {
            // Logged in successfully, no code needed
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

// File Upload Logic
const fileUploadInput = document.getElementById('fileUploadInput');
const btnUploadImage = document.getElementById('btnUploadImage');
const btnUploadFile = document.getElementById('btnUploadFile');

// Audio Recording Logic
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

micBtn.addEventListener('click', async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

                // Trigger the upload logic directly
                appendSystemMessage(`Uploading Voice Message...`);
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

                    uploadedFileRefs.push(`[Voice: ${data.filepath}]`);
                    appendSystemMessage(`✓ Voice Attached: ${data.filename}`);

                    // Automatically send a default message with the voice note if input is empty
                    if (messageInput.value.trim() === '') {
                        messageInput.value = 'Voice message';
                    }
                    sendMessage();

                } catch (err) {
                    appendSystemMessage(`❌ Voice Upload Error: ${err.message}`);
                }
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('text-red-500'); // UI Feedback
            if (window.AndroidJS && window.AndroidJS.vibrate) window.AndroidJS.vibrate(50);

        } catch (err) {
            appendSystemMessage(`❌ Microphone Error: ${err.message}`);
        }
    } else {
        // Stop recording
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        isRecording = false;
        micBtn.classList.remove('text-red-500');
        if (window.AndroidJS && window.AndroidJS.vibrate) window.AndroidJS.vibrate(50);
    }
});

btnUploadImage.addEventListener('click', () => {
    fileUploadInput.accept = "image/*,video/*";
    fileUploadInput.click();
    toggleSheet(attachSheet, attachSheetBackdrop, false);
});

btnUploadFile.addEventListener('click', () => {
    fileUploadInput.accept = "*/*";
    fileUploadInput.click();
    toggleSheet(attachSheet, attachSheetBackdrop, false);
});

fileUploadInput.addEventListener('change', async (e) => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];

    // UI Feedback
    appendSystemMessage(`Uploading: ${file.name}...`);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Upload failed');

        // Save the reference for the next message
        const refType = file.type.startsWith('audio/') ? 'Voice' : 'File';
        uploadedFileRefs.push(`[${refType}: ${data.filepath}]`);

        appendSystemMessage(`✓ Attached: ${data.filename}`);
    } catch (err) {
        appendSystemMessage(`❌ Upload Error: ${err.message}`);
    }
    fileUploadInput.value = ''; // reset
});

// Fetch Sidebar Chats
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
            historyList.innerHTML = '<div class="text-sm text-gray-500">No chats yet</div>';
            return;
        }

        chats.forEach(chat => {
            const chatDiv = document.createElement('div');
            chatDiv.className = 'cursor-pointer hover:bg-[#2a2a2c] -mx-2 p-2 rounded-lg transition-colors';
            chatDiv.innerHTML = `<p class="text-[15px] text-[#e0e0e0] truncate">${chat.title || chat.id}</p>`;
            chatDiv.onclick = () => loadChatHistory(chat.id || chat.chat_id);
            historyList.appendChild(chatDiv);
        });
    } catch(e) {
        console.error("Failed to load chats", e);
    }
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
        sharedFiles = []; // Reset files
        updateFileManagerUI();
        toggleSidebar(false);

        newChatState.classList.add('hidden');
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
                    contentDiv.textContent = m.content;
                }
            });
            scrollToBottom();
        }
    } catch(e) {
        appendSystemMessage("Failed to load chat history.");
    }
}

// Attach Handlers
attachBtn.addEventListener('click', () => toggleSheet(attachSheet, attachSheetBackdrop, true));
closeAttachSheet.addEventListener('click', () => toggleSheet(attachSheet, attachSheetBackdrop, false));
attachSheetBackdrop.addEventListener('click', () => toggleSheet(attachSheet, attachSheetBackdrop, false));

// New Chat state handler
newChatBtn.addEventListener('click', () => {
    currentChatId = `chat_${Date.now()}`;
    activeChatState.innerHTML = '';
    activeChatState.classList.add('hidden');
    activeChatState.classList.remove('flex');
    newChatState.classList.remove('hidden');
    messageInput.value = '';
    sharedFiles = []; // Reset files
    updateFileManagerUI();
    toggleSidebar(false);
});


function initChat() {
    fetchChats();
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

    if (msg.type === 'agent_state') {
        const state = msg.data.status;
        const content = msg.data.content;

        let botMsgDiv = document.getElementById(currentMessageId);
        if (!botMsgDiv) botMsgDiv = createMessageBlock('bot', currentMessageId);
        const contentDiv = botMsgDiv.querySelector('.message-content');

        // Remove typing cursor if it exists
        const cursor = contentDiv.querySelector('.typing-cursor');
        if (cursor) cursor.remove();

        if (state === 'thinking' || state === 'thinking_stream') {
            contentDiv.innerHTML = `
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6 text-[#c0846c] animate-spin" viewBox="0 0 24 24" fill="currentColor" style="animation-duration: 3s;">
                        <path d="M12 2L12 6M12 18L12 22M4.9282 4.9282L7.75664 7.75664M16.2434 16.2434L19.0718 19.0718M2 12L6 12M18 12L22 12M4.9282 19.0718L7.75664 16.2434M16.2434 7.75664L19.0718 4.9282" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                    <span class="text-[#c0846c] italic">Thinking...</span>
                </div>`;
        }
        else if (state === 'tool_use') {
            const toolName = msg.data.tool || 'unknown_tool';
            const toolArgs = msg.data.args ? JSON.stringify(msg.data.args) : '';
            contentDiv.innerHTML += `
                <div class="tool-use-block">
                    <div><span class="text-[#7fa1f5]">Invoking Tool:</span> ${toolName}</div>
                    ${toolArgs ? `<div class="mt-1 text-xs opacity-70">${toolArgs}</div>` : ''}
                </div>`;
        }
        else if (state === 'observation') {
            const obsResult = content || '...';
            contentDiv.innerHTML += `
                <div class="observation-block">
                    <span class="text-gray-400">Result:</span> ${obsResult}
                </div>`;
        }
        else if (state === 'final_stream' || state === 'final') {
            // Re-parse all accumulated content text to markdown and add cursor
            const parsedHTML = marked.parse(content || '');
            contentDiv.innerHTML = parsedHTML + (state === 'final_stream' ? '<span class="typing-cursor"></span>' : '');

            // Highlight code blocks
            contentDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));

            if (state === 'final') {
                isBotTyping = false;
                currentMessageId = null;
                messageInput.disabled = false;
                messageInput.focus();

                // Native Vibration if available
                if (window.AndroidJS && window.AndroidJS.vibrate) {
                    window.AndroidJS.vibrate(50);
                }

                // Refresh chats list to update sidebar history
                fetchChats();
            }
        }
        scrollToBottom();
    }
    // Backward compatibility for basic streaming format
    else if (msg.type === 'thinking_stream') {
        let botMsgDiv = document.getElementById(currentMessageId);
        if (!botMsgDiv) botMsgDiv = createMessageBlock('bot', currentMessageId);
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
        if (!botMsgDiv) botMsgDiv = createMessageBlock('bot', currentMessageId);
        const contentDiv = botMsgDiv.querySelector('.message-content');
        const cursor = contentDiv.querySelector('.typing-cursor');
        if (cursor) cursor.remove();

        const parsedHTML = marked.parse(msg.content || '');
        contentDiv.innerHTML = parsedHTML + '<span class="typing-cursor"></span>';
        contentDiv.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
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
        messageInput.disabled = false;
        messageInput.focus();

        if (window.AndroidJS && window.AndroidJS.vibrate) window.AndroidJS.vibrate(50);
        fetchChats();
    }
    else if (msg.type === 'bot_action') {
        let botMsgDiv = document.getElementById(currentMessageId);
        if (!botMsgDiv) botMsgDiv = createMessageBlock('bot', currentMessageId);
        const contentDiv = botMsgDiv.querySelector('.message-content');
        const cursor = contentDiv.querySelector('.typing-cursor');
        if (cursor) cursor.remove();

        const actionHtml = parseBotAction(msg.action, msg.filename ? {filename: msg.filename} : msg.data);
        if (actionHtml) {
            contentDiv.innerHTML += actionHtml;
            scrollToBottom();
        }

        if (window.AndroidJS && window.AndroidJS.vibrate) window.AndroidJS.vibrate(100);
    }
}

function parseBotAction(action, data) {
    if (!data || !data.filename) return '';
    const fileUrl = `${API_BASE}/download/${data.filename}`;

    // Add to shared files list
    let fileType = 'document';
    if (action === 'send_photo' || action === 'send_image') fileType = 'image';
    else if (action === 'send_video') fileType = 'video';
    else if (action === 'send_audio') fileType = 'audio';

    sharedFiles.push({
        type: fileType,
        url: fileUrl,
        name: data.filename,
        timestamp: new Date().toLocaleTimeString()
    });
    if (typeof updateFileManagerUI === 'function') {
        updateFileManagerUI();
    }

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

    // Append uploaded files context if any
    let messageContent = text;
    if (uploadedFileRefs.length > 0) {
        messageContent += "\n\n" + uploadedFileRefs.join("\n");
        uploadedFileRefs = [];
    }

    // Generate new message ID for bot response
    currentMessageId = 'msg-' + Date.now();
    isBotTyping = true;

    // Send to WS
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'chat',
            chat_id: currentChatId,
            message: messageContent
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

// --- File Manager Logic ---
fileManagerTabBtn.addEventListener('click', () => {
    // Toggle active state styling on buttons
    fileManagerTabBtn.classList.add('bg-[#2a2a2c]', 'text-white', 'border-[#3f3f3f]');
    fileManagerTabBtn.classList.remove('text-[#a3a3a3]', 'border-transparent');

    // Hide chat, show file manager
    chatContainer.classList.add('hidden');
    fileManagerContainer.classList.remove('hidden');
    updateFileManagerUI();
});

// To return to chat, clicking model select area toggles back
document.getElementById('modelSelectBtn').addEventListener('click', () => {
    // Reset file tab styling
    fileManagerTabBtn.classList.remove('bg-[#2a2a2c]', 'text-white', 'border-[#3f3f3f]');
    fileManagerTabBtn.classList.add('text-[#a3a3a3]', 'border-transparent');

    // Hide file manager, show chat
    fileManagerContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
});

function updateFileManagerUI() {
    fileCount.textContent = `${sharedFiles.length} file${sharedFiles.length !== 1 ? 's' : ''}`;

    if (sharedFiles.length === 0) {
        fileGrid.innerHTML = '';
        emptyFilesMsg.classList.remove('hidden');
        fileGrid.appendChild(emptyFilesMsg);
        return;
    }

    emptyFilesMsg.classList.add('hidden');
    fileGrid.innerHTML = '';

    sharedFiles.forEach(file => {
        const card = document.createElement('div');
        card.className = 'bg-[#2a2a2c] rounded-xl overflow-hidden border border-[#3f3f3f] flex flex-col cursor-pointer hover:border-[#555] transition-colors relative group';
        card.onclick = () => window.open(file.url, '_blank');

        let previewHtml = '';
        if (file.type === 'image') {
            previewHtml = `<div class="h-32 bg-[#1c1c1c] w-full flex items-center justify-center overflow-hidden">
                <img src="${file.url}" class="object-cover w-full h-full" alt="${file.name}">
            </div>`;
        } else if (file.type === 'video') {
             previewHtml = `<div class="h-32 bg-[#1c1c1c] w-full flex items-center justify-center relative">
                <video src="${file.url}" class="object-cover w-full h-full opacity-70"></video>
                <div class="absolute inset-0 flex items-center justify-center"><svg class="w-10 h-10 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
            </div>`;
        } else if (file.type === 'audio') {
             previewHtml = `<div class="h-32 bg-[#1c1c1c] w-full flex items-center justify-center">
                 <svg class="w-12 h-12 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
            </div>`;
        } else {
            previewHtml = `<div class="h-32 bg-[#1c1c1c] w-full flex items-center justify-center">
                 <svg class="w-12 h-12 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            </div>`;
        }

        card.innerHTML = `
            ${previewHtml}
            <div class="p-3">
                <p class="text-[13px] text-[#f1f1f1] font-medium truncate">${file.name}</p>
                <p class="text-[11px] text-[#8e8e8e] mt-1">${file.timestamp}</p>
            </div>
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                 <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </div>
        `;
        fileGrid.appendChild(card);
    });
}
