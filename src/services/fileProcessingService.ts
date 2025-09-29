import type { PDFPageProxy } from 'pdfjs-dist'

// Dynamic import for mammoth to avoid bundling issues
let mammothLib: any = null

const initMammoth = async () => {
  if (!mammothLib) {
    mammothLib = await import('mammoth')
  }
  return mammothLib.default || mammothLib
}

// Dynamic import for PDF.js to avoid bundling issues
let pdfjsLib: typeof import('pdfjs-dist') | null = null

const initPDFJS = async () => {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist')
    // Configure PDF.js worker - use local worker file
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
  }
  return pdfjsLib
}


export class FileProcessingService {
  /**
   * Extract text content from a PDF file with optimized processing
   */
  static async extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()

    // Initialize PDF.js dynamically
    const pdfjs = await initPDFJS()

    // Configure PDF.js for better performance
    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/cmaps/',
      cMapPacked: true,
      // Disable font rendering for better performance
      disableFontFace: true,
      // Enable text layer for better text extraction
      disableRange: false,
      disableStream: false,
      disableAutoFetch: false,
    })

    const pdf = await loadingTask.promise
    let fullText = ""
    const maxPages = Math.min(pdf.numPages, 50) // Limit pages to prevent excessive processing

    // Process pages in batches for better performance
    const batchSize = 5
    for (let batchStart = 1; batchStart <= maxPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, maxPages)
      const pagePromises = []

      for (let i = batchStart; i <= batchEnd; i++) {
        pagePromises.push(
          pdf.getPage(i).then(async (page: PDFPageProxy) => {
            try {
              const textContent = await page.getTextContent()
              const pageText = textContent.items
                .map((item: any) => 'str' in item ? item.str : '')
                .join(' ')
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim()
              return pageText
            } catch (error) {
              console.warn(`Failed to extract text from page ${i}:`, error)
              return '' // Return empty string for failed pages
            }
          })
        )
      }

      const pageTexts = await Promise.all(pagePromises)
      fullText += pageTexts.join('\n') + '\n'
    }

    return fullText.trim()
  }

  /**
   * Extract text content from a DOCX file
   */
  static async extractTextFromDOCX(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const mammoth = await initMammoth()
    const result = await mammoth.extractRawText({ arrayBuffer })

    return result.value
  }

  /**
   * Extract text from supported file types (PDF, DOCX)
   */
  static async extractTextFromFile(file: File): Promise<string> {
    if (file.type === "application/pdf") {
      return await this.extractTextFromPDF(file)
    } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return await this.extractTextFromDOCX(file)
    } else {
      throw new Error("Unsupported file type")
    }
  }

  /**
   * Validate file type and size
   */
  static validateFile(file: File, maxSizeMB: number = 5): { isValid: boolean; error?: string } {
    const maxSize = maxSizeMB * 1024 * 1024 // Convert to bytes

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File too large. Please upload a file smaller than ${maxSizeMB}MB.`
      }
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: "Invalid file type. Please upload only PDF or DOCX files."
      }
    }

    // Validate file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !['pdf', 'docx'].includes(fileExtension)) {
      return {
        isValid: false,
        error: "Invalid file extension. Please upload only PDF or DOCX files."
      }
    }

    return { isValid: true }
  }
}
