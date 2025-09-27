import { useState, useCallback, useRef } from 'react'

interface FileWithId {
  id: string
  file: File
  name: string
  size: number
  type: string
}

interface UseFileUploadOptions {
  accept?: string
  maxSize?: number
  multiple?: boolean
  onError?: (error: string) => void
}

interface UseFileUploadReturn {
  files: FileWithId[]
  isDragging: boolean
  errors: string[]
  handleDragEnter: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  openFileDialog: () => void
  removeFile: (id: string) => void
  getInputProps: () => React.InputHTMLAttributes<HTMLInputElement>
}

export function useFileUpload({
  accept,
  maxSize,
  multiple = false,
  onError
}: UseFileUploadOptions = {}): UseFileUploadReturn {
  const [files, setFiles] = useState<FileWithId[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateId = () => Math.random().toString(36).substring(2, 11)

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`
    }
    
    if (accept) {
      const acceptedTypes = accept.split(',').map(type => type.trim())
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      const mimeType = file.type
      
      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type
        }
        if (type.includes('*')) {
          const pattern = type.replace(/\*/g, '.*')
          return new RegExp(pattern).test(mimeType)
        }
        return mimeType === type
      })
      
      if (!isValidType) {
        return `File type not supported. Accepted types: ${accept}`
      }
    }
    
    return null
  }

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const newFileObjects: FileWithId[] = []
    const newErrors: string[] = []

    fileArray.forEach(file => {
      const error = validateFile(file)
      if (error) {
        newErrors.push(`${file.name}: ${error}`)
        if (onError) onError(error)
      } else {
        newFileObjects.push({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type
        })
      }
    })

    setFiles(prev => {
      if (multiple) {
        return [...prev, ...newFileObjects]
      } else {
        return newFileObjects.length > 0 ? [newFileObjects[0]] : []
      }
    })

    setErrors(prev => [...prev, ...newErrors])
  }, [accept, maxSize, multiple, onError])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }, [addFiles])

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id))
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(selectedFiles)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }, [addFiles])

  const getInputProps = useCallback(() => {
    return {
      ref: fileInputRef,
      type: 'file',
      accept,
      multiple,
      onChange: handleFileInputChange,
      style: { display: 'none' }
    } as React.InputHTMLAttributes<HTMLInputElement> & { ref: React.RefObject<HTMLInputElement> }
  }, [accept, multiple, handleFileInputChange])

  return {
    files,
    isDragging,
    errors,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFileDialog,
    removeFile,
    getInputProps
  }
}
