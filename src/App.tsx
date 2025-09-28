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
    <div className="min-h-screen max-h-screen bg-background flex flex-col p-2 sm:p-2 gap-1 sm:gap-2 overflow-hidden">
      {/* Header - Fixed height */}
      <header className="flex-shrink-0">
        <div
          className="flex items-center justify-center py-3 w-full bg-secondary rounded-md sm:rounded-lg"
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
              <IntervieweeTab />
            </TabsContent>

            <TabsContent value="interviewer" className="h-full">
              <InterviewerTab />
            </TabsContent>
          </TabsContents>
        </Component>
      </main>

      <Toaster />
    </div>
  )
}

export default App