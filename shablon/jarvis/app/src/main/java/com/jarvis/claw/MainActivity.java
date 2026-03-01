package com.jarvis.claw;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Vibrator;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ListView;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.ArrayList;

public class MainActivity extends Activity {

    private ListView lvChat;
    private EditText etMessage;
    private ImageButton btnSend, btnAttach, btnMic;

    private ArrayList<ChatMessage> messages;
    private ChatAdapter adapter;
    private SharedPreferences prefs;
    private WebSocketManager wsManager;
    private Vibrator vibrator;

    private ChatMessage currentBotMessage;
    private String currentChatId = "default_chat_id"; // Mock ID or dynamic ID

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);

        prefs = getSharedPreferences("JarvisPrefs", MODE_PRIVATE);
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        lvChat = findViewById(R.id.lvChat);
        etMessage = findViewById(R.id.etMessage);
        btnSend = findViewById(R.id.btnSend);
        btnAttach = findViewById(R.id.btnAttach);
        btnMic = findViewById(R.id.btnMic);

        messages = new ArrayList<>();
        adapter = new ChatAdapter(this, messages);
        lvChat.setAdapter(adapter);

        etMessage.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (s.length() > 0) {
                    btnSend.setVisibility(View.VISIBLE);
                    btnMic.setVisibility(View.GONE);
                } else {
                    btnSend.setVisibility(View.GONE);
                    btnMic.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        btnSend.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String text = etMessage.getText().toString().trim();
                if (!text.isEmpty()) {
                    sendMessage(text);
                }
            }
        });

        btnAttach.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // Add actual file picker logic here as needed for native integration
                Toast.makeText(MainActivity.this, "File attachment not yet implemented", Toast.LENGTH_SHORT).show();
            }
        });

        initWebSocket();
        loadHistory();
    }

    private void loadHistory() {
        String token = prefs.getString("token", "");
        okhttp3.Request request = new okhttp3.Request.Builder()
                .url(ApiClient.BASE_URL + "/api/chats/" + currentChatId)
                .addHeader("Authorization", "Bearer " + token)
                .get()
                .build();

        ApiClient.getClient().newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call call, java.io.IOException e) {
                // handle failure
            }

            @Override
            public void onResponse(okhttp3.Call call, okhttp3.Response response) throws java.io.IOException {
                if (response.isSuccessful()) {
                    try {
                        String body = response.body().string();
                        JSONObject json = new JSONObject(body);
                        org.json.JSONArray msgs = json.getJSONArray("messages");

                        final ArrayList<ChatMessage> history = new ArrayList<>();
                        for (int i = 0; i < msgs.length(); i++) {
                            JSONObject m = msgs.getJSONObject(i);
                            int type = m.getString("role").equals("user") ? ChatMessage.TYPE_USER : ChatMessage.TYPE_BOT;
                            history.add(new ChatMessage(type, m.getString("content")));
                        }

                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                messages.clear();
                                messages.addAll(history);
                                adapter.notifyDataSetChanged();
                                scrollToBottom();
                            }
                        });
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        });
    }

    private void sendMessage(String text) {
        etMessage.setText("");
        ChatMessage userMsg = new ChatMessage(ChatMessage.TYPE_USER, text);
        messages.add(userMsg);

        currentBotMessage = new ChatMessage(ChatMessage.TYPE_BOT, "");
        currentBotMessage.isThinking = true;
        currentBotMessage.thinkingText = "Thinking...";
        messages.add(currentBotMessage);

        adapter.notifyDataSetChanged();
        scrollToBottom();

        wsManager.sendMessage(currentChatId, text);
    }

    private void initWebSocket() {
        String token = prefs.getString("token", "");
        wsManager = new WebSocketManager(token, new WebSocketManager.WSListener() {
            @Override
            public void onMessage(JSONObject data) {
                handleWebSocketMessage(data);
            }

            @Override
            public void onClosed() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, "Connection closed", Toast.LENGTH_SHORT).show();
                    }
                });
            }

            @Override
            public void onFailure(Throwable t) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, "Connection error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                });
            }
        });
        wsManager.connect();
    }

    private void handleWebSocketMessage(JSONObject json) {
        if (currentBotMessage == null) return;

        try {
            String type = json.optString("type", "");

            if (type.equals("agent_state")) {
                JSONObject data = json.getJSONObject("data");
                String status = data.optString("status", "");

                if (status.equals("thinking") || status.equals("thinking_stream")) {
                    currentBotMessage.isThinking = true;
                    currentBotMessage.thinkingText = data.optString("content", "Thinking...");
                } else if (status.equals("tool_use")) {
                    currentBotMessage.isThinking = true;
                    currentBotMessage.thinkingText = "Using tool: " + data.optString("tool", "...");
                } else if (status.equals("final_stream")) {
                    currentBotMessage.isThinking = false;
                    String content = data.optString("content", "");
                    currentBotMessage.message += content;
                    vibrateHaptic();
                } else if (status.equals("final")) {
                    currentBotMessage.isThinking = false;
                    currentBotMessage.message = data.optString("content", currentBotMessage.message);
                    currentBotMessage = null; // Done with this message
                }
            } else if (type.equals("bot_action")) {
                // handle file action
            }

            adapter.notifyDataSetChanged();
            scrollToBottom();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void vibrateHaptic() {
        if (vibrator != null && vibrator.hasVibrator()) {
            vibrator.vibrate(10);
        }
    }

    private void scrollToBottom() {
        lvChat.post(new Runnable() {
            @Override
            public void run() {
                lvChat.setSelection(adapter.getCount() - 1);
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (wsManager != null) {
            wsManager.disconnect();
        }
    }
}
