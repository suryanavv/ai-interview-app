import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, X, CheckCircle, AlertCircle, Clock, Send, User, Mail, Phone } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useInterviewStore } from "@/store/interviewStore"
import { InterviewCompletionDialog } from "@/components/InterviewCompletionDialog"
import { toast } from "sonner"
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
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [missingFields, setMissingFields] = useState<MissingFields>({
    name: true,
    email: true,
    phone: true
  })
  const [showChatbot, setShowChatbot] = useState(false)
  const [chatbotMessage, setChatbotMessage] = useState("")
  const [userInput, setUserInput] = useState("")
  const [currentField, setCurrentField] = useState<keyof MissingFields | null>(null)
  const [collectedData, setCollectedData] = useState<Partial<ExtractedData>>({})
  const [canStartInterview, setCanStartInterview] = useState(false)
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [showResetMessage, setShowResetMessage] = useState(false)
  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [completedCandidate, setCompletedCandidate] = useState<any>(null)

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

    setResumeFile(file)
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
      toast.success("Resume processed successfully", {
        description: `Found ${Object.values(missing).filter(Boolean).length} missing fields.`
      })
      
      // If any fields are missing, start chatbot flow
      if (missing.name || missing.email || missing.phone) {
        setShowChatbot(true)
        startChatbotFlow(missing)
      } else {
        setCanStartInterview(true)
        toast.success("Ready to start", {
          description: "All information extracted successfully!"
        })
      }
      
    } catch (error) {
      console.error("Error processing file:", error)
      toast.error("Processing failed", {
        description: "Unable to process the file. Please ensure it's a valid PDF or DOCX and try again."
      })
      setResumeFile(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      handleFileUpload(file)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      handleFileUpload(file)
    }
  }

  const removeFile = () => {
    setResumeFile(null)
    setExtractedData(null)
    setMissingFields({ name: true, email: true, phone: true })
    setShowChatbot(false)
    setCanStartInterview(false)
    setCollectedData({})
  }

  const startChatbotFlow = (missing: MissingFields) => {
    if (missing.name) {
      setCurrentField('name')
      setChatbotMessage("Hi! I need to collect some information from you before we start the interview. What's your full name?")
    } else if (missing.email) {
      setCurrentField('email')
      setChatbotMessage("Great! Now I need your email address. What's your email?")
    } else if (missing.phone) {
      setCurrentField('phone')
      setChatbotMessage("Perfect! Finally, what's your phone number?")
    }
  }

  const validateField = (field: keyof MissingFields, value: string): { isValid: boolean; message?: string } => {
    switch (field) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(value)) {
          return { isValid: false, message: "Please enter a valid email address" }
        }
        break
      case 'phone':
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
        const cleanPhone = value.replace(/[\s\-\(\)]/g, '')
        if (!phoneRegex.test(cleanPhone) || cleanPhone.length < 10) {
          return { isValid: false, message: "Please enter a valid phone number (at least 10 digits)" }
        }
        break
      case 'name':
        if (value.length < 2) {
          return { isValid: false, message: "Please enter your full name (at least 2 characters)" }
        }
        break
    }
    return { isValid: true }
  }

  const handleChatbotSubmit = () => {
    if (!currentField || !userInput.trim()) {
      toast.warning("Input required", {
        description: "Please provide the requested information."
      })
      return
    }

    const validation = validateField(currentField, userInput.trim())
    if (!validation.isValid) {
      toast.error("Invalid input", {
        description: validation.message || "Please check your input and try again."
      })
      return
    }

    const newCollectedData = {
      ...collectedData,
      [currentField]: userInput.trim()
    }
    setCollectedData(newCollectedData)

    // Update missing fields
    const newMissing = { ...missingFields }
    newMissing[currentField] = false
    setMissingFields(newMissing)

    // Show success message
    toast.success("Information saved", {
      description: `${currentField.charAt(0).toUpperCase() + currentField.slice(1)} has been saved successfully.`
    })

    // Check if there are more fields to collect
    const nextMissingField = Object.entries(newMissing).find(([_, isMissing]) => isMissing)?.[0] as keyof MissingFields

    if (nextMissingField) {
      setCurrentField(nextMissingField)
      const fieldMessages = {
        name: "What's your full name?",
        email: "What's your email address?",
        phone: "What's your phone number?"
      }
      setChatbotMessage(fieldMessages[nextMissingField])
    } else {
      // All fields collected
      setChatbotMessage("Perfect! I have all the information I need. You're ready to start the interview!")
      setCurrentField(null)
      setCanStartInterview(true)
      toast.success("All set!", {
        description: "You're ready to start the interview."
      })
    }

    setUserInput("")
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

  // Listen for reset resume upload event
  useEffect(() => {
    const handleResetResumeUpload = () => {
      setResumeFile(null)
      setExtractedData(null)
      setMissingFields({ name: true, email: true, phone: true })
      setShowChatbot(false)
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
  }, [])

  // Check for interview completion and show dialog
  useEffect(() => {
    if (currentCandidate?.interviewStatus === 'completed' && !showCompletionDialog) {
      setCompletedCandidate(currentCandidate)
      setShowCompletionDialog(true)
    }
  }, [currentCandidate?.interviewStatus, showCompletionDialog])

  // Handle completion dialog close
  const handleCompletionDialogClose = () => {
    setShowCompletionDialog(false)
    setCompletedCandidate(null)
    // Reset to home UI (resume upload)
    resetInterview()
    setResumeFile(null)
    setExtractedData(null)
    setMissingFields({ name: true, email: true, phone: true })
    setShowChatbot(false)
    setCanStartInterview(false)
    setCollectedData({})
    setCurrentAnswer("")
    setTimeElapsed(0)
  }

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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "bg-chart-2/20 text-chart-2"
      case "Medium": return "bg-chart-4/20 text-chart-4"
      case "Hard": return "bg-destructive/20 text-destructive"
      default: return "bg-muted text-muted-foreground"
    }
  }

  // If interview is active, only show the interview UI
  if (isInterviewActive && currentQuestion) {
    // Get the most recent candidate to ensure we're showing the correct data
    const mostRecentCandidate = candidates[candidates.length - 1]
    const displayCandidate = mostRecentCandidate || currentCandidate
    
    return (
      <Card className="border-2 border-chart-3/30 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-chart-3/10 to-chart-1/10 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
            <div>
              <CardTitle className="text-xl text-foreground">Interview in Progress</CardTitle>
              <CardDescription className="text-muted-foreground">
                {displayCandidate?.name} - {displayCandidate?.email}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getDifficultyColor(currentQuestion.difficulty)}>
                {currentQuestion.difficulty}
              </Badge>
              <Badge variant="outline">{currentQuestion.category}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Timer Section */}
          <div className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all ${
            timeRemaining <= 10 
              ? 'border-destructive/50 bg-destructive/10 text-destructive' 
              : timeRemaining <= 30 
              ? 'border-chart-4/50 bg-chart-4/10 text-chart-4'
              : 'border-chart-3/50 bg-chart-3/10 text-chart-3'
          }`}>
            <div className="flex items-center space-x-3">
              <Clock className="h-6 w-6" />
              <span className="font-mono text-2xl font-bold">
                {formatTime(timeRemaining)}
              </span>
              {timeRemaining <= 10 && (
                <span className="text-sm bg-destructive/20 text-destructive px-3 py-1 rounded-full font-medium">
                  Time's up soon!
                </span>
              )}
            </div>
          </div>

          {/* Question Section */}
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Question {(displayCandidate?.currentQuestionIndex || 0) + 1} of 6
                </h3>
                <div className="text-sm text-muted-foreground">
                  {currentQuestion.difficulty} • {currentQuestion.category}
                </div>
              </div>
              <p className="text-foreground text-base leading-relaxed">{currentQuestion.text}</p>
            </div>

            {/* Answer Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Your Answer</label>
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full resize-none text-base"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {currentAnswer.length} characters
                </div>
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={!currentAnswer.trim()}
                  className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Answer
                </Button>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span className="font-medium">Interview Progress</span>
              <span className="font-mono">
                {(displayCandidate?.currentQuestionIndex || 0) + 1} / 6
              </span>
            </div>
            <Progress 
              value={(((displayCandidate?.currentQuestionIndex || 0) + 1) / 6) * 100} 
              className="w-full h-3" 
            />
            <div className="text-xs text-muted-foreground/70 text-center">
              {6 - (displayCandidate?.currentQuestionIndex || 0) - 1} questions remaining
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }


  // Default view - Resume upload and setup
  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Interview Chat</CardTitle>
        <CardDescription>
          Upload your resume and start your interview
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reset Message */}
        {showResetMessage && (
          <Alert className="border-chart-2/30 bg-chart-2/10">
            <CheckCircle className="h-4 w-4 text-chart-2" />
            <AlertDescription className="text-chart-2">
              Resume upload has been reset. Please upload a new resume to start a fresh interview.
            </AlertDescription>
          </Alert>
        )}

        {/* Resume Upload Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-base font-medium">Resume Upload</Label>
            <p className="text-sm text-muted-foreground">
              Upload your resume to automatically extract your information
            </p>
          </div>
          
          <div className={`border-2 border-dashed rounded-xl p-8 transition-all duration-200 ${
            dragActive 
              ? "border-chart-3/50 bg-chart-3/10 scale-[1.02]" 
              : "border-border hover:border-muted-foreground/50"
          }`}>
            {!resumeFile ? (
              <div
                className="text-center space-y-4"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-foreground">
                    Drop your resume here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse files
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground/70">
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    PDF, DOCX
                  </span>
                  <span>•</span>
                  <span>Max 5MB</span>
                </div>
                <Input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileInput}
                  className="hidden"
                  id="resume-upload"
                />
                <Label
                  htmlFor="resume-upload"
                  className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors font-medium"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {resumeFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Processing Status */}
                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">Processing resume...</span>
                    </div>
                    <Progress value={50} className="w-full" />
                  </div>
                )}

                {/* Extracted Information Display */}
                {extractedData && !isProcessing && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-base">Extracted Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['name', 'email', 'phone'] as const).map((field) => {
                        const fieldStatus = getFieldStatus(field)
                        const fieldLabels = { name: 'Name', email: 'Email', phone: 'Phone' }
                        const fieldIcons = { name: User, email: Mail, phone: Phone }
                        const Icon = fieldIcons[field]
                        
                        return (
                          <div key={field} className={`p-4 rounded-lg border-2 transition-all ${
                            fieldStatus.status === 'extracted' 
                              ? 'border-chart-2/30 bg-chart-2/10' 
                              : fieldStatus.status === 'collected'
                              ? 'border-chart-3/30 bg-chart-3/10'
                              : 'border-destructive/30 bg-destructive/10'
                          }`}>
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-full ${
                                fieldStatus.status === 'extracted' 
                                  ? 'bg-chart-2/20' 
                                  : fieldStatus.status === 'collected'
                                  ? 'bg-chart-3/20'
                                  : 'bg-destructive/20'
                              }`}>
                                <Icon className={`h-4 w-4 ${
                                  fieldStatus.status === 'extracted' 
                                    ? 'text-chart-2' 
                                    : fieldStatus.status === 'collected'
                                    ? 'text-chart-3'
                                    : 'text-destructive'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{fieldLabels[field]}</p>
                                {fieldStatus.value ? (
                                  <p className="text-sm text-muted-foreground truncate">{fieldStatus.value}</p>
                                ) : (
                                  <p className="text-sm text-destructive">Missing</p>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                {fieldStatus.status === 'extracted' && (
                                  <CheckCircle className="h-5 w-5 text-chart-2" />
                                )}
                                {fieldStatus.status === 'collected' && (
                                  <CheckCircle className="h-5 w-5 text-chart-3" />
                                )}
                                {fieldStatus.status === 'missing' && (
                                  <AlertCircle className="h-5 w-5 text-destructive" />
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Chatbot Interface */}
                {showChatbot && !canStartInterview && (
                  <div className="border-2 border-chart-3/30 rounded-xl p-6 bg-gradient-to-br from-chart-3/10 to-chart-1/10">
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-chart-3 to-chart-1 rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold shadow-lg">
                          AI
                        </div>
                        <div className="flex-1 bg-background rounded-lg p-4 shadow-sm">
                          <p className="text-sm text-foreground leading-relaxed">{chatbotMessage}</p>
                        </div>
                      </div>
                      
                      {currentField && (
                        <div className="space-y-3">
                          <div className="flex space-x-2">
                            <Input
                              value={userInput}
                              onChange={(e) => setUserInput(e.target.value)}
                              placeholder={`Enter your ${currentField}...`}
                              onKeyPress={(e) => e.key === 'Enter' && handleChatbotSubmit()}
                              className="flex-1 h-11"
                            />
                            <Button 
                              onClick={handleChatbotSubmit} 
                              size="sm"
                              className="h-11 px-6 bg-primary hover:bg-primary/90"
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Send
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground/70">
                            Press Enter to submit or click Send
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Ready to Start Interview */}
                {canStartInterview && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Great! All required information has been collected. You're ready to start the interview.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            disabled={!canStartInterview || isInterviewActive}
            onClick={handleStartInterview}
            className="w-full"
          >
            {isInterviewActive ? "Interview in Progress" : canStartInterview ? "Start Interview" : "Complete Resume Upload First"}
          </Button>
        </div>
      </CardContent>
    </Card>

    {/* Interview Completion Dialog */}
    <InterviewCompletionDialog
      isOpen={showCompletionDialog}
      onClose={handleCompletionDialogClose}
      candidate={completedCandidate}
    />
  </>
  )
}
