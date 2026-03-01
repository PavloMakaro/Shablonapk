package com.jarvis.claw;

public class ChatMessage {
    public static final int TYPE_USER = 0;
    public static final int TYPE_BOT = 1;

    public int type;
    public String message;
    public boolean isThinking;
    public String thinkingText;
    public String attachmentUrl;
    public String attachmentType;

    public ChatMessage(int type, String message) {
        this.type = type;
        this.message = message;
        this.isThinking = false;
        this.thinkingText = "";
    }
}