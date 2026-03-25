"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { Upload, Plus } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010"

function getPipelineState(job) {
  const uploaded = true

  const ranked =
    !!job?.baseline ||
    (Array.isArray(job?.experiments) && job.experiments.length > 0)

  const explained =
    (Array.isArray(job?.explanations) && job.explanations.length > 0) ||
    !!job?.summary

  return { uploaded, ranked, explained }
}

function getNextAction(job) {
  const { ranked, explained } = getPipelineState(job)

  if (!ranked) return "Run Baseline"
  if (!explained) return "Run Experiments"
  return "View Results"
}

function StepDot({ active }) {
  return (
    <div
      className={`h-4 w-4 rounded-full border ${
        active
          ? "border-green-500 bg-green-500"
          : "border-muted-foreground/30 bg-background"
      }`}
    />
  )
}

function StepLine({ active }) {
  return (
    <div
      className={`mx-3 h-[2px] w-16 rounded-full ${
        active ? "bg-green-500/70" : "bg-muted"
      }`}
    />
  )
}

function JobPipeline({ job }) {
  const { uploaded, ranked, explained } = getPipelineState(job)

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center">
        <StepDot active={uploaded} />
        <StepLine active={ranked} />
        <StepDot active={ranked} />
        <StepLine active={explained} />
        <StepDot active={explained} />
      </div>

      <div className="mt-3 grid w-full grid-cols-3 text-center text-xs text-muted-foreground">
        <span className={uploaded ? "text-foreground" : ""}>Upload</span>
        <span className={ranked ? "text-foreground" : ""}>Ranked</span>
        <span className={explained ? "text-foreground" : ""}>Explained</span>
      </div>
    </div>
  )
}

export default function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [jobPdfFile, setJobPdfFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadJobs = async () => {
    try {
      setLoading(true)
      setError("")

      const res = await fetch(`${API_BASE}/jobs`, { cache: "no-store" })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`GET /jobs failed (${res.status}) ${txt}`)
      }

      const data = await res.json()
      const indexJobs = Array.isArray(data?.jobs) ? data.jobs : []

      const fullJobs = await Promise.all(
        indexJobs.map(async (job) => {
          try {
            const stateRes = await fetch(
              `${API_BASE}/jobs/${encodeURIComponent(job.job_id)}`,
              { cache: "no-store" }
            )

            if (!stateRes.ok) {
              return { ...job }
            }

            const state = await stateRes.json()

            return {
              ...job,
              ...state,
              job_id: state?.job?.job_id || job?.job_id,
            }
          } catch {
            return { ...job }
          }
        })
      )

      setJobs(fullJobs)
    } catch (e) {
      setError(e?.message || "Failed to load jobs")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return jobs.filter((job) => {
      return (
        (job?.job_id || "").toLowerCase().includes(q) ||
        getNextAction(job).toLowerCase().includes(q)
      )
    })
  }, [jobs, searchQuery])

  const resetForm = () => {
    setJobPdfFile(null)

    const fileInput = document.getElementById("job-pdf-upload")
    if (fileInput) fileInput.value = ""
  }

  const handleUploadJob = async () => {
    if (!jobPdfFile) {
      setError("Please upload a job PDF")
      return
    }

    try {
      setIsSubmitting(true)
      setError("")

      const formData = new FormData()
      formData.append("file", jobPdfFile)

      const res = await fetch(`${API_BASE}/jobs/upload`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`POST /jobs/upload failed (${res.status}) ${txt}`)
      }

      resetForm()
      setIsDialogOpen(false)
      await loadJobs()
    } catch (e) {
      setError(e?.message || "Failed to create job")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteJob = async (jobIdToDelete) => {
    if (!jobIdToDelete) return

    const ok = window.confirm(
      `Delete job "${jobIdToDelete}"? This cannot be undone.`
    )
    if (!ok) return

    try {
      setError("")

      const res = await fetch(
        `${API_BASE}/jobs/${encodeURIComponent(jobIdToDelete)}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`DELETE /jobs/${jobIdToDelete} failed (${res.status}) ${txt}`)
      }

      await loadJobs()
    } catch (e) {
      setError(e?.message || "Failed to delete job")
    }
  }

  return (
    <div>
      <PageHeader
        title="Job Orders"
        description="Manage your uploaded jobs and track pipeline progress"
      >
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              resetForm()
              setError("")
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Add New Job
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Job</DialogTitle>
              <DialogDescription>
                Upload a job description PDF. The current backend uses the PDF
                file name as the Job ID.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="job-pdf-upload">Upload Job PDF</Label>

                <input
                  id="job-pdf-upload"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file =
                      e.target.files && e.target.files[0]
                        ? e.target.files[0]
                        : null
                    setJobPdfFile(file)
                  }}
                />

                <label
                  htmlFor="job-pdf-upload"
                  className="flex w-full cursor-pointer items-center justify-center rounded-full border border-green-300 bg-green-100 px-5 py-3 text-sm font-medium text-green-700 transition hover:bg-green-200"
                >
                  Select PDF Files
                </label>

                {jobPdfFile ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {jobPdfFile.name}
                  </p>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    PDF file name will be used as the Job ID
                  </p>
                )}
              </div>

              <Button
                onClick={handleUploadJob}
                className="w-full"
                disabled={isSubmitting}
              >
                <Plus className="mr-2 h-4 w-4" />
                {isSubmitting ? "Uploading..." : "Upload Job"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />

            <div className="text-xs text-muted-foreground">
              Progress: Upload → Ranked → Explained
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Job ID</TableHead>
                  <TableHead className="font-semibold text-center">
                    Progress
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Next Action
                  </TableHead>
                  <TableHead className="font-semibold text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job.job_id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        <Link
                          href={`/jobs/${encodeURIComponent(job.job_id)}`}
                          className="text-primary hover:underline"
                        >
                          {job.job_id}
                        </Link>
                      </TableCell>

                      <TableCell className="text-center">
                        <JobPipeline job={job} />
                      </TableCell>

                      <TableCell className="text-center">
                        <span className="text-sm font-medium text-foreground">
                          {getNextAction(job)}
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="destructive"
                          onClick={() =>
                            handleDeleteJob(job.job_id ?? job.id ?? job.jobId)
                          }
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}