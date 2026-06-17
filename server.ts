import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Route for AI Image Generation
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, aspectRatio = "4:3" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
        return res.status(400).json({ 
          error: "Gemini API key is not configured in Secrets. Please go to Settings (gear icon) > Secrets and add GEMINI_API_KEY, or enjoy playing with our beautifully pre-loaded high-resolution galleries or upload your own images!" 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Use gemini-2.5-flash-image for image generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          }
        }
      });

      let base64Image = "";
      const candidates = response.candidates;
      if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64Image) {
        return res.status(500).json({ error: "The AI did not return image data. Try a different prompt, e.g., 'a peaceful lake in autumn, oil painting style'." });
      }

      const imageUrl = `data:image/png;base64,${base64Image}`;
      return res.json({ imageUrl });

    } catch (error: any) {
      console.error("Error generating image:", error);
      return res.status(500).json({ 
        error: error.message || "An error occurred while generating the image. Please try again." 
      });
    }
  });

  // Serve static files and handle SPA fallback
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
