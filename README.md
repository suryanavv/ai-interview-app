# Crisp - AI-Powered Interview Assistant

An AI-powered interview assistant built with React that streamlines the interview process for full-stack (React/Node) developer positions. The application provides a seamless experience for both candidates and interviewers with real-time chat, automated question generation, and comprehensive candidate evaluation.

## Features

### Interviewee Experience
- **Resume Upload**: Upload PDF or DOCX resumes for automatic data extraction
- **Smart Field Extraction**: Automatically extracts Name, Email, and Phone from uploaded resumes
- **Interactive Data Collection**: Chatbot prompts for any missing information before interview begins
- **AI-Powered Interview**: Dynamic question generation tailored to full-stack React/Node roles
- **Timed Questions**: Structured interview with 6 questions (2 Easy, 2 Medium, 2 Hard)
  - Easy questions: 20 seconds each
  - Medium questions: 60 seconds each
  - Hard questions: 120 seconds each
- **Auto-Submission**: Automatically submits answers when time expires
- **Progress Tracking**: Real-time progress indicators and timer displays

### Interviewer Dashboard
- **Candidate Management**: Comprehensive list of all candidates ordered by score
- **Detailed Candidate Views**: Access complete chat history, profiles, and AI-generated summaries
- **Search & Sort**: Advanced filtering and sorting capabilities
- **Performance Analytics**: Score tracking and interview duration metrics

### Data Persistence
- **Local Storage**: All interview data, answers, and progress saved locally
- **Session Recovery**: Automatic restoration of progress on page refresh or reopening
- **Welcome Back Modal**: Resume interrupted interviews with progress preservation

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **State Management**: Zustand with persistence
- **UI Components**: Radix UI primitives with Tailwind CSS
- **File Processing**: PDF.js for PDF parsing, Mammoth.js for DOCX
- **AI Integration**: OpenRouter API for dynamic question generation and evaluation
- **Build Tool**: Vite with optimized chunking

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/suryanavv/ai-interview-app.git
   cd ai-interview-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your OpenRouter API key:
   ```env
   VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
   VITE_AI_ENABLED=true
   VITE_AI_MODEL=openai/gpt-oss-20b:free
   VITE_AI_TIMEOUT=20000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
```bash
   npm run build
   npm run preview
   ```

## Usage

### For Candidates (Interviewee Tab)
1. **Upload Resume**: Drag and drop or click to upload PDF/DOCX resume
2. **Complete Profile**: Fill in any missing information (Name, Email, Phone) via chatbot
3. **Start Interview**: Begin the AI-powered interview session
4. **Answer Questions**: Respond to each question within the allocated time
5. **View Results**: Receive final score and AI-generated summary upon completion

### For Interviewers (Interviewer Tab)
1. **View Candidates**: Browse all candidates ordered by performance score
2. **Search & Filter**: Use search functionality to find specific candidates
3. **Detailed Analysis**: Click on any candidate to view:
   - Complete chat history
   - Question-by-question breakdown
   - AI evaluation scores
   - Candidate profile information
   - Final AI summary

## Configuration

### AI Settings
- **AI_ENABLED**: Enable/disable AI features (default: true)
- **OPENROUTER_API_KEY**: Your OpenRouter API key (required for AI features)
- **AI_MODEL**: AI model for question generation (default: openai/gpt-oss-20b:free)
- **AI_TIMEOUT**: Timeout for AI requests in milliseconds (default: 20000)

### Popular AI Models
- `openai/gpt-oss-20b:free` - Free tier, good performance
- `anthropic/claude-sonnet-4` - High quality (paid)
- `openai/gpt-5` - High quality (paid)
- `google/gemini-2.5-flash` - High quality (paid)
- `x-ai/grok-4-fast` - High quality (paid)

## Interview Flow

The application follows a structured 6-question interview process:

1. **Preparation Phase**
   - Resume upload and data extraction
   - Missing information collection via chatbot
   - Interview initialization

2. **Interview Phase**
   - Question 1-2: Easy (20s each) - Basic concepts
   - Question 3-4: Medium (60s each) - Intermediate concepts
   - Question 5-6: Hard (120s each) - Advanced concepts

3. **Evaluation Phase**
   - AI analysis of all responses
   - Final score calculation (0-100)
   - Comprehensive candidate summary

## Data Persistence

All interview data is automatically saved to local storage, including:
- Candidate profiles and extracted resume data
- Interview progress and current question
- All answers and timestamps
- Timer states and session information
- AI-generated questions and evaluations

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npx tsc --noEmit
```

## License

This project is built as part of the Swipe Internship Assignment.
