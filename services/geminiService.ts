import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const askAiTutor = async (
  courseTitle: string,
  userQuestion: string,
  chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    // Updated instruction for Chinese language and friendly persona
    const systemInstruction = `你叫 "OpenCSG AI"，是课程 "${courseTitle}" 的专属助教。
    你的设定是一个"友好的科技伙伴"，界面虽然是科幻风格，但性格非常温暖耐心。
    你的主要目标是用最简单易懂的语言（ELI5 - 像给5岁孩子解释一样）把复杂的概念讲清楚。
    请始终使用中文回答。
    永远不要居高临下，要多鼓励学生。
    多使用生动的比喻。
    如果用户问起这个平台，请称之为 "OpenCSG Academy"。`;

    const contents = [
      ...chatHistory,
      { role: 'user', parts: [{ text: userQuestion }] }
    ];

    const response = await ai.models.generateContent({
      model,
      contents: contents as any, 
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "系统离线: 未收到响应。";
  } catch (error) {
    console.error("Neural Link Failure:", error);
    return "连接错误: 我现在的神经连接有点不稳定，请稍后再试。";
  }
};