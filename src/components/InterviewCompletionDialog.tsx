import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, Star, Clock, Trophy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface InterviewCompletionDialogProps {
  isOpen: boolean
  onClose: () => void
  candidate: {
    name: string
    email: string
    finalScore?: number
    totalTime?: number
    answers?: any[]
  } | null
}

export function InterviewCompletionDialog({ isOpen, onClose, candidate }: InterviewCompletionDialogProps) {
  if (!candidate) return null

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getScoreMessage = (score: number) => {
    if (score >= 80) return "Outstanding performance! 🎉"
    if (score >= 60) return "Great job! 👍"
    if (score >= 40) return "Good effort! 💪"
    return "Keep practicing! 📚"
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-chart-2"
    if (score >= 60) return "text-chart-3"
    if (score >= 40) return "text-chart-4"
    return "text-destructive"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-chart-2 to-chart-1 rounded-full flex items-center justify-center">
            <Trophy className="h-10 w-10 text-primary-foreground" />
          </div>
          <DialogTitle className="text-3xl font-bold text-foreground">
            Thank You for Attending the Interview!
          </DialogTitle>
          <DialogDescription className="text-lg text-muted-foreground">
            Your responses have been submitted successfully and are being reviewed by our team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Candidate Info */}
          <Card className="bg-gradient-to-r from-muted/50 to-accent/50 border-border">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold text-foreground">{candidate.name}</h3>
                <p className="text-muted-foreground">{candidate.email}</p>
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          {candidate.finalScore !== undefined && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="mx-auto w-12 h-12 bg-chart-4/20 rounded-full flex items-center justify-center">
                      <Star className="h-6 w-6 text-chart-4" />
                    </div>
                    <div className={`text-3xl font-bold ${getScoreColor(candidate.finalScore)}`}>
                      {candidate.finalScore}/100
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Final Score</div>
                    <div className="text-sm text-muted-foreground/70">
                      {getScoreMessage(candidate.finalScore)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="mx-auto w-12 h-12 bg-chart-3/20 rounded-full flex items-center justify-center">
                      <Clock className="h-6 w-6 text-chart-3" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                      {candidate.totalTime ? formatTime(candidate.totalTime) : 'N/A'}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Total Time</div>
                    <div className="text-sm text-muted-foreground/70">
                      {candidate.answers?.length || 0} questions completed
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Next Steps */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-6">
              <h4 className="font-semibold text-foreground mb-3 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-chart-2" />
                What happens next?
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-chart-3 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Our team will review your responses and evaluation
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-chart-3 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  You'll receive feedback and next steps via email
                </li>
                <li className="flex items-start">
                  <span className="w-2 h-2 bg-chart-3 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                  Results will be available in your candidate dashboard
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Action Button */}
          <div className="text-center">
            <Button 
              onClick={onClose}
              className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
