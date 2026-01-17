import { GoogleGenAI, Type } from "@google/genai";
import { JourneyStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateJourneySuggestion = async (
  campaignName: string,
  objective: string,
  targetAudience: string
): Promise<JourneyStep[]> => {
  
  const prompt = `
    Create a strategic, multi-step ABM (Account Based Marketing) outreach sequence for a campaign named "${campaignName}".
    
    Context:
    - Objective: ${objective}
    - Target Audience Profile: ${targetAudience}
    
    Requirements:
    - Return a JSON object containing an array of steps.
    - Each step must have:
      - 'type': One of "Email", "LinkedIn", "Call", "Wait"
      - 'title': A short, punchy title for the step.
      - 'description': A brief summary of what happens in this step (e.g., email subject line idea, or connection note topic).
      - 'day': The day number (e.g., 1, 3, 5) relative to the start.
    - Ensure the sequence is logical (e.g., don't call before connecting, wait a few days between touches).
    - Limit to 4-6 steps.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // High budget for complex reasoning on strategy
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  day: { type: Type.NUMBER },
                },
                required: ["type", "title", "description", "day"]
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No text returned from Gemini");
    
    const data = JSON.parse(jsonText);
    
    // Map to ensure IDs and types are correct
    return data.steps.map((step: any, index: number) => ({
      id: `generated-${Date.now()}-${index}`,
      type: step.type,
      title: step.title,
      description: step.description,
      day: step.day
    }));

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};