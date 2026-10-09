import Groq from "groq-sdk";
import dotenv from "dotenv";
import { } from "groq-sdk";

dotenv.config();

export const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, // reads from .env
});






