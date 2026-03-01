package com.jarvis.claw;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.support.v7.widget.LinearLayoutManager;
import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.OpenableColumns;
import java.io.InputStream;
import java.io.FileOutputStream;
import android.support.v7.widget.RecyclerView;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ImageView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class MainActivity extends Activity {

    private RecyclerView rvChat;
    private ChatAdapter chatAdapter;
    private List<ChatMessage> messageList;

    private EditText etMessage;
    private ImageButton btnSend;
    private ImageButton btnAttach;
    private LinearLayout llStreamingIndicator;
    private TextView tvStreamingStatus;
    private ImageView ivMenuFiles;

    private OkHttpClient client;
    private WebSocket webSocket;
    private Vibrator vibrator;

    private String token;
    private String username;
    private String currentChatId = "user_default";

    private static final String BASE_URL = "http://c11.play2go.cloud:20067";
    private static final String WS_URL = "ws://c11.play2go.cloud:20067/ws";

    private static final int FILE_SELECT_CODE = 0;
    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        SharedPreferences prefs = getSharedPreferences("JarvisPrefs", MODE_PRIVATE);
        token = prefs.getString("token", null);
        username = prefs.getString("username", "user_" + UUID.randomUUID().toString().substring(0,8));
        currentChatId = username; // Use username as default chat_id for session consistency

        if (token == null) {
            startActivity(new Intent(this, AuthActivity.class));
            finish();
            return;
        }

        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        client = new OkHttpClient();

        messageList = new ArrayList<>();
        chatAdapter = new ChatAdapter(messageList, this);

        rvChat = (RecyclerView) findViewById(R.id.rv_chat);
        LinearLayoutManager layoutManager = new LinearLayoutManager(this);
        layoutManager.setStackFromEnd(true);
        rvChat.setLayoutManager(layoutManager);
        rvChat.setAdapter(chatAdapter);

        etMessage = (EditText) findViewById(R.id.et_message);
        btnSend = (ImageButton) findViewById(R.id.btn_send);
        btnAttach = (ImageButton) findViewById(R.id.btn_attach);
        llStreamingIndicator = (LinearLayout) findViewById(R.id.ll_streaming_indicator);
        tvStreamingStatus = (TextView) findViewById(R.id.tv_streaming_status);
        ivMenuFiles = (ImageView) findViewById(R.id.iv_menu_files);

        ivMenuFiles.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(MainActivity.this, FileManagerActivity.class));
            }
        });

        btnSend.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                sendMessage();
            }
        });

        btnAttach.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openFileChooser();
            }
        });

        loadChatHistory();
        connectWebSocket();
        checkPermissions();
    }

    private void checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE},
                        PERMISSION_REQUEST_CODE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Permissions granted", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Permissions denied, file upload may not work", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void loadChatHistory() {
        Request request = new Request.Builder()
                .url(BASE_URL + "/api/chats/" + currentChatId)
                .addHeader("Authorization", "Bearer " + token)
                .get()
                .build();

        client.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                // Ignore failure on history load initially
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful()) {
                    try {
                        String respStr = response.body().string();
                        JSONObject json = new JSONObject(respStr);
                        if (json.has("messages")) {
                            JSONArray msgs = json.getJSONArray("messages");
                            for (int i = 0; i < msgs.length(); i++) {
                                JSONObject msgObj = msgs.getJSONObject(i);
                                String role = msgObj.optString("role");
                                String content = msgObj.optString("content");
                                ChatMessage msg = new ChatMessage(role.equals("user"), content);
                                messageList.add(msg);
                            }
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    chatAdapter.notifyDataSetChanged();
                                    rvChat.scrollToPosition(messageList.size() - 1);
                                }
                            });
                        }
                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                }
            }
        });
    }

    private void connectWebSocket() {
        Request request = new Request.Builder()
                .url(WS_URL + "?token=" + token)
                .build();

        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                super.onOpen(webSocket, response);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, R.string.chat_connected, Toast.LENGTH_SHORT).show();
                    }
                });
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                super.onMessage(webSocket, text);
                try {
                    final JSONObject msg = new JSONObject(text);
                    String type = msg.optString("type");

                    if ("agent_state".equals(type)) {
                        JSONObject data = msg.getJSONObject("data");
                        final String status = data.optString("status");
                        final String content = data.optString("content");

                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                handleStreamStatus(status, content, data);
                            }
                        });
                    } else if ("bot_action".equals(type)) {
                        final String action = msg.optString("action");
                        final String filename = msg.optString("filename");

                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                handleBotAction(action, filename);
                            }
                        });
                    }
                } catch (JSONException e) {
                    e.printStackTrace();
                }
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                super.onFailure(webSocket, t, response);
            }
        });
    }

    private void handleStreamStatus(String status, String content, JSONObject data) {
        if ("thinking".equals(status)) {
            llStreamingIndicator.setVisibility(View.VISIBLE);
            tvStreamingStatus.setText("Agent is thinking...");
            chatAdapter.updateStreamingMessage(""); // create new empty msg
        } else if ("thinking_stream".equals(status)) {
            // Option to append thinking text to the bubble, or just keep indicator
            tvStreamingStatus.setText("Thinking...");
            // We can append this to the message bubble with a special thought format if desired.
        } else if ("tool_use".equals(status)) {
            String tool = data.optString("tool");
            tvStreamingStatus.setText("Using tool: " + tool);
            vibrateSmall();
        } else if ("observation".equals(status)) {
            tvStreamingStatus.setText("Observing results...");
        } else if ("final_stream".equals(status)) {
            llStreamingIndicator.setVisibility(View.GONE);
            chatAdapter.appendStreamingMessage(content);
            rvChat.scrollToPosition(messageList.size() - 1);
        } else if ("final".equals(status)) {
            llStreamingIndicator.setVisibility(View.GONE);
            chatAdapter.finalizeStreamingMessage();
            vibrateSmall();
        }
    }

    private void handleBotAction(String action, String filename) {
        String url = BASE_URL + "/download/" + filename;
        String content = "Shared " + action + ":\n" + url;
        ChatMessage actionMsg = new ChatMessage(false, content);

        // Mark the action message properties
        actionMsg.isAction = true;
        actionMsg.actionType = action;
        actionMsg.actionFileUrl = url;

        messageList.add(actionMsg);
        chatAdapter.notifyItemInserted(messageList.size() - 1);
        rvChat.scrollToPosition(messageList.size() - 1);
        vibrateSmall();

        // Track file globally for FileManager
        FileManagerActivity.fileList.add(new FileManagerActivity.SharedFile(filename, url, action));
    }

    private void sendMessage() {
        String text = etMessage.getText().toString().trim();
        if (text.isEmpty()) return;

        etMessage.setText("");
        messageList.add(new ChatMessage(true, text));
        chatAdapter.notifyItemInserted(messageList.size() - 1);
        rvChat.scrollToPosition(messageList.size() - 1);

        try {
            JSONObject json = new JSONObject();
            json.put("action", "chat");
            json.put("chat_id", currentChatId);
            json.put("message", text);

            if (webSocket != null) {
                webSocket.send(json.toString());
            } else {
                Toast.makeText(this, "WebSocket disconnected", Toast.LENGTH_SHORT).show();
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    private void vibrateSmall() {
        if (vibrator != null && vibrator.hasVibrator()) {
            vibrator.vibrate(50);
        }
    }

    private void openFileChooser() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        try {
            startActivityForResult(Intent.createChooser(intent, "Select a File"), FILE_SELECT_CODE);
        } catch (android.content.ActivityNotFoundException ex) {
            Toast.makeText(this, "Please install a File Manager.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_SELECT_CODE && resultCode == RESULT_OK) {
            Uri uri = data.getData();
            if (uri != null) {
                uploadFile(uri);
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void uploadFile(final Uri uri) {
        Toast.makeText(this, "Uploading file...", Toast.LENGTH_SHORT).show();

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String tempFilename = "upload_" + System.currentTimeMillis();
                    Cursor returnCursor = getContentResolver().query(uri, null, null, null, null);
                    if (returnCursor != null) {
                        int nameIndex = returnCursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (returnCursor.moveToFirst()) {
                            tempFilename = returnCursor.getString(nameIndex);
                        }
                        returnCursor.close();
                    }
                    final String filename = tempFilename;

                    InputStream inputStream = getContentResolver().openInputStream(uri);
                    if (inputStream == null) return;

                    File tempFile = new File(getCacheDir(), filename);
                    FileOutputStream out = new FileOutputStream(tempFile);
                    byte[] buffer = new byte[1024];
                    int read;
                    while ((read = inputStream.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    out.close();
                    inputStream.close();

                    RequestBody requestBody = new MultipartBody.Builder()
                            .setType(MultipartBody.FORM)
                            .addFormDataPart("file", filename,
                                    RequestBody.create(MediaType.parse("application/octet-stream"), tempFile))
                            .build();

                    Request request = new Request.Builder()
                            .url(BASE_URL + "/upload")
                            .addHeader("Authorization", "Bearer " + token)
                            .post(requestBody)
                            .build();

                    client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "Upload failed.", Toast.LENGTH_SHORT).show();
                        }
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.isSuccessful()) {
                        String respStr = response.body().string();
                        try {
                            JSONObject json = new JSONObject(respStr);
                            final String uploadedFilename = json.optString("filename");
                            final String uploadedFilepath = json.optString("filepath");

                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(MainActivity.this, "Uploaded: " + uploadedFilename, Toast.LENGTH_SHORT).show();

                                    // Automatically send a message referencing the file
                                    String tag = "[File: " + uploadedFilepath + "]";
                                    String currentMsg = etMessage.getText().toString();
                                    etMessage.setText(currentMsg + " " + tag);
                                    etMessage.setSelection(etMessage.getText().length());
                                }
                            });
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    } else {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(MainActivity.this, "Upload error.", Toast.LENGTH_SHORT).show();
                            }
                        });
                    }
                }
            });

                } catch (Exception e) {
                    e.printStackTrace();
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "Error processing file.", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        }).start();
    }
}
