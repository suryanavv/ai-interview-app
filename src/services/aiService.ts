import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { Config } from '@/lib/config';

export interface AIQuestion {
  id: string;
  text: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  timeLimit: number;
  category: string;
}

interface AIQuestionResponse {
  id: string;
  text: string;
  difficulty: string;
  timeLimit: number;
  category: string;
}

interface AIChatSession {
  id: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  resumeText: string;
  questions: AIQuestion[];
  createdAt: Date;
}

export class AIService {
  private static openrouter: ReturnType<typeof createOpenRouter> | null = null;

  /**
   * Get or create OpenRouter instance with current configuration
   */
  private static getOpenRouter(): ReturnType<typeof createOpenRouter> {
    const config = Config.getAIConfig();

    // Recreate instance if it doesn't exist (we don't need to check apiKey changes as the instance is lightweight)
    if (!this.openrouter) {
      this.openrouter = createOpenRouter({
        apiKey: config.apiKey,
      });
    }

    return this.openrouter;
  }

  // Store active chat sessions
  private static chatSessions: Map<string, AIChatSession> = new Map();

  /**
   * Create a new AI chat session and generate 6 personalized interview questions based on resume text
   */
  static async createChatSession(resumeText: string): Promise<{ sessionId: string; questions: AIQuestion[] }> {
    if (!resumeText.trim()) {
      throw new Error('Resume text is required');
    }

    const config = Config.getAIConfig();

    if (!config.enabled) {
      throw new Error('AI features are disabled. Please enable AI in your configuration or use standard questions.');
    }

    if (!config.apiKey) {
      throw new Error('OpenRouter API key not configured. Please set VITE_OPENROUTER_API_KEY in your environment variables.');
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const prompt = `
You are an expert technical interviewer. Based on the following resume text, generate 6 personalized interview questions that assess the candidate's technical skills, experience, and problem-solving abilities.

Resume Text:
${resumeText}

Requirements:
1. Generate exactly 6 questions total
2. 2 Easy questions (basic concepts, 20 second time limit each)
3. 2 Medium questions (intermediate concepts, 60 second time limit each)
4. 2 Hard questions (advanced concepts requiring deep understanding, 120 second time limit each)
5. Questions should be directly relevant to the candidate's experience and skills shown in the resume
6. Include a mix of technical knowledge, problem-solving, and experience-based questions
7. Each question should have an appropriate category (e.g., "JavaScript", "React", "Node.js", "Database", "System Design", etc.)

IMPORTANT: You must respond with ONLY valid JSON. Do not include any other text, explanations, or formatting. Start your response directly with { and end with }.

Return ONLY this exact JSON structure:
{
  "questions": [
    {
      "id": "1",
      "text": "Question text here",
      "difficulty": "Easy",
      "timeLimit": 20,
      "category": "Category name"
    },
    {
      "id": "2",
      "text": "Question text here",
      "difficulty": "Easy",
      "timeLimit": 20,
      "category": "Category name"
    },
    {
      "id": "3",
      "text": "Question text here",
      "difficulty": "Medium",
      "timeLimit": 60,
      "category": "Category name"
    },
    {
      "id": "4",
      "text": "Question text here",
      "difficulty": "Medium",
      "timeLimit": 60,
      "category": "Category name"
    },
    {
      "id": "5",
      "text": "Question text here",
      "difficulty": "Hard",
      "timeLimit": 120,
      "category": "Category name"
    },
    {
      "id": "6",
      "text": "Question text here",
      "difficulty": "Hard",
      "timeLimit": 120,
      "category": "Category name"
    }
  ]
}

Make sure the questions are challenging but fair based on the candidate's apparent experience level. Focus on practical application rather than just theoretical knowledge.`;

    try {
      const { text } = await generateText({
        model: this.getOpenRouter().chat(config.model),
        prompt: prompt,
        temperature: 0.7,
      });

      // Try to extract JSON from the response - some models might add extra text
      let jsonText = text.trim();

      // Remove any text before the first { and after the last }
      const startIndex = jsonText.indexOf('{');
      const lastIndex = jsonText.lastIndexOf('}');

      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        jsonText = jsonText.substring(startIndex, lastIndex + 1);
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseError) {
        // If direct parsing fails, try to find JSON within code blocks
        const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error(`Failed to parse JSON response: ${parseError}`);
        }
      }

      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length !== 6) {
        throw new Error('Invalid response format from AI - missing or invalid questions array');
      }

      const questions = parsed.questions.map((q: AIQuestionResponse, index: number) => ({
        id: (index + 1).toString(),
        text: q.text,
        difficulty: q.difficulty as 'Easy' | 'Medium' | 'Hard',
        timeLimit: q.timeLimit,
        category: q.category,
      }));

      // Create chat session with resume text and questions
      const chatSession: AIChatSession = {
        id: sessionId,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: text }
        ],
        resumeText,
        questions,
        createdAt: new Date()
      };

      this.chatSessions.set(sessionId, chatSession);

      return { sessionId, questions };

    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error('Failed to generate personalized questions. Please try again.');
    }
  }

  /**
   * Generate 6 personalized interview questions based on resume text (legacy method for backward compatibility)
   */
  static async generatePersonalizedQuestions(resumeText: string): Promise<AIQuestion[]> {
    const { questions } = await this.createChatSession(resumeText);
    return questions;
  }

  /**
   * Evaluate interview performance using existing chat session
   */
  static async evaluateInterviewWithSession(
    sessionId: string,
    answers: { questionId: string; question: string; answer: string; timeSpent: number; difficulty: string }[]
  ): Promise<{ score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    const config = Config.getAIConfig();

    if (!config.enabled) {
      throw new Error('AI features are disabled. Please enable AI in your configuration.');
    }

    if (!config.apiKey) {
      throw new Error('OpenRouter API key not configured. Please set VITE_OPENROUTER_API_KEY in your environment variables.');
    }

    const session = this.chatSessions.get(sessionId);
    if (!session) {
      throw new Error('Chat session not found. Please restart the interview.');
    }

    const answersText = answers.map((answer, index) =>
      `Question ${index + 1} (${answer.difficulty}, ${answer.timeSpent}s spent):
${answer.question}

Answer:
${answer.answer || '(No answer provided)'}

---`
    ).join('\n\n');

    const evaluationPrompt = `
Based on the interview questions I generated earlier and the candidate's answers provided below, provide a comprehensive evaluation.

Interview Questions and Answers:
${answersText}

Requirements:
Analyze the candidate's performance and provide a detailed evaluation including:
1. An overall numerical score out of 100 (0-100) based on technical knowledge, problem-solving ability, communication skills, and answer quality. Calculate this score based on:
   - Accuracy and depth of technical answers
   - Problem-solving approach demonstrated
   - Communication clarity and completeness
   - Time management relative to question difficulty
   - Overall understanding of concepts
2. A comprehensive summary of the candidate's overall performance (exactly 25 words)
3. Specific strengths demonstrated in the interview
4. Areas for improvement or development
5. Recommendations for the candidate's next steps

IMPORTANT: You must respond with ONLY valid JSON. Do not include any other text, explanations, or formatting. Start your response directly with { and end with }.

Return ONLY this exact JSON structure:
{
  "score": 0,
  "summary": "Brief summary of candidate performance in exactly 25 words.",
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "weaknesses": ["Specific area for improvement 1", "Specific area for improvement 2"],
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"]
}

Scoring Guidelines:
- 90-100: Exceptional performance, deep understanding, excellent communication
- 80-89: Strong performance, solid technical knowledge, good problem-solving
- 70-79: Good performance, adequate knowledge, reasonable problem-solving
- 60-69: Average performance, basic knowledge, needs improvement
- 50-59: Below average, limited understanding, significant gaps
- 0-49: Poor performance, major knowledge gaps, inadequate responses

Calculate the score based on actual answer quality, not as an example. The summary must be exactly 25 words.`;

    try {
      // Continue the conversation in the existing session
      const messages = [
        ...session.messages,
        { role: 'user' as const, content: evaluationPrompt }
      ];

      const { text } = await generateText({
        model: this.getOpenRouter().chat(config.model),
        messages: messages,
        temperature: 0.6,
      });

      // Update session with evaluation message
      session.messages.push(
        { role: 'user', content: evaluationPrompt },
        { role: 'assistant', content: text }
      );

      // Try to extract JSON from the response - some models might add extra text
      let jsonText = text.trim();

      // Remove any text before the first { and after the last }
      const startIndex = jsonText.indexOf('{');
      const lastIndex = jsonText.lastIndexOf('}');

      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        jsonText = jsonText.substring(startIndex, lastIndex + 1);
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(jsonText);
      } catch (parseError) {
        // If direct parsing fails, try to find JSON within code blocks
        const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error(`Failed to parse JSON response: ${parseError}`);
        }
      }

      // Type guard function for detailed evaluation format
      function isDetailedEvaluation(obj: unknown): obj is { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] } {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          typeof (obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).score === 'number' &&
          typeof (obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).summary === 'string' &&
          Array.isArray((obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).strengths) &&
          Array.isArray((obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).weaknesses) &&
          Array.isArray((obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).recommendations)
        );
      }

      if (isDetailedEvaluation(parsedResult)) {
        return parsedResult;
      }

      throw new Error('Invalid response format from AI - missing required fields');

    } catch (error) {
      console.error('Error evaluating interview:', error);
      throw new Error('Failed to evaluate interview. Please try again.');
    }
  }

  /**
   * Evaluate interview for resumed sessions where chat session might be lost
   * This method sends resume text, questions, and answers directly to AI
   */
  static async evaluateInterviewForResumedSession(
    resumeText: string,
    questions: AIQuestion[],
    answers: { questionId: string; question: string; answer: string; timeSpent: number; difficulty: string }[]
  ): Promise<{ score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    const config = Config.getAIConfig();

    if (!config.enabled) {
      throw new Error('AI features are disabled. Please enable AI in your configuration.');
    }

    if (!config.apiKey) {
      throw new Error('OpenRouter API key not configured. Please set VITE_OPENROUTER_API_KEY in your environment variables.');
    }

    const answersText = answers.map((answer, index) =>
      `Question ${index + 1} (${answer.difficulty}, ${answer.timeSpent}s spent):
${answer.question}

Answer:
${answer.answer || '(No answer provided)'}

---`
    ).join('\n\n');

    const questionsText = questions.map((q, index) =>
      `Question ${index + 1}: ${q.text} (${q.difficulty}, ${q.timeLimit}s limit, Category: ${q.category})`
    ).join('\n');

    const prompt = `
You are an expert technical interviewer evaluating a candidate's interview performance. Based on the resume, questions asked, and answers provided, provide a comprehensive evaluation.

Resume Text:
${resumeText}

Questions Asked:
${questionsText}

Interview Answers:
${answersText}

Requirements:
Analyze the candidate's performance and provide a detailed evaluation including:
1. An overall numerical score out of 100 (0-100) based on technical knowledge, problem-solving ability, communication skills, and answer quality. Calculate this score based on:
   - Accuracy and depth of technical answers
   - Problem-solving approach demonstrated
   - Communication clarity and completeness
   - Time management relative to question difficulty
   - Overall understanding of concepts
2. A comprehensive summary of the candidate's overall performance (exactly 25 words)
3. Specific strengths demonstrated in the interview
4. Areas for improvement or development
5. Recommendations for the candidate's next steps

IMPORTANT: You must respond with ONLY valid JSON. Do not include any other text, explanations, or formatting. Start your response directly with { and end with }.

Return ONLY this exact JSON structure:
{
  "score": 0,
  "summary": "Brief summary of candidate performance in exactly 25 words.",
  "strengths": ["Specific strength 1", "Specific strength 2"],
  "weaknesses": ["Specific area for improvement 1", "Specific area for improvement 2"],
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"]
}

Scoring Guidelines:
- 90-100: Exceptional performance, deep understanding, excellent communication
- 80-89: Strong performance, solid technical knowledge, good problem-solving
- 70-79: Good performance, adequate knowledge, reasonable problem-solving
- 60-69: Average performance, basic knowledge, needs improvement
- 50-59: Below average, limited understanding, significant gaps
- 0-49: Poor performance, major knowledge gaps, inadequate responses

Calculate the score based on actual answer quality, not as an example. The summary must be exactly 25 words.`;

    try {
      const { text } = await generateText({
        model: this.getOpenRouter().chat(config.model),
        prompt: prompt,
        temperature: 0.6,
      });

      // Try to extract JSON from the response - some models might add extra text
      let jsonText = text.trim();

      // Remove any text before the first { and after the last }
      const startIndex = jsonText.indexOf('{');
      const lastIndex = jsonText.lastIndexOf('}');

      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        jsonText = jsonText.substring(startIndex, lastIndex + 1);
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(jsonText);
      } catch (parseError) {
        // If direct parsing fails, try to find JSON within code blocks
        const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error(`Failed to parse JSON response: ${parseError}`);
        }
      }

      // Type guard function for detailed evaluation format
      function isDetailedEvaluation(obj: unknown): obj is { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] } {
        return (
          typeof obj === 'object' &&
          obj !== null &&
          typeof (obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).score === 'number' &&
          typeof (obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).summary === 'string' &&
          Array.isArray((obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).strengths) &&
          Array.isArray((obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).weaknesses) &&
          Array.isArray((obj as { score: number; summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }).recommendations)
        );
      }

      if (isDetailedEvaluation(parsedResult)) {
        return parsedResult;
      }

      throw new Error('Invalid response format from AI - missing required fields');

    } catch (error) {
      console.error('Error evaluating interview for resumed session:', error);
      throw new Error('Failed to evaluate interview. Please try again.');
    }
  }

  /**
   * Evaluate interview performance and generate summary (legacy method for backward compatibility)
   */
  static async evaluateInterview(
    resumeText: string,
    _questions: AIQuestion[],
    answers: { questionId: string; question: string; answer: string; timeSpent: number; difficulty: string }[]
  ): Promise<{ summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    // Create a temporary session for backward compatibility
    const { sessionId } = await this.createChatSession(resumeText);
    return this.evaluateInterviewWithSession(sessionId, answers);
  }

  /**
   * Clean up old chat sessions (older than 24 hours)
   */
  static cleanupOldSessions(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    for (const [sessionId, session] of this.chatSessions.entries()) {
      if (session.createdAt.getTime() < cutoffTime) {
        this.chatSessions.delete(sessionId);
      }
    }
  }

  /**
   * Get session info for debugging
   */
  static getSessionInfo(sessionId: string): { exists: boolean; messageCount: number; createdAt: Date } | null {
    const session = this.chatSessions.get(sessionId);
    if (!session) return null;

    return {
      exists: true,
      messageCount: session.messages.length,
      createdAt: session.createdAt
    };
  }

  /**
   * Check if AI service is configured and enabled
   */
  static isConfigured(): boolean {
    const config = Config.getAIConfig();
    return config.enabled && !!config.apiKey;
  }
}
