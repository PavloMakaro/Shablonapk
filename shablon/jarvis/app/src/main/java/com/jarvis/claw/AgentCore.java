package com.jarvis.claw;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.jarvis.claw.api.DeepSeekClient;
import org.json.JSONArray;
import org.json.JSONObject;

public class AgentCore {
    private Context context;
    private SettingsManager settings;
    private ToolRegistry toolRegistry;
    private Handler mainHandler;
    private JSONArray conversationHistory;

    public interface AgentCallback {
        void onMessageReceived(String message);
        void onToolCall(String toolName, String args);
        void onToolResult(String result);
        void onError(String error);
    }

    public AgentCore(Context context, ToolRegistry toolRegistry, SettingsManager settings) {
        this.context = context;
        this.toolRegistry = toolRegistry;
        this.settings = settings;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.conversationHistory = new JSONArray();

        try {
            JSONObject systemMsg = new JSONObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", "You are an AI assistant in an Android app with tool-calling capabilities. Provide helpful and concise responses.");
            conversationHistory.put(systemMsg);
        } catch (Exception e) {}
    }

    public void processInput(final String input, final AgentCallback callback) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String apiKey = settings.getString("deepseek_api_key", "");
                    if (apiKey.isEmpty()) {
                        postError("DeepSeek API key is missing.", callback);
                        return;
                    }

                    DeepSeekClient client = new DeepSeekClient(apiKey);

                    JSONObject userMsg = new JSONObject();
                    userMsg.put("role", "user");
                    userMsg.put("content", input);
                    conversationHistory.put(userMsg);

                    boolean keepCalling = true;

                    while (keepCalling) {
                        JSONObject payload = new JSONObject();
                        payload.put("model", "deepseek-chat");
                        payload.put("messages", conversationHistory);

                        JSONArray tools = toolRegistry.getRegisteredTools();
                        if (tools.length() > 0) {
                            payload.put("tools", tools);
                        }

                        String response = client.sendChatCompletion(payload.toString());
                        JSONObject jsonResponse = new JSONObject(response);

                        JSONArray choices = jsonResponse.getJSONArray("choices");
                        if (choices.length() > 0) {
                            JSONObject message = choices.getJSONObject(0).getJSONObject("message");
                            conversationHistory.put(message);

                            if (message.has("tool_calls")) {
                                JSONArray toolCalls = message.getJSONArray("tool_calls");

                                for (int i = 0; i < toolCalls.length(); i++) {
                                    JSONObject toolCall = toolCalls.getJSONObject(i);
                                    String id = toolCall.getString("id");
                                    JSONObject function = toolCall.getJSONObject("function");
                                    final String name = function.getString("name");
                                    final String arguments = function.getString("arguments");

                                    postToolCall(name, arguments, callback);

                                    String result = toolRegistry.executeTool(name, arguments);
                                    postToolResult(result, callback);

                                    JSONObject toolMsg = new JSONObject();
                                    toolMsg.put("role", "tool");
                                    toolMsg.put("tool_call_id", id);
                                    toolMsg.put("name", name);
                                    toolMsg.put("content", result);
                                    conversationHistory.put(toolMsg);
                                }
                            } else {
                                final String content = message.getString("content");
                                keepCalling = false;
                                postMessage(content, callback);
                            }
                        } else {
                            keepCalling = false;
                        }
                    }
                } catch (Exception e) {
                    postError(e.getMessage(), callback);
                }
            }
        }).start();
    }

    private void postMessage(final String message, final AgentCallback callback) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (callback != null) callback.onMessageReceived(message);
            }
        });
    }

    private void postToolCall(final String name, final String args, final AgentCallback callback) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (callback != null) callback.onToolCall(name, args);
            }
        });
    }

    private void postToolResult(final String result, final AgentCallback callback) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (callback != null) callback.onToolResult(result);
            }
        });
    }

    private void postError(final String error, final AgentCallback callback) {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (callback != null) callback.onError(error);
            }
        });
    }
}
