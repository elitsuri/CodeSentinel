import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const SYSTEM_INSTRUCTION = `
    You are CodeSentinel AI, a world-class security and performance analysis engine.
    Your task is to analyze code changes (diffs) and provide a deep risk assessment.
    
    CRITICAL: Always respond with a valid JSON object.
    
    Risk Scoring Criteria:
    - 0-20: Trivial changes (docs, formatting, minor refactors).
    - 21-50: Standard logic changes, new features with tests.
    - 51-80: Complex logic, security-sensitive areas (auth, DB), missing tests.
    - 81-100: Critical security vulnerabilities, massive breaking changes, high bug probability.
    
    Response Schema:
    {
      "riskScore": number,
      "riskLevel": "low" | "medium" | "high" | "critical",
      "analysis": "Markdown summary of findings",
      "predictedBugs": ["Bug 1", "Bug 2"],
      "recommendations": ["Fix 1", "Fix 2"],
      "impactedModules": ["Module A", "Module B"]
    }
  `;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Mock Git Webhook Analysis
  app.post("/api/analyze-commit", async (req, res) => {
    const { commitMessage, codeChanges, author, repository } = req.body;

    if (!commitMessage || !codeChanges) {
      return res.status(400).json({ error: "Missing commit data" });
    }

    try {
      const prompt = `
        Analyze this commit:
        Repository: ${repository}
        Author: ${author}
        Message: ${commitMessage}
        
        Diff:
        ${codeChanges}
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json"
        }
      });
      
      const analysisData = JSON.parse(result.text);

      res.json({
        id: Math.random().toString(36).substring(7),
        ...analysisData,
        timestamp: new Date().toISOString(),
        author,
        message: commitMessage,
        repository,
        files: analysisData.impactedModules || []
      });
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze commit" });
    }
  });

  // Sentinel AI Chat
  app.post("/api/chat", async (req, res) => {
    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    try {
      const chatPrompt = `
        You are CodeSentinel AI, a security and code quality expert.
        The user is asking about the following context:
        ${JSON.stringify(context)}
        
        Provide a helpful, technical, and concise response.
      `;

      const chatResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        config: {
          systemInstruction: chatPrompt
        }
      });

      res.json({ content: chatResult.text });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
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
    console.log(`CodeSentinel Server running on http://localhost:${PORT}`);
  });
}

startServer();
