import {
  Component,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
} from "@/components/ui/animate-tabs"
import { Toaster } from "@/components/ui/sonner"
import { useEffect, memo, useCallback, Suspense, lazy } from "react"
import { useInterviewStore } from "@/store/interviewStore"
import { AIService } from "@/services/aiService"
import './App.css'

// Lazy load heavy components
const IntervieweeTab = lazy(() => import("@/components/IntervieweeTab").then(module => ({ default: module.IntervieweeTab })))
const InterviewerTab = lazy(() => import("@/components/InterviewerTab").then(module => ({ default: module.InterviewerTab })))

// Memoize the loading overlay component
const LoadingOverlay = memo(({ isSubmittingAnswer, isStartingInterview, isTransitioningQuestions }: {
  isSubmittingAnswer: boolean;
  isStartingInterview: boolean;
  isTransitioningQuestions: boolean;
}) => {
  if (!isSubmittingAnswer && !isStartingInterview && !isTransitioningQuestions) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-background border rounded-lg p-6 shadow-lg flex flex-col items-center gap-4 max-w-sm mx-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">
            {isTransitioningQuestions ? "Submitting Your Answer..." :
             isSubmittingAnswer ? "Submitting All Answers..." : "Starting Interview..."}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isTransitioningQuestions ? "Saving your response" :
             isSubmittingAnswer ? "Please wait while we are analysing the result." :
             "Please wait while we prepare your personalized assessment."
            }
          </p>
        </div>
      </div>
    </div>
  );
});

LoadingOverlay.displayName = 'LoadingOverlay';

const App = memo(() => {
  const {
    isSubmittingAnswer,
    isStartingInterview,
    isTransitioningQuestions
  } = useInterviewStore()

  const isAnyLoading = isSubmittingAnswer || isStartingInterview || isTransitioningQuestions

  // Cleanup function for AI sessions
  const cleanupAISessions = useCallback(() => {
    try {
      AIService.cleanupOldSessions()
    } catch (error) {
      console.warn('Failed to cleanup AI sessions:', error)
    }
  }, [])

  // Cleanup session flag on unmount
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('interview-session-active')
    }
  }, [])

  // Cleanup old AI chat sessions periodically
  useEffect(() => {
    // Run cleanup immediately and then every hour
    cleanupAISessions()
    const interval = setInterval(cleanupAISessions, 60 * 60 * 1000) // 1 hour

    return () => clearInterval(interval)
  }, [cleanupAISessions])

  return (
    <div className={`min-h-screen max-h-screen bg-background flex flex-col p-2 sm:p-2 gap-1 sm:gap-2 overflow-hidden ${isAnyLoading ? 'pointer-events-none' : ''}`}>
      {/* Header - Fixed height */}
      <header className="flex-shrink-0">
        <div
          className="flex items-center justify-center py-1.5 w-full bg-secondary rounded-md sm:rounded-lg"
        >
          <h1 className="text-sm sm:text-lg font-semibold text-center px-1">Crisp - An AI Powered Interview Assistant</h1>
        </div>
      </header>

      {/* Main content - Takes remaining height */}
      <main className="flex-1 flex flex-col min-h-0">
        <Component defaultValue="interviewee" className="w-full bg-muted rounded-md sm:rounded-lg flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tabs triggers - Fixed height */}
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="interviewee" className="text-xs sm:text-sm cursor-pointer px-2 sm:px-4">Interviewee</TabsTrigger>
            <TabsTrigger value="interviewer" className="text-xs sm:text-sm cursor-pointer px-2 sm:px-4">Interviewer</TabsTrigger>
          </TabsList>

          {/* Tabs content - Takes remaining height with proper overflow */}
          <TabsContents className="flex-1 min-h-0 mx-0.5 sm:mx-1 mb-0.5 sm:mb-1 -mt-0.5 sm:-mt-1 rounded-sm bg-background overflow-hidden">
            <TabsContent value="interviewee" className="h-full">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }>
                <IntervieweeTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="interviewer" className="h-full">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              }>
                <InterviewerTab />
              </Suspense>
            </TabsContent>
          </TabsContents>
        </Component>
      </main>

      <Toaster />

      <LoadingOverlay
        isSubmittingAnswer={isSubmittingAnswer}
        isStartingInterview={isStartingInterview}
        isTransitioningQuestions={isTransitioningQuestions}
      />
    </div>
  )
})

App.displayName = 'App'

export default App