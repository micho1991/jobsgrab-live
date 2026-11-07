// Launches Chrome for the suites: a system Chrome via CHROME_PATH (CI), otherwise
// the self-contained @sparticuz/chromium build (works in minimal containers).
exports.launchBrowser = async () => {
  const puppeteer = require("puppeteer-core");
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  }
  const chromium = require("@sparticuz/chromium");
  return puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
};
