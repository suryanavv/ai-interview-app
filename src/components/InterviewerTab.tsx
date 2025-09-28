"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
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

import { cn } from "@/lib/utils"
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

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed": return "bg-primary/10 text-primary"
    case "in_progress": return "bg-secondary/10 text-secondary-foreground"
    case "paused": return "bg-muted text-muted-foreground"
    default: return "bg-muted text-muted-foreground"
  }
}

const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
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

  const { candidates, deleteCandidate, addCandidate, updateCandidate } = useInterviewStore()

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

  // Add dummy candidates if none exist
  useEffect(() => {
    if (candidates.length === 0) {
      const dummyCandidates = [
        { name: "John Smith", email: "john.smith@email.com", phone: "+1-555-0101", interviewStatus: "completed", finalScore: 85 },
        { name: "Sarah Johnson", email: "sarah.johnson@email.com", phone: "+1-555-0102", interviewStatus: "completed", finalScore: 92 },
        { name: "Michael Brown", email: "michael.brown@email.com", phone: "+1-555-0103", interviewStatus: "completed", finalScore: 78 },
        { name: "Emily Davis", email: "emily.davis@email.com", phone: "+1-555-0104", interviewStatus: "in_progress", finalScore: undefined },
        { name: "David Wilson", email: "david.wilson@email.com", phone: "+1-555-0105", interviewStatus: "completed", finalScore: 88 },
        { name: "Lisa Anderson", email: "lisa.anderson@email.com", phone: "+1-555-0106", interviewStatus: "completed", finalScore: 76 },
        { name: "Robert Taylor", email: "robert.taylor@email.com", phone: "+1-555-0107", interviewStatus: "completed", finalScore: 91 },
        { name: "Jennifer Martinez", email: "jennifer.martinez@email.com", phone: "+1-555-0108", interviewStatus: "not_started", finalScore: undefined },
        { name: "James Garcia", email: "james.garcia@email.com", phone: "+1-555-0109", interviewStatus: "completed", finalScore: 83 },
        { name: "Maria Rodriguez", email: "maria.rodriguez@email.com", phone: "+1-555-0110", interviewStatus: "completed", finalScore: 89 },
        { name: "Christopher Lee", email: "christopher.lee@email.com", phone: "+1-555-0111", interviewStatus: "completed", finalScore: 74 },
        { name: "Amanda White", email: "amanda.white@email.com", phone: "+1-555-0112", interviewStatus: "in_progress", finalScore: undefined },
        { name: "Daniel Harris", email: "daniel.harris@email.com", phone: "+1-555-0113", interviewStatus: "completed", finalScore: 87 },
        { name: "Jessica Clark", email: "jessica.clark@email.com", phone: "+1-555-0114", interviewStatus: "completed", finalScore: 82 },
        { name: "Matthew Lewis", email: "matthew.lewis@email.com", phone: "+1-555-0115", interviewStatus: "not_started", finalScore: undefined },
      ]

      dummyCandidates.forEach((candidate, index) => {
        // Add basic candidate info first
        const candidateId = addCandidate({
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
        })

        // Then update with additional properties
        const startTime = new Date(Date.now() - (index * 24 * 60 * 60 * 1000)) // Spread over last 15 days
        const totalTime = candidate.interviewStatus === "completed" ? Math.floor(Math.random() * 1800) + 600 : undefined // 10-40 minutes

        const updates: any = {
          interviewStatus: candidate.interviewStatus,
          currentQuestionIndex: candidate.interviewStatus === "completed" ? 6 : candidate.interviewStatus === "in_progress" ? Math.floor(Math.random() * 6) : 0,
        }

        if (candidate.finalScore !== undefined) {
          updates.finalScore = candidate.finalScore
        }

        if (candidate.interviewStatus !== "not_started") {
          updates.startTime = startTime
        }

        if (totalTime !== undefined) {
          updates.totalTime = totalTime
        }

        // Use updateCandidate to set the additional properties
        updateCandidate(candidateId, updates)
      })
    }
  }, [candidates.length, addCandidate])

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
  }, [table.getColumn("interviewStatus")?.getFacetedUniqueValues()])

  // Get counts for each status
  const statusCounts = useMemo(() => {
    const statusColumn = table.getColumn("interviewStatus")
    if (!statusColumn) return new Map()
    return statusColumn.getFacetedUniqueValues()
  }, [table.getColumn("interviewStatus")?.getFacetedUniqueValues()])

  const selectedStatuses = useMemo(() => {
    const filterValue = table.getColumn("interviewStatus")?.getFilterValue() as string[]
    return filterValue ?? []
  }, [table.getColumn("interviewStatus")?.getFilterValue()])

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

      {/* Details Overlay */}
      {selectedCandidate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-8"
          onClick={closeDetails}
        >
          <div 
            className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-full overflow-hidden flex flex-col border-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 p-3 border-b flex justify-between items-center">
              <div>
                <h3 className="text-base sm:text-lg font-semibold">{selectedCandidate.name} - Interview Details</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                {selectedCandidate.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeDetails}
                className="p-0"
              >
                <IconX size={16} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Candidate Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border rounded p-3">
                    <h4 className="font-medium mb-1 text-sm">Contact Information</h4>
                    <div className="space-y-1 text-xs">
                      <p><strong>Name:</strong> {selectedCandidate.name}</p>
                      <p><strong>Email:</strong> {selectedCandidate.email}</p>
                      <p><strong>Phone:</strong> {selectedCandidate.phone}</p>
                    </div>
                  </div>
                  <div className="border rounded p-3">
                    <h4 className="font-medium mb-1 text-sm">Interview Summary</h4>
                    <div className="space-y-1 text-xs">
                      <p><strong>Status:</strong> {selectedCandidate.interviewStatus.replace('_', ' ')}</p>
                      <p><strong>Score:</strong> {selectedCandidate.finalScore || 'Pending'}/100</p>
                      <p><strong>Duration:</strong> {selectedCandidate.totalTime ? formatTime(selectedCandidate.totalTime) : 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Questions and Answers */}
                <div>
                  <h4 className="font-medium mb-2 text-sm">Interview Questions & Answers</h4>
                  <div className="space-y-2">
                    {selectedCandidate.answers && selectedCandidate.answers.length > 0 ? (
                      selectedCandidate.answers.map((answer, index) => (
                        <div key={answer.questionId} className="border rounded p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-1">
                            <span className="text-xs text-muted-foreground">Question {index + 1}</span>
                              <Badge className={`text-xs px-1.5 py-0.5 ${getDifficultyColor(answer.difficulty)}`}>
                                {answer.difficulty}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Time: {formatTime(answer.timeSpent * 1000)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div>
                              <strong className="text-xs">Question:</strong>
                              <p className="text-xs mt-1">{answer.question}</p>
                            </div>
                            <div>
                              <strong className="text-xs">Answer:</strong>
                              <p className="text-xs mt-1 bg-muted p-2 rounded">
                                {answer.answer}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="border rounded p-4 text-center text-sm text-muted-foreground">
                        No questions available
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Summary */}
                {selectedCandidate.aiSummary && (
                  <div className="border rounded p-3">
                    <h4 className="font-medium mb-1 text-sm">AI Summary</h4>
                    <div className="bg-accent p-2 rounded">
                      <p className="text-xs">{selectedCandidate.aiSummary}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
