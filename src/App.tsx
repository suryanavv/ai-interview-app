import {
  Component,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
} from "@/components/ui/animate-tabs"
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
    <div className="min-h-screen bg-background flex flex-col items-center py-2">
      <main className="container mx-auto px-2">
        <div className="w-full space-y-2 mx-auto">
          <div
            className="flex items-center justify-center px-3 py-2 w-full bg-secondary"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <h1 className="text-sm font-semibold text-center">AI-Powered Interview Assistant (Crisp)</h1>
          </div>
          <Component defaultValue="interviewee" className="w-full bg-muted rounded-lg">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="interviewee" className="text-sm cursor-pointer">Interviewee</TabsTrigger>
              <TabsTrigger value="interviewer" className="text-sm cursor-pointer">Interviewer</TabsTrigger>
            </TabsList>

            <TabsContents className="mx-1 mb-1 -mt-2 rounded-sm h-full bg-background">
              <TabsContent value="interviewee" className="space-y-4 p-6">
                <IntervieweeTab />
              </TabsContent>

              <TabsContent value="interviewer" className="space-y-4 p-6">
                <InterviewerTab />
              </TabsContent>
            </TabsContents>
          </Component>
        </div>
      </main>

      <Toaster />
    </div>
  )
}

export default App
