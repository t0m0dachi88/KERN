import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
const apiKey = "AIzaSyCRQrUy7aMJ05QPcI1dJ835vC2P5p1FkGU"

const ai = new GoogleGenAI({ apiKey });

const MODEL = "gemma-4-31b-it";
const response = await ai.models.generateContent({
  model: MODEL,
  contents: "Reply with exactly: Hello from Kern.",
});

console.log(response.text);