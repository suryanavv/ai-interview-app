import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntervieweeTab } from "@/components/IntervieweeTab"
import { InterviewerTab } from "@/components/InterviewerTab"
import { WelcomeBackModal } from "@/components/WelcomeBackModal"
import { useInterviewStore } from "@/store/interviewStore"
import { Toaster } from "@/components/ui/sonner"
import { useEffect } from "react"
import './App.css'

function App() {
  const {
    showWelcomeBackModal,
    setShowWelcomeBackModal,
    unfinishedSession,
    setUnfinishedSession,
    candidates,
    startInterview,
    resetInterview,
    isInterviewActive,
    submitPendingInterviewWithEmptyAnswers
  } = useInterviewStore()

  // Check for unfinished sessions only on app load (not during active interview)
  useEffect(() => {
    // Check if this is a page reload (not a state change during active session)
    const isPageReload = !sessionStorage.getItem('interview-session-active')
    
    // Only show modal if there's an unfinished session AND it's a page reload
    const unfinishedCandidate = candidates.find(
      candidate => candidate.interviewStatus === 'in_progress'
    )
    
    if (unfinishedCandidate && isPageReload && !showWelcomeBackModal) {
      setUnfinishedSession(unfinishedCandidate)
      setShowWelcomeBackModal(true)
    }
  }, []) // Only run once on mount

  const handleResumeInterview = () => {
    if (unfinishedSession) {
      startInterview(unfinishedSession.id)
      setShowWelcomeBackModal(false)
      setUnfinishedSession(null)
    }
  }

  const handleStartNew = () => {
    if (unfinishedSession) {
      // Submit the existing pending interview with empty answers first
      submitPendingInterviewWithEmptyAnswers(unfinishedSession)
    }
    
    resetInterview()
    setShowWelcomeBackModal(false)
    setUnfinishedSession(null)
    // Clear any existing resume data to show fresh upload
    window.dispatchEvent(new CustomEvent('resetResumeUpload'))
  }

  const handleCloseModal = () => {
    setShowWelcomeBackModal(false)
    setUnfinishedSession(null)
  }

  // Cleanup session flag on unmount
  useEffect(() => {
    return () => {
      // Only clear if no active interview
      if (!isInterviewActive) {
        sessionStorage.removeItem('interview-session-active')
      }
    }
  }, [isInterviewActive])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-2">
          <h1 className="text-2xl font-bold text-center">Interview AI</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-4">
        <div className="w-full max-w-4xl mx-auto">
          <Tabs defaultValue="interviewee" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="interviewee">Interviewee</TabsTrigger>
              <TabsTrigger value="interviewer">Interviewer</TabsTrigger>
            </TabsList>

            <TabsContent value="interviewee" className="space-y-4">
              <IntervieweeTab />
            </TabsContent>

            <TabsContent value="interviewer" className="space-y-4">
              <InterviewerTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <WelcomeBackModal
        isOpen={showWelcomeBackModal}
        onClose={handleCloseModal}
        candidate={unfinishedSession}
        onResume={handleResumeInterview}
        onStartNew={handleStartNew}
      />
      
      <Toaster />
    </div>
  )
}

export default App
