import { Note, CycleLength, Language, Goal } from "../types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekOptions = {
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

const createDeepSeekRequest = async (
  apiKey: string,
  messages: DeepSeekMessage[],
  options: DeepSeekOptions = {}
) => {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
};

const extractJson = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Invalid JSON response");
  }
  return JSON.parse(value.slice(start, end + 1));
};

export const generateDailyInsight = async (
  content: string,
  language: Language,
  apiKey: string,
  imageUrl?: string
) => {
  const isEn = language === "en";
  const systemInstruction = isEn
    ? "Generate a very concise daily growth insight (max 15 words) based on the user's note. Focus on the 'Why' or the 'Meaning'."
    : "请根据用户的笔记内容生成一段非常精炼的（15字以内）每日总结或成长洞察。侧重于挖掘行为背后的意义或给出一句鼓励。";

  const userContent = imageUrl
    ? `${content}\n\n[Image attached; visual analysis not available.]`
    : content;

  try {
    const response = await createDeepSeekRequest(apiKey, [
      { role: "system", content: systemInstruction },
      { role: "user", content: userContent }
    ]);
    return response || (isEn ? "Recorded a peaceful day." : "记录了一个平凡而充实的一天。");
  } catch (error) {
    console.error("Daily insight error:", error);
    return isEn ? "Documented today's thoughts." : "记录了当下的思考。";
  }
};

export const generateReflectionPrompt = async (
  historyNotes: Note[],
  language: Language,
  apiKey: string
) => {
  const isEn = language === "en";
  const recentContext = historyNotes
    .slice(0, 5)
    .map(n => n.content.replace(/<[^>]*>/g, ""))
    .join(" | ");

  const systemInstruction = isEn
    ? "You are a professional life coach. Ask ONE deep, reflective question to inspire today's writing. Be concise."
    : "你是一位专业的心理成长教练。请提出一个深刻、启发性的提问，引导用户开启今天的记录，保持简短。";

  const userPrompt = isEn
    ? `Recent notes: ${recentContext}\nAsk one concise reflective question.`
    : `近期记录：${recentContext}\n请提出一个简短的反思问题。`;

  try {
    const response = await createDeepSeekRequest(apiKey, [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ]);
    return response || (isEn ? "What's the most meaningful thing that happened today?" : "今天发生的哪件事让你觉得最有意义？");
  } catch (error) {
    return isEn ? "What's the most meaningful thing that happened today?" : "今天发生的哪件事让你觉得最有意义？";
  }
};

export const generateGrowthSummary = async (
  notes: Note[],
  cycleLength: CycleLength,
  language: Language,
  apiKey: string,
  goals: Goal[]
) => {
  const isEn = language === "en";
  const notesText = notes
    .map(n => {
      const date = n.date.split("T")[0];
      const mood = n.mood ? `mood=${n.mood}` : "mood=unknown";
      const goalsText = n.goals?.length ? `goals=${n.goals.join(",")}` : "";
      const meta = [mood, goalsText].filter(Boolean).join(" | ");
      return `[${date}] ${meta}: ${n.content.replace(/<[^>]*>/g, "")}`;
    })
    .join("\n\n---\n\n");

  const goalsSummary = goals.length
    ? goals
        .map(goal => `${goal.name}(${goal.completed ? (isEn ? "completed" : "已完成") : (isEn ? "active" : "进行中")})`)
        .join(" | ")
    : isEn
      ? "none"
      : "无";

  const systemInstruction = isEn
    ? `Summarize the user's growth cycle in the last ${cycleLength} days.
Include mood trend, top themes, and a concise next-week plan.
Consider current goals and their completion status.
Respond ONLY with JSON: { "summaryText": string, "keyInsights": string[], "advice": string[], "growthScore": number, "moodTrend": string, "topThemes": string[], "nextWeekPlan": string[] }`
    : "对用户近期的成长周期进行深度复盘。\n请输出心情走势、高频主题、下周行动计划。\n考虑用户的目标及完成情况。\n输出 JSON：{ \"summaryText\": string, \"keyInsights\": string[], \"advice\": string[], \"growthScore\": number, \"moodTrend\": string, \"topThemes\": string[], \"nextWeekPlan\": string[] }";

  const prompt = isEn
    ? `Goals: ${goalsSummary}\n\nNotes:\n${notesText}`
    : `目标：${goalsSummary}\n\n笔记：\n${notesText}`;

  try {
    const response = await createDeepSeekRequest(
      apiKey,
      [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      { temperature: 0.4 }
    );
    return extractJson(response || "{}");
  } catch (error) {
    console.error("Summary Error:", error);
    throw error;
  }
};
