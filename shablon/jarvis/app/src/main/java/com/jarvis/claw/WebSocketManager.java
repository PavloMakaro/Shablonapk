package com.jarvis.claw;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class WebSocketManager {
    private WebSocket webSocket;
    private WSListener listener;
    private String token;

    public interface WSListener {
        void onMessage(JSONObject data);
        void onClosed();
        void onFailure(Throwable t);
    }

    public WebSocketManager(String token, WSListener listener) {
        this.token = token;
        this.listener = listener;
    }

    public void connect() {
        Request request = new Request.Builder()
                .url(ApiClient.WS_URL)
                .addHeader("Authorization", "Bearer " + token)
                .build();

        webSocket = ApiClient.getClient().newWebSocket(request, new WebSocketListener() {
            @Override
            public void onMessage(WebSocket webSocket, final String text) {
                try {
                    final JSONObject json = new JSONObject(text);
                    new Handler(Looper.getMainLooper()).post(new Runnable() {
                        @Override
                        public void run() {
                            if (listener != null) {
                                listener.onMessage(json);
                            }
                        }
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                new Handler(Looper.getMainLooper()).post(new Runnable() {
                    @Override
                    public void run() {
                        if (listener != null) listener.onClosed();
                    }
                });
            }

            @Override
            public void onFailure(WebSocket webSocket, final Throwable t, Response response) {
                new Handler(Looper.getMainLooper()).post(new Runnable() {
                    @Override
                    public void run() {
                        if (listener != null) listener.onFailure(t);
                    }
                });
            }
        });
    }

    public void sendMessage(String chatId, String message) {
        if (webSocket != null) {
            try {
                JSONObject json = new JSONObject();
                json.put("action", "chat");
                json.put("chat_id", chatId);
                json.put("message", message);
                webSocket.send(json.toString());
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    public void disconnect() {
        if (webSocket != null) {
            webSocket.close(1000, "User disconnected");
        }
    }
}