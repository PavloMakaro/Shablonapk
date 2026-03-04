package com.jarvis.claw;

import android.content.Context;
import com.jarvis.claw.modules.ModuleAPI;
import com.jarvis.claw.modules.ModuleManager;
import com.jarvis.claw.api.GroqClient;
import com.jarvis.claw.api.TavilyClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;

public class ToolRegistry {
    private Context context;
    private ModuleManager moduleManager;
    private SettingsManager settings;

    public ToolRegistry(Context context, ModuleManager moduleManager, SettingsManager settings) {
        this.context = context;
        this.moduleManager = moduleManager;
        this.settings = settings;
    }

    public JSONArray getRegisteredTools() {
        JSONArray tools = new JSONArray();
        try {
            // Core tools
            tools.put(createToolSchema("file_read", "Reads a file from external storage.", "path"));
            tools.put(createToolSchema("file_write", "Writes content to a file.", "path", "content"));
            tools.put(createToolSchema("list_files", "Lists files in a directory.", "dirPath"));
            tools.put(createToolSchema("download_file", "Downloads a file from a URL.", "url", "destination"));
            tools.put(createToolSchema("search_web", "Searches the web using Tavily API.", "query"));
            tools.put(createToolSchema("speech_to_text", "Transcribes speech audio file.", "filePath"));
            tools.put(createToolSchema("analyze_image", "Analyzes an image URL or path.", "imageUrl"));

            // Module tools
            for (ModuleAPI module : moduleManager.getEnabledModules()) {
                JSONArray moduleTools = new JSONArray(module.registerTools());
                for (int i = 0; i < moduleTools.length(); i++) {
                    tools.put(moduleTools.getJSONObject(i));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return tools;
    }

    private JSONObject createToolSchema(String name, String desc, String... requiredParams) throws Exception {
        JSONObject tool = new JSONObject();
        tool.put("type", "function");

        JSONObject function = new JSONObject();
        function.put("name", name);
        function.put("description", desc);

        JSONObject parameters = new JSONObject();
        parameters.put("type", "object");
        JSONObject properties = new JSONObject();
        JSONArray required = new JSONArray();

        for (String param : requiredParams) {
            JSONObject prop = new JSONObject();
            prop.put("type", "string");
            properties.put(param, prop);
            required.put(param);
        }

        parameters.put("properties", properties);
        parameters.put("required", required);
        function.put("parameters", parameters);
        tool.put("function", function);

        return tool;
    }

    public String executeTool(String name, String args) {
        try {
            JSONObject jsonArgs = new JSONObject(args);

            // Core Tools
            if ("file_read".equals(name)) {
                return fileRead(jsonArgs.getString("path"));
            } else if ("file_write".equals(name)) {
                return fileWrite(jsonArgs.getString("path"), jsonArgs.getString("content"));
            } else if ("list_files".equals(name)) {
                return listFiles(jsonArgs.getString("dirPath"));
            } else if ("download_file".equals(name)) {
                return downloadFile(jsonArgs.getString("url"), jsonArgs.getString("destination"));
            } else if ("search_web".equals(name)) {
                return new TavilyClient(settings.getString("tavily_api_key", "")).searchWeb(jsonArgs.getString("query"));
            } else if ("speech_to_text".equals(name)) {
                return new GroqClient(settings.getString("groq_api_key", "")).speechToText(jsonArgs.getString("filePath"));
            } else if ("analyze_image".equals(name)) {
                return new GroqClient(settings.getString("groq_api_key", "")).analyzeImage(jsonArgs.getString("imageUrl"));
            }

            // Module Tools
            for (ModuleAPI module : moduleManager.getEnabledModules()) {
                String result = module.executeTool(name, args);
                if (!"{\"error\": \"Unknown tool\"}".equals(result)) {
                    return result;
                }
            }

            return "{\"error\": \"Tool not found or unsupported\"}";
        } catch (Exception e) {
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    private String fileRead(String path) {
        try {
            File file = new File(path);
            if (!file.exists()) return "{\"error\": \"File not found.\"}";
            FileInputStream fis = new FileInputStream(file);
            byte[] data = new byte[(int) file.length()];
            fis.read(data);
            fis.close();
            return "{\"content\": \"" + new String(data, "UTF-8").replace("\"", "\\\"").replace("\n", "\\n") + "\"}";
        } catch (Exception e) {
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    private String fileWrite(String path, String content) {
        try {
            File file = new File(path);
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(content.getBytes("UTF-8"));
            fos.close();
            return "{\"status\": \"success\"}";
        } catch (Exception e) {
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    private String listFiles(String dirPath) {
        try {
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) return "{\"error\": \"Directory not found.\"}";
            String[] files = dir.list();
            JSONArray arr = new JSONArray();
            if (files != null) {
                for (String f : files) arr.put(f);
            }
            return "{\"files\": " + arr.toString() + "}";
        } catch (Exception e) {
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }

    private String downloadFile(String fileUrl, String destPath) {
        try {
            URL url = new URL(fileUrl);
            InputStream in = url.openStream();
            OutputStream out = new FileOutputStream(new File(destPath));
            byte[] buffer = new byte[1024];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            in.close();
            out.close();
            return "{\"status\": \"success\"}";
        } catch (Exception e) {
            return "{\"error\": \"" + e.getMessage() + "\"}";
        }
    }
}
