import { createTool, ToolExecutionContext } from "@mastra/core";
import { z } from "zod";
import playwright from "playwright";
import path from "path";
import fs from "fs/promises";
import { URL } from "url";

async function ensureDir(filePath: string) {
  const dirname = path.dirname(filePath);
  try {
    await fs.access(dirname);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirname, { recursive: true });
    } else {
      throw error;
    }
  }
}

function sanitizeFilename(urlPath: string): string {
    const parts = urlPath.split('/');
    const id = parts[parts.length - 1];
    let filename = id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return filename || 'unknown_id';
}


const scrapeRangeInputSchema = z.object({
  baseUrlPattern: z.string().describe("Base URL pattern including '{id}' placeholder, e.g., https://example.com/magazine/{id}"),
  startId: z.number().int().positive().describe("The starting ID for the range to scrape."),
  endId: z.number().int().positive().describe("The ending ID for the range to scrape."),
  loginUrl: z.string().optional().describe("The URL of the login page. If not provided, login attempt will use the first generated URL."),
  username: z.string().optional().describe("Username for login."),
  password: z.string().optional().describe("Password for login."),
  usernameSelector: z.string().optional().describe("CSS selector for the username input field."),
  passwordSelector: z.string().optional().describe("CSS selector for the password input field."),
  loginButtonSelector: z.string().optional().describe("CSS selector for the login button."),
  captchaCheckSelector: z.string().optional().describe("Optional CSS selector for a known CAPTCHA element."),
  outputDir: z.string().default("/home/ubuntu/scraped_pdfs").describe("Directory to save the PDF files."),
});

const scrapeRangeOutputSchema = z.object({
  status: z.enum(["success", "error", "partial"]),
  message: z.string(),
  outputDir: z.string().optional().describe("Path to the directory containing the saved PDFs."),
  scrapedIds: z.array(z.number()).optional().describe("List of IDs successfully scraped and saved as PDF."),
  skippedIds: z.array(z.number()).optional().describe("List of IDs skipped due to errors or CAPTCHA detection."),
  captchaDetectedIds: z.array(z.number()).optional().describe("List of IDs where a CAPTCHA element was detected."),
});

export const playwrightScrapeRangeTool = createTool({
  id: "playwright_scrape_range",
  description: "Scrapes a range of URLs based on an ID pattern (e.g., /magazine/{id}), handling login and saving pages as PDFs.",
  inputSchema: scrapeRangeInputSchema,
  outputSchema: scrapeRangeOutputSchema,
  execute: async (context: ToolExecutionContext<typeof scrapeRangeInputSchema>): Promise<z.infer<typeof scrapeRangeOutputSchema>> => {
    const {
      baseUrlPattern,
      startId,
      endId,
      loginUrl,
      username,
      password,
      usernameSelector,
      passwordSelector,
      loginButtonSelector,
      captchaCheckSelector,
      outputDir
    } = context.context;

    if (!baseUrlPattern.includes('{id}')) {
        return { status: "error", message: "baseUrlPattern must include '{id}' placeholder." };
    }
     if (startId > endId) {
        return { status: "error", message: "startId cannot be greater than endId." };
    }

    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    const successfulScrapes: number[] = [];
    const skippedIds: number[] = [];
    const captchaDetectedIds: number[] = [];

    let overallStatus: "success" | "error" | "partial" = "success";
    let overallMessage = "Scraping initiated.";
    let loggedIn = false;

    let hostname = 'unknown_host';
    try {
        hostname = new URL(baseUrlPattern.replace('{id}', startId.toString())).hostname;
    } catch (e) {
        console.warn("Could not parse hostname from baseUrlPattern");
    }
    const baseOutputDir = path.join(outputDir, hostname, 'magazines'); // Subdirectory for magazines

    try {
      if (username && password && usernameSelector && passwordSelector && loginButtonSelector) {
        const firstUrl = baseUrlPattern.replace('{id}', startId.toString());
        const targetLoginUrl = loginUrl || firstUrl; // Use specific login URL or first page
        console.log(`Attempting login at: ${targetLoginUrl}`);
        try {
            await page.goto(targetLoginUrl, { waitUntil: 'networkidle' });
            await page.fill(usernameSelector, username);
            await page.fill(passwordSelector, password);
            await page.click(loginButtonSelector);
            await page.waitForLoadState('networkidle', { timeout: 20000 }); // Increased timeout
            console.log("Login attempted.");
            loggedIn = true; // Assume success for now, errors during scraping will indicate failure

            if (captchaCheckSelector) {
                try {
                    const captchaElement = await page.locator(captchaCheckSelector).first().isVisible({ timeout: 5000 });
                    if (captchaElement) {
                        console.warn(`CAPTCHA detected after login attempt using selector: ${captchaCheckSelector}`);
                        overallMessage += ` Warning: CAPTCHA detected after login attempt. Scraping may fail.`;
                    }
                } catch (e) { /* No CAPTCHA found */ }
            }
        } catch (loginError: any) {
             console.error(`Login failed: ${loginError.message}`);
             loggedIn = false; // Mark as potentially not logged in
             overallMessage = `Login attempt failed or timed out: ${loginError.message}. Proceeding with scraping attempt, assuming session might be active.`;
             overallStatus = "partial"; // Indicate potential issue
        }
      } else {
          console.log("No login credentials provided, proceeding without login attempt.");
      }

      for (let id = startId; id <= endId; id++) {
        const currentUrl = baseUrlPattern.replace('{id}', id.toString());
        console.log(`Attempting to scrape ID ${id}: ${currentUrl}`);

        try {
          await page.goto(currentUrl, { waitUntil: 'networkidle', timeout: 30000 }); // Increased timeout for page load

          if (captchaCheckSelector) {
              try {
                  const captchaElement = await page.locator(captchaCheckSelector).first().isVisible({ timeout: 5000 });
                  if (captchaElement) {
                      console.warn(`CAPTCHA detected on ID ${id} (${currentUrl}). Skipping.`);
                      captchaDetectedIds.push(id);
                      skippedIds.push(id);
                      overallStatus = "partial";
                      continue; // Skip this ID
                  }
              } catch (e) { /* No CAPTCHA found */ }
          }



          const filename = sanitizeFilename(currentUrl); // Use ID for filename
          const pdfPath = path.join(baseOutputDir, `${filename}.pdf`);
          await ensureDir(pdfPath);
          await page.pdf({ path: pdfPath, format: 'A4', printBackground: true }); // Removed invalid timeout option
          console.log(`Saved PDF for ID ${id}: ${pdfPath}`);
          successfulScrapes.push(id);

        } catch (scrapeError: any) {
          console.error(`Error scraping ID ${id} (${currentUrl}): ${scrapeError.message}`);
          skippedIds.push(id);
          overallStatus = "partial"; // Mark as partial success if any error occurs
        }
      } // End ID loop

      const successCount = successfulScrapes.length;
      const skipCount = skippedIds.length;
      const totalAttempted = endId - startId + 1;
      overallMessage = `Scraping finished. Attempted IDs: ${totalAttempted}. Successfully saved: ${successCount}. Skipped/Errors: ${skipCount}. PDFs saved in ${baseOutputDir}.`;
      if (skipCount > 0) overallStatus = "partial";


    } catch (error: any) {
      console.error(`Scraping range failed critically: ${error}`);
      overallStatus = "error";
      overallMessage = `Scraping range failed critically: ${error.message}`;
    } finally {
      await browser.close();
    }

    return {
      status: overallStatus,
      message: overallMessage,
      outputDir: (overallStatus === "success" || overallStatus === "partial") ? baseOutputDir : undefined,
      scrapedIds: successfulScrapes,
      skippedIds: skippedIds.length > 0 ? skippedIds : undefined,
      captchaDetectedIds: captchaDetectedIds.length > 0 ? captchaDetectedIds : undefined,
    };
  },
});
export {}; // Ensure this file is treated as a module
