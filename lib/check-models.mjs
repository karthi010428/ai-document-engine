import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function check() {
  try {
    const list = await ai.models.list();
    console.log("\n--- Available models for your API Key ---");
    for await (const m of list) {
      if (m.supportedActions?.includes("generateContent")) {
        console.log(m.name);
      }
    }
    console.log("-----------------------------------------\n");
  } catch (err) {
    console.error("Error fetching models:", err.message);
  }
}

check();