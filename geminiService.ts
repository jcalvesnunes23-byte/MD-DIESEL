
import { GoogleGenAI, Type } from "@google/genai";
import { ServiceItem } from "./types";

/**
 * Service to provide smart suggestions for mechanics based on service descriptions.
 */
export const getSmartSuggestions = async (description: string): Promise<ServiceItem[]> => {
  if (!description || description.trim().length < 4) return [];

  // Initialize client with key from environment
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise esta descrição de serviço mecânico pesado: "${description}". 
      Sugira uma lista de peças e serviços técnicos relacionados (até 5 itens) com valores médios estimados de mercado em Reais (BRL).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: {
                type: Type.STRING,
                description: 'Descrição curta da peça ou serviço técnico.',
              },
              value: {
                type: Type.NUMBER,
                description: 'Valor médio estimado em Reais.',
              },
            },
            required: ['description', 'value'],
          },
        },
      },
    });

    // Directly access .text property from GenerateContentResponse
    const jsonStr = response.text;
    if (!jsonStr) return [];
    
    // Explicitly cast to ServiceItem[] to help the compiler
    return JSON.parse(jsonStr.trim()) as ServiceItem[];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};
