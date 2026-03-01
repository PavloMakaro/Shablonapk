package com.jarvis.claw;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AuthActivity extends Activity {

    private EditText etUsername, etPassword;
    private Button btnLogin;
    private TextView tvToggleMode, tvTitle;
    private boolean isLoginMode = true;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("JarvisPrefs", MODE_PRIVATE);

        // Check if already logged in
        if (prefs.contains("token")) {
            if (prefs.getBoolean("has_access", false)) {
                startActivity(new Intent(this, MainActivity.class));
            } else {
                startActivity(new Intent(this, AccessCodeActivity.class));
            }
            finish();
            return;
        }

        setContentView(R.layout.activity_auth);

        etUsername = findViewById(R.id.etUsername);
        etPassword = findViewById(R.id.etPassword);
        btnLogin = findViewById(R.id.btnLogin);
        tvToggleMode = findViewById(R.id.tvToggleMode);
        tvTitle = findViewById(R.id.tvTitle);

        tvToggleMode.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isLoginMode = !isLoginMode;
                if (isLoginMode) {
                    tvTitle.setText("Welcome to Jarvis");
                    btnLogin.setText("Login");
                    tvToggleMode.setText("Don't have an account? Register");
                } else {
                    tvTitle.setText("Register for Jarvis");
                    btnLogin.setText("Register");
                    tvToggleMode.setText("Already have an account? Login");
                }
            }
        });

        btnLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String username = etUsername.getText().toString();
                String password = etPassword.getText().toString();

                if (username.isEmpty() || password.isEmpty()) {
                    Toast.makeText(AuthActivity.this, "Fill all fields", Toast.LENGTH_SHORT).show();
                    return;
                }

                authenticate(username, password);
            }
        });
    }

    private void authenticate(String username, String password) {
        String endpoint = isLoginMode ? "/auth/login" : "/auth/register";

        try {
            JSONObject jsonObject = new JSONObject();
            jsonObject.put("username", username);
            jsonObject.put("password", password);

            RequestBody body = RequestBody.create(ApiClient.JSON, jsonObject.toString());
            Request request = new Request.Builder()
                    .url(ApiClient.BASE_URL + endpoint)
                    .post(body)
                    .build();

            ApiClient.getClient().newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, final IOException e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(AuthActivity.this, "Network Error", Toast.LENGTH_SHORT).show();
                        }
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    final String respStr = response.body().string();
                    try {
                        final JSONObject json = new JSONObject(respStr);
                        if (response.isSuccessful()) {
                            String token = json.getString("token");
                            boolean hasAccess = false;
                            if (json.has("has_access")) {
                                hasAccess = json.getBoolean("has_access");
                            }

                            prefs.edit()
                                .putString("token", token)
                                .putBoolean("has_access", hasAccess)
                                .apply();

                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Intent intent = new Intent(AuthActivity.this, prefs.getBoolean("has_access", false) ? MainActivity.class : AccessCodeActivity.class);
                                    startActivity(intent);
                                    finish();
                                }
                            });
                        } else {
                            final String error = json.optString("error", "Error occurred");
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(AuthActivity.this, error, Toast.LENGTH_SHORT).show();
                                }
                            });
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}