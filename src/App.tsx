import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntervieweeTab } from "@/components/IntervieweeTab"
import { InterviewerTab } from "@/components/InterviewerTab"
import { Toaster } from "@/components/ui/sonner"
import { useEffect } from "react"
import './App.css'

function App() {
  // Cleanup session flag on unmount
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('interview-session-active')
    }
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-3">
        <div
          className="flex items-center justify-center px-3 py-1 w-full max-w-4xl bg-secondary"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <h1 className="text-sm font-semibold text-center">AI-Powered Interview Assistant (Crisp)</h1>
        </div>
      <main className="container mx-auto px-4 py-2">
        <div className="w-full max-w-4xl mx-auto">
          <Tabs defaultValue="interviewee" className="w-full">
            <TabsList className="grid w-full max-w-4xl mx-auto gap-1 grid-cols-2">
              <TabsTrigger value="interviewee" className="text-sm">Interviewee</TabsTrigger>
              <TabsTrigger value="interviewer" className="text-sm">Interviewer</TabsTrigger>
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

      <Toaster />
    </div>
  )
}

export default App
