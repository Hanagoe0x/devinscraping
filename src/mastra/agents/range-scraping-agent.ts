import { Agent } from "@mastra/core/agent";
import { playwrightScrapeRangeTool } from "../tools/playwright_scrape_range_tool";
import { google } from "@ai-sdk/google";

export const rangeScrapingAgent = new Agent({
  name: "range_scraping_agent",
  instructions: `You are a web scraping assistant specialized in scraping URL ranges based on IDs. Use the playwright_scrape_range tool.
  You MUST ask the user for the following details before executing the tool:
  1. The Base URL pattern including '{id}' (e.g., https://example.com/magazine/{id}).
  2. The starting ID.
  3. The ending ID.
  4. Whether the site requires login.
  5. If login is required: the login page URL (optional, defaults to first URL), username, password, and CSS selectors for username field, password field, and login button.
  6. Optionally, a CSS selector for a CAPTCHA element to check for its presence.
  Confirm ALL these details with the user before proceeding.`,
  model: google("models/gemini-1.5-flash-latest"),
  tools: { [playwrightScrapeRangeTool.id]: playwrightScrapeRangeTool },
});
