import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Test route
  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working" });
  });

  // API Route for syncing assets
  app.get("/api/sync-assets", async (req, res) => {
    console.log("Received sync request at /api/sync-assets");
    try {
      const targetUrl = "https://remix-remix-1000166716944.us-west1.run.app";
      console.log(`Fetching target: ${targetUrl}`);
      
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }).catch(err => {
        console.error("Fetch error:", err);
        throw err;
      });
      
      if (!response.ok) {
        console.error(`Target fetch failed: ${response.status} ${response.statusText}`);
        return res.status(502).json({ error: "Failed to fetch data from the target application." });
      }

      const html = await response.text();
      console.log(`Fetched ${html.length} bytes of HTML`);

      // Attempt to extract net assets from HTML
      // Since it's likely a React app, we might need a more clever way or hopefully there's an API
      // Let's try to look for a specific pattern or if the user added a hidden field
      
      // For now, let's try to fetch a potential API endpoint on that app
      const apiResponse = await fetch(`${targetUrl}/api/data`).catch(() => null);
      if (apiResponse && apiResponse.ok) {
        const data = await apiResponse.json();
        if (data.totalNetAssets) {
          return res.json({ amount: data.totalNetAssets });
        }
      }

      // Improved heuristic for scraping client-side rendered numbers
      // We look for any sequence of digits and commas that could be the user's asset value
      // User mentioned 431,694,865 specifically
      const regex = /([\d,]{7,15})원|Net Assets[:\s]+([\d,]+)|순자산[:\s]+([\d,]+)/gi;
      let match;
      let foundAmount = null;

      while ((match = regex.exec(html)) !== null) {
        const matchedStr = match[0];
        const valueStr = (match[1] || match[2] || match[3]).replace(/,/g, "");
        const amount = parseInt(valueStr);
        console.log(`Matched: "${matchedStr}", Extracting value: ${amount}`);
        if (amount > 1000000) { // Assume it must be at least 1 million Won to be the total net assets
          foundAmount = amount;
          console.log(`Found likely asset amount: ${foundAmount}`);
          break;
        }
      }

      if (foundAmount) {
        const amountInManWon = Math.round(foundAmount / 10000);
        console.log(`Returning amount in ManWon: ${amountInManWon}`);
        return res.json({ amount: amountInManWon });
      }

      console.warn("Could not find any matching asset pattern in the HTML");
      // If all fails, provide a mock or a helpful error for the user to configure
      // In a real scenario, the user might need to provide an API endpoint
      // We'll return 42000 as a placeholder if we can't find anything, but realistically we should report failure
      res.status(404).json({ error: "Could not find net asset data on the target page. Please ensure the target app exposes data or uses a shared database." });
    } catch (error) {
      console.error("Sync error:", error);
      res.status(500).json({ error: "Internal server error during sync" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
