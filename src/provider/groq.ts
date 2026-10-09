import Groq from "groq-sdk";
import dotenv from "dotenv";
import { } from "groq-sdk";

dotenv.config();

export const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, // reads from .env
});



import { GoogleGenAI } from "@google/genai";

const google = new GoogleGenAI({
    apiKey:"AIzaSyDlJJX0yFn1EN40We8UiUDZQcjlJVbwsxs"
});

const response = await google.models.generateContent({
  model: "gemma-4-26b-a4b-it",
  contents: "Roses are red...",
});
console.log(response.text);