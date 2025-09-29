import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { InterviewService, type Candidate, type Answer, type Question, type AIEvaluation } from '@/services'

// Re-export types for backward compatibility
export type { Candidate, Answer, Question, AIEvaluation }

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
  lastCompletedCandidateId: string | null
  isSubmittingAnswer: boolean
  isStartingInterview: boolean
  isTransitioningQuestions: boolean
}

export interface InterviewActions {
  addCandidate: (candidate: Omit<Candidate, 'id' | 'interviewStatus' | 'currentQuestionIndex' | 'answers'>) => string
  updateCandidate: (id: string, updates: Partial<Candidate>) => void
  setCurrentCandidate: (id: string | null) => void
  startInterview: (candidateId: string, isResuming?: boolean) => Promise<void>
  submitAnswer: (answer: string, timeSpent: number) => void
  nextQuestion: () => Promise<void>
  completeInterview: (finalScore: number, aiResult: { summary: string; evaluation: AIEvaluation | null }) => void
  resetInterview: () => void
  startQuestionTimer: () => void
  setShowWelcomeBackModal: (show: boolean) => void
  setUnfinishedSession: (candidate: Candidate | null) => void
  deleteCandidate: (id: string) => void
  tickTimer: () => boolean
  submitPendingInterviewWithEmptyAnswers: (candidate: Candidate) => void
  setShowFeedbackCompletion: (show: boolean) => void
  returnToHome: () => void
  handleResumeInterview: () => Promise<void>
  handleStartNew: () => void
  setIsSubmittingAnswer: (isSubmitting: boolean) => void
  setIsStartingInterview: (isStarting: boolean) => void
  setIsTransitioningQuestions: (isTransitioning: boolean) => void
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
      lastCompletedCandidateId: null,
      isSubmittingAnswer: false,
      isStartingInterview: false,
      isTransitioningQuestions: false,

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

      startInterview: async (candidateId, isResuming = false) => {
        const candidate = get().candidates.find(c => c.id === candidateId)
        if (!candidate) return

        let questions: Question[]
        let sessionId: string | undefined

        // Check if this is a resumed interview with existing questions
        if (isResuming && candidate.aiQuestions && candidate.aiQuestions.length > 0) {
          // Use existing questions for resumed interviews - don't call AI again
          questions = candidate.aiQuestions
          sessionId = candidate.aiSessionId
        } else {
          // Generate AI questions for fresh interviews
          const resumeText = candidate.extractedData?.rawText
          const result = await InterviewService.generateQuestionsWithSession(resumeText)
          questions = result.questions
          sessionId = result.sessionId

          // Store AI-generated questions and session ID with the candidate
          const updates: Partial<Candidate> = {
            aiQuestions: questions
          }

          if (sessionId) {
            updates.aiSessionId = sessionId
          }

          get().updateCandidate(candidateId, updates)
        }

        const now = Date.now()
        const questionIndex = candidate.currentQuestionIndex || 0
        const currentQuestion = questions[questionIndex]

        // If resuming, use previously saved remaining time; otherwise start fresh
        const prevRemaining = isResuming ? get().timeRemaining : null
        const initialRemaining = prevRemaining && prevRemaining > 0 && prevRemaining <= currentQuestion.timeLimit
          ? prevRemaining
          : currentQuestion.timeLimit

        set({
          currentCandidateId: candidateId,
          isInterviewActive: true,
          currentQuestion: currentQuestion,
          timeRemaining: initialRemaining,
          interviewStartTime: now,
          // Delay questionStartTime until UI signals it's displayed
          questionStartTime: null
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

        // Prevent duplicate answers for the same question
        const existingAnswerIndex = candidate.answers.findIndex(a => a.questionId === state.currentQuestion!.id)
        const updatedAnswers = [...candidate.answers]

        if (existingAnswerIndex >= 0) {
          // Update existing answer
          updatedAnswers[existingAnswerIndex] = newAnswer
        } else {
          // Add new answer
          updatedAnswers.push(newAnswer)
        }

        get().updateCandidate(state.currentCandidateId, {
          answers: updatedAnswers
        })
      },

      nextQuestion: async () => {
        const state = get()
        if (!state.currentCandidateId) return

        const candidate = state.candidates.find(c => c.id === state.currentCandidateId)
        if (!candidate) return

        // Use stored AI questions or generate standard questions as fallback
        const questions = candidate.aiQuestions || await InterviewService.generateQuestions()
        const nextIndex = candidate.currentQuestionIndex + 1

        if (nextIndex >= questions.length) {
          // Interview completed - generate AI summary with AI-generated score
          const aiResult = await InterviewService.generateAISummary(candidate, questions)
          const finalScore = aiResult.evaluation?.score ?? InterviewService.calculateFinalScore(candidate.answers, questions)
          get().completeInterview(finalScore, aiResult)
          return
        }

        const nextQuestion = questions[nextIndex]

        set({
          currentQuestion: nextQuestion,
          timeRemaining: nextQuestion.timeLimit,
          // Defer starting timer until UI confirms render
          questionStartTime: null
        })

        get().updateCandidate(state.currentCandidateId, {
          currentQuestionIndex: nextIndex
        })
      },

      startQuestionTimer: () => {
        const state = get()
        if (!state.currentQuestion) return
        const now = Date.now()
        // Adjust start time so remaining time continues from stored value
        const timeLimit = state.currentQuestion.timeLimit
        const remaining = Math.min(Math.max(state.timeRemaining || timeLimit, 0), timeLimit)
        const secondsAlreadyUsed = timeLimit - remaining
        const adjustedStart = now - secondsAlreadyUsed * 1000
        set({ questionStartTime: adjustedStart })
      },

      completeInterview: (finalScore, aiResult) => {
        const state = get()
        if (!state.currentCandidateId) return

        const candidate = state.candidates.find(c => c.id === state.currentCandidateId)
        if (!candidate) {
          console.error('Cannot complete interview: candidate not found', state.currentCandidateId)
          return
        }

        const endTime = new Date()
        const startTime = candidate.startTime

        const updateData: Partial<Candidate> = {
          interviewStatus: 'completed',
          finalScore,
          aiSummary: aiResult.summary,
          endTime,
          totalTime: startTime ? endTime.getTime() - (startTime instanceof Date ? startTime.getTime() : new Date(startTime).getTime()) : 0
        }

        // Only set aiEvaluation if it exists (not null)
        if (aiResult.evaluation) {
          updateData.aiEvaluation = aiResult.evaluation
        }

        get().updateCandidate(state.currentCandidateId, updateData)

        // Clear session flag when interview is completed
        sessionStorage.removeItem('interview-session-active')

        set({
          isInterviewActive: false,
          currentCandidateId: null,
          currentQuestion: null,
          timeRemaining: 0,
          interviewStartTime: null,
          questionStartTime: null,
          showFeedbackCompletion: true,
          lastCompletedCandidateId: state.currentCandidateId
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
          showFeedbackCompletion: false,
          lastCompletedCandidateId: null
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

          // Only update state if time remaining has actually changed
          if (remaining !== state.timeRemaining) {
            set({ timeRemaining: remaining })
          }

          // Auto-submit when time runs out
          if (remaining <= 0) {
            return true // Indicates time is up
          }
        }
        return false
      },

      submitPendingInterviewWithEmptyAnswers: async (candidate) => {
        const questions = candidate.aiQuestions || await InterviewService.generateQuestions()
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
        const updatedCandidate = { ...candidate, answers: allAnswers, currentQuestionIndex: totalQuestions - 1 }

        get().updateCandidate(candidate.id, {
          answers: allAnswers,
          currentQuestionIndex: totalQuestions - 1, // Mark as completed
          interviewStatus: 'completed'
        })

        // Generate AI summary with AI-generated score
        const aiResult = await InterviewService.generateAISummary(updatedCandidate, questions)
        const finalScore = aiResult.evaluation?.score ?? InterviewService.calculateFinalScore(updatedCandidate.answers, questions)

        // Update with final results
        const updateData: Partial<Candidate> = {
          finalScore,
          aiSummary: aiResult.summary,
          endTime: new Date(),
          totalTime: candidate.startTime ?
            new Date().getTime() - (candidate.startTime instanceof Date ?
              candidate.startTime.getTime() : new Date(candidate.startTime).getTime()) : 0
        }

        // Only set aiEvaluation if it exists (not null)
        if (aiResult.evaluation) {
          updateData.aiEvaluation = aiResult.evaluation
        }

        get().updateCandidate(candidate.id, updateData)
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
          showFeedbackCompletion: false,
          lastCompletedCandidateId: null
        })

        // Clear session flag
        sessionStorage.removeItem('interview-session-active')

        // Dispatch event to reset resume upload
        window.dispatchEvent(new CustomEvent('resetResumeUpload'))
      },

      handleResumeInterview: async () => {
        const state = get()
        if (state.unfinishedSession) {
          await get().startInterview(state.unfinishedSession.id, true) // Pass true for isResuming
          get().setShowWelcomeBackModal(false)
          get().setUnfinishedSession(null)
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

      setIsSubmittingAnswer: (isSubmitting) => {
        set({ isSubmittingAnswer: isSubmitting })
      },

      setIsStartingInterview: (isStarting) => {
        set({ isStartingInterview: isStarting })
      },

      setIsTransitioningQuestions: (isTransitioning) => {
        set({ isTransitioningQuestions: isTransitioning })
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
        showFeedbackCompletion: state.showFeedbackCompletion,
        lastCompletedCandidateId: state.lastCompletedCandidateId
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

