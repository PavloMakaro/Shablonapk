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
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AccessCodeActivity extends Activity {

    private EditText etAccessCode;
    private Button btnSubmitCode;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("JarvisPrefs", MODE_PRIVATE);

        if (prefs.getBoolean("has_access", false)) {
            startActivity(new Intent(this, MainActivity.class));
            finish();
            return;
        }

        setContentView(R.layout.activity_access_code);

        etAccessCode = findViewById(R.id.etAccessCode);
        btnSubmitCode = findViewById(R.id.btnSubmitCode);

        btnSubmitCode.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String code = etAccessCode.getText().toString();
                if (code.isEmpty()) {
                    Toast.makeText(AccessCodeActivity.this, "Enter access code", Toast.LENGTH_SHORT).show();
                    return;
                }
                submitCode(code);
            }
        });
    }

    private void submitCode(String code) {
        try {
            JSONObject jsonObject = new JSONObject();
            jsonObject.put("code", code);

            RequestBody body = RequestBody.create(ApiClient.JSON, jsonObject.toString());

            String token = prefs.getString("token", "");
            Request request = new Request.Builder()
                    .url(ApiClient.BASE_URL + "/auth/link_code")
                    .addHeader("Authorization", "Bearer " + token)
                    .post(body)
                    .build();

            ApiClient.getClient().newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, final IOException e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(AccessCodeActivity.this, "Network Error", Toast.LENGTH_SHORT).show();
                        }
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    final String respStr = response.body().string();
                    try {
                        final JSONObject json = new JSONObject(respStr);
                        if (response.isSuccessful()) {
                            prefs.edit().putBoolean("has_access", true).apply();
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    startActivity(new Intent(AccessCodeActivity.this, MainActivity.class));
                                    finish();
                                }
                            });
                        } else {
                            final String error = json.optString("error", "Invalid access code");
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(AccessCodeActivity.this, error, Toast.LENGTH_SHORT).show();
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