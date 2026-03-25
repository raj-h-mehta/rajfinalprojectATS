"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { PlayCircle, Users, Loader2 } from "lucide-react"
import {
  MapPinCheckInside,
  ListChecks,
  BarChart3,
  Target,
} from "lucide-react"
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010"

export default function Viewjobdetails() {
  const router = useRouter()
  const params = useParams()
  const jobId = useMemo(() => {
    const v = params?.id
    return Array.isArray(v) ? v[0] : (v ?? "")
  }, [params])
  const [jobDetails, setJobDetails] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attachedCandidates, setAttachedCandidates] = useState([])
  const [availableCandidates, setAvailableCandidates] = useState([])
  const [isUpdatingCandidates, setIsUpdatingCandidates] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  //GS added to show params
  const [selectedRankers, setSelectedRankers] = useState([])
  const [allowedRankers, setAllowedRankers] = useState([])
  const [numIterations, setNumIterations] = useState(12)
  const loadParams = async () => {
    if (!jobId) return
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/params`, {
      cache: "no-store",
    })
    const data = await res.json()
    const p = data?.params ?? {}
    setAllowedRankers(Array.isArray(data?.rankers) ? data.rankers : [])
    setSelectedRankers(Array.isArray(p?.rankers) ? p.rankers : [])
    setNumIterations(p?.num_iterations ?? 12)
  }
  const handleRankerToggle = (ranker) => {
    setSelectedRankers((prev) =>
      prev.includes(ranker) ? prev.filter((r) => r !== ranker) : [...prev, ranker]
    )
  }
  const handleChangeParams = async () => {
    if (!jobId) return
    if (!selectedRankers.length) {
      setError("Select at least one ranker")
      return
    }
    const iters = Number(numIterations)
    if (!Number.isFinite(iters) || iters < 5 || iters > 30) {
      setError("Iterations must be 5–30")
      return
    }
    setError("")
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/params`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        params: {
          rankers: selectedRankers,
          num_iterations: iters,
        },
      }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => "")
      throw new Error(`PUT /jobs/${jobId}/params failed (${res.status}) ${txt}`)
    }
    await loadParams()
    }  //GS added to show the parameters

  
  const loadAttachedCandidates = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/jobs/${encodeURIComponent(jobId)}/candidates`,
        { cache: "no-store" }
      )

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`GET /jobs/${jobId}/candidates failed (${res.status}) ${txt}`)
      }

      const data = await res.json()
      setAttachedCandidates(data?.candidates ?? [])
    } catch (e) {
      setError(e?.message || "Failed to load attached candidates")
    }
  }
  const handleAttachCandidate = async (candidateId) => {
    if (!jobId || !candidateId) return

    try {
      setIsUpdatingCandidates(true)
      setError("")

      const res = await fetch(
        `${API_BASE}/jobs/${encodeURIComponent(jobId)}/candidates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidate_ids: [candidateId] }),
        }
      )

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`POST /jobs/${jobId}/candidates failed (${res.status}) ${txt}`)
      }

      await loadAttachedCandidates()
    } catch (e) {
      setError(e?.message || "Failed to attach candidate")
    } finally {
      setIsUpdatingCandidates(false)
    }
  }

  const handleRemoveCandidate = async (candidateId) => {
    if (!jobId || !candidateId) return

    try {
      setIsUpdatingCandidates(true)
      setError("")

      const res = await fetch(
        `${API_BASE}/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(candidateId)}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`DELETE /jobs/${jobId}/candidates/${candidateId} failed (${res.status}) ${txt}`)
      }

      await loadAttachedCandidates()
    } catch (e) {
      setError(e?.message || "Failed to remove candidate")
    } finally {
      setIsUpdatingCandidates(false)
    }
  }
  const loadCandidates = async () => {
    try {
      setLoading(true)
      setError("")

      const candsRes = await fetch(
        `${API_BASE}/candidates`,
        { cache: "no-store" }
      )

      if (!candsRes.ok) {
        const txt = await candsRes.text().catch(() => "")
        throw new Error(`GET /candidates failed (${candsRes.status}) ${txt}`)
      }
      const candsData = await candsRes.json()
      setCandidates(candsData?.candidates ?? [])
    } catch (e) {
      setError(e?.message || "Failed to load candidates")
    } finally {
      setLoading(false)
    }
  }
  
  const loadJobDetails = async () => {
    try {
      setError("")

      const jobRes = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/requirements`, {
        cache: "no-store",
      })

      if (!jobRes.ok) {
        const txt = await jobRes.text().catch(() => "")
        throw new Error(`GET /jobs/${jobId} failed (${jobRes.status}) ${txt}`)
      }

      const reqData = await jobRes.json()
      setJobDetails(reqData ?? null)
    } catch (e) {
      setError(e?.message || "Failed to load job details")
    }
  }

  useEffect(() => {
    if (!jobId) return

    loadCandidates()
    loadJobDetails()
    loadAttachedCandidates()
    loadParams()
  }, [jobId])
  useEffect(() => {
    const attachedIds = new Set(attachedCandidates.map((c) => c.candidate_id))
    setAvailableCandidates(candidates.filter((c) => !attachedIds.has(c.candidate_id)))
  }, [candidates, attachedCandidates])

  const handleRunATS = async () => {
    if (!jobId || attachedCandidates.length === 0) return

    setIsRunning(true)
    setError("")

    try {
      const runRes = await fetch(
        `${API_BASE}/jobs/${encodeURIComponent(jobId)}/baseline/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})   //GS was ({ rankers: [] }), this fixes issue
        }
      )

      if (!runRes.ok) {
        const txt = await runRes.text().catch(() => "")
        throw new Error(`POST /jobs/${jobId}/baseline/run failed (${runRes.status}) ${txt}`)
      }

      router.push(`/results/${encodeURIComponent(jobId)}`)
    } catch (e) {
      setError(e?.message || "Run ATS failed")
    } finally {
      setIsRunning(false)
    }
  }

  const renderRequirementValue = (section, items) => {
    if (Array.isArray(items)) {
      if (items.length === 0) {
        return <p className="text-sm text-muted-foreground">—</p>
      }

      return (
        <ul className="list-disc pl-5 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{String(it)}</li>
          ))}
        </ul>
      )
    }

    if (!items) {
      return <p className="text-sm text-muted-foreground">—</p>
    }

    if (section === "education" && typeof items === "object") {
      return (
        <div className="space-y-1 text-sm">
          <p>{items.credential || "—"}</p>
          {items.field && (
            <p><span className="font-medium">Field:</span> {items.field}</p>
          )}
          {items.level !== null && items.level !== undefined && (
            <p><span className="font-medium">Level:</span> {items.level}</p>
          )}
        </div>
      )
    }

    if (section === "experience" && typeof items === "object") {
      return (
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">Minimum years:</span>{" "}
            {items.years_min ?? "—"}
          </p>
        </div>
      )
    }

    if (typeof items === "object") {
      return (
        <div className="space-y-1 text-sm">
          {Object.entries(items).map(([key, value]) => {
            if (!value) return null
            return (
              <p key={key}>
                <span className="font-medium capitalize">
                  {key.replaceAll("_", " ")}:
                </span>{" "}
                {String(value)}
              </p>
            )
          })}
        </div>
      )
    }

    return <p className="whitespace-pre-line text-sm">{String(items)}</p>
  }
  return (
    <div>
      <PageHeader title="Job Details" description="Learn about job and select candidate to run ranking" />
      {error && (
        <div className="mb-4 rounded border border-destructive p-3 text-sm">
          {error}
        </div>
      )}
      {loading && <p className="mb-4 text-sm text-muted-foreground">Loading…</p>}
      <div className="grid gap-6 lg:grid-cols-2 items-stretch">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Job Breakdown
                </CardTitle>
            <CardDescription>{jobId ? `Job ID: ${jobId}` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto">
            {jobDetails ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-lg p-1.5 `}>
                          <Target className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground">Title :</span>
                        <p className="font-medium text-foreground">{jobDetails.title || "—"}</p>
                      </div>
                  </div>
                    
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`rounded-lg p-1.5 `}>
                          <MapPinCheckInside className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground">Location :</span>
                        <p className="font-medium text-foreground">{jobDetails.location || "—"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`rounded-lg p-1.5 `}>
                          <ListChecks className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground">Requirements :</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {jobDetails?.requirements ? (
                      Object.entries(jobDetails.requirements).map(([section, items]) => (
                        <div key={section} className="rounded-lg border p-3">
                          <p className="mb-2 font-medium text-muted-foreground capitalize">
                            {section.replaceAll("_", " ")}
                          </p>
                          {renderRequirementValue(section, items)}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </div>
                </div>     
              </div>
                )
            : (
                <p className="text-sm text-muted-foreground">Loading job details…</p>
              )}
            </CardContent>

        </Card>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Attached Candidates
            </CardTitle>
          </CardHeader>

          <CardContent className="max-h-[500px] overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Attached Candidates</h3>

                <div className="max-h-64 space-y-3 overflow-y-auto">
                  {attachedCandidates.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No candidates attached to this job yet.
                    </div>
                  ) : (
                    attachedCandidates.map((candidate) => (
                      <div
                        key={candidate.candidate_id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/30"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {candidate.candidate_name || candidate.candidate_id}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {candidate.resume_pdf_path
                              ? candidate.resume_pdf_path.split("\\").pop()
                              : "No resume path"}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRemoveCandidate(candidate.candidate_id)}
                          disabled={isUpdatingCandidates}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Available Candidates</h3>

                <div className="max-h-64 space-y-3 overflow-y-auto">
                  {availableCandidates.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No more available candidates to attach.
                    </div>
                  ) : (
                    availableCandidates.map((candidate) => (
                      <div
                        key={candidate.candidate_id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/30"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-foreground">
                            {candidate.candidate_name || candidate.candidate_id}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {candidate.resume_pdf_path
                              ? candidate.resume_pdf_path.split("\\").pop()
                              : "No resume path"}
                          </p>
                        </div>

                        <Button
                          type="button"
                          onClick={() => handleAttachCandidate(candidate.candidate_id)}
                          disabled={isUpdatingCandidates}
                        >
                          Attach
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <h3 className="font-medium text-foreground">Ready to Run</h3>
            <p className="text-sm text-muted-foreground">
              {jobId ? `Job: ${jobId}` : "No job selected"} - {attachedCandidates.length} candidate
              {attachedCandidates.length !== 1 ? "s" : ""} attached
            </p>
          </div>
           <div className="flex gap-2">
            <Button size="lg" onClick={handleRunATS} disabled={!jobId || attachedCandidates.length === 0 || isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Running Analysis...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Run Baseline Ranking
                </>
              )}
            </Button>
          </div>
        </CardContent>
        <div className="px-6 pb-4">
            <div className="text-xs text-muted-foreground">Rankers</div>
            <div className="flex flex-wrap gap-3">
              {allowedRankers.map((ranker) => (
                <label key={ranker} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedRankers.includes(ranker)}
                    onChange={() => handleRankerToggle(ranker)}
                  />
                  <span>{ranker}</span>
                </label>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Iterations</div>
                <input type="number" min="5" max="30" value={numIterations}  onChange={(e) => setNumIterations(e.target.value)}
                  className="w-24 rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <Button variant="outline" onClick={handleChangeParams}>
                Change Parameters
              </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
