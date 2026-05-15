import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

// Serve client UI
app.use(express.static(path.join(__dirname, "..", "client")));

if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not set in .env — chat RAG will fail until you add it.");
}
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// Load KB + embeddings (optional: server starts even if missing)
let docs = [];
let embeddedDocs = [];
try {
    docs = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets", "knowledgeBase.json"), "utf8"));
} catch (e) {
    console.warn("Could not load knowledgeBase.json:", e.message);
}
try {
    embeddedDocs = JSON.parse(fs.readFileSync(path.join(__dirname, "kb_embeddings.json"), "utf8"));
} catch (e) {
    console.warn("Could not load kb_embeddings.json — using full KB as context:", e.message);
}

// Cosine similarity
function cosineSimilarity(a, b) {
    let dot = 0,
        normA = 0,
        normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] ** 2;
        normB += b[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

app.post("/rag", async (req, res) => {
    try {
        if (!genAI) {
            return res.status(503).json({
                error: "Chat is not configured. Add GEMINI_API_KEY to server/.env and restart."
            });
        }
        const query = req.body.userMessage;
        if (!query) {
            return res.status(400).json({ error: "userMessage is required" });
        }

        let contextText = "";
        if (embeddedDocs.length > 0) {
            // ------ Embed user query ------
            const embedRes = await genAI.models.embedContent({
                model: "text-embedding-004",
                contents: query
            });
            const qVec =
                embedRes?.embedding?.values ??
                embedRes?.embeddings?.[0]?.values;
            if (!qVec) {
                throw new Error("Embedding response missing values");
            }
            // ------ Retrieve best document ------
            let best = { text: "", score: -Infinity };
            embeddedDocs.forEach((vec, i) => {
                const score = cosineSimilarity(qVec, vec);
                if (score > best.score) {
                    best = { text: docs[i]?.text ?? "", score };
                }
            });
            contextText = best.text;
        } else {
            contextText = docs.map((d) => d.text).join("\n\n") || "No knowledge base loaded.";
        }

        // ------ Generate answer using Gemini ------
        const modelName = "gemini-2.0-flash";

        const result = await genAI.models.generateContent({
            model: modelName,
            contents: `
You are SafeSpace AI, a CBT-guided, emotionally supportive AI.
Use the following knowledge base context to answer safely:

Context:
${contextText}

User message:
${query}
            `
        });

        return res.json({ reply: result.text });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("RAG server running on port 3000"));
