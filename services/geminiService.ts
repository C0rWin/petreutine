import { GoogleGenAI, Type } from "@google/genai";
import { PetPost, GeminiMatchResult } from '../types';

// Use the recommended model for basic text/reasoning tasks
const MODEL_NAME = 'gemini-2.5-flash-preview';

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Analyzes a new draft post against existing posts to find potential matches.
   * Logic: If creating a LOST post, look for similar FOUND posts.
   * If creating a FOUND post, look for similar LOST posts.
   */
  async findPotentialMatches(draft: Partial<PetPost>, existingPosts: PetPost[]): Promise<GeminiMatchResult[]> {
    if (!process.env.API_KEY) {
      console.warn("No API Key available for Gemini");
      return [];
    }

    // Filter relevant candidates first (opposite type)
    const candidates = existingPosts.filter(p => p.type !== draft.type && p.status === 'OPEN');
    
    if (candidates.length === 0) return [];

    const prompt = `
      I am building a lost and found pet application.
      
      NEW POST BEING DRAFTED:
      Type: ${draft.type}
      Animal: ${draft.animalType}
      Description: ${draft.description}
      Location: ${draft.location}
      
      EXISTING POSTS:
      ${JSON.stringify(candidates.map(c => ({
        id: c.id,
        type: c.type,
        animal: c.animalType,
        desc: c.description,
        loc: c.location
      })))}

      TASK:
      Analyze the "NEW POST" and compare it against "EXISTING POSTS".
      Identify if any existing posts describe the SAME animal. 
      For example, if the new post is "Lost Dog" and an existing post is "Found Dog" with matching features (color, breed, location proximity), it is a match.
      
      Return a JSON array of matches. If no matches, return an empty array.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                postId: { type: Type.STRING },
                reason: { type: Type.STRING },
                confidence: { type: Type.NUMBER, description: "Confidence score between 0 and 1" },
              },
              required: ["postId", "reason", "confidence"],
            }
          }
        }
      });

      const text = response.text;
      if (!text) return [];
      return JSON.parse(text) as GeminiMatchResult[];
    } catch (error) {
      console.error("Gemini matching failed:", error);
      return [];
    }
  }

  /**
   * Performs a smart search on existing posts.
   */
  async smartSearch(query: string, posts: PetPost[]): Promise<string[]> {
    if (!process.env.API_KEY || !query.trim()) return posts.map(p => p.id);

    const prompt = `
      User Query: "${query}"
      
      Filter and rank the following pet posts based on relevance to the query.
      If the user asks for "cats in Brooklyn", prioritize posts with cats in Brooklyn.
      
      POSTS:
      ${JSON.stringify(posts.map(p => ({ id: p.id, content: `${p.title} ${p.description} ${p.location} ${p.animalType} ${p.type}` })))}
      
      Return ONLY a JSON array of post IDs that are relevant, sorted by relevance.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.ARRAY,
             items: { type: Type.STRING }
          }
        }
      });
      
      const text = response.text;
      if (!text) return [];
      return JSON.parse(text) as string[];

    } catch (error) {
      console.error("Gemini search failed:", error);
      // Fallback to simple local filter
      const lowerQuery = query.toLowerCase();
      return posts
        .filter(p => 
          p.title.toLowerCase().includes(lowerQuery) || 
          p.description.toLowerCase().includes(lowerQuery) ||
          p.location.toLowerCase().includes(lowerQuery)
        )
        .map(p => p.id);
    }
  }
}

export const geminiService = new GeminiService();