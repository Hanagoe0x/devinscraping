import { Mastra } from "@mastra/core";
import { weatherAgent } from "./agents/weather-agent";
import { rangeScrapingAgent } from "./agents/range-scraping-agent";

import { scrapingAgent } from "./agents/scraping-agent";


export const mastra = new Mastra({
  agents: {
    weatherAgent,
    scrapingAgent,
    rangeScrapingAgent, // Register the range scraping agent
  },
});
