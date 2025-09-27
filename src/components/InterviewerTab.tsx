"use client"

import { useId, useMemo, useRef, useState } from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleXIcon,
  EllipsisIcon,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useInterviewStore, type Candidate } from "@/store/interviewStore"

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
          <div className="h-4 w-4 rounded-full bg-muted" />
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
          <div className="h-4 w-4 rounded-full bg-muted" />
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
    totalTime: false,
    startTime: false,
  })
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const inputRef = useRef<HTMLInputElement>(null)

  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "finalScore",
      desc: true,
    },
  ])

  const { candidates, deleteCandidate } = useInterviewStore()

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
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      pagination,
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
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Candidates List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
            <div>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <div className="h-4 w-4 rounded bg-muted" />
                <span>Candidates ({table.getFilteredRowModel().rows.length})</span>
              </CardTitle>
              <CardDescription className="text-sm">
                View all interview candidates ordered by score
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                    className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed"
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
            </div>
            <div className="flex items-center gap-3">
              {/* Delete button */}
              {table.getSelectedRowModel().rows.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="ml-auto" variant="outline" size="sm">
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
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border"
                        aria-hidden="true"
                      >
                        <CircleAlertIcon className="opacity-80" size={16} />
                      </div>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
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
                      <AlertDialogAction onClick={handleDeleteRows}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-background overflow-hidden rounded-md border">
            <Table className="table-fixed">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead
                          key={header.id}
                          style={{ width: `${header.getSize()}px` }}
                          className="h-9 text-xs"
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <div
                              className={cn(
                                header.column.getCanSort() &&
                                  "flex h-full cursor-pointer items-center justify-between gap-2 select-none"
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                              onKeyDown={(e) => {
                                // Enhanced keyboard handling for sorting
                                if (
                                  header.column.getCanSort() &&
                                  (e.key === "Enter" || e.key === " ")
                                ) {
                                  e.preventDefault()
                                  header.column.getToggleSortingHandler()?.(e)
                                }
                              }}
                              tabIndex={header.column.getCanSort() ? 0 : undefined}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {{
                                asc: (
                                  <ChevronUpIcon
                                    className="shrink-0 opacity-60"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                ),
                                desc: (
                                  <ChevronDownIcon
                                    className="shrink-0 opacity-60"
                                    size={16}
                                    aria-hidden="true"
                                  />
                                ),
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )
                          )}
                        </TableHead>
                      )
                    })}
                </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="h-8"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="last:py-0 py-1 text-xs">
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

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4 mt-3">
            {/* Results per page */}
            <div className="flex items-center gap-2">
              <Label htmlFor={id} className="max-sm:sr-only text-xs">
                Rows per page
              </Label>
              <Select
                value={table.getState().pagination.pageSize.toString()}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger id={id} className="w-fit whitespace-nowrap h-8 text-xs">
                  <SelectValue placeholder="Select number of results" />
                </SelectTrigger>
                <SelectContent className="[&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8 [&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2">
                  {[5, 10, 25, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={pageSize.toString()}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                        </div>
            {/* Page number information */}
            <div className="text-muted-foreground flex grow justify-end text-xs whitespace-nowrap">
              <p
                className="text-muted-foreground text-xs whitespace-nowrap"
                aria-live="polite"
              >
                <span className="text-foreground">
                  {table.getState().pagination.pageIndex *
                    table.getState().pagination.pageSize +
                    1}
                  -
                  {Math.min(
                    Math.max(
                      table.getState().pagination.pageIndex *
                        table.getState().pagination.pageSize +
                        table.getState().pagination.pageSize,
                      0
                    ),
                    table.getRowCount()
                  )}
                </span>{" "}
                of{" "}
                <span className="text-foreground">
                  {table.getRowCount().toString()}
                </span>
              </p>
            </div>

            {/* Pagination buttons */}
            <div>
              <div className="flex items-center gap-1">
                {/* First page button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0"
                  onClick={() => table.firstPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to first page"
                >
                  <ChevronFirstIcon size={14} aria-hidden="true" />
                </Button>
                {/* Previous page button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label="Go to previous page"
                >
                  <ChevronLeftIcon size={14} aria-hidden="true" />
                </Button>
                {/* Next page button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to next page"
                >
                  <ChevronRightIcon size={14} aria-hidden="true" />
                </Button>
                {/* Last page button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0"
                  onClick={() => table.lastPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label="Go to last page"
                >
                  <ChevronLastIcon size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
                      </div>
  )
}

function RowActions({ row }: { row: Row<Candidate> }) {
  const { deleteCandidate } = useInterviewStore()
  const candidate = row.original

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="shadow-none h-6 w-6 p-0"
            aria-label="Edit item"
          >
            <EllipsisIcon size={12} aria-hidden="true" />
          </Button>
                      </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
                        <Dialog>
                          <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <EyeIcon size={14} aria-hidden="true" />
                <span>View Details</span>
              </DropdownMenuItem>
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
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
                          onClick={() => deleteCandidate(candidate.id)}
          >
            <TrashIcon size={14} aria-hidden="true" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}