import { GoogleGenAI } from "@google/genai";
import { Session } from '../types';

export const generateProductivityInsights = async (sessions: Session[]): Promise<string> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    return "API Key is missing. Please check your environment variables.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Prepare data for the model
    const recentSessions = sessions
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, 50) // Analyze last 50 sessions
      .map(s => ({
        project: s.projectName,
        duration: Math.round(s.durationSeconds / 60),
        notes: s.notes || 'No notes',
        date: new Date(s.endTime).toLocaleDateString(),
        tags: s.tags
      }));

    const prompt = `
      You are a friendly, encouraging productivity coach.
      Analyze the following productivity session data for the user.
      
      Data: ${JSON.stringify(recentSessions)}
      
      Please provide:
      1. A brief summary of their recent focus habits and projects.
      2. One specific observation about their work patterns (e.g., "You spend most of your time on [Project Name]" or "Your sessions are getting longer").
      3. A short, motivational closing.
      
      Keep the tone light, professional, and concise (max 150 words).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate insights at this time.";
  } catch (error) {
    console.error("Error generating insights:", error);
    return "Sorry, I couldn't connect to the insight engine right now. Please try again later.";
  }
};
