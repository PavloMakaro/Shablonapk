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

public class InviteActivity extends Activity {

    private EditText etInviteCode;
    private Button btnSubmit;
    private Button btnSkip;
    private OkHttpClient client;

    private static final String BASE_URL = "http://c11.play2go.cloud:20067";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_invite);

        client = new OkHttpClient();

        etInviteCode = (EditText) findViewById(R.id.et_invite_code);
        btnSubmit = (Button) findViewById(R.id.btn_submit_invite);
        btnSkip = (Button) findViewById(R.id.btn_skip);

        btnSubmit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                submitInviteCode();
            }
        });

        btnSkip.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(InviteActivity.this, MainActivity.class));
                finish();
            }
        });
    }

    private void submitInviteCode() {
        String code = etInviteCode.getText().toString().trim();

        if (code.isEmpty()) {
            Toast.makeText(this, R.string.error_empty_fields, Toast.show_short).show();
            return;
        }

        btnSubmit.setEnabled(false);

        SharedPreferences prefs = getSharedPreferences("JarvisPrefs", MODE_PRIVATE);
        String token = prefs.getString("token", "");

        try {
            JSONObject json = new JSONObject();
            json.put("code", code);

            RequestBody body = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), json.toString());
            Request request = new Request.Builder()
                    .url(BASE_URL + "/auth/link_code")
                    .addHeader("Authorization", "Bearer " + token)
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(InviteActivity.this, R.string.error_network, Toast.show_short).show();
                            btnSubmit.setEnabled(true);
                        }
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.isSuccessful()) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(InviteActivity.this, "Code linked successfully!", Toast.LENGTH_SHORT).show();
                                startActivity(new Intent(InviteActivity.this, MainActivity.class));
                                finish();
                            }
                        });
                    } else {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(InviteActivity.this, "Error: Invalid code or already linked.", Toast.LENGTH_SHORT).show();
                                btnSubmit.setEnabled(true);
                            }
                        });
                    }
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
