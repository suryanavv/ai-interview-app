import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  startTime?: Date
  endTime?: Date
  totalTime?: number
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

export interface InterviewState {
  candidates: Candidate[]
  currentCandidateId: string | null
  isInterviewActive: boolean
  currentQuestion: Question | null
  timeRemaining: number
  showWelcomeBackModal: boolean
  unfinishedSession: Candidate | null
  interviewStartTime: number | null
  questionStartTime: number | null
}

export interface InterviewActions {
  addCandidate: (candidate: Omit<Candidate, 'id' | 'interviewStatus' | 'currentQuestionIndex' | 'answers'>) => void
  updateCandidate: (id: string, updates: Partial<Candidate>) => void
  setCurrentCandidate: (id: string | null) => void
  startInterview: (candidateId: string) => void
  submitAnswer: (answer: string, timeSpent: number) => void
  nextQuestion: () => void
  completeInterview: (finalScore: number, aiSummary: string) => void
  resetInterview: () => void
  setShowWelcomeBackModal: (show: boolean) => void
  setUnfinishedSession: (candidate: Candidate | null) => void
  deleteCandidate: (id: string) => void
  tickTimer: () => boolean
  submitPendingInterviewWithEmptyAnswers: (candidate: Candidate) => void
}

const generateQuestions = (): Question[] => [
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

// Calculate final score based on answers and questions
const calculateFinalScore = (answers: Answer[], questions: Question[]): number => {
  if (answers.length === 0) return 0
  
  let totalScore = 0
  let totalWeight = 0
  
  answers.forEach((answer, index) => {
    const question = questions[index]
    if (!question) return
    
    // Weight questions by difficulty
    const weight = question.difficulty === 'Easy' ? 1 : question.difficulty === 'Medium' ? 2 : 3
    totalWeight += weight
    
    // Simple scoring based on answer length and content
    let score = 0
    if (answer.answer.trim().length > 0) {
      score = Math.min(10, Math.floor(answer.answer.length / 10)) // Basic length-based scoring
      
      // Bonus for longer, more detailed answers
      if (answer.answer.length > 50) score += 2
      if (answer.answer.length > 100) score += 3
      if (answer.answer.length > 200) score += 5
      
      // Bonus for technical keywords
      const technicalKeywords = ['react', 'node', 'javascript', 'api', 'database', 'component', 'state', 'props', 'async', 'promise', 'websocket', 'scalable', 'architecture']
      const keywordCount = technicalKeywords.filter(keyword => 
        answer.answer.toLowerCase().includes(keyword)
      ).length
      score += keywordCount
    }
    
    totalScore += score * weight
  })
  
  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) : 0
}

// Generate AI summary based on candidate performance
const generateAISummary = (candidate: Candidate, questions: Question[], finalScore: number): string => {
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
  
  return summary
}

export const useInterviewStore = create<InterviewState & InterviewActions>()(
  persist(
    (set, get) => ({
      // Initial State
      candidates: [],
      currentCandidateId: null,
      isInterviewActive: false,
      currentQuestion: null,
      timeRemaining: 0,
      showWelcomeBackModal: false,
      unfinishedSession: null,
      interviewStartTime: null,
      questionStartTime: null,

      // Actions
      addCandidate: (candidateData) => {
        const newCandidate: Candidate = {
          ...candidateData,
          id: Date.now().toString(),
          interviewStatus: 'not_started',
          currentQuestionIndex: 0,
          answers: []
        }
        set((state) => ({
          candidates: [...state.candidates, newCandidate]
        }))
      },

      updateCandidate: (id, updates) => {
        set((state) => ({
          candidates: state.candidates.map(candidate =>
            candidate.id === id ? { ...candidate, ...updates } : candidate
          )
        }))
      },

      setCurrentCandidate: (id) => {
        set({ currentCandidateId: id })
      },

      startInterview: (candidateId) => {
        const questions = generateQuestions()
        const candidate = get().candidates.find(c => c.id === candidateId)
        if (!candidate) return

        const now = Date.now()
        const questionIndex = candidate.currentQuestionIndex || 0
        const currentQuestion = questions[questionIndex]

        set({
          currentCandidateId: candidateId,
          isInterviewActive: true,
          currentQuestion: currentQuestion,
          timeRemaining: currentQuestion.timeLimit,
          interviewStartTime: now,
          questionStartTime: now
        })

        // Set session flag to indicate active interview
        sessionStorage.setItem('interview-session-active', 'true')

        // Update candidate status
        get().updateCandidate(candidateId, {
          interviewStatus: 'in_progress',
          startTime: new Date()
        })
      },


      submitAnswer: (answer, timeSpent) => {
        const state = get()
        if (!state.currentCandidateId || !state.currentQuestion) return

        const newAnswer: Answer = {
          questionId: state.currentQuestion.id,
          question: state.currentQuestion.text,
          answer,
          timeSpent,
          difficulty: state.currentQuestion.difficulty,
          timestamp: new Date()
        }

        get().updateCandidate(state.currentCandidateId, {
          answers: [...state.candidates.find(c => c.id === state.currentCandidateId)!.answers, newAnswer]
        })
      },

      nextQuestion: () => {
        const state = get()
        if (!state.currentCandidateId) return

        const candidate = state.candidates.find(c => c.id === state.currentCandidateId)
        if (!candidate) return

        const questions = generateQuestions()
        const nextIndex = candidate.currentQuestionIndex + 1

        if (nextIndex >= questions.length) {
          // Interview completed - calculate final score and generate summary
          const finalScore = calculateFinalScore(candidate.answers, questions)
          const aiSummary = generateAISummary(candidate, questions, finalScore)
          get().completeInterview(finalScore, aiSummary)
          return
        }

        const nextQuestion = questions[nextIndex]
        const now = Date.now()
        
        set({
          currentQuestion: nextQuestion,
          timeRemaining: nextQuestion.timeLimit,
          questionStartTime: now
        })

        get().updateCandidate(state.currentCandidateId, {
          currentQuestionIndex: nextIndex
        })
      },

      completeInterview: (finalScore, aiSummary) => {
        const state = get()
        if (!state.currentCandidateId) return

        const endTime = new Date()
        const candidate = state.candidates.find(c => c.id === state.currentCandidateId)
        const startTime = candidate?.startTime

        get().updateCandidate(state.currentCandidateId, {
          interviewStatus: 'completed',
          finalScore,
          aiSummary,
          endTime,
          totalTime: startTime ? endTime.getTime() - (startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime()) : 0
        })

        // Clear session flag when interview is completed
        sessionStorage.removeItem('interview-session-active')

        set({
          isInterviewActive: false,
          currentCandidateId: null,
          currentQuestion: null,
          timeRemaining: 0,
          interviewStartTime: null,
          questionStartTime: null
        })
      },

      resetInterview: () => {
        // Clear session flag when resetting
        sessionStorage.removeItem('interview-session-active')
        
        set({
          isInterviewActive: false,
          currentCandidateId: null,
          currentQuestion: null,
          timeRemaining: 0,
          interviewStartTime: null,
          questionStartTime: null
        })
      },

      setShowWelcomeBackModal: (show) => {
        set({ showWelcomeBackModal: show })
      },

      setUnfinishedSession: (candidate) => {
        set({ unfinishedSession: candidate })
      },

      deleteCandidate: (id) => {
        set((state) => ({
          candidates: state.candidates.filter(candidate => candidate.id !== id)
        }))
      },

      tickTimer: () => {
        const state = get()
        if (state.isInterviewActive && state.questionStartTime && state.currentQuestion) {
          const now = Date.now()
          const elapsed = Math.floor((now - state.questionStartTime) / 1000)
          const remaining = Math.max(0, state.currentQuestion.timeLimit - elapsed)
          
          set({ timeRemaining: remaining })
          
          // Auto-submit when time runs out
          if (remaining <= 0) {
            return true // Indicates time is up
          }
        }
        return false
      },

      submitPendingInterviewWithEmptyAnswers: (candidate) => {
        const questions = generateQuestions()
        const totalQuestions = questions.length
        const currentIndex = candidate.currentQuestionIndex || 0
        
        // Create empty answers for all remaining questions
        const emptyAnswers: Answer[] = []
        
        for (let i = currentIndex; i < totalQuestions; i++) {
          const question = questions[i]
          emptyAnswers.push({
            questionId: question.id,
            question: question.text,
            answer: '', // Empty answer
            timeSpent: 0, // No time spent
            difficulty: question.difficulty,
            timestamp: new Date()
          })
        }
        
        // Update candidate with all answers (existing + empty ones)
        const allAnswers = [...candidate.answers, ...emptyAnswers]
        
        get().updateCandidate(candidate.id, {
          answers: allAnswers,
          currentQuestionIndex: totalQuestions - 1, // Mark as completed
          interviewStatus: 'completed'
        })
        
        // Calculate final score and generate summary
        const finalScore = calculateFinalScore(allAnswers, questions)
        const aiSummary = generateAISummary(
          { ...candidate, answers: allAnswers, currentQuestionIndex: totalQuestions - 1 },
          questions,
          finalScore
        )
        
        // Update with final results
        get().updateCandidate(candidate.id, {
          finalScore,
          aiSummary,
          endTime: new Date(),
          totalTime: candidate.startTime ? 
            new Date().getTime() - (candidate.startTime instanceof Date ? 
              candidate.startTime.getTime() : new Date(candidate.startTime).getTime()) : 0
        })
      }
    }),
    {
      name: 'interview-storage',
      partialize: (state) => ({
        candidates: state.candidates,
        currentCandidateId: state.currentCandidateId,
        isInterviewActive: state.isInterviewActive,
        currentQuestion: state.currentQuestion,
        timeRemaining: state.timeRemaining,
        interviewStartTime: state.interviewStartTime,
        questionStartTime: state.questionStartTime
      })
    }
  )
)
