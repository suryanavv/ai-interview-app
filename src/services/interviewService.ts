import { toast } from "sonner"

export interface Candidate {
  id: string
  name: string
  email: string
  phone: string
  resumeFile?: File
  extractedData?: {
    name?: string
    email?: string
    phone?: string
    rawText: string
  }
  interviewStatus: 'not_started' | 'in_progress' | 'completed'
  currentQuestionIndex: number
  answers: Answer[]
  finalScore?: number
  aiSummary?: string
  aiEvaluation?: AIEvaluation
  startTime?: Date
  endTime?: Date
  totalTime?: number
  aiQuestions?: Question[] // Store AI-generated questions for this candidate
  aiSessionId?: string // Store AI chat session ID for evaluation
}

export interface Answer {
  questionId: string
  question: string
  answer: string
  timeSpent: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  score?: number
  timestamp: Date
}

export interface Question {
  id: string
  text: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  timeLimit: number
  category: string
}

export interface AIEvaluation {
  score: number
  summary: string
  feedback: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
}

import { AIService } from './aiService'
import { Config } from '@/lib/config'

export class InterviewService {
  private static withTimeout<T>(promise: Promise<T>, ms: number = Config.getAIConfig().timeout, onTimeout?: () => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        onTimeout?.()
        reject(new Error('timeout'))
      }, ms)
      promise
        .then((value) => {
          clearTimeout(timer)
          resolve(value)
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }
  /**
   * Generate AI-personalized questions based on resume text and return session info
   * Falls back to standard questions if AI fails or no resume text provided
   */
  static async generateQuestionsWithSession(resumeText?: string): Promise<{ questions: Question[], sessionId?: string }> {
    if (resumeText && AIService.isConfigured()) {
      try {
        const { sessionId, questions: aiQuestions } = await this.withTimeout(
          AIService.createChatSession(resumeText),
          20000,
          () => {
            toast.warning("AI timed out", {
              description: "Personalized questions took too long. Falling back to standard questions.",
              duration: 4000
            })
          }
        )
        const questions = aiQuestions.map(q => ({
          id: q.id,
          text: q.text,
          difficulty: q.difficulty,
          timeLimit: q.timeLimit,
          category: q.category
        }))
        return { questions, sessionId }
      } catch (error) {
        console.error('Failed to generate AI personalized questions, falling back to standard questions:', error)
        toast.error("AI Service Error", {
          description: "Unable to generate personalized questions. Using standard interview questions instead.",
          duration: 5000
        })
        // Fall back to standard questions if AI fails
      }
    } else if (resumeText && !AIService.isConfigured()) {
      // Show toast when API key is not configured
      toast.warning("AI Service Unavailable", {
        description: "OpenRouter API key not configured. Using standard interview questions for mock assessment.",
        duration: 5000
      })
    }

    // Fallback to standard questions
    return { questions: this.generateStandardQuestions() }
  }

  /**
   * Generate AI-personalized questions based on resume text
   * Falls back to standard questions if AI fails or no resume text provided
   * @deprecated Use generateQuestionsWithSession for new implementations
   */
  static async generateQuestions(resumeText?: string): Promise<Question[]> {
    const { questions } = await this.generateQuestionsWithSession(resumeText)
    return questions
  }

  /**
   * Generate the standard set of interview questions (fallback)
   */
  static generateStandardQuestions(): Question[] {
    return [
      // Easy Questions (2) - 20 seconds each
      { id: '1', text: 'What is React and what are its main advantages for building user interfaces?', difficulty: 'Easy', timeLimit: 20, category: 'React' },
      { id: '2', text: 'What is Node.js and how does it differ from traditional server-side technologies?', difficulty: 'Easy', timeLimit: 20, category: 'Node.js' },

      // Medium Questions (2) - 60 seconds each
      { id: '3', text: 'Explain the difference between state and props in React. When would you use each?', difficulty: 'Medium', timeLimit: 60, category: 'React' },
      { id: '4', text: 'How would you handle asynchronous operations in Node.js? Explain callbacks, promises, and async/await.', difficulty: 'Medium', timeLimit: 60, category: 'Node.js' },

      // Hard Questions (2) - 120 seconds each
      { id: '5', text: 'Design a real-time chat application using React and Node.js. Explain your architecture, state management, and how you\'d handle WebSocket connections.', difficulty: 'Hard', timeLimit: 120, category: 'Full Stack' },
      { id: '6', text: 'You need to build a scalable e-commerce platform. Describe your tech stack, database design, API architecture, and how you\'d handle high traffic and data consistency.', difficulty: 'Hard', timeLimit: 120, category: 'Full Stack' }
    ]
  }

  /**
   * Calculate final score based on answers and questions
   */
  static calculateFinalScore(answers: Answer[], questions: Question[]): number {
    if (answers.length === 0) return 0

    // Deduplicate answers by questionId to ensure each question is only scored once
    const answerMap = new Map<string, Answer>()
    answers.forEach(answer => {
      if (!answerMap.has(answer.questionId)) {
        answerMap.set(answer.questionId, answer)
      }
    })

    // Get unique answers and sort by question ID to maintain order
    const uniqueAnswers = Array.from(answerMap.values())
      .sort((a, b) => a.questionId.localeCompare(b.questionId))
      .slice(0, 6) // Limit to first 6 questions

    let totalScore = 0
    let maxPossibleScore = 0

    uniqueAnswers.forEach((answer, index) => {
      const question = questions[index]
      if (!question) return

      // Maximum score per question based on difficulty
      const maxScorePerQuestion = question.difficulty === 'Easy' ? 20 : question.difficulty === 'Medium' ? 30 : 50
      maxPossibleScore += maxScorePerQuestion

      // Calculate score based on answer quality
      let questionScore = 0

      if (answer.answer.trim().length > 0) {
        const answerLength = answer.answer.length

        // Base score based on answer length (0-10 points)
        if (answerLength >= 10) questionScore += 2
        if (answerLength >= 50) questionScore += 3
        if (answerLength >= 100) questionScore += 3
        if (answerLength >= 200) questionScore += 2

        // Technical content scoring (0-10 points)
        const technicalKeywords = this.getTechnicalKeywordsForCategory(question.category)
        const keywordMatches = technicalKeywords.filter(keyword =>
          answer.answer.toLowerCase().includes(keyword.toLowerCase())
        ).length

        if (keywordMatches > 0) questionScore += Math.min(5, keywordMatches)
        if (keywordMatches >= 3) questionScore += 5

        // Time management bonus/penalty (0-5 points)
        const timeRatio = answer.timeSpent / question.timeLimit
        if (timeRatio >= 0.8) questionScore += 3 // Used most of allocated time
        else if (timeRatio >= 0.5) questionScore += 1 // Reasonable time usage
        else if (timeRatio < 0.2) questionScore -= 2 // Too rushed
      }

      // Ensure score doesn't exceed maximum for this question
      questionScore = Math.max(0, Math.min(maxScorePerQuestion, questionScore))
      totalScore += questionScore
    })

    // Convert to percentage out of 100
    const finalScore = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0
    return Math.min(100, Math.max(0, finalScore))
  }

  /**
   * Get relevant technical keywords for a given question category
   */
  static getTechnicalKeywordsForCategory(category: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'React': ['react', 'component', 'state', 'props', 'hooks', 'jsx', 'virtual dom', 'lifecycle'],
      'Node.js': ['node', 'express', 'npm', 'server', 'backend', 'api', 'middleware', 'async'],
      'JavaScript': ['javascript', 'es6', 'typescript', 'function', 'variable', 'object', 'array', 'promise'],
      'Database': ['mongodb', 'sql', 'nosql', 'schema', 'query', 'index', 'aggregation', 'orm'],
      'System Design': ['architecture', 'scalability', 'microservices', 'api', 'load balancing', 'caching', 'performance'],
      'Full Stack': ['frontend', 'backend', 'database', 'api', 'deployment', 'docker', 'aws', 'cloud'],
      'Authentication': ['jwt', 'oauth', 'session', 'token', 'security', 'encryption', 'bcrypt', 'passport'],
      'API': ['rest', 'graphql', 'endpoint', 'http', 'json', 'cors', 'middleware', 'routing'],
      'Performance': ['optimization', 'caching', 'lazy loading', 'bundle', 'compression', 'cdn', 'indexing'],
      'Testing': ['unit test', 'integration', 'jest', 'mocha', 'cypress', 'tdd', 'coverage']
    }

    // Find matching category (case-insensitive partial match)
    for (const [key, keywords] of Object.entries(keywordMap)) {
      if (category.toLowerCase().includes(key.toLowerCase())) {
        return keywords
      }
    }

    // Default technical keywords
    return ['react', 'node', 'javascript', 'api', 'database', 'component', 'state', 'props', 'async', 'promise']
  }

  /**
   * Generate AI evaluation and summary based on candidate performance
   */
  static async generateAISummary(candidate: Candidate, questions: Question[]): Promise<{ summary: string; evaluation: AIEvaluation | null }> {
    if (!candidate.extractedData?.rawText || !AIService.isConfigured()) {
      // Fall back to basic summary if no AI available
      if (!AIService.isConfigured()) {
        toast.warning("AI Evaluation Unavailable", {
          description: "OpenRouter API key not configured. Using basic scoring for assessment.",
          duration: 5000
        })
      }
      const fallbackScore = this.calculateFinalScore(candidate.answers, questions)
      return this.generateBasicSummary(candidate, questions, fallbackScore)
    }

    try {
      // Deduplicate answers by questionId and limit to first 6 questions
      const answerMap = new Map<string, Answer>()
      candidate.answers.forEach(answer => {
        if (!answerMap.has(answer.questionId)) {
          answerMap.set(answer.questionId, answer)
        }
      })

      // Get unique answers and sort by question ID to maintain order
      const uniqueAnswers = Array.from(answerMap.values())
        .sort((a, b) => a.questionId.localeCompare(b.questionId))
        .slice(0, 6)

      const answersForAI = uniqueAnswers.map(answer => ({
        questionId: answer.questionId,
        question: answer.question,
        answer: answer.answer,
        timeSpent: answer.timeSpent,
        difficulty: answer.difficulty
      }))

      let aiEvaluation;

      // Use existing chat session if available, otherwise use fallback evaluation for resumed sessions
      if (candidate.aiSessionId && AIService.getSessionInfo(candidate.aiSessionId)?.exists) {
        aiEvaluation = await this.withTimeout(
          AIService.evaluateInterviewWithSession(
            candidate.aiSessionId,
            answersForAI
          ),
          20000,
          () => {
            toast.warning("AI Evaluation Timed Out", {
              description: "Falling back to basic scoring and summary.",
              duration: 4000
            })
          }
        )
      } else {
        aiEvaluation = await this.withTimeout(
          AIService.evaluateInterviewForResumedSession(
            candidate.extractedData.rawText,
            questions,
            answersForAI
          ),
          20000,
          () => {
            toast.warning("AI Evaluation Timed Out", {
              description: "Falling back to basic scoring and summary.",
              duration: 4000
            })
          }
        )
      }

      // Create AI evaluation object with AI-generated score
      const evaluationData = {
        score: aiEvaluation.score,
        summary: aiEvaluation.summary,
        feedback: '',
        strengths: aiEvaluation.strengths,
        weaknesses: aiEvaluation.weaknesses,
        recommendations: aiEvaluation.recommendations
      }

      // Format the comprehensive AI evaluation into a summary string
      let summary = `Interview completed for ${candidate.name}.\n\n`
      summary += `AI Evaluation Score: ${aiEvaluation.score}/100\n\n`
      summary += `Summary:\n${aiEvaluation.summary}\n\n`

      if (aiEvaluation.strengths && aiEvaluation.strengths.length > 0) {
        summary += `Strengths:\n${aiEvaluation.strengths.map(strength => `• ${strength}`).join('\n')}\n\n`
      }

      if (aiEvaluation.weaknesses && aiEvaluation.weaknesses.length > 0) {
        summary += `Areas for Improvement:\n${aiEvaluation.weaknesses.map(weakness => `• ${weakness}`).join('\n')}\n\n`
      }

      if (aiEvaluation.recommendations && aiEvaluation.recommendations.length > 0) {
        summary += `Recommendations:\n${aiEvaluation.recommendations.map(rec => `• ${rec}`).join('\n')}\n\n`
      }

      return {
        summary,
        evaluation: evaluationData
      }

    } catch (error) {
      console.error('Failed to generate AI summary, falling back to basic summary:', error)
      toast.error("AI Evaluation Error", {
        description: "Unable to generate AI-powered evaluation. Using basic scoring instead.",
        duration: 5000
      })
      const fallbackScore = this.calculateFinalScore(candidate.answers, questions)
      return this.generateBasicSummary(candidate, questions, fallbackScore)
    }
  }

  /**
   * Generate basic summary (fallback when AI is not available)
   */
  static generateBasicSummary(candidate: Candidate, questions: Question[], finalScore: number): { summary: string; evaluation: AIEvaluation | null } {
    const totalQuestions = questions.length
    const answeredQuestions = candidate.answers.length
    const completionRate = Math.round((answeredQuestions / totalQuestions) * 100)

    let summary = `Interview completed for ${candidate.name}.\n\n`
    summary += `Overall Score: ${finalScore}/100\n`
    summary += `Questions Answered: ${answeredQuestions}/${totalQuestions} (${completionRate}%)\n\n`

    // Performance analysis
    if (finalScore >= 80) {
      summary += `Excellent performance! The candidate demonstrated strong understanding of full-stack development concepts. `
    } else if (finalScore >= 60) {
      summary += `Good performance with solid knowledge of core concepts. `
    } else if (finalScore >= 40) {
      summary += `Average performance with basic understanding of the technologies. `
    } else if (finalScore === 0) {
      summary += `Interview was abandoned - no answers were provided for the remaining questions. `
    } else {
      summary += `Below average performance with limited knowledge of the required technologies. `
    }

    // Specific feedback based on answers
    const hasDetailedAnswers = candidate.answers.some(answer => answer.answer.length > 100)
    const hasTechnicalKeywords = candidate.answers.some(answer => {
      const keywords = ['react', 'node', 'javascript', 'api', 'database', 'component', 'state', 'props']
      return keywords.some(keyword => answer.answer.toLowerCase().includes(keyword))
    })

    if (hasDetailedAnswers) {
      summary += `The candidate provided detailed and comprehensive answers. `
    }

    if (hasTechnicalKeywords) {
      summary += `Technical terminology was used appropriately throughout the interview. `
    }

    // Time management analysis
    const avgTimePerAnswer = candidate.answers.reduce((sum, answer) => sum + (answer.timeSpent || 0), 0) / candidate.answers.length
    if (avgTimePerAnswer > 0) {
      summary += `Average time per answer: ${Math.round(avgTimePerAnswer)}s. `
    }

    summary += `\n\nRecommendation: ${finalScore >= 70 ? 'Strong candidate for the full-stack developer position.' : finalScore >= 50 ? 'Consider for the position with additional training.' : finalScore === 0 ? 'Interview abandoned - candidate did not complete the assessment.' : 'Not recommended for the position at this time.'}`

    return {
      summary,
      evaluation: null
    }
  }
}
