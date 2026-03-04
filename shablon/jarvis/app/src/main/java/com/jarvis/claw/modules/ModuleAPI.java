package com.jarvis.claw.modules;

public interface ModuleAPI {
    String registerTools(); // Returns a JSON array of tool schemas
    String executeTool(String name, String arguments); // Executes the tool and returns JSON string result
}
