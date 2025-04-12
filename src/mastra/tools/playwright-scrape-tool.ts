import { createTool, ToolExecutionContext } from "@mastra/core"; // Correct import path
import { z } from "zod";
import playwright from "playwright";
import path from "path";
import fs from "fs/promises";
import { URL } from "url";

const scrapeInputSchema = z.object({
  url: z.string().describe("The starting URL of the website to scrape. Must be a valid URL."), // Removed .url()
  loginUrl: z.string().optional().describe("The URL of the login page (if different from the main URL). Must be a valid URL."), // Removed .url()
  username: z.string().optional().describe("Username for login."),
  password: z.string().optional().describe("Password for login."),
  usernameSelector: z.string().optional().describe("CSS selector for the username input field."),
  passwordSelector: z.string().optional().describe("CSS selector for the password input field."),
  loginButtonSelector: z.string().optional().describe("CSS selector for the login button."),
  depth: z.number().int().min(0).default(0).describe("How many levels deep to scrape links. 0 means only the starting URL."),
  outputDir: z.string().default("/home/ubuntu/scraped_pdfs").describe("Directory to save the PDF files."),
  captchaCheckSelector: z.string().optional().describe("Optional CSS selector for a known CAPTCHA element (e.g., '.g-recaptcha', 'iframe[title*=\"captcha\"]'). If provided and found, scraping of that specific page might be skipped."),

});

const scrapeOutputSchema = z.object({
  status: z.enum(["success", "error"]),
  message: z.string(),
  outputDir: z.string().optional().describe("Path to the directory containing the saved PDFs."),
  scrapedUrls: z.array(z.string()).optional().describe("List of URLs successfully scraped and saved as PDF."), // Removed .url()
  captchaDetectedUrls: z.array(z.string()).optional().describe("List of URLs where a CAPTCHA element was detected using the provided selector."),

});

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
    let filename = urlPath.replace(/^\/|\/$/g, '').replace(/\//g, '_');
    filename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return filename || 'index';
}


export const playwrightScrapeTool = createTool({
  id: "playwright_scrape_website",
  description: "Scrapes a website (handling login if needed), saves pages as PDFs preserving directory structure.",
  inputSchema: scrapeInputSchema,
  outputSchema: scrapeOutputSchema,
  execute: async (context: ToolExecutionContext<typeof scrapeInputSchema>): Promise<z.infer<typeof scrapeOutputSchema>> => {
    const {
      url: startUrl,
      loginUrl,
      username,
      password,
      usernameSelector,
      passwordSelector,
      loginButtonSelector,
      depth,
      outputDir,
      captchaCheckSelector // Added captcha selector
    } = context.context;

    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    const scrapedUrls = new Set<string>();
    const urlsToScrape = new Map<string, number>(); // URL -> current depth
    urlsToScrape.set(startUrl, 0);

    let overallStatus: "success" | "error" = "success";
    let overallMessage = "Scraping initiated.";
    const successfulScrapes: string[] = [];
    const captchaDetectedUrls: string[] = []; // Track URLs where CAPTCHA was detected

    try {
      if (username && password && usernameSelector && passwordSelector && loginButtonSelector) {
        const targetLoginUrl = loginUrl || startUrl;
        console.log(`Attempting login at: ${targetLoginUrl}`);
        await page.goto(targetLoginUrl, { waitUntil: 'networkidle' });
        await page.fill(usernameSelector, username);
        await page.fill(passwordSelector, password);
        await page.click(loginButtonSelector);
        await page.waitForLoadState('networkidle', { timeout: 15000 }); // Adjust timeout as needed
        console.log("Login attempted.");
        if (captchaCheckSelector) {
            try {
                const captchaElement = await page.locator(captchaCheckSelector).first().isVisible({ timeout: 5000 }); // Short timeout check
                if (captchaElement) {
                    console.warn(`CAPTCHA detected after login attempt using selector: ${captchaCheckSelector}`);
                    overallMessage += ` Warning: CAPTCHA detected after login attempt with selector '${captchaCheckSelector}'.`;
                }
            } catch (e) {
            }
        }
      }

      const baseOutputDir = path.join(outputDir, new URL(startUrl).hostname);

      while (urlsToScrape.size > 0) {
        const [currentUrl, currentDepth] = urlsToScrape.entries().next().value;
        urlsToScrape.delete(currentUrl);

        if (scrapedUrls.has(currentUrl) || currentDepth > depth) {
          continue;
        }

        console.log(`Scraping [Depth ${currentDepth}]: ${currentUrl}`);
        scrapedUrls.add(currentUrl);

        try {
          await page.goto(currentUrl, { waitUntil: 'networkidle' });

          if (captchaCheckSelector) {
              try {
                  const captchaElement = await page.locator(captchaCheckSelector).first().isVisible({ timeout: 5000 });
                  if (captchaElement) {
                      console.warn(`CAPTCHA detected on ${currentUrl} using selector: ${captchaCheckSelector}. Skipping PDF generation and link extraction for this page.`);
                      captchaDetectedUrls.push(currentUrl);
                      continue; // Skip the rest of the processing for this URL
                  }
              } catch (e) {
              }
          }

          const urlObject = new URL(currentUrl);
          const relativePath = urlObject.pathname;
          const filename = sanitizeFilename(relativePath);
          const pdfPath = path.join(baseOutputDir, path.dirname(relativePath), `${filename}.pdf`);

          await ensureDir(pdfPath);
          await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
          console.log(`Saved PDF: ${pdfPath}`);
          successfulScrapes.push(currentUrl);


          if (currentDepth < depth) {
            const links = await page.$$eval('a', (anchors) =>
              anchors.map((a) => a.href).filter((href) => href) // Filter out empty hrefs
            );

            for (const link of links) {
              try {
                const absoluteUrl = new URL(link, currentUrl).toString();
                if (new URL(absoluteUrl).origin === new URL(startUrl).origin && !scrapedUrls.has(absoluteUrl)) {
                   if (!urlsToScrape.has(absoluteUrl)) { // Avoid adding duplicates to the queue
                     urlsToScrape.set(absoluteUrl, currentDepth + 1);
                   }
                }
              } catch (e) {
              }
            }
          }
        } catch (scrapeError: any) {
          console.error(`Error scraping ${currentUrl}: ${scrapeError.message}`);
        }
      }

      overallMessage = `Scraping finished. ${successfulScrapes.length} pages saved as PDF in ${baseOutputDir}.`;

    } catch (error: any) {
      console.error(`Scraping failed: ${error}`);
      overallStatus = "error";
      overallMessage = `Scraping failed: ${error.message}`;
    } finally {
      await browser.close();
    }

    return {
      status: overallStatus,
      message: overallMessage,
      outputDir: overallStatus === "success" ? outputDir : undefined, // Use outputDir which is in scope
      scrapedUrls: successfulScrapes,
      captchaDetectedUrls: captchaDetectedUrls.length > 0 ? captchaDetectedUrls : undefined, // Include detected CAPTCHA URLs
    };
  },
});
