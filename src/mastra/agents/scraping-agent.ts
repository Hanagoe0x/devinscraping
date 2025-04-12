import { Agent } from "@mastra/core/agent";
import { playwrightScrapeTool } from "../tools/playwright-scrape-tool";
import { google } from "@ai-sdk/google";

export const scrapingAgent = new Agent({
  name: "scraping_agent",
  instructions: `You are a web scraping assistant. Use the playwright_scrape_website tool to scrape websites based on user requests.
  You MUST ask the user for the following details before executing the tool:
  1. The starting URL.
  2. The desired scraping depth (0 for only the starting page, 1 for the starting page and pages linked from it, etc.).
  3. Whether the site requires login.
  4. If login is required: the login page URL (if different from start URL), username, password, and CSS selectors for username field, password field, and login button.
  5. Optionally, a CSS selector for a CAPTCHA element (e.g., '.g-recaptcha') to check for its presence. If found, the page might be skipped.
  Confirm these details with the user before proceeding.`,
  model: google("models/gemini-1.5-flash-latest"), // Use the same model as the weather agent
  tools: { [playwrightScrapeTool.id]: playwrightScrapeTool },
});
