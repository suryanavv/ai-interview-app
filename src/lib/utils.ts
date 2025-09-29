import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format time in MM:SS format
 * @param time - Time in seconds (for remaining time) or milliseconds (for total time)
 * @returns Formatted time string
 */
export function formatTime(time: number): string {
  const seconds = Math.floor(time / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Get difficulty color class for badges
 * @param difficulty - Difficulty level ("Easy", "Medium", "Hard")
 * @returns Tailwind CSS classes for the badge
 */
export function getDifficultyColor(difficulty: string): string {
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
