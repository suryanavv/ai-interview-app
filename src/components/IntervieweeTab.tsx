import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, CheckCircle, Clock, Send, User, Mail, Phone, AlertCircleIcon, XIcon, Play } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useInterviewStore } from "@/store/interviewStore"
import { toast } from "sonner"
import { useFileUpload } from "@/hooks/use-file-upload"
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Configure PDF.js worker - use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

interface ExtractedData {
  name?: string
  email?: string
  phone?: string
  rawText: string
}

interface MissingFields {
  name: boolean
  email: boolean
  phone: boolean
}

export function IntervieweeTab() {
  const maxSizeMB = 5
  const maxSize = maxSizeMB * 1024 * 1024 // 5MB default

  const {
    files,
    isDragging,
    errors,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFileDialog,
    removeFile: removeFileFromHook,
    getInputProps,
  } = useFileUpload({
    accept: ".pdf,.docx",
    maxSize,
  })

  const resumeFile = files[0]?.file || null
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [missingFields, setMissingFields] = useState<MissingFields>({
    name: true,
    email: true,
    phone: true
  })
  const [collectedData, setCollectedData] = useState<Partial<ExtractedData>>({})
  const [canStartInterview, setCanStartInterview] = useState(false)
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [showResetMessage, setShowResetMessage] = useState(false)

  const {
    currentCandidateId,
    isInterviewActive,
    currentQuestion,
    timeRemaining,
    candidates,
    addCandidate,
    startInterview,
    submitAnswer,
    nextQuestion,
    tickTimer,
    resetInterview,
    showFeedbackCompletion,
    returnToHome,
    showWelcomeBackModal,
    unfinishedSession,
    setUnfinishedSession,
    setShowWelcomeBackModal,
    handleResumeInterview,
    handleStartNew,
  } = useInterviewStore()


  const currentCandidate = candidates.find(c => c.id === currentCandidateId)

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
    let fullText = ""

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += pageText + '\n'
    }

    // Console log for testing
    console.log('=== PDF PARSED TEXT ===')
    console.log('File:', file.name)
    console.log('Pages:', pdf.numPages)
    console.log('Text:', fullText)
    console.log('=== END PDF TEXT ===')

    return fullText
  }

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })

    // Console log for testing
    console.log('=== DOCX PARSED TEXT ===')
    console.log('File:', file.name)
    console.log('Text:', result.value)
    console.log('=== END DOCX TEXT ===')

    return result.value
  }

  const extractFields = (text: string): ExtractedData => {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g

    const emails = text.match(emailRegex) || []
    const phones = text.match(phoneRegex) || []

    // Simple name extraction - look for common patterns
    const lines = text.split('\n').filter(line => line.trim().length > 0)
    let name = ""

    // Look for name in first few lines (common resume format)
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].trim()
      if (line.length > 2 && line.length < 50 && !line.includes('@') && !line.match(phoneRegex)) {
        // Check if it looks like a name (contains letters and possibly spaces)
        if (/^[A-Za-z\s\.]+$/.test(line)) {
          name = line
          break
        }
      }
    }

    const extractedData = {
      name: name || undefined,
      email: emails[0] || undefined,
      phone: phones[0] || undefined,
      rawText: text
    }

    // Console log for testing
    console.log('=== EXTRACTED FIELDS ===')
    console.log('Name:', extractedData.name)
    console.log('Email:', extractedData.email)
    console.log('Phone:', extractedData.phone)
    console.log('All emails found:', emails)
    console.log('All phones found:', phones)
    console.log('=== END EXTRACTED FIELDS ===')

    return extractedData
  }

  const handleFileUpload = async (file: File) => {
    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast.error("File too large", {
        description: "Please upload a file smaller than 5MB."
      })
      return
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type", {
        description: "Please upload only PDF or DOCX files."
      })
      return
    }

    // Validate file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !['pdf', 'docx'].includes(fileExtension)) {
      toast.error("Invalid file extension", {
        description: "Please upload only PDF or DOCX files."
      })
      return
    }

    setIsProcessing(true)

    try {
      let text = ""

      if (file.type === "application/pdf") {
        text = await extractTextFromPDF(file)
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        text = await extractTextFromDOCX(file)
      } else {
        throw new Error("Unsupported file type")
      }

      const extracted = extractFields(text)
      setExtractedData(extracted)

      // Check which fields are missing
      const missing = {
        name: !extracted.name,
        email: !extracted.email,
        phone: !extracted.phone
      }
      setMissingFields(missing)

      // Show success message
      toast.success("AI Resume Analysis Complete", {
        description: `Successfully extracted profile information. ${Object.values(missing).filter(Boolean).length} additional details needed.`
      })

      // Check if all fields are available (either extracted or can be filled manually)
      setCanStartInterview(true)
      toast.success("Ready for AI Assessment", {
        description: "Profile information extracted."
      })

    } catch (error) {
      console.error("Error processing file:", error)
      toast.error("Processing failed", {
        description: "Unable to process the file. Please ensure it's a valid PDF or DOCX and try again."
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveFile = () => {
    if (files[0]?.id) {
      removeFileFromHook(files[0].id)
    }
    setExtractedData(null)
    setMissingFields({ name: true, email: true, phone: true })
    setCanStartInterview(false)
    setCollectedData({})
  }


  const getFieldStatus = (field: keyof MissingFields) => {
    if (extractedData?.[field]) {
      return { status: 'extracted', value: extractedData[field] }
    } else if (collectedData[field]) {
      return { status: 'collected', value: collectedData[field] }
    } else {
      return { status: 'missing', value: null }
    }
  }

  // Timer effect - handles countdown and auto-submission
  useEffect(() => {
    let interval: number | null = null

    if (isInterviewActive) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1)

        // Use store's tickTimer method
        const timeUp = tickTimer()

        if (timeUp) {
          // Time's up - auto-submit answer if there's one
          if (currentAnswer.trim()) {
            // Submit the current answer and move to next question
            submitAnswer(currentAnswer, timeElapsed)
            setCurrentAnswer("")
            setTimeElapsed(0)
            nextQuestion()
          } else {
            // No answer provided - submit empty answer and move to next question
            submitAnswer("", 0) // 0 score for no answer
            nextQuestion()
          }
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isInterviewActive, currentAnswer, tickTimer, submitAnswer, nextQuestion])

  // Auto-process file when uploaded
  useEffect(() => {
    if (resumeFile && !extractedData && !isProcessing) {
      handleFileUpload(resumeFile)
    }
  }, [resumeFile, extractedData, isProcessing])

  // Check if all required fields are filled
  useEffect(() => {
    if (extractedData || Object.keys(collectedData).length > 0) {
      const hasName = extractedData?.name || collectedData.name
      const hasEmail = extractedData?.email || collectedData.email
      const hasPhone = extractedData?.phone || collectedData.phone

      if (hasName && hasEmail && hasPhone) {
        setCanStartInterview(true)
      } else {
        setCanStartInterview(false)
      }
    }
  }, [extractedData, collectedData])

  // Listen for reset resume upload event
  useEffect(() => {
    const handleResetResumeUpload = () => {
      if (files[0]?.id) {
        removeFileFromHook(files[0].id)
      }
      setExtractedData(null)
      setMissingFields({ name: true, email: true, phone: true })
      setCanStartInterview(false)
      setCollectedData({})
      setCurrentAnswer("")
      setTimeElapsed(0)

      // Show reset message briefly
      setShowResetMessage(true)
      setTimeout(() => setShowResetMessage(false), 3000)
    }

    window.addEventListener('resetResumeUpload', handleResetResumeUpload)

    return () => {
      window.removeEventListener('resetResumeUpload', handleResetResumeUpload)
    }
  }, [files, removeFileFromHook])


  useEffect(() => {
    const { candidates } = useInterviewStore.getState()
    const unfinished = candidates.find(c => c.interviewStatus === 'in_progress')
    
    // Check if this is a page reload (not an active session)
    const isPageReload = !sessionStorage.getItem('interview-session-active')
    
    if (unfinished && isPageReload) {
      setUnfinishedSession(unfinished)
      setShowWelcomeBackModal(true)
    }
  }, []) // Run on mount



  const handleStartInterview = () => {
    if (!extractedData && !collectedData.name) return

    const candidateData = {
      name: extractedData?.name || collectedData.name || '',
      email: extractedData?.email || collectedData.email || '',
      phone: extractedData?.phone || collectedData.phone || '',
      extractedData: extractedData || undefined
    }

    // Debug logging
    console.log('=== STARTING INTERVIEW ===')
    console.log('Extracted Data:', extractedData)
    console.log('Collected Data:', collectedData)
    console.log('Final Candidate Data:', candidateData)

    // Reset any existing interview state first
    resetInterview()

    // Clear local state to ensure fresh start
    setCurrentAnswer("")
    setTimeElapsed(0)

    // Add the new candidate
    addCandidate(candidateData)

    // Use a timeout to ensure the candidate is added before starting interview
    setTimeout(() => {
      const allCandidates = useInterviewStore.getState().candidates
      const newCandidate = allCandidates[allCandidates.length - 1]
      console.log('All candidates:', allCandidates)
      console.log('New candidate:', newCandidate)

      if (newCandidate) {
        console.log('Starting interview for candidate:', newCandidate.name, newCandidate.email)
        startInterview(newCandidate.id)
      }
    }, 100)
  }

  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim()) return

    const timeSpent = timeElapsed
    submitAnswer(currentAnswer, timeSpent)
    setCurrentAnswer("")
    setTimeElapsed(0)
    nextQuestion()
  }


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Uses three different colors for each difficulty
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        // Green = Success = Easy
        return "bg-green-100 text-green-800 border-green-200"
      case "Medium":
        // Yellow = Warning = Medium
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Hard":
        // Red = Danger = Hard
        return "bg-red-100 text-red-800 border-red-200"
      default:
        // Uses muted for unknown
        return "bg-muted text-muted-foreground"
    }
  }

  // If feedback completion is shown, display the completion screen
  if (showFeedbackCompletion) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Thank You!</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Thanks for attending the interview. Your responses have been recorded and will be reviewed by our team.
            </p>
          </div>

          <Button
            onClick={returnToHome}
            size="sm"
            className="px-6 cursor-pointer"
          >
            Return to Home
          </Button>
        </div>
      </div>
    )
  }

  // Welcome Back Modal
  if (showWelcomeBackModal && unfinishedSession) {
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
      <Dialog open={showWelcomeBackModal} onOpenChange={() => {}}>
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

          <div className="border rounded-lg p-4">
            <div className="pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{unfinishedSession.name}</h3>
                <Badge className={getStatusColor(unfinishedSession.interviewStatus)}>
                  {unfinishedSession.interviewStatus.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{unfinishedSession.email}</p>
            </div>
            <div className="pt-0">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress:</span>
                  <span>{unfinishedSession.currentQuestionIndex + 1} / 6 questions</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time Spent:</span>
                  <span>{unfinishedSession.totalTime ? formatTime(unfinishedSession.totalTime) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started:</span>
                  <span>{unfinishedSession.startTime ? new Date(unfinishedSession.startTime).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleResumeInterview} size="sm" className="flex-1 cursor-pointer">
              <Play className="h-3 w-3 mr-1" />
              Resume Interview
            </Button>
            <Button variant="outline" onClick={handleStartNew} size="sm" className="flex-1 cursor-pointer">
              Start New Interview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // If interview is active, only show the interview UI
  if (isInterviewActive && currentQuestion) {
    // Get the most recent candidate to ensure we're showing the correct data
    const mostRecentCandidate = candidates[candidates.length - 1]
    const displayCandidate = mostRecentCandidate || currentCandidate

    return (
      <>
        <div className="w-full mx-auto">
          <div className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-1 sm:space-y-0">
              <div>
                <h2 className="text-base font-semibold">AI Interview Assessment</h2>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>
                  {displayCandidate?.name
                    ?.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </span>
                <span>•</span>
                <span>{displayCandidate?.email}</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">

            {/* Question Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  Question {(displayCandidate?.currentQuestionIndex || 0) + 1} of 6
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${getDifficultyColor(currentQuestion.difficulty)}`}>
                      {currentQuestion.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">{currentQuestion.category}</Badge>
                  </div>
                </h3>
                {/* Timer Section */}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-mono font-semibold">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
              <p className="text-sm leading-relaxed">{currentQuestion.text}</p>

              {/* Answer Section */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Your Answer</Label>
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={14}
                  className="min-h-[350px] resize-y text-sm"
                  style={{ minHeight: 250, maxHeight: 600 }}
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    {currentAnswer.length} characters
                  </span>
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!currentAnswer.trim()}
                    size="sm"
                    className="cursor-pointer"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Submit Answer
                  </Button>
                </div>
              </div>
            </div>

            {/* Progress Section */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground text-center">
                {6 - (displayCandidate?.currentQuestionIndex || 0) - 1} questions remaining
              </div>
            </div>
          </div>
        </div>

      </>
    )
  }


  // Default view - Resume upload and setup
  return (
    <>
      <div className="w-full mx-auto">
        <div className="space-y-4">
          {/* Reset Message */}
          {showResetMessage && (
            <Alert className="py-2">
              <CheckCircle className="h-3 w-3" />
              <AlertDescription className="text-sm">
                Resume upload has been reset. Please upload a new resume.
              </AlertDescription>
            </Alert>
          )}

          {/* Resume Upload Section */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-lg font-semibold">Smart Resume Analysis</Label>
              <p className="text-xs text-muted-foreground">
                Upload your resume for AI-powered information extraction and personalized interview preparation
              </p>
            </div>

            <div className="flex flex-col gap-2 items-center">
              <div className="relative w-full mx-auto">
                {/* Drop area */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  data-dragging={isDragging || undefined}
                  className="border-input hover:bg-accent/40 data-[dragging=true]:bg-accent/40 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 has-disabled:pointer-events-none has-disabled:opacity-50 has-[img]:border-none has-[input:focus]:ring-[3px] relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-3 transition-colors"
                >
                  <input
                    {...getInputProps()}
                    className="sr-only"
                    aria-label="Upload resume"
                  />
                  {resumeFile ? (
                    <div className="flex flex-col items-center justify-center px-4 py-2 text-center">
                      <div
                        className="bg-background mb-2 flex size-9 shrink-0 items-center justify-center rounded-full border"
                        aria-hidden="true"
                      >
                        <FileText className="size-4 opacity-60" />
                      </div>
                      <p className="mb-1 text-xs font-medium">
                        {resumeFile.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Ready to process
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-3 py-2 text-center">
                      <div
                        className="bg-background mb-1 flex size-8 shrink-0 items-center justify-center rounded-full border"
                        aria-hidden="true"
                      >
                        <Upload className="size-3 opacity-60" />
                      </div>
                      <p className="mb-1 text-xs font-medium">
                        Drop your resume here
                      </p>
                      <p className="text-muted-foreground text-xs">
                        PDF, DOCX supported • Max {maxSizeMB}MB • AI-powered analysis
                      </p>
                      <button
                        type="button"
                        className="mt-2 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                        onClick={openFileDialog}
                      >
                        Choose File
                      </button>
                    </div>
                  )}
                </div>
                {resumeFile && (
                  <div className="absolute top-4 right-4">
                    <button
                      type="button"
                      className="focus-visible:border-ring focus-visible:ring-ring/50 z-50 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-[color,box-shadow] outline-none hover:bg-black/80 focus-visible:ring-[3px] cursor-pointer"
                      onClick={handleRemoveFile}
                      aria-label="Remove resume"
                    >
                      <XIcon className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div
                  className="text-destructive flex items-center gap-1 text-xs"
                  role="alert"
                >
                  <AlertCircleIcon className="size-3 shrink-0" />
                  <span>{errors[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                Processing resume...
              </div>
              <Progress value={50} className="w-full h-1" />
            </div>
          )}

          {/* Profile Information Form */}
          {extractedData && !isProcessing && (
            <div className="space-y-3">
              <h4 className="text-base font-semibold">Profile Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {(['name', 'email', 'phone'] as const).map((field) => {
                  const fieldStatus = getFieldStatus(field)
                  const fieldLabels = { name: 'Full Name', email: 'Email Address', phone: 'Phone Number' }
                  const fieldIcons = { name: User, email: Mail, phone: Phone }
                  const Icon = fieldIcons[field]
                  const currentValue = fieldStatus.value || ''

                  return (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs font-medium flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {fieldLabels[field]}
                      </Label>
                      <Input
                        value={currentValue}
                        onChange={(e) => {
                          const newCollectedData = { ...collectedData, [field]: e.target.value }
                          setCollectedData(newCollectedData)

                          // Update missing fields
                          const newMissing = { ...missingFields }
                          newMissing[field] = !e.target.value.trim()
                          setMissingFields(newMissing)
                        }}
                        placeholder={`Enter your ${fieldLabels[field].toLowerCase()}`}
                        className={`text-sm h-8 ${fieldStatus.status === 'extracted' ? 'border-green-200 bg-green-50' : fieldStatus.status === 'collected' ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}
                      />
                      <div className="flex items-center gap-1">
                        {fieldStatus.status === 'extracted' && (
                          <Badge variant="default" className="text-xs px-1.5 py-0.5">AI Extracted</Badge>
                        )}
                        {fieldStatus.status === 'collected' && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">Manual Entry</Badge>
                        )}
                        {fieldStatus.status === 'missing' && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0.5">Required</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}


          {/* Ready to Start Interview */}
          {canStartInterview && (
            // <div>
              <span className="text-sm flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-600" />
                All information collected. Ready to begin the interview.
              </span>
            // </div>
          )}

          <div className="space-y-2 flex justify-center">
            <Button
              disabled={!canStartInterview || isInterviewActive}
              onClick={handleStartInterview}
              size="sm"
              className="px-6 text-sm cursor-pointer"
            >
              {isInterviewActive ? "Assessment in Progress" : "Begin Assessment"}
            </Button>

          </div>
        </div>
      </div>

    </>
  )
}