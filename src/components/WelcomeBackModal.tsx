import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Play, X } from "lucide-react"
import { type Candidate } from "@/store/interviewStore"

interface WelcomeBackModalProps {
  isOpen: boolean
  onClose: () => void
  candidate: Candidate | null
  onResume: () => void
  onStartNew: () => void
}

export function WelcomeBackModal({ isOpen, onClose, candidate, onResume, onStartNew }: WelcomeBackModalProps) {
  if (!candidate) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress": return "bg-chart-3/20 text-chart-3"
      case "paused": return "bg-chart-4/20 text-chart-4"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-chart-3" />
            <span>Welcome Back!</span>
          </DialogTitle>
          <DialogDescription>
            You have an unfinished interview session. Would you like to resume or start fresh?
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{candidate.name}</CardTitle>
              <Badge className={getStatusColor(candidate.interviewStatus)}>
                {candidate.interviewStatus.replace('_', ' ')}
              </Badge>
            </div>
            <CardDescription>{candidate.email}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Progress:</span>
                <span>{candidate.currentQuestionIndex + 1} / 6 questions</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Spent:</span>
                <span>{candidate.totalTime ? formatTime(candidate.totalTime) : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started:</span>
                <span>{candidate.startTime ? new Date(candidate.startTime).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex space-x-3">
          <Button onClick={onResume} className="flex-1">
            <Play className="h-4 w-4 mr-2" />
            Resume Interview
          </Button>
          <Button variant="outline" onClick={onStartNew} className="flex-1">
            Start New Interview
          </Button>
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
