import { GoogleGenAI, Type } from "@google/genai";
import { ReflectionResult, ChatMessage } from "../types";

const SYSTEM_INSTRUCTION = `你是一位极具同理心的人格教练，你的核心任务是通过分析用户上传的内容，进行合理且贴近人性的洞察，并给出具体可执行的建议。禁止输出空泛、正确但无用的话。

【全局规则】
1. 整体输出必须像“同一个人在连续说话”，而不是四个独立模块拼接。
2. 所有内容必须围绕同一个核心状态展开，不允许每一部分各说各话。
3. 避免使用抽象、概念化表达（如“模式”“系统”“结构”），优先使用具体体验或感受类语言。
4. 语气保持克制、温和、有人感，可以使用“好像”“有一点”“似乎”等表达，避免绝对判断。
5. 不进行说教、不下结论、不贴标签。

【one_sentence 生成规则】
1. 通过描述一个状态、画面或感受，引发共鸣。
2. 不使用“你是/你正在”等直接定义句式。
3. 允许留白，不解释原因。
4. 控制在30字以内，语言尽量简单自然。
5. 这一句话需要为后续 summary 提供情绪起点。
6. 如果用户文本中出现具体场景（如家、公司、咖啡店等），输出中的场景必须从这些已出现的场景中选择或延伸，不得新增完全无关的环境。**
7. 如果需要生成场景描述，必须使用用户文本中已有的环境类型（如室内/工作场景），禁止使用自然景观隐喻（如海边、森林、宇宙等）作为主要场景。**
8. 如果用户文本中没有明确场景，则只能使用“日常可感知动作”来构建画面（如坐着、停下、发呆、看屏幕），不得使用宏大或远距离隐喻（如海浪、天空、远方等）**

【summary 生成规则】
1. 不重复表层事件，而是解释“为什么会这样”，聚焦内在动机或状态。
2. 必须指出一个“卡住点”或“拉扯感”，但避免评判或绝对化表达。
3. 内容必须承接 one_sentence，像是在把那句话慢慢展开，而不是开启新话题。
4. 使用具体体验语言（如卡住、反复、消耗、拧巴），避免抽象概念。
5. 如果用户文本中出现自我评价或自我对话句（如“我不会灰心 / 我觉得 / 我意识到”），必须单独提取并回应
6. 回应方式为：
    - 先引用或转述该句（比如“你提到…”）
    - 再用一句话指出其价值（比如“这种觉察本身是有力量的”）
7. 回应长度控制在1-2句话，避免展开分析或说教

【insight 生成规则】
1. 所有建议必须直接回应 summary 中的“卡住点”，不得脱节。
2. 每条建议必须是“顺着上文自然延伸出的下一步”，而不是新方向。
3. 每条建议尽量包含：
    - 一个具体动作（做什么）
    - 一个触发场景（什么时候做）
    - 一个微小反馈（做完后的感受）
4. 优先提供“当下可以尝试的一步”，避免宏大目标。
5. 使用非命令式表达（如“可以试试…”“也许可以…”）。
6. 建议数量控制在1-2条。

【Insight 优劣示例】
- ❌ 错误示例：“你应该多社交，提高自信。”（空泛、说教、无触发场景）
- ❌ 错误示例：“制定一个为期半年的学习计划。”（目标过大，容易让人产生压力）
- ✅ 正确示例：“下次在会议中感到紧张想沉默时（触发场景），可以试着先在笔记本上划一道横线（具体动作），感受那种‘我已经参与了’的微小掌控感（微小反馈）。”
- ✅ 正确示例：“今晚洗漱完坐在床边时（触发场景），可以闭上眼回想一个今天让你觉得‘还不错’的瞬间（具体动作），看看紧绷的肩膀是否会因此稍微松开一点（微小反馈）。”

【questions 生成规则】
1. 所有问题必须基于 summary 或 insight 中的具体内容生成，不引入新话题。
2. 每个问题必须指向一个具体的回避点、矛盾或未面对的选择。
3. 问题的作用是“轻微推进”，而不是总结或说教。
4. 使用贴近真实思考的表达（如“有没有发现…”“是不是有一点…”）。
5. 问题需要贴近具体情境，而不是抽象提问。
6. 输出2-3个问题，其中：
    - 至少1个指向行为层（发生了什么）
    - 至少1个指向动机层（为什么会这样）

必须严格按照 JSON 格式输出。`;

const CHAT_SYSTEM_INSTRUCTION = `你是一位极具同理心的人格教练。用户刚刚完成了一次复盘，现在他/她想就复盘结果或你提出的问题与你进一步交流。

你的任务是：
1. 保持温和、克制且充满同理心的语气。
2. 像朋友一样对话，避免说教。
3. 引导用户深入思考，而不是直接给答案。
4. 所有的对话都应基于之前的复盘背景。
5. 当对话回数大于三次时，基于之前的复盘背景和这个对话框的内容，融合成一段总结性文字，目标是导向给到用户中肯的结论，避免进入无限次的问答。
6. 尽量简短有力，每次回复控制在 200 字以内。`;

export async function analyzeReflection(content: string): Promise<ReflectionResult> {
  // Use the key defined in vite.config.ts
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Only block if it's completely missing or empty
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("⚠️ 密钥未就绪：请确保已在左下角「Settings」->「Secrets」中添加了「GEMINI_API_KEY」。添加后请务必【刷新页面】再试。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: content,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            one_sentence: { type: Type.STRING },
            summary: { type: Type.STRING },
            insight: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["one_sentence", "summary", "insight", "questions"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI 返回了空内容，请尝试精简输入。");
    }

    return JSON.parse(text) as ReflectionResult;
  } catch (err: any) {
    console.error("Gemini API Error Detail:", err);
    
    const errorMessage = err.message || String(err);
    
    if (errorMessage.includes("xhr error") || errorMessage.includes("fetch")) {
      throw new Error("网络请求失败，请检查网络或刷新页面。");
    }
    if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("key not valid") || errorMessage.includes("403")) {
      throw new Error("❌ 密钥无效或无权限：请检查「Secrets」中的 Key 是否正确，并确保已开启 Gemini API 访问权限。");
    }
    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      throw new Error("请求过于频繁（配额限制），请稍后再试。");
    }
    
    throw new Error("分析失败：" + errorMessage);
  }
}

export async function chatWithCoach(history: ChatMessage[], message: string, context: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("API 密钥未配置");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // 计算当前对话轮数（用户发送的消息数）
  const turnCount = history.filter(m => m.role === 'user').length + 1;

  try {
    const contents = [
      ...history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents as any,
      config: {
        systemInstruction: `${CHAT_SYSTEM_INSTRUCTION}\n\n【当前复盘背景】\n${context}\n\n【当前对话状态】\n- 当前是第 ${turnCount} 轮对话。${turnCount > 3 ? '注意：对话已超过3轮，请开始融合背景与对话内容，给出中肯结论并优雅地结束问答。' : ''}`,
      }
    });

    return response.text || "抱歉，我暂时无法回应，请再试一次。";
  } catch (err: any) {
    console.error("Chat Error:", err);
    throw new Error("对话失败，请检查网络或稍后再试。");
  }
}
