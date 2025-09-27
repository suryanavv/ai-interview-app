import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Trash2, Star, Search, Eye, Clock, CheckCircle, XCircle, Pause, Users, TrendingUp, Calendar } from "lucide-react"
import { useState, useMemo } from "react"
import { useInterviewStore } from "@/store/interviewStore"


export function InterviewerTab() {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "score" | "status" | "date">("score")

  const { candidates, deleteCandidate } = useInterviewStore()


  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "bg-chart-2/20 text-chart-2"
      case "Medium": return "bg-chart-4/20 text-chart-4"
      case "Hard": return "bg-destructive/20 text-destructive"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-chart-2" />
      case "in_progress": return <Clock className="h-4 w-4 text-chart-3" />
      case "paused": return <Pause className="h-4 w-4 text-chart-4" />
      default: return <XCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-chart-2/20 text-chart-2"
      case "in_progress": return "bg-chart-3/20 text-chart-3"
      case "paused": return "bg-chart-4/20 text-chart-4"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(candidate => 
        candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        switch (sortBy) {
          case "name":
            return a.name.localeCompare(b.name)
          case "score":
            return (b.finalScore || 0) - (a.finalScore || 0)
          case "status":
            return a.interviewStatus.localeCompare(b.interviewStatus)
          case "date":
            return new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime()
          default:
            return 0
        }
      })
  }, [candidates, searchTerm, sortBy])

  const stats = useMemo(() => {
    const completed = candidates.filter(c => c.interviewStatus === 'completed').length
    const inProgress = candidates.filter(c => c.interviewStatus === 'in_progress').length
    const averageScore = candidates
      .filter(c => c.finalScore !== undefined)
      .reduce((sum, c) => sum + (c.finalScore || 0), 0) / 
      Math.max(candidates.filter(c => c.finalScore !== undefined).length, 1)
    
    return { completed, inProgress, averageScore: Math.round(averageScore) }
  }, [candidates])

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-chart-3/20 rounded-full">
                <Users className="h-6 w-6 text-chart-3" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Candidates</p>
                <p className="text-2xl font-bold text-foreground">{candidates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-chart-2/20 rounded-full">
                <CheckCircle className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-chart-4/20 rounded-full">
                <TrendingUp className="h-6 w-6 text-chart-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold text-foreground">{stats.averageScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Candidates List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Candidates ({filteredCandidates.length})</span>
              </CardTitle>
              <CardDescription>
                View all interview candidates ordered by score
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Sort by Score</SelectItem>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="status">Sort by Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Candidate</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Score</TableHead>
                  <TableHead className="font-semibold hidden sm:table-cell">Duration</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">Date</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((candidate) => (
                  <TableRow key={candidate.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{candidate.name}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">{candidate.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(candidate.interviewStatus)}
                        <Badge className={getStatusColor(candidate.interviewStatus)}>
                          {candidate.interviewStatus.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {candidate.finalScore !== undefined ? (
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 text-chart-4" />
                          <span className="font-medium text-foreground">{candidate.finalScore}/100</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 hidden sm:table-cell">
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{candidate.totalTime ? formatTime(candidate.totalTime) : '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 hidden md:table-cell">
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{candidate.startTime ? new Date(candidate.startTime).toLocaleDateString() : '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </Button>
                          </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{candidate.name} - Interview Details</DialogTitle>
                            <DialogDescription>
                              Complete interview history and evaluation
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-6">
                            {/* Candidate Info */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-medium mb-2">Contact Information</h4>
                                <div className="space-y-1 text-sm">
                                  <p><strong>Name:</strong> {candidate.name}</p>
                                  <p><strong>Email:</strong> {candidate.email}</p>
                                  <p><strong>Phone:</strong> {candidate.phone}</p>
                                </div>
                              </div>
                              <div>
                                <h4 className="font-medium mb-2">Interview Summary</h4>
                                <div className="space-y-1 text-sm">
                                  <p><strong>Status:</strong> {candidate.interviewStatus}</p>
                                  <p><strong>Score:</strong> {candidate.finalScore || 'Pending'}/100</p>
                                  <p><strong>Duration:</strong> {candidate.totalTime ? formatTime(candidate.totalTime) : 'N/A'}</p>
                                </div>
                              </div>
                            </div>

                            {/* Questions and Answers */}
                            <div>
                              <h4 className="font-medium mb-3">Interview Questions & Answers</h4>
                              <div className="space-y-4">
                                {candidate.answers.map((answer, index) => (
                                  <div key={answer.questionId} className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center space-x-2">
                                        <Badge className={getDifficultyColor(answer.difficulty)}>
                                          {answer.difficulty}
                                        </Badge>
                                        <span className="text-sm text-gray-600">Question {index + 1}</span>
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        Time: {formatTime(answer.timeSpent * 1000)}
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <div>
                                        <strong>Question:</strong>
                                        <p className="text-sm mt-1">{answer.question}</p>
                                      </div>
                                      <div>
                                        <strong>Answer:</strong>
                                        <p className="text-sm mt-1 bg-gray-50 p-2 rounded">
                                          {answer.answer}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* AI Summary */}
                            {candidate.aiSummary && (
                              <div>
                                <h4 className="font-medium mb-2">AI Summary</h4>
                                <div className="bg-blue-50 p-3 rounded-lg">
                                  <p className="text-sm">{candidate.aiSummary}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteCandidate(candidate.id)}
                          className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredCandidates.length === 0 && (
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                <Users className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No candidates found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search terms.' : 'Start an interview to see candidates here.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
