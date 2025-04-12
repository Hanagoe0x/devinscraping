import { mastra } from "./mastra"; // Import the configured Mastra instance
import readline from "readline";
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let currentAgentName: 'weatherAgent' | 'scrapingAgent' | 'rangeScrapingAgent' | null = null;
let conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

async function main() {
  console.log("Available agents: weatherAgent, scrapingAgent, rangeScrapingAgent");
  rl.question("Select an agent to interact with (or type 'exit'): ", (agentName) => {
    if (agentName.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    if (agentName === 'weatherAgent' || agentName === 'scrapingAgent' || agentName === 'rangeScrapingAgent') {
      currentAgentName = agentName;
      conversationHistory = []; // Reset history for new agent session
      console.log(`Switched to ${currentAgentName}. How can I help?`);
      rl.prompt();
    } else {
      console.log("Invalid agent name. Please choose 'weatherAgent', 'scrapingAgent', or 'rangeScrapingAgent'.");
      main(); // Ask again
    }
  });

  rl.on("line", async (input) => {
    if (!currentAgentName) {
      console.log("Please select an agent first using 'switch <agent_name>'.");
      rl.prompt();
      return;
    }

    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    if (input.toLowerCase().startsWith("switch ")) {
        const newAgentName = input.split(" ")[1];
        if (newAgentName === 'weatherAgent' || newAgentName === 'scrapingAgent' || newAgentName === 'rangeScrapingAgent') {
            currentAgentName = newAgentName;
            conversationHistory = []; // Reset history
            console.log(`Switched to ${currentAgentName}. How can I help?`);
        } else {
            console.log("Invalid agent name. Available: weatherAgent, scrapingAgent, rangeScrapingAgent");
        }
        rl.prompt();
        return;
    }


    try {
      conversationHistory.push({ role: "user", content: input });

      const agent = mastra.getAgent(currentAgentName);
      if (!agent) {
          console.error(`Agent ${currentAgentName} not found.`);
          rl.prompt();
          return;
      }

      console.log(`\nThinking... (using ${currentAgentName})`);
      const response = await agent.generate(conversationHistory);

      conversationHistory.push({ role: "assistant", content: response.text });

      console.log(`\n${currentAgentName}:`, response.text);

      if (response.toolCalls && response.toolCalls.length > 0) {
          console.log("\nTool Calls:");
          response.toolCalls.forEach(tc => console.log(`- ${tc.toolName}(${JSON.stringify(tc.args)})`));
      }
      if (response.toolResults && response.toolResults.length > 0) {
          console.log("\nTool Results:");
          response.toolResults.forEach(tr => console.log(`- ${tr.toolName}: ${JSON.stringify(tr.result)}`));
      }


    } catch (error) {
      console.error(`Error interacting with ${currentAgentName}:`, error);
    }

    rl.prompt();
  });

  // rl.prompt();
}

main().catch(console.error);
