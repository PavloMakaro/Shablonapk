function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });
    document.querySelectorAll('.nav button').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById('tab-' + tabName).style.display = 'flex';
    document.getElementById('btn-' + tabName).classList.add('active');

    if (tabName === 'marketplace') {
        loadMarketplace();
    } else if (tabName === 'settings') {
        loadSettings();
    }
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    appendMessage(message, 'user');
    input.value = '';

    document.getElementById('thinking-indicator').classList.remove('hidden');
    scrollToBottom();

    if (typeof AndroidApp !== 'undefined') {
        AndroidApp.sendMessage(message);
    } else {
        setTimeout(() => onMessageReceived("Mock response from Web."), 1000);
    }
}

function appendMessage(text, type) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'message ' + type;
    div.innerText = text;
    container.appendChild(div);
    scrollToBottom();
}

function onMessageReceived(message) {
    document.getElementById('thinking-indicator').classList.add('hidden');
    appendMessage(message, 'bot');
}

function onToolCall(toolName, args) {
    document.getElementById('thinking-indicator').innerText = `Executing ${toolName}...`;
    appendMessage(`[Tool Call: ${toolName}] ${args}`, 'tool');
}

function onToolResult(result) {
    document.getElementById('thinking-indicator').innerText = 'Jarvis is thinking...';
    appendMessage(`[Tool Result]: ${result}`, 'tool');
}

function onError(error) {
    document.getElementById('thinking-indicator').classList.add('hidden');
    appendMessage(`[Error]: ${error}`, 'tool');
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

function saveSetting(key, inputId) {
    const val = document.getElementById(inputId).value;
    if (typeof AndroidApp !== 'undefined') {
        AndroidApp.saveSetting(key, val);
        alert('Saved!');
    }
}

function loadSettings() {
    if (typeof AndroidApp !== 'undefined') {
        document.getElementById('setting-deepseek').value = AndroidApp.getSetting('deepseek_api_key');
        document.getElementById('setting-groq').value = AndroidApp.getSetting('groq_api_key');
        document.getElementById('setting-tavily').value = AndroidApp.getSetting('tavily_api_key');
    }
}

function loadMarketplace() {
    if (typeof AndroidApp !== 'undefined') {
        try {
            const modulesJson = AndroidApp.getMarketplaceModules();
            const modules = JSON.parse(modulesJson);
            const container = document.getElementById('modules-list');
            container.innerHTML = '';

            modules.forEach(mod => {
                const card = document.createElement('div');
                card.className = 'module-card';
                card.innerHTML = `
                    <h3>${mod.name}</h3>
                    <p>${mod.description}</p>
                    <label>
                        <input type="checkbox" onchange="toggleModule('${mod.id}', this.checked)" ${mod.enabled ? 'checked' : ''}> Enable
                    </label>
                `;
                container.appendChild(card);
            });
        } catch (e) {
            console.error("Failed to load marketplace", e);
        }
    }
}

function toggleModule(moduleId, enabled) {
    if (typeof AndroidApp !== 'undefined') {
        AndroidApp.setModuleEnabled(moduleId, enabled);
    }
}

// Initial Setup
switchTab('chat');
document.getElementById('tab-chat').classList.add('active');
