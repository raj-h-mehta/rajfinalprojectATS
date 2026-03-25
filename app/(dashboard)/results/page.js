"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { CheckCircle2, Clock, ArrowRight } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010"

function mapStatus(status) {
  const s = String(status || "").toLowerCase()
  if (s === "running") return "running"
  if (s === "complete" || s === "completed" || s === "baselined") return "completed"
  return "pending"
}

export default function ResultsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const getStatusBadge = (status) => {
    const styles = {
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      running: "bg-amber-50 text-amber-700 border-amber-200",
      pending: "bg-gray-50 text-gray-700 border-gray-200",
    }

    const icons = {
      completed: CheckCircle2,
      running: Clock,
      pending: Clock,
    }

    const Icon = icons[status] || Clock

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
          styles[status] || styles.pending
        }`}
      >
        <Icon className="h-3 w-3" />
        {status}
      </span>
    )
  }

  useEffect(() => {
    let alive = true

    async function apiGet(path) {
      const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`GET ${path} failed (${res.status}) ${txt}`)
      }
      return res.json()
    }

    async function load() {
      try {
        setLoading(true)
        setError("")

        const jobsData = await apiGet("/jobs")
        const jobs = jobsData?.jobs ?? []

        const states = await Promise.all(
          jobs.map(async (j) => {
            const id = j?.job_id
            if (!id) return null
            const s = await apiGet(`/jobs/${encodeURIComponent(id)}`)
            return { job: j, state: s }
          })
        )

        if (!alive) return

        const built = states
          .filter(Boolean)
          .map(({ job, state }) => {
            const jobId = job?.job_id

            const experiments = Array.isArray(state?.experiments) ? state.experiments : []
            const latestExp = experiments.length ? experiments[experiments.length - 1] : null
            const baseline = state?.baseline || state?.baseline_summary || null

            const hasBaseline = Array.isArray(baseline?.rows) && baseline.rows.length > 0
            const hasExperiment = Array.isArray(latestExp?.rows) && latestExp.rows.length > 0

            const uiStatus = mapStatus(state?.status)

            return {
              id: jobId,
              jobTitle: jobId,
              status: uiStatus,
              hasBaseline,
              hasExperiment,
            }
          })

        setRows(built)
      } catch (e) {
        if (!alive) return
        setError(e?.message || "Failed to load results")
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    load()

    return () => {
      alive = false
    }
  }, [])

  const hasRows = useMemo(() => rows.length > 0, [rows])

  return (
    <div>
      <PageHeader title="ATS Results" description="View all your ATS ranking results" />

      {error && (
        <div className="mb-4 rounded border border-destructive p-3 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="rounded-lg border border-border">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40%] font-semibold text-left">
                    Job Position
                  </TableHead>
                  <TableHead className="w-[20%] font-semibold text-left">
                    Status
                  </TableHead>
                  <TableHead className="w-[40%] font-semibold text-left">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : !hasRows ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No ATS runs yet. Start by running a new ranking.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((run) => (
                    <TableRow key={run.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground truncate">
                        {run.jobTitle}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center">
                          {getStatusBadge(run.status)}
                        </div>
                      </TableCell>

                      <TableCell>
                        {run.status === "completed" ? (
                          <div className="flex items-center gap-2">
                            {run.hasBaseline && (
                              <Link
                                href={`/results/${run.id}/baseline`}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
                              >
                                View Baseline Result
                              </Link>
                            )}

                            {run.hasExperiment && (
                              <Link
                                href={`/results/${run.id}/experiment`}
                                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium bg-black text-white hover:bg-black/90"
                              >
                                View Experiment Result
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Processing...
                          </span>
                        )}
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