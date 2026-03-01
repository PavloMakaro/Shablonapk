package com.jarvis.claw;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AuthActivity extends Activity {

    private EditText etUsername;
    private EditText etPassword;
    private Button btnLogin;
    private Button btnRegister;
    private OkHttpClient client;

    private static final String BASE_URL = "http://c11.play2go.cloud:20067";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_auth);

        client = new OkHttpClient();

        SharedPreferences prefs = getSharedPreferences("JarvisPrefs", MODE_PRIVATE);
        if (prefs.contains("token")) {
            startActivity(new Intent(this, MainActivity.class));
            finish();
            return;
        }

        etUsername = (EditText) findViewById(R.id.et_username);
        etPassword = (EditText) findViewById(R.id.et_password);
        btnLogin = (Button) findViewById(R.id.btn_login);
        btnRegister = (Button) findViewById(R.id.btn_register);

        btnLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                performAuth("/auth/login");
            }
        });

        btnRegister.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                performAuth("/auth/register");
            }
        });
    }

    private void performAuth(final String endpoint) {
        String username = etUsername.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        if (username.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, R.string.error_empty_fields, Toast.show_short).show();
            return;
        }

        btnLogin.setEnabled(false);
        btnRegister.setEnabled(false);

        try {
            JSONObject json = new JSONObject();
            json.put("username", username);
            json.put("password", password);

            RequestBody body = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), json.toString());
            Request request = new Request.Builder()
                    .url(BASE_URL + endpoint)
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(AuthActivity.this, R.string.error_network, Toast.show_short).show();
                            btnLogin.setEnabled(true);
                            btnRegister.setEnabled(true);
                        }
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    final String respStr = response.body().string();
                    if (response.isSuccessful()) {
                        try {
                            JSONObject respJson = new JSONObject(respStr);
                            if (respJson.has("token")) {
                                String token = respJson.getString("token");
                                SharedPreferences.Editor editor = getSharedPreferences("JarvisPrefs", MODE_PRIVATE).edit();
                                editor.putString("token", token);
                                editor.putString("username", username);
                                editor.apply();

                                // Check if user needs to link code
                                checkLinkStatusAndProceed(token);
                            } else {
                                runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        Toast.makeText(AuthActivity.this, "Success, please login.", Toast.LENGTH_SHORT).show();
                                        btnLogin.setEnabled(true);
                                        btnRegister.setEnabled(true);
                                    }
                                });
                            }
                        } catch (Exception e) {
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(AuthActivity.this, "Parse error.", Toast.LENGTH_SHORT).show();
                                    btnLogin.setEnabled(true);
                                    btnRegister.setEnabled(true);
                                }
                            });
                        }
                    } else {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(AuthActivity.this, "Error: " + response.code(), Toast.LENGTH_SHORT).show();
                                btnLogin.setEnabled(true);
                                btnRegister.setEnabled(true);
                            }
                        });
                    }
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void checkLinkStatusAndProceed(String token) {
        // Since the API requires link_code but we don't have an endpoint to check if linked,
        // we'll attempt to connect to ws or check a specific endpoint.
        // For now, we'll route to InviteActivity to ensure they link.
        // A better approach would be to get the user profile, but the docs don't specify one.
        // I will route to InviteActivity. If they are already linked, we'll handle it there or let them skip.

        // Actually, let's just go to InviteActivity and let them enter it.
        // It's safer.
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                startActivity(new Intent(AuthActivity.this, InviteActivity.class));
                finish();
            }
        });
    }
}
