import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const result = await groq.models.list();

console.log("Models available on your account:");
for (const model of result.data) {
    console.log(" -", model.id);
}
