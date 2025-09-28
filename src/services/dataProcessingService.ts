export interface ExtractedData {
  name?: string
  email?: string
  phone?: string
  rawText: string
}

export interface MissingFields {
  name: boolean
  email: boolean
  phone: boolean
}

export class DataProcessingService {
  /**
   * Extract contact information from text using regex patterns
   */
  static extractFields(text: string): ExtractedData {
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

    return extractedData
  }

  /**
   * Check which required fields are missing from extracted data
   */
  static getMissingFields(extractedData: ExtractedData): MissingFields {
    return {
      name: !extractedData.name,
      email: !extractedData.email,
      phone: !extractedData.phone
    }
  }

  /**
   * Get field status combining extracted and manually collected data
   */
  static getFieldStatus(
    field: keyof MissingFields,
    extractedData: ExtractedData | null,
    collectedData: Record<string, string>
  ): { status: 'extracted' | 'collected' | 'missing'; value: string | null } {
    if (extractedData?.[field]) {
      return { status: 'extracted', value: extractedData[field]! }
    } else if (collectedData[field]) {
      return { status: 'collected', value: collectedData[field] }
    } else {
      return { status: 'missing', value: null }
    }
  }

  /**
   * Check if all required fields are available (either extracted or collected)
   */
  static hasAllRequiredFields(extractedData: ExtractedData | null, collectedData: Record<string, string>): boolean {
    const requiredFields: (keyof MissingFields)[] = ['name', 'email', 'phone']

    return requiredFields.every(field => {
      return (extractedData?.[field]) || collectedData[field]
    })
  }
}
