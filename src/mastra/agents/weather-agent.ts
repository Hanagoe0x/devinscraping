import { Agent } from "@mastra/core/agent"; // Correct import path
import { weatherTool } from "../tools/weather-tool";
import { google } from "@ai-sdk/google"; // Assuming Gemini model will be used via @ai-sdk/google

export const weatherAgent = new Agent({
  name: "weather_agent",
  instructions: "An agent that can get the current weather.", // Use 'instructions' instead of 'description'
  model: google("models/gemini-1.5-flash-latest"), // Try a different Gemini model
  tools: { [weatherTool.id]: weatherTool }, // Pass tools as an object { id: tool }
});
