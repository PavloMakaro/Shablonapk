package com.jarvis.claw.api;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class TavilyClient {
    private String apiKey;

    public TavilyClient(String apiKey) {
        this.apiKey = apiKey;
    }

    public String searchWeb(String query) throws Exception {
        String jsonPayload = "{\"api_key\":\"" + apiKey + "\",\"query\":\"" + query + "\"}";

        URL url = new URL("https://api.tavily.com/search");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        try (java.io.OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonPayload.getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        int responseCode = conn.getResponseCode();
        BufferedReader br;
        if (responseCode >= 200 && responseCode < 300) {
            br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "utf-8"));
        } else {
            br = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "utf-8"));
        }

        StringBuilder response = new StringBuilder();
        String responseLine;
        while ((responseLine = br.readLine()) != null) {
            response.append(responseLine.trim());
        }

        if (responseCode >= 200 && responseCode < 300) {
            return response.toString();
        } else {
            throw new Exception("HTTP " + responseCode + ": " + response.toString());
        }
    }
}
