import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { IconUpload, IconFileText, IconCircleCheck, IconClock, IconSend, IconUser, IconMail, IconPhone, IconAlertCircle, IconX, IconPlayerPlay } from "@tabler/icons-react"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useInterviewStore } from "@/store/interviewStore"
import { toast } from "sonner"
import { useFileUpload } from "@/hooks/use-file-upload"
import { FileProcessingService, DataProcessingService, type ExtractedData, type MissingFields } from "@/services"

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


  const handleFileUpload = async (file: File) => {
    // Validate file using the service
    const validation = FileProcessingService.validateFile(file, maxSizeMB)
    if (!validation.isValid) {
      toast.error("File validation failed", {
        description: validation.error
      })
      return
    }

    setIsProcessing(true)

    try {
      // Extract text from file using the service
      const text = await FileProcessingService.extractTextFromFile(file)

      // Extract fields from text using the service
      const extracted = DataProcessingService.extractFields(text)
      setExtractedData(extracted)

      // Check which fields are missing using the service
      const missing = DataProcessingService.getMissingFields(extracted)
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
    return DataProcessingService.getFieldStatus(field, extractedData, collectedData)
  }

  // Timer effect - handles countdown and auto-submission
  useEffect(() => {
    let interval: number | null = null

    if (isInterviewActive) {
      interval = setInterval(() => {
        // Double-check that interview is still active
        const { isInterviewActive: currentIsActive } = useInterviewStore.getState()
        if (!currentIsActive) {
          return
        }

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
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [isInterviewActive, tickTimer, submitAnswer, nextQuestion]) // Removed currentAnswer from dependencies

  // Auto-process file when uploaded
  useEffect(() => {
    if (resumeFile && !extractedData && !isProcessing) {
      handleFileUpload(resumeFile)
    }
  }, [resumeFile, extractedData, isProcessing])

  // Check if all required fields are filled
  useEffect(() => {
    if (extractedData || Object.keys(collectedData).length > 0) {
      const hasAllFields = DataProcessingService.hasAllRequiredFields(extractedData, collectedData)
      setCanStartInterview(hasAllFields)
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


    // Reset any existing interview state first
    resetInterview()

    // Clear local state to ensure fresh start
    setCurrentAnswer("")
    setTimeElapsed(0)

    // Add the new candidate and get the ID directly
    const candidateId = addCandidate(candidateData)

    console.log('Starting interview for candidate ID:', candidateId)
    startInterview(candidateId)
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
      <div className="h-full flex flex-col items-center justify-center p-3 sm:p-4 overflow-hidden">
        <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4">
          <div className="text-center space-y-2 sm:space-y-3">
            <div className="mx-auto w-10 sm:w-12 h-10 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
              <IconCircleCheck className="h-5 sm:h-6 w-5 sm:w-6 text-green-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Thank You!</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm px-2">
              Thanks for attending the interview. Your responses have been recorded and will be reviewed by our team.
            </p>
          </div>

          <Button
            onClick={returnToHome}
            size="sm"
            className="px-4 sm:px-6 cursor-pointer"
          >
            Return to Home
          </Button>
        </div>
      </div>
    )
  }

  // Welcome Back Screen
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
      <div className="h-full flex flex-col items-center justify-center p-3 sm:p-4 overflow-hidden">
        <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4">
          <div className="text-center space-y-2 sm:space-y-3">
            <div className="mx-auto w-10 sm:w-12 h-10 sm:h-12 bg-chart-3/10 rounded-full flex items-center justify-center">
              <IconClock className="h-5 w-5 sm:h-6 sm:w-6 text-chart-3" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Welcome Back!</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm px-2">
              You have an unfinished interview session. Would you like to resume or start fresh?
            </p>
          </div>

          <div className="w-full max-w-sm border border-muted rounded-lg bg-muted/30 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold truncate">{unfinishedSession.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{unfinishedSession.email}</p>
              </div>
              <Badge className={getStatusColor(unfinishedSession.interviewStatus) + " text-xs px-2 py-0.5 ml-2"}>
                {unfinishedSession.interviewStatus.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex justify-between text-center">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-sm font-medium">{unfinishedSession.currentQuestionIndex + 1} / 6</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Time</span>
                <span className="text-sm font-medium">{unfinishedSession.totalTime ? formatTime(unfinishedSession.totalTime) : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleResumeInterview}
              size="sm"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer"
            >
              <IconPlayerPlay className="h-4 w-4" />
              Resume Interview
            </Button>
            <Button
              variant="outline"
              onClick={handleStartNew}
              size="sm"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer"
            >
              Start New Interview
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // If interview is active, only show the interview UI
  if (isInterviewActive && currentQuestion) {
    // Get the most recent candidate to ensure we're showing the correct data
    const mostRecentCandidate = candidates[candidates.length - 1]
    const displayCandidate = mostRecentCandidate || currentCandidate

    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header - Fixed height */}
        <div className="flex-shrink-0 p-3 sm:p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-1 sm:space-y-0">
            <div>
              <h2 className="text-sm sm:text-base font-semibold">AI Interview Assessment</h2>
            </div>
            <div className="flex flex-row sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <span className="truncate">
                {displayCandidate?.name
                  ?.split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </span>
              <span>•</span>
              <span className="truncate">{displayCandidate?.email}</span>
            </div>
          </div>
        </div>
        
        {/* Content - Scrollable */}
        <div className="flex-1 min-h-0 overflow-auto px-3 sm:px-4 pb-3 sm:pb-4">
          <div className="space-y-3 sm:space-y-4">

            {/* Question Section */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-semibold flex flex-wrap items-center gap-1 sm:gap-2">
                  Question {(displayCandidate?.currentQuestionIndex || 0) + 1} of 6
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${getDifficultyColor(currentQuestion.difficulty)}`}>
                      {currentQuestion.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">{currentQuestion.category}</Badge>
                  </div>
                </h3>
                {/* Timer Section */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <IconClock className="h-3 sm:h-4 w-3 sm:w-4 text-muted-foreground" />
                  <span className="text-base sm:text-lg font-mono font-semibold">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">{currentQuestion.text}</p>

              {/* Answer Section */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Your Answer</Label>
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={18}
                  className="min-h-[400px] sm:min-h-[800px] resize-y text-xs sm:text-sm border border-border/50 focus:border-border/70"
                  style={{ minHeight: 300, maxHeight: 800, boxShadow: "none", borderWidth: "1px" }}
                />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {currentAnswer.length} characters
                  </span>
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!currentAnswer.trim()}
                    size="sm"
                    className="w-full sm:w-auto cursor-pointer"
                  >
                    <IconSend className="h-3 w-3 mr-1" />
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
      </div>
    )
  }


  // Default view - Resume upload and setup
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4">
        <div className="space-y-3 sm:space-y-4">

          {/* Resume Upload Section */}
          <div className="space-y-2 sm:space-y-3">
            <div className="space-y-1">
              <Label className="text-base sm:text-lg font-semibold">Smart Resume Analysis</Label>
              <p className="text-xs text-muted-foreground">
                Upload your resume for AI-powered personalized interview
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
                  className="border-input hover:bg-accent/40 data-[dragging=true]:bg-accent/40 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 has-disabled:pointer-events-none has-disabled:opacity-50 has-[img]:border-none has-[input:focus]:ring-[3px] relative flex min-h-48 sm:min-h-64 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-2 sm:p-3 transition-colors"
                >
                  <input
                    {...getInputProps()}
                    className="sr-only"
                    aria-label="Upload resume"
                  />
                  {resumeFile ? (
                    <div className="flex flex-col items-center justify-center px-3 sm:px-4 py-2 text-center">
                      <div
                        className="bg-background mb-2 flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-full border"
                        aria-hidden="true"
                      >
                        <IconFileText className="size-3 sm:size-4 opacity-60" />
                      </div>
                      <p className="mb-1 text-xs font-medium truncate max-w-full">
                        {resumeFile.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {(resumeFile.size / 1024 / 1024).toFixed(2)} MB • Ready to process
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-2 sm:px-3 py-2 text-center">
                      <div
                        className="bg-background mb-1 flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full border"
                        aria-hidden="true"
                      >
                        <IconUpload className="size-3 opacity-60" />
                      </div>
                      <p className="mb-1 text-xs font-medium">
                        Drop your resume here
                      </p>
                      <p className="text-muted-foreground text-xs px-2">
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
                      <IconX className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div
                  className="text-destructive flex items-center gap-1 text-xs"
                  role="alert"
                >
                  <IconAlertCircle className="size-3 shrink-0" />
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
            <div className="space-y-2 sm:space-y-3">
              <h4 className="text-sm sm:text-base font-semibold">Profile Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {(['name', 'email', 'phone'] as const).map((field) => {
                  const fieldStatus = getFieldStatus(field)
                  const fieldLabels = { name: 'Full Name', email: 'Email Address', phone: 'Phone Number' }
                  const fieldIcons = { name: IconUser, email: IconMail, phone: IconPhone }
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
                        className={`text-xs sm:text-sm h-7 sm:h-8 border border-[1px] ${fieldStatus.status === 'extracted' ? 'border-green-200 bg-green-50' : fieldStatus.status === 'collected' ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}
                        style={{ boxShadow: "none", borderWidth: "1px" }}
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

          <div className="flex justify-center mt-auto pt-3">
            <Button
              disabled={!canStartInterview || isInterviewActive}
              onClick={handleStartInterview}
              size="sm"
              className="px-4 sm:px-6 text-xs sm:text-sm cursor-pointer w-full sm:w-auto"
            >
              {isInterviewActive ? "Assessment in Progress" : "Begin Assessment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}