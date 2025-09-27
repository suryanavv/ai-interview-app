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
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleAlertIcon,
  CircleXIcon,
  EyeIcon,
  FilterIcon,
  SearchIcon,
  StarIcon,
  TrashIcon,
} from "lucide-react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
    case "Easy": return "bg-primary/10 text-primary"
    case "Medium": return "bg-secondary/10 text-secondary-foreground"
    case "Hard": return "bg-destructive/10 text-destructive"
    default: return "bg-muted text-muted-foreground"
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
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
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
          <StarIcon className="h-4 w-4 text-primary" />
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
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
]


export function InterviewerTab() {
  const id = useId()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    totalTime: true,
    startTime: true,
  })
  const inputRef = useRef<HTMLInputElement>(null)

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

  const handleDeleteRows = () => {
    const selectedRows = table.getSelectedRowModel().rows
    selectedRows.forEach((row) => {
      deleteCandidate(row.original.id)
    })
    table.resetRowSelection()
  }

  const table = useReactTable({
    data: candidates,
    columns,
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

  return (
    <div className="w-fullmx-auto space-y-4">
      {/* Candidates List */}
      <div className="">
        <div className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
            <div>
              <h2 className="flex items-center space-x-2 text-lg font-semibold">
                <span>Candidates ({table.getFilteredRowModel().rows.length})</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                View all interview candidates ordered by score
              </p>
            </div>
          </div>
        </div>
        <div>
          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-3">
              {/* Filter by name or email */}
              <div className="relative">
                <Input
                  id={`${id}-input`}
                  ref={inputRef}
                  className={cn(
                    "peer min-w-60 ps-9",
                    Boolean(table.getColumn("name")?.getFilterValue()) && "pe-9"
                  )}
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
                  <SearchIcon size={16} aria-hidden="true" />
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
                    <CircleXIcon size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              {/* Filter by status */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FilterIcon
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
                  <ArrowUpIcon size={14} />
                ) : (
                  <ArrowDownIcon size={14} />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {/* Delete button */}
              {table.getSelectedRowModel().rows.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="ml-auto text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/20 cursor-pointer" variant="outline" size="sm">
                      <TrashIcon
                        className="-ms-1 opacity-60"
                        size={14}
                        aria-hidden="true"
                      />
                      Delete
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
                        <CircleAlertIcon className="opacity-80 text-destructive" size={16} />
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
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-background border-b">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          style={{ width: `${header.getSize()}px` }}
                          className="h-9 text-xs sticky top-0 bg-background z-10"
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
            <ScrollArea className="h-94 bg-background">
              <Table className="table-fixed">
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="h-8"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            style={{ width: `${cell.column.getSize()}px` }}
                            className="last:py-0 py-1 text-xs"
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
            </ScrollArea>
          </div>

        </div>
      </div>
    </div>
  )
}

function RowActions({ row }: { row: Row<Candidate> }) {
  const { deleteCandidate } = useInterviewStore()
  const candidate = row.original

  return (
    <div className="flex justify-end gap-1">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            size="sm"
            className="h-8 text-accent-foreground px-2 cursor-pointer !bg-transparent hover:text-accent-foreground hover:!bg-transparent active:!bg-transparent focus:!bg-transparent"
            style={{
              background: "transparent",
            }}
          >
            <EyeIcon size={14} aria-hidden="true" />
            <span className="ml-1">View</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg">{candidate.name} - Interview Details</DialogTitle>
            <DialogDescription className="text-sm">
              Complete interview history and evaluation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Candidate Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <h4 className="font-medium mb-1 text-sm">Contact Information</h4>
                <div className="space-y-1 text-xs">
                  <p><strong>Name:</strong> {candidate.name}</p>
                  <p><strong>Email:</strong> {candidate.email}</p>
                  <p><strong>Phone:</strong> {candidate.phone}</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-1 text-sm">Interview Summary</h4>
                <div className="space-y-1 text-xs">
                  <p><strong>Status:</strong> {candidate.interviewStatus.replace('_', ' ')}</p>
                  <p><strong>Score:</strong> {candidate.finalScore || 'Pending'}/100</p>
                  <p><strong>Duration:</strong> {candidate.totalTime ? formatTime(candidate.totalTime) : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Questions and Answers */}
            <div>
              <h4 className="font-medium mb-2 text-sm">Interview Questions & Answers</h4>
              <div className="space-y-2">
                {candidate.answers.map((answer, index) => (
                  <div key={answer.questionId} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1">
                        <Badge className={`text-xs px-1.5 py-0.5 ${getDifficultyColor(answer.difficulty)}`}>
                          {answer.difficulty}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Question {index + 1}</span>
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
                ))}
              </div>
            </div>

            {/* AI Summary */}
            {candidate.aiSummary && (
              <div>
                <h4 className="font-medium mb-1 text-sm">AI Summary</h4>
                <div className="bg-accent p-2 rounded">
                  <p className="text-xs">{candidate.aiSummary}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 px-2 text-destructive hover:text-destructive cursor-pointer !bg-transparent hover:!bg-transparent active:!bg-transparent focus:!bg-transparent"
        onClick={() => deleteCandidate(candidate.id)}
        style={{
          background: "transparent",
        }}
      >
        <TrashIcon size={14} aria-hidden="true" />
        <span className="ml-1">Delete</span>
      </Button>
    </div>
  )
}