package com.jarvis.claw;

public class ChatMessage {
    public boolean isUser;
    public String content;
    public boolean isStreaming;

    // For bot actions
    public boolean isAction = false;
    public String actionType = "";
    public String actionFileUrl = "";

    public ChatMessage(boolean isUser, String content) {
        this.isUser = isUser;
        this.content = content;
        this.isStreaming = false;
    }
}
