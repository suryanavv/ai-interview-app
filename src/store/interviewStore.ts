import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { InterviewService, type Candidate, type Answer, type Question } from '@/services'

// Re-export types for backward compatibility
export type { Candidate, Answer, Question }

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
  showFeedbackCompletion: boolean
}

export interface InterviewActions {
  addCandidate: (candidate: Omit<Candidate, 'id' | 'interviewStatus' | 'currentQuestionIndex' | 'answers'>) => string
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
  setShowFeedbackCompletion: (show: boolean) => void
  returnToHome: () => void
  handleResumeInterview: () => void
  handleStartNew: () => void
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
      showFeedbackCompletion: false,

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
        return newCandidate.id
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
        const questions = InterviewService.generateQuestions()
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
        if (!state.isInterviewActive) {
          console.error('Cannot submit answer: interview not active')
          return
        }
        if (!state.currentCandidateId || !state.currentQuestion) {
          console.error('Cannot submit answer: missing currentCandidateId or currentQuestion', {
            currentCandidateId: state.currentCandidateId,
            currentQuestion: state.currentQuestion,
            isInterviewActive: state.isInterviewActive
          })
          return
        }

        const candidate = state.candidates.find(c => c.id === state.currentCandidateId)
        if (!candidate) {
          console.error('Cannot submit answer: candidate not found', state.currentCandidateId)
          return
        }

        const newAnswer: Answer = {
          questionId: state.currentQuestion.id,
          question: state.currentQuestion.text,
          answer,
          timeSpent,
          difficulty: state.currentQuestion.difficulty,
          timestamp: new Date()
        }

        get().updateCandidate(state.currentCandidateId, {
          answers: [...candidate.answers, newAnswer]
        })
      },

      nextQuestion: () => {
        const state = get()
        if (!state.currentCandidateId) return

        const candidate = state.candidates.find(c => c.id === state.currentCandidateId)
        if (!candidate) return

        const questions = InterviewService.generateQuestions()
        const nextIndex = candidate.currentQuestionIndex + 1

        if (nextIndex >= questions.length) {
          // Interview completed - calculate final score and generate summary
          const finalScore = InterviewService.calculateFinalScore(candidate.answers, questions)
          const aiSummary = InterviewService.generateAISummary(candidate, questions, finalScore)
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

        const candidate = state.candidates.find(c => c.id === state.currentCandidateId)
        if (!candidate) {
          console.error('Cannot complete interview: candidate not found', state.currentCandidateId)
          return
        }

        const endTime = new Date()
        const startTime = candidate.startTime

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
          questionStartTime: null,
          showFeedbackCompletion: true
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
          questionStartTime: null,
          showFeedbackCompletion: false
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
        const questions = InterviewService.generateQuestions()
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
        const finalScore = InterviewService.calculateFinalScore(allAnswers, questions)
        const aiSummary = InterviewService.generateAISummary(
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
      },

      setShowFeedbackCompletion: (show) => {
        set({ showFeedbackCompletion: show })
      },

      returnToHome: () => {
        // Reset all interview state
        set({
          isInterviewActive: false,
          currentCandidateId: null,
          currentQuestion: null,
          timeRemaining: 0,
          interviewStartTime: null,
          questionStartTime: null,
          showFeedbackCompletion: false
        })
        
        // Clear session flag
        sessionStorage.removeItem('interview-session-active')
        
        // Dispatch event to reset resume upload
        window.dispatchEvent(new CustomEvent('resetResumeUpload'))
      },

      handleResumeInterview: () => {
        const state = get()
        if (state.unfinishedSession) {
          state.startInterview(state.unfinishedSession.id)
          state.setShowWelcomeBackModal(false)
          state.setUnfinishedSession(null)
        }
      },

      handleStartNew: () => {
        const state = get()
        if (state.unfinishedSession) {
          // Submit the existing pending interview with empty answers first
          state.submitPendingInterviewWithEmptyAnswers(state.unfinishedSession)
        }
        
        state.resetInterview()
        state.setShowWelcomeBackModal(false)
        state.setUnfinishedSession(null)
        // Clear any existing resume data to show fresh upload
        window.dispatchEvent(new CustomEvent('resetResumeUpload'))
      },

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
        questionStartTime: state.questionStartTime,
        showFeedbackCompletion: state.showFeedbackCompletion
      }),
      onRehydrateStorage: () => (state) => {
        // Validate state consistency after rehydration
        if (state && state.currentCandidateId) {
          const candidate = state.candidates?.find(c => c.id === state.currentCandidateId)
          if (!candidate) {
            // Candidate ID exists but candidate not found - reset interview state
            console.warn('State inconsistency detected: currentCandidateId exists but candidate not found. Resetting interview state.')
            state.currentCandidateId = null
            state.isInterviewActive = false
            state.currentQuestion = null
            state.timeRemaining = 0
            state.interviewStartTime = null
            state.questionStartTime = null
            state.showFeedbackCompletion = false
          }
        }
      }
    }
  )
)
