package com.jarvis.claw;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;

public class ApiClient {
    public static final String BASE_URL = "http://c11.play2go.cloud:20067";
    public static final String WS_URL = "ws://c11.play2go.cloud:20067/ws";

    private static final OkHttpClient client = new OkHttpClient();
    public static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    public static OkHttpClient getClient() {
        return client;
    }

    public static Request.Builder getAuthRequest(String path, String token) {
        Request.Builder builder = new Request.Builder()
                .url(BASE_URL + path);
        if (token != null && !token.isEmpty()) {
            builder.addHeader("Authorization", "Bearer " + token);
        }
        return builder;
    }
}