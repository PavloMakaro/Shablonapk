package com.jarvis.claw;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.jarvis.claw.modules.ModuleManager;

public class MainActivity extends Activity {
    private WebView webView;
    private SettingsManager settingsManager;
    private ModuleManager moduleManager;
    private ToolRegistry toolRegistry;
    private AgentCore agentCore;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        settingsManager = new SettingsManager(this);
        moduleManager = new ModuleManager(this);
        toolRegistry = new ToolRegistry(this, moduleManager, settingsManager);
        agentCore = new AgentCore(this, toolRegistry, settingsManager);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidApp");
        webView.loadUrl("file:///android_asset/index.html");
    }

    private class WebAppInterface {
        @JavascriptInterface
        public void sendMessage(String message) {
            agentCore.processInput(message, new AgentCore.AgentCallback() {
                @Override
                public void onMessageReceived(final String message) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript("javascript:onMessageReceived('" + escapeJS(message) + "')", null);
                        }
                    });
                }

                @Override
                public void onToolCall(final String toolName, final String args) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript("javascript:onToolCall('" + escapeJS(toolName) + "', '" + escapeJS(args) + "')", null);
                        }
                    });
                }

                @Override
                public void onToolResult(final String result) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript("javascript:onToolResult('" + escapeJS(result) + "')", null);
                        }
                    });
                }

                @Override
                public void onError(final String error) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            webView.evaluateJavascript("javascript:onError('" + escapeJS(error) + "')", null);
                        }
                    });
                }
            });
        }

        @JavascriptInterface
        public void saveSetting(String key, String value) {
            settingsManager.putString(key, value);
        }

        @JavascriptInterface
        public String getSetting(String key) {
            return settingsManager.getString(key, "");
        }

        @JavascriptInterface
        public String getMarketplaceModules() {
            return moduleManager.getMarketplaceJson();
        }

        @JavascriptInterface
        public void setModuleEnabled(String moduleId, boolean enabled) {
            moduleManager.setModuleEnabled(moduleId, enabled);
        }
    }

    private String escapeJS(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r");
    }
}
