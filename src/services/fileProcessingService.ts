import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Configure PDF.js worker - use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

export class FileProcessingService {
  /**
   * Extract text content from a PDF file
   */
  static async extractTextFromPDF(file: File): Promise<string> {
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

    return fullText
  }

  /**
   * Extract text content from a DOCX file
   */
  static async extractTextFromDOCX(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
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
