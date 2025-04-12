import { createTool, ToolExecutionContext } from "@mastra/core/tools"; // Import ToolExecutionContext
import { z } from "zod";

interface WeatherResponse {
  location: string;
  temperature: string;
  unit: "celsius" | "fahrenheit";
  description: string;
}

const weatherInputSchema = z.object({
  location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  unit: z.enum(["celsius", "fahrenheit"]).optional(),
});

const weatherOutputSchema = z.object({
  location: z.string(),
  temperature: z.string(),
  unit: z.enum(["celsius", "fahrenheit"]),
  description: z.string(),
});

export const weatherTool = createTool({
  id: "get_weather", // Changed 'name' to 'id' based on Tool class definition
  description: "Get the current weather in a given location",
  inputSchema: weatherInputSchema, // Use inputSchema property
  outputSchema: weatherOutputSchema, // Use outputSchema property
  execute: async (context): Promise<WeatherResponse> => { // Access input via context.context
    const inputData = context.context; // Use context.context based on IExecutionContext definition
    if (!inputData) {
      throw new Error("Input data is missing from context");
    }
    const { location, unit = "fahrenheit" } = inputData; // Destructure from inputData
    const temperature = unit === "celsius" ? "20" : "68";
    return {
      location,
      temperature,
      unit,
      description: "Sunny",
    };
  },
});
