package com.jarvis.claw.modules;

import android.content.Context;
import com.jarvis.claw.SettingsManager;
import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.json.JSONArray;

public class ModuleManager {
    private Context context;
    private SettingsManager settings;
    private Map<String, ModuleAPI> registeredModules = new HashMap<>();

    public ModuleManager(Context context) {
        this.context = context;
        this.settings = new SettingsManager(context);
        loadMockMarketplace();
    }

    private void loadMockMarketplace() {
        // Register a mock module (ReminderModule)
        registeredModules.put("ReminderModule", new ReminderModule());
    }

    public List<ModuleAPI> getEnabledModules() {
        List<ModuleAPI> enabled = new ArrayList<>();
        for (Map.Entry<String, ModuleAPI> entry : registeredModules.entrySet()) {
            if (settings.getBoolean("module_" + entry.getKey() + "_enabled", false)) {
                enabled.add(entry.getValue());
            }
        }
        return enabled;
    }

    public String getMarketplaceJson() {
        try {
            JSONArray modulesArray = new JSONArray();
            for (String moduleName : registeredModules.keySet()) {
                JSONObject obj = new JSONObject();
                obj.put("id", moduleName);
                obj.put("name", moduleName);
                obj.put("description", "A mock module for demonstration.");
                obj.put("enabled", settings.getBoolean("module_" + moduleName + "_enabled", false));
                modulesArray.put(obj);
            }
            return modulesArray.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    public void setModuleEnabled(String moduleId, boolean enabled) {
        settings.putBoolean("module_" + moduleId + "_enabled", enabled);
    }
}

class ReminderModule implements ModuleAPI {
    @Override
    public String registerTools() {
        return "[\n" +
               "  {\n" +
               "    \"type\": \"function\",\n" +
               "    \"function\": {\n" +
               "      \"name\": \"set_reminder\",\n" +
               "      \"description\": \"Sets a reminder for the user.\",\n" +
               "      \"parameters\": {\n" +
               "        \"type\": \"object\",\n" +
               "        \"properties\": {\n" +
               "          \"message\": {\"type\": \"string\"},\n" +
               "          \"time\": {\"type\": \"string\"}\n" +
               "        },\n" +
               "        \"required\": [\"message\", \"time\"]\n" +
               "      }\n" +
               "    }\n" +
               "  }\n" +
               "]";
    }

    @Override
    public String executeTool(String name, String arguments) {
        if ("set_reminder".equals(name)) {
            return "{\"status\": \"success\", \"info\": \"Reminder set.\"}";
        }
        return "{\"error\": \"Unknown tool\"}";
    }
}
