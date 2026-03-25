"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import {
  Briefcase,
  Users,
  PlayCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
  BarChart3,
} from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010"

export default function DashboardPage() {
  const [jobsIndex, setJobsIndex] = useState([])
  const [candidates, setCandidates] = useState([])
  const [jobStates, setJobStates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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
        const jobs = Array.isArray(jobsData) ? jobsData : jobsData?.jobs ?? []
        if (!alive) return
        setJobsIndex(jobs)

        const candData = await apiGet("/candidates")
        const cands = Array.isArray(candData) ? candData : candData?.candidates ?? []
        if (!alive) return
        setCandidates(cands)

        const states = await Promise.all(
          jobs.map(async (j) => {
            const id = j.job_id ?? j.id ?? j.jobId
            if (!id) return null
            try {
              return await apiGet(`/jobs/${encodeURIComponent(id)}`)
            } catch {
              return null
            }
          })
        )

        if (!alive) return
        setJobStates(states.filter(Boolean))
      } catch (e) {
        if (!alive) return
        setError(e?.message || "Failed to load dashboard")
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

  const totalJobs = jobsIndex.length
  const totalCandidates = candidates.length

  const readyJobs = useMemo(() => {
    return jobStates.filter((s) => s?.status === "ready").length
  }, [jobStates])

  const totalExperiments = useMemo(() => {
    return jobStates.reduce((sum, s) => {
      const exps = Array.isArray(s?.experiments) ? s.experiments : []
      return sum + exps.length
    }, 0)
  }, [jobStates])

  const recentRuns = useMemo(() => {
    const rows = []

    for (const s of jobStates) {
      const jobId = s?.job?.job_id || "Job"
      const jobTitle =
        (s?.job?.description && s.job.description.trim()) ||
        jobId

      const exps = Array.isArray(s?.experiments) ? s.experiments : []

      for (const exp of exps) {
        rows.push({
          id: exp.experiment_id,
          jobId,
          jobTitle,
          status: "completed",
          candidateCount: exp?.rows
            ? new Set(exp.rows.map((r) => r.candidate_id)).size
            : 0,
          runCount: Array.isArray(exp?.rows) ? exp.rows.length : 0,
        })
      }
    }

    return rows.slice(-2).reverse()
  }, [jobStates])

  const stats = [
    {
      title: "Total Jobs",
      value: totalJobs,
      subtitle: `${readyJobs} ready to evaluate`,
      icon: Briefcase,
      href: "/jobs",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total Candidates",
      value: totalCandidates,
      subtitle: "Available in library",
      icon: Users,
      href: "/candidates",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "ATS Runs",
      value: totalExperiments,
      subtitle: "Recent experiment sets",
      icon: PlayCircle,
      href: "/results",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Track jobs, candidates, and ranking progress"
      />

      {error ? (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon

          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>

                  <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {loading ? "—" : stat.value}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {loading ? "Loading..." : stat.subtitle}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Recent ATS Runs
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading recent runs...</p>
            ) : recentRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ATS runs yet</p>
            ) : (
              <div className="space-y-4">
                {recentRuns.map((run, index) => (
                  <Link
                    key={`${run.jobId}-${index}`}
                    href={run.jobId ? `/results/${run.jobId}` : "/results"}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {run.jobTitle}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {run.candidateCount || 0} candidates evaluated
                      </p>
                    </div>

                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <span className="flex items-center gap-1 text-sm text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Quick Actions
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3">
              <Link
                href="/jobs"
                className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Add New Job</p>
                  <p className="text-sm text-muted-foreground">
                    Upload a job description PDF
                  </p>
                </div>
              </Link>

              <Link
                href="/candidates"
                className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="rounded-lg bg-emerald-50 p-2">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Add Candidates</p>
                  <p className="text-sm text-muted-foreground">
                    Upload resume PDFs
                  </p>
                </div>
              </Link>

              <Link
                href="/results"
                className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="rounded-lg bg-amber-50 p-2">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">View Results</p>
                  <p className="text-sm text-muted-foreground">
                    Review ranking outcomes and explanations
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}