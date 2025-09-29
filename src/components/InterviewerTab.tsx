"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  IconArrowDown,
  IconArrowUp,
  IconAlertCircle,
  IconCircleX,
  IconX,
  IconFilter,
  IconSearch,
  IconStar,
  IconTrash,
} from "@tabler/icons-react"

import { cn, formatTime, getDifficultyColor } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useInterviewStore, type Candidate } from "@/store/interviewStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<Candidate> = (row, _columnId, filterValue) => {
  const searchableRowContent =
    `${row.original.name} ${row.original.email}`.toLowerCase()
  const searchTerm = (filterValue ?? "").toLowerCase()
  return searchableRowContent.includes(searchTerm)
}

const statusFilterFn: FilterFn<Candidate> = (
  row,
  _columnId,
  filterValue: string[]
) => {
  if (!filterValue?.length) return true
  const status = row.getValue("interviewStatus") as string
  return filterValue.includes(status)
}


const getStatusColor = (status: string) => {
  switch (status) {
    case "completed": return "bg-primary/10 text-primary"
    case "in_progress": return "bg-secondary/10 text-secondary-foreground"
    case "paused": return "bg-muted text-muted-foreground"
    default: return "bg-muted text-muted-foreground"
  }
}


export function InterviewerTab() {
  const id = useId()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    totalTime: true,
    startTime: true,
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "finalScore",
      desc: true,
    },
  ])

  const [selectedSortField, setSelectedSortField] = useState<string>("finalScore")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [sortingEnabled, setSortingEnabled] = useState<boolean>(true)

  const { candidates, deleteCandidate } = useInterviewStore()

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)

  const columns: ColumnDef<Candidate>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      size: 28,
      enableSorting: false,
      enableHiding: false,
    },
    {
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
      size: 180,
      filterFn: multiColumnFilterFn,
      enableHiding: false,
    },
    {
      header: "Email",
      accessorKey: "email",
      size: 220,
    },
    {
      header: "Status",
      accessorKey: "interviewStatus",
      cell: ({ row }) => {
        const status = row.getValue("interviewStatus") as string
        return (
          <Badge className={getStatusColor(status)}>
            {status.replace('_', ' ')}
          </Badge>
        )
      },
      size: 120,
      filterFn: statusFilterFn,
    },
    {
      header: "Score",
      accessorKey: "finalScore",
      cell: ({ row }) => {
        const score = row.getValue("finalScore") as number | undefined
        return score !== undefined ? (
          <div className="flex items-center space-x-1">
            <IconStar className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{score}/100</span>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      },
      size: 100,
    },
    {
      header: "Duration",
      accessorKey: "totalTime",
      cell: ({ row }) => {
        const totalTime = row.getValue("totalTime") as number | undefined
        return (
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <span>{totalTime ? formatTime(totalTime) : '-'}</span>
          </div>
        )
      },
      size: 100,
      enableHiding: true,
    },
    {
      header: "Date",
      accessorKey: "startTime",
      cell: ({ row }) => {
        const startTime = row.getValue("startTime") as Date | undefined
        return (
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <span>{startTime ? new Date(startTime).toLocaleDateString() : '-'}</span>
          </div>
        )
      },
      size: 120,
      enableHiding: true,
    },
  ]


  // Sync sorting state with selected field and direction
  useEffect(() => {
    if (sortingEnabled) {
      setSorting([
        {
          id: selectedSortField,
          desc: sortDirection === "desc",
        },
      ])
    } else {
      setSorting([])
    }
  }, [selectedSortField, sortDirection, sortingEnabled])

  // Synchronize horizontal scrolling between header and body
  useEffect(() => {
    const headerScroll = headerScrollRef.current
    const bodyScroll = bodyScrollRef.current

    if (!headerScroll || !bodyScroll) return

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      target.scrollLeft = source.scrollLeft
    }

    const handleHeaderScroll = () => syncScroll(headerScroll, bodyScroll)
    const handleBodyScroll = () => syncScroll(bodyScroll, headerScroll)

    headerScroll.addEventListener('scroll', handleHeaderScroll)
    bodyScroll.addEventListener('scroll', handleBodyScroll)

    return () => {
      headerScroll.removeEventListener('scroll', handleHeaderScroll)
      bodyScroll.removeEventListener('scroll', handleBodyScroll)
    }
  }, [])

  const handleDeleteRows = () => {
    const selectedRows = table.getSelectedRowModel().rows
    selectedRows.forEach((row) => {
      deleteCandidate(row.original.id)
    })
    table.resetRowSelection()
  }

  const table = useReactTable({
    data: candidates,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  // Get unique status values
  const uniqueStatusValues = useMemo(() => {
    const statusColumn = table.getColumn("interviewStatus")

    if (!statusColumn) return []

    const values = Array.from(statusColumn.getFacetedUniqueValues().keys())

    return values.sort()
  }, [table])

  // Get counts for each status
  const statusCounts = useMemo(() => {
    const statusColumn = table.getColumn("interviewStatus")
    if (!statusColumn) return new Map()
    return statusColumn.getFacetedUniqueValues()
  }, [table])

  const selectedStatuses = useMemo(() => {
    const filterValue = table.getColumn("interviewStatus")?.getFilterValue() as string[]
    return filterValue ?? []
  }, [table])

  const handleStatusChange = (checked: boolean, value: string) => {
    const filterValue = table.getColumn("interviewStatus")?.getFilterValue() as string[]
    const newFilterValue = filterValue ? [...filterValue] : []

    if (checked) {
      newFilterValue.push(value)
    } else {
      const index = newFilterValue.indexOf(value)
      if (index > -1) {
        newFilterValue.splice(index, 1)
      }
    }

    table
      .getColumn("interviewStatus")
      ?.setFilterValue(newFilterValue.length ? newFilterValue : undefined)
  }

  const closeDetails = () => {
    setSelectedCandidate(null)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-2 sm:p-4">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 pb-2 sm:pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-1 sm:space-y-0">
          <div>
            <h2 className="flex items-center space-x-1 sm:space-x-2 text-base sm:text-lg font-semibold">
              <span>Candidates ({table.getFilteredRowModel().rows.length})</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              View all interview candidates ordered by score
            </p>
          </div>
        </div>
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="flex flex-col gap-3 mb-4">
            {/* Search input - full width on first line */}
            <div className="relative w-full">
              <Input
                id={`${id}-input`}
                ref={inputRef}
                className={cn(
                  "peer ps-9 border border-border/50 focus:border-border/70", // Make border thinner and less prominent
                  Boolean(table.getColumn("name")?.getFilterValue()) && "pe-9"
                )}
                style={{
                  boxShadow: "none", // Remove any box shadow
                  borderWidth: "1px", // Thinner border
                }}
                value={
                  (table.getColumn("name")?.getFilterValue() ?? "") as string
                }
                onChange={(e) =>
                  table.getColumn("name")?.setFilterValue(e.target.value)
                }
                placeholder="Filter by name or email..."
                type="text"
                aria-label="Filter by name or email"
              />
              <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                <IconSearch size={16} aria-hidden="true" />
              </div>
              {Boolean(table.getColumn("name")?.getFilterValue()) && (
                <button
                  className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed cursor-pointer"
                  aria-label="Clear filter"
                  onClick={() => {
                    table.getColumn("name")?.setFilterValue("")
                    if (inputRef.current) {
                      inputRef.current.focus()
                    }
                  }}
                >
                  <IconCircleX size={16} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Filter controls - second line */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Filter by status */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <IconFilter
                      className="-ms-1 opacity-60"
                      size={14}
                      aria-hidden="true"
                    />
                    Status
                    {selectedStatuses.length > 0 && (
                      <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-4 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                        {selectedStatuses.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto min-w-36 p-3" align="start">
                  <div className="space-y-3">
                    <div className="text-muted-foreground text-xs font-medium">
                      Filters
                    </div>
                    <div className="space-y-3">
                      {uniqueStatusValues.map((value, i) => (
                        <div key={value} className="flex items-center gap-2">
                          <Checkbox
                            id={`${id}-${i}`}
                            checked={selectedStatuses.includes(value)}
                            onCheckedChange={(checked: boolean) =>
                              handleStatusChange(checked, value)
                            }
                          />
                          <Label
                            htmlFor={`${id}-${i}`}
                            className="flex grow justify-between gap-2 font-normal"
                          >
                            {value.replace('_', ' ')}{" "}
                            <span className="text-muted-foreground ms-2 text-xs">
                              {statusCounts.get(value)}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {/* Sort by dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    Sort by: {sortingEnabled ? (selectedSortField === "name" ? "Name" : selectedSortField === "finalScore" ? "Score" : selectedSortField === "startTime" ? "Date" : selectedSortField === "totalTime" ? "Duration" : "Score") : "None"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedSortField("name")
                      setSortingEnabled(true)
                    }}
                    className={sortingEnabled && selectedSortField === "name" ? "bg-accent" : ""}
                  >
                    Name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedSortField("finalScore")
                      setSortingEnabled(true)
                    }}
                    className={sortingEnabled && selectedSortField === "finalScore" ? "bg-accent" : ""}
                  >
                    Score
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedSortField("startTime")
                      setSortingEnabled(true)
                    }}
                    className={sortingEnabled && selectedSortField === "startTime" ? "bg-accent" : ""}
                  >
                    Date
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedSortField("totalTime")
                      setSortingEnabled(true)
                    }}
                    className={sortingEnabled && selectedSortField === "totalTime" ? "bg-accent" : ""}
                  >
                    Duration
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setSortingEnabled(false)}
                    className={!sortingEnabled ? "bg-accent" : ""}
                  >
                    Clear sorting
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Sort direction arrow */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                disabled={!sortingEnabled}
                className="px-2 cursor-pointer"
              >
                {sortDirection === "asc" ? (
                  <IconArrowUp size={14} />
                ) : (
                  <IconArrowDown size={14} />
                )}
              </Button>
              {/* Delete button */}
              {table.getSelectedRowModel().rows.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/20 cursor-pointer ml-auto" variant="outline" size="sm">
                      <IconTrash
                        className="-ms-1"
                        size={14}
                        aria-hidden="true"
                      />
                      <span className="-ml-0.5 hidden lg:inline">Delete</span>
                      <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-4 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                        {table.getSelectedRowModel().rows.length}
                      </span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive"
                        aria-hidden="true"
                      >
                        <IconAlertCircle className="opacity-80 text-destructive" size={16} />
                      </div>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-destructive/80">
                          This action cannot be undone. This will permanently delete{" "}
                          {table.getSelectedRowModel().rows.length} selected{" "}
                          {table.getSelectedRowModel().rows.length === 1
                            ? "row"
                            : "rows"}
                          .
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteRows}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="relative">
            {/* Fixed Header */}
            <div className="absolute top-0 left-0 right-0 z-50 bg-background border-b">
              <div ref={headerScrollRef} className="overflow-x-auto">
                <Table className="table-fixed min-w-[600px]">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="hover:bg-transparent">
                        {headerGroup.headers.map((header) => {
                          return (
                            <TableHead
                              key={header.id}
                              style={{ width: `${header.getSize()}px` }}
                              className="h-9 text-xs bg-background px-1 sm:px-2"
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </TableHead>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                </Table>
              </div>
            </div>

            {/* Scrollable Body */}
            <div ref={bodyScrollRef} className="pt-9 h-130 sm:h-96 bg-background overflow-auto">
              <Table className="table-fixed min-w-[600px]">
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="h-8 cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedCandidate(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            style={{ width: `${cell.column.getSize()}px` }}
                            className="last:py-0 py-1 text-xs px-1 sm:px-2"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-16 text-center text-sm"
                      >
                        No results.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
      </div>

        {/* Results Overlay */}
        {selectedCandidate && createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closeDetails}
          >
            <div
              className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold">Interview Results</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCandidate.name} - Detailed Evaluation
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeDetails}
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
                        <div><strong>Name:</strong> {selectedCandidate.name}</div>
                        <div><strong>Email:</strong> {selectedCandidate.email}</div>
                        <div><strong>Phone:</strong> {selectedCandidate.phone}</div>
                      </div>
                    </div>

                    {/* Score Display */}
                    {selectedCandidate.finalScore !== undefined && (
                      <div className="border rounded-lg p-3 sm:p-4 text-center bg-gradient-to-r from-primary/5 to-primary/10">
                        <div className="text-3xl sm:text-4xl font-bold text-primary mb-1">
                          {selectedCandidate.finalScore}/100
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Your Interview Score
                        </p>
                      </div>
                    )}

                    {/* Questions and Answers */}
                    <div className="border rounded-lg p-3 sm:p-4">
                      <h4 className="text-sm sm:text-base font-semibold mb-3">Interview Questions & Answers</h4>
                      <div className="space-y-3">
                        {selectedCandidate.answers && selectedCandidate.answers.length > 0 ? (
                          selectedCandidate.answers.map((answer, index) => (
                            <div key={answer.questionId} className="border rounded-lg p-3 bg-muted/20">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-muted-foreground font-medium">Question {index + 1}</span>
                                  <Badge className={`text-xs px-1.5 py-0.5 ${getDifficultyColor(answer.difficulty)}`}>
                                    {answer.difficulty}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Time: {formatTime(answer.timeSpent * 1000)}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <strong className="text-xs font-medium">Question:</strong>
                                  <p className="text-sm mt-1 leading-relaxed">{answer.question}</p>
                                </div>
                                <div>
                                  <strong className="text-xs font-medium">Answer:</strong>
                                  <div className="bg-background border rounded-md p-3 mt-1">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground bg-muted/20">
                            No questions available
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Evaluation */}
                    {selectedCandidate.aiEvaluation && (
                      <div className="border rounded-lg p-3 sm:p-4 space-y-3">
                        <h4 className="text-sm sm:text-base font-semibold">AI Evaluation</h4>

                        {/* Summary */}
                        <div>
                          <p className="text-sm leading-relaxed">{selectedCandidate.aiEvaluation.summary}</p>
                        </div>

                        {/* Strengths */}
                        {selectedCandidate.aiEvaluation.strengths && selectedCandidate.aiEvaluation.strengths.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-green-700 mb-2">Strengths:</h5>
                            <ul className="text-sm space-y-1 ml-2">
                              {selectedCandidate.aiEvaluation.strengths.map((strength, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-green-600 mr-2">•</span>
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Weaknesses */}
                        {selectedCandidate.aiEvaluation.weaknesses && selectedCandidate.aiEvaluation.weaknesses.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-orange-700 mb-2">Areas for Improvement:</h5>
                            <ul className="text-sm space-y-1 ml-2">
                              {selectedCandidate.aiEvaluation.weaknesses.map((weakness, index) => (
                                <li key={index} className="flex items-start">
                                  <span className="text-orange-600 mr-2">•</span>
                                  {weakness}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Recommendations */}
                        {selectedCandidate.aiEvaluation.recommendations && selectedCandidate.aiEvaluation.recommendations.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-blue-700 mb-2">Recommendations:</h5>
                            <ul className="text-sm space-y-1 ml-2">
                              {selectedCandidate.aiEvaluation.recommendations.map((rec, index) => (
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
                    {!selectedCandidate.aiEvaluation && selectedCandidate.aiSummary && (
                      <div className="border rounded-lg p-3 sm:p-4">
                        <h4 className="text-sm sm:text-base font-semibold mb-2">Interview Summary</h4>
                        <div>
                          <p className="text-sm whitespace-pre-line leading-relaxed">{selectedCandidate.aiSummary}</p>
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
    </div>
  )
}
