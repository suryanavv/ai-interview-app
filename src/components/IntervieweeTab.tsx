import { useState, useEffect, memo, useCallback } from "react"
import { createPortal } from "react-dom"
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
import { formatTime, getDifficultyColor } from "@/lib/utils"

export const IntervieweeTab = memo(() => {
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
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [showResultsOverlay, setShowResultsOverlay] = useState(false)
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false)

  const {
    currentCandidateId,
    isInterviewActive,
    currentQuestion,
    timeRemaining,
    currentAnswer,
    candidates,
    addCandidate,
    startInterview,
    submitAnswer,
    nextQuestion,
    tickTimer,
    resetInterview,
    showFeedbackCompletion,
    lastCompletedCandidateId,
    returnToHome,
    showWelcomeBackModal,
    unfinishedSession,
    setUnfinishedSession,
    setShowWelcomeBackModal,
    handleResumeInterview,
    handleStartNew,
    isSubmittingAnswer,
    setIsSubmittingAnswer,
    isStartingInterview,
    setIsStartingInterview,
    isTransitioningQuestions,
    setIsTransitioningQuestions,
    startQuestionTimer,
    setCurrentAnswer,
  } = useInterviewStore()


  const currentCandidate = candidates.find(c => c.id === currentCandidateId)


  const handleFileUpload = useCallback(async (file: File) => {
    if (isProcessingFile) return // Prevent multiple simultaneous uploads

    // Validate file using the service
    const validation = FileProcessingService.validateFile(file, maxSizeMB)
    if (!validation.isValid) {
      toast.error("Invalid file", {
        description: validation.error || "Please select a valid PDF or DOCX file."
      })
      return
    }

    setIsProcessingFile(true)
    setIsProcessing(true)

    try {
      toast.loading("Analyzing your resume...", {
        id: "file-processing"
      })

      // Extract text from file using the service
      const text = await FileProcessingService.extractTextFromFile(file)

      if (!text || text.trim().length === 0) {
        throw new Error("No readable content found in the file")
      }

      // Extract fields from text using the service
      const extracted = DataProcessingService.extractFields(text)
      setExtractedData(extracted)

      // Check which fields are missing using the service
      const missing = DataProcessingService.getMissingFields(extracted)
      setMissingFields(missing)

      const missingCount = Object.values(missing).filter(Boolean).length

      toast.dismiss("file-processing")
      toast.success("Resume analysis complete!", {
        description: `Successfully extracted profile information. ${missingCount > 0 ? `${missingCount} field${missingCount === 1 ? '' : 's'} need${missingCount === 1 ? 's' : ''} your attention.` : 'All information extracted successfully!'}`
      })

      // Check if all fields are available (either extracted or can be filled manually)
      setCanStartInterview(true)

    } catch (error) {
      console.error("Error processing file:", error)
      toast.dismiss("file-processing")

      // Provide user-friendly error messages
      let errorMessage = "Unable to process your resume."
      let errorDescription = "Please ensure it's a valid PDF or DOCX file and try again."

      if (error instanceof Error) {
        if (error.message.includes("content")) {
          errorMessage = "Resume content extraction failed"
          errorDescription = "The file appears to be empty or corrupted. Please try with a different file."
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          errorMessage = "Connection issue"
          errorDescription = "Please check your internet connection and try again."
        } else if (error.message.includes("size")) {
          errorMessage = "File too large"
          errorDescription = `Please select a file smaller than ${maxSizeMB}MB.`
        }
      }

      toast.error(errorMessage, {
        description: errorDescription,
        duration: 5000
      })
    } finally {
      setIsProcessing(false)
      setIsProcessingFile(false)
    }
  }, [maxSizeMB])

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

  // Timer effect - handles countdown and auto-submission with requestAnimationFrame for better performance
  useEffect(() => {
    let animationFrameId: number | null = null
    let lastTime = Date.now()

    const tick = () => {
      const currentTime = Date.now()
      const deltaTime = currentTime - lastTime

      // Always check for time expiry, but only update elapsed time every second
      if (deltaTime >= 1000) {
        // Double-check that interview is still active
        const { isInterviewActive: currentIsActive } = useInterviewStore.getState()
        if (!currentIsActive) {
          return
        }

        setTimeElapsed(prev => prev + 1)
        lastTime = currentTime
      }

      // Always check for time expiry on every frame for precision
      const timeUp = tickTimer()

      if (timeUp && !hasAutoSubmitted) {
        // Time's up - get the current textarea value directly from DOM for accuracy
        const textareaElement = document.querySelector('textarea[placeholder="Type your answer here..."]') as HTMLTextAreaElement
        const finalAnswer = textareaElement ? textareaElement.value : currentAnswer

        // Prevent multiple submissions
        setHasAutoSubmitted(true)

        // Show visual feedback that time has run out
        toast.info(`Time's up! ${finalAnswer.trim() ? 'Auto-submitting your answer.' : 'Auto-submitting (no answer provided).'}`, {
          duration: 2000
        })


        // Submit the captured answer (preserve exact text as typed)
        submitAnswer(finalAnswer, timeElapsed)
        setCurrentAnswer("")
        setTimeElapsed(0)

        // Reset auto-submit flag after a brief delay to prevent race conditions
        setTimeout(() => setHasAutoSubmitted(false), 100)

        // Handle async nextQuestion call
        nextQuestion().catch((error: unknown) => {
          console.error('Error moving to next question:', error)
        })
      }

      if (isInterviewActive) {
        animationFrameId = requestAnimationFrame(tick)
      }
    }

    if (isInterviewActive) {
      animationFrameId = requestAnimationFrame(tick)
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isInterviewActive, tickTimer, submitAnswer, nextQuestion])

  // Start question timer only after the question is displayed
  useEffect(() => {
    if (isInterviewActive && currentQuestion) {
      // Defer slightly to ensure paint
      const id = window.requestAnimationFrame(() => startQuestionTimer())
      return () => cancelAnimationFrame(id)
    }
  }, [isInterviewActive, currentQuestion, startQuestionTimer])

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
      setIsTransitioningQuestions(false)
      setHasAutoSubmitted(false)
    }

    window.addEventListener('resetResumeUpload', handleResetResumeUpload)

    return () => {
      window.removeEventListener('resetResumeUpload', handleResetResumeUpload)
    }
  }, [files, removeFileFromHook])



  useEffect(() => {
    // Lock body scroll when results overlay is open
    if (showResultsOverlay) {
      document.body.classList.add('overflow-hidden')
    } else {
      document.body.classList.remove('overflow-hidden')
    }

    return () => {
      document.body.classList.remove('overflow-hidden')
    }
  }, [showResultsOverlay])

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



  const handleStartInterview = async () => {
    if (!extractedData && !collectedData.name) return
    if (isStartingInterview) return // Prevent multiple clicks

    setIsStartingInterview(true)

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
    setHasAutoSubmitted(false)

    // Add the new candidate and get the ID directly
    const candidateId = addCandidate(candidateData)


    try {
      // Show loading state for AI question generation
      toast.loading("Generating personalized questions...", {
        id: "ai-questions-loading",
        description: "This may take a few moments"
      })

      await startInterview(candidateId)

      toast.dismiss("ai-questions-loading")
      toast.success("Interview ready!", {
        description: "Your personalized assessment is about to begin."
      })

    } catch (error) {
      console.error('Error starting interview:', error)
      toast.dismiss("ai-questions-loading")

      // Provide user-friendly error messages
      let errorMessage = "Unable to start assessment"
      let errorDescription = "Using standard questions instead. Click to continue."

      if (error instanceof Error) {
        if (error.message.includes("API") || error.message.includes("network")) {
          errorMessage = "Connection issue"
          errorDescription = "Unable to connect to AI services. Using standard questions instead."
        } else if (error.message.includes("key") || error.message.includes("auth")) {
          errorMessage = "Service configuration issue"
          errorDescription = "AI services are temporarily unavailable. Using standard questions instead."
        }
      }

      toast.error(errorMessage, {
        description: errorDescription,
        duration: 4000
      })

      // Try to start with standard questions as fallback
      try {
        toast.loading("Starting with standard questions...", {
          id: "fallback-questions-loading"
        })

        await startInterview(candidateId)

        toast.dismiss("fallback-questions-loading")
        toast.success("Assessment starting!", {
          description: "Using standard questions for your evaluation."
        })

      } catch (fallbackError) {
        console.error('Fallback interview start failed:', fallbackError)
        toast.dismiss("fallback-questions-loading")
        toast.error("Unable to start assessment", {
          description: "Please try again in a moment or contact support if the issue persists.",
          duration: 5000
        })
      }
    } finally {
      setIsStartingInterview(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || isSubmittingAnswer || isTransitioningQuestions) return

    setIsSubmittingAnswer(true)

    const timeSpent = timeElapsed
    submitAnswer(currentAnswer, timeSpent)
    setCurrentAnswer("")
    setTimeElapsed(0)
    setHasAutoSubmitted(false)

    // Show transition loading screen
    setIsTransitioningQuestions(true)

    // Add a small delay for smooth transition effect
    setTimeout(async () => {
      try {
        await nextQuestion()
      } catch (error) {
        console.error('Error moving to next question:', error)
      } finally {
        setIsSubmittingAnswer(false)
        setIsTransitioningQuestions(false)
      }
    }, 500) // 1 second delay for a nice transition
  }



  // If feedback completion is shown, display the completion screen
  if (showFeedbackCompletion) {
    const completedCandidate = candidates.find(c => c.id === lastCompletedCandidateId)

    return (
      <>
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 p-3 sm:p-4 pb-2">
            <div className="text-center space-y-1">
              <div className="mx-auto w-10 sm:w-12 h-10 sm:h-12 bg-green-100 rounded-full flex items-center justify-center">
                <IconCircleCheck className="h-5 sm:h-6 w-5 sm:w-6 text-green-600" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Thank You!</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Thanks for attending the interview. Your responses have been recorded and will be reviewed by our team.
              </p>
            </div>
          </div>

          {/* Content - Centered */}
          <div className="flex-1 flex items-center justify-center px-3 sm:px-4">
            <div className="text-center space-y-4 max-w-sm">
              <p className="text-sm text-muted-foreground">
                Your interview has been completed successfully. Click below to view your detailed results.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 p-3 sm:p-4 pt-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-center justify-center">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center w-fit">
                <Button
                  onClick={() => setShowResultsOverlay(true)}
                  variant="outline"
                  size="sm"
                  className="min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer"
                  disabled={!completedCandidate}
                >
                  View Results
                </Button>
                <Button
                  onClick={() => {
                    setShowResultsOverlay(false)
                    returnToHome()
                  }}
                  size="sm"
                  className="min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer"
                >
                  Return to Home
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Overlay */}
        {showResultsOverlay && completedCandidate && createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowResultsOverlay(false)}
          >
            <div
              className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold">Interview Results</h3>
                  <p className="text-sm text-muted-foreground">
                    {completedCandidate.name} - Detailed Evaluation
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResultsOverlay(false)}
                  className="p-2"
                >
                  <IconX size={16} />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4 sm:space-y-6">
                  {/* Interview Summary */}
                  <div className="space-y-3 sm:space-y-4">
                    {/* Candidate Info */}
                    <div className="border rounded-lg p-3 sm:p-4 bg-muted/30">
                      <h4 className="text-sm sm:text-base font-semibold mb-2">Profile Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div><strong>Name:</strong> {completedCandidate.name}</div>
                        <div><strong>Email:</strong> {completedCandidate.email}</div>
                        <div><strong>Phone:</strong> {completedCandidate.phone}</div>
                         </div>
                    </div>

                    {/* Score Display */}
                    {completedCandidate.finalScore !== undefined && (
                      <div className="border rounded-lg p-3 sm:p-4 text-center bg-gradient-to-r from-primary/5 to-primary/10">
                        <div className="text-3xl sm:text-4xl font-bold text-primary mb-1">
                          {completedCandidate.finalScore}/100
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Your Interview Score
                        </p>
                      </div>
                    )}

                    {/* AI Evaluation */}
                    {completedCandidate.aiEvaluation && (
                      <div className="border rounded-lg p-3 sm:p-4 space-y-3">
                        <h4 className="text-sm sm:text-base font-semibold">AI Evaluation</h4>

                        {/* Summary */}
                        <div>
                          <p className="text-sm leading-relaxed">{completedCandidate.aiEvaluation.summary}</p>
                        </div>

                        {/* Strengths */}
                        {completedCandidate.aiEvaluation.strengths && completedCandidate.aiEvaluation.strengths.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-green-700 mb-2">Strengths:</h5>
                            <ul className="text-sm space-y-1 ml-2">
                              {completedCandidate.aiEvaluation.strengths.map((strength, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-green-600 mr-2">•</span>
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Weaknesses */}
                        {completedCandidate.aiEvaluation.weaknesses && completedCandidate.aiEvaluation.weaknesses.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-orange-700 mb-2">Areas for Improvement:</h5>
                            <ul className="text-sm space-y-1 ml-2">
                              {completedCandidate.aiEvaluation.weaknesses.map((weakness, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-orange-600 mr-2">•</span>
                                  {weakness}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommendations */}
                        {completedCandidate.aiEvaluation.recommendations && completedCandidate.aiEvaluation.recommendations.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-blue-700 mb-2">Recommendations:</h5>
                            <ul className="text-sm space-y-1 ml-2">
                              {completedCandidate.aiEvaluation.recommendations.map((rec, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-blue-600 mr-2">•</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fallback Summary */}
                    {!completedCandidate.aiEvaluation && completedCandidate.aiSummary && (
                      <div className="border rounded-lg p-3 sm:p-4">
                        <h4 className="text-sm sm:text-base font-semibold mb-2">Interview Summary</h4>
                        <div>
                          <p className="text-sm whitespace-pre-line leading-relaxed">{completedCandidate.aiSummary}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
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
              onClick={() => handleResumeInterview()}
              size="sm"
              disabled={isStartingInterview}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer"
            >
              {isStartingInterview ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1"></div>
                  Loading...
                </>
              ) : (
                <>
                  <IconPlayerPlay className="h-4 w-4" />
                  Resume Interview
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleStartNew}
              size="sm"
              disabled={isStartingInterview}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer"
            >
              {isStartingInterview ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1"></div>
                  Loading...
                </>
              ) : (
                "Start New Interview"
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Show loading transition between questions
  if (isTransitioningQuestions) {
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

        {/* Content - Centered Loading */}
        <div className="flex-1 flex items-center justify-center px-3 sm:px-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary/10 to-primary/20 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-semibold text-foreground">Processing Your Answer</h3>
              <p className="text-sm text-muted-foreground">
                Analyzing your response and preparing the next question...
              </p>
            </div>
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
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
                    {formatTime(timeRemaining * 1000)}
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
                  rows={8}
                  className="min-h-[100px] sm:min-h-[200px] md:min-h-[240px] max-h-[300px] sm:max-h-[250px] md:max-h-[350px] text-xs sm:text-sm border border-border/50 focus:border-border/70 resize-vertical"
                  style={{ boxShadow: "none", borderWidth: "1px" }}
                />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {currentAnswer.length} characters
                  </span>
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!currentAnswer.trim() || isSubmittingAnswer || isTransitioningQuestions}
                    size="sm"
                    className="w-full sm:w-auto cursor-pointer"
                  >
                    <IconSend className="h-3 w-3 mr-1" />
                    {isTransitioningQuestions ? "Processing..." : isSubmittingAnswer ? "Submitting..." : "Submit Answer"}
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
                  onDragEnter={isProcessingFile || isStartingInterview ? undefined : handleDragEnter}
                  onDragLeave={isProcessingFile || isStartingInterview ? undefined : handleDragLeave}
                  onDragOver={isProcessingFile || isStartingInterview ? undefined : handleDragOver}
                  onDrop={isProcessingFile || isStartingInterview ? undefined : handleDrop}
                  data-dragging={isDragging || undefined}
                  data-processing={(isProcessingFile || isStartingInterview) || undefined}
                  className="border-input hover:bg-accent/40 data-[dragging=true]:bg-accent/40 data-[processing=true]:bg-muted/50 data-[processing=true]:cursor-not-allowed has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 has-disabled:pointer-events-none has-disabled:opacity-50 has-[img]:border-none has-[input:focus]:ring-[3px] relative flex min-h-48 sm:min-h-64 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-2 sm:p-3 transition-colors"
                >
                  <input
                    {...getInputProps()}
                    className="sr-only"
                    aria-label="Upload resume"
                    disabled={isProcessingFile || isStartingInterview}
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
                        className={`mt-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          isProcessingFile || isStartingInterview
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-primary text-white hover:bg-primary/90"
                        }`}
                        onClick={isProcessingFile || isStartingInterview ? undefined : openFileDialog}
                        disabled={isProcessingFile || isStartingInterview}
                      >
                        {isProcessingFile ? "Processing..." : isStartingInterview ? "Preparing..." : "Choose File"}
                      </button>
                    </div>
                  )}
                </div>
                {resumeFile && (
                  <div className="absolute top-4 right-4">
                    <button
                      type="button"
                      className={`focus-visible:border-ring focus-visible:ring-ring/50 z-50 flex size-8 items-center justify-center rounded-full text-white transition-[color,box-shadow] outline-none focus-visible:ring-[3px] ${
                        isProcessingFile || isStartingInterview
                          ? "bg-muted cursor-not-allowed opacity-50"
                          : "bg-black/60 hover:bg-black/80 cursor-pointer"
                      }`}
                      onClick={isProcessingFile || isStartingInterview ? undefined : handleRemoveFile}
                      disabled={isProcessingFile || isStartingInterview}
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
                        disabled={isProcessingFile || isStartingInterview}
                        className={`text-xs sm:text-sm h-7 sm:h-8 border-1 ${
                          isProcessingFile || isStartingInterview
                            ? 'opacity-50 cursor-not-allowed'
                            : fieldStatus.status === 'extracted'
                            ? 'border-green-200 bg-green-50'
                            : fieldStatus.status === 'collected'
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-red-200 bg-red-50'
                        }`}
                        readOnly={isProcessingFile || isStartingInterview}
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
              disabled={!canStartInterview || isInterviewActive || isStartingInterview || isProcessingFile}
              onClick={handleStartInterview}
              size="sm"
              className="px-4 sm:px-6 text-xs sm:text-sm cursor-pointer w-full sm:w-auto"
            >
              {isStartingInterview ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  Preparing Assessment...
                </>
              ) : isInterviewActive ? (
                "Assessment in Progress"
              ) : isProcessingFile ? (
                "Processing Resume..."
              ) : (
                "Begin Assessment"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

IntervieweeTab.displayName = 'IntervieweeTab'