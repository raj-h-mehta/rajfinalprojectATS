"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { ArrowLeft, Trophy, TrendingUp, Sparkles } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010"

function formatNum(value, digits = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  return n.toFixed(digits)
}

function formatPercent(value, digits = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  return `${n.toFixed(digits)}%`
}

function buildInsightSentence(row) {
  if (!row?.impactSummary || row.impactSummary.length === 0) {
    return "No major contributing factors detected."
  }

  const parts = row.impactSummary.map((item) => {
    const [label, count] = String(item).split(" +")
    if (label === "tech") return `${count} technical additions`
    if (label === "education") return `${count} education change${count === "1" ? "" : "s"}`
    if (label === "experience") return `${count} experience change${count === "1" ? "" : "s"}`
    if (label === "other") return `${count} other change${count === "1" ? "" : "s"}`
    return item
  })

  if (parts.length === 1) {
    return `Improvement was mainly driven by ${parts[0]}.`
  }

  if (parts.length === 2) {
    return `Improvement was mainly driven by ${parts[0]} and ${parts[1]}.`
  }

  return `Improvement was mainly driven by ${parts
    .slice(0, -1)
    .join(", ")} and ${parts[parts.length - 1]}.`
}

export default function ExperimentOutputPage() {
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [jobState, setJobState] = useState(null)
  const [jobDetails, setJobDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attachedCandidates, setAttachedCandidates] = useState([])
  const [selectedRanker, setSelectedRanker] = useState("transformer")

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        setLoading(true)
        setError("")

        const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(id)}`, {
          cache: "no-store",
        })

        if (!res.ok) {
          const txt = await res.text().catch(() => "")
          throw new Error(`GET /jobs/${id} failed (${res.status}) ${txt}`)
        }

        const data = await res.json()
        if (!alive) return
        setJobState(data)

        const jobDetailsRes = await fetch(
          `${API_BASE}/jobs/${encodeURIComponent(id)}/requirements`,
          { cache: "no-store" }
        )

        if (!jobDetailsRes.ok) {
          const txt = await jobDetailsRes.text().catch(() => "")
          throw new Error(`GET /jobs/${id}/requirements failed (${jobDetailsRes.status}) ${txt}`)
        }

        const jobDetailsData = await jobDetailsRes.json()
        if (!alive) return
        setJobDetails(jobDetailsData ?? null)

        const candidatesRes = await fetch(
          `${API_BASE}/jobs/${encodeURIComponent(id)}/candidates`,
          { cache: "no-store" }
        )

        if (!candidatesRes.ok) {
          const txt = await candidatesRes.text().catch(() => "")
          throw new Error(`GET /jobs/${id}/candidates failed (${candidatesRes.status}) ${txt}`)
        }

        const candidatesData = await candidatesRes.json()
        if (!alive) return

        setAttachedCandidates(
          Array.isArray(candidatesData?.candidates) ? candidatesData.candidates : []
        )
      } catch (e) {
        if (!alive) return
        setError(e?.message || "Failed to load experiment results")
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    if (id) load()

    return () => {
      alive = false
    }
  }, [id])

  const rankerOptions = useMemo(() => {
    const rankers = Array.isArray(jobState?.params_current?.rankers)
      ? jobState.params_current.rankers
      : ["bm25", "tfidf", "transformer"]

    return rankers.map((r) => String(r).toLowerCase())
  }, [jobState])

  const candidateNameMap = useMemo(() => {
    const map = new Map()

    for (const candidate of attachedCandidates) {
      const candidateId = String(candidate?.candidate_id ?? "")
      const candidateName = String(candidate?.candidate_name ?? "")
      if (candidateId) {
        map.set(candidateId, candidateName || candidateId)
      }
    }

    return map
  }, [attachedCandidates])

  useEffect(() => {
    if (rankerOptions.length > 0 && !rankerOptions.includes(selectedRanker)) {
      setSelectedRanker(rankerOptions[0])
    }
  }, [rankerOptions, selectedRanker])

  const experimentLookup = useMemo(() => {
    const map = new Map()
    const exps = Array.isArray(jobState?.experiments) ? jobState.experiments : []

    for (const exp of exps) {
      const rows = Array.isArray(exp?.rows) ? exp.rows : []
      for (const row of rows) {
        const candidateId = String(row?.candidate_id ?? "")
        const ranker = String(row?.ranker ?? "").toLowerCase()
        const caseId = String(row?.case_id ?? "")
        if (!candidateId || !ranker || !caseId) continue

        map.set(`${candidateId}__${ranker}__${caseId}`, {
          norm: Number(row?.norm_score ?? row?.score ?? 0) || 0,
          rank: Number(row?.rank ?? 0) || 0,
        })
      }
    }

    return map
  }, [jobState])

  const baselineLookup = useMemo(() => {
    const map = new Map()
    const rows = Array.isArray(jobState?.baseline?.rows) ? jobState.baseline.rows : []

    for (const row of rows) {
      const candidateId = String(row?.candidate_id ?? "")
      const ranker = String(row?.ranker ?? "").toLowerCase()
      if (!candidateId || !ranker) continue

      map.set(`${candidateId}__${ranker}`, {
        norm: Number(row?.norm_score ?? row?.score ?? 0) || 0,
        rank: Number(row?.rank ?? 0) || 0,
      })
    }

    return map
  }, [jobState])

  const explanationRows = useMemo(() => {
    const explanations = Array.isArray(jobState?.explanations) ? jobState.explanations : []

    const explanationMap = new Map()
    for (const item of explanations) {
      const candidateId = String(item?.candidate_id ?? "")
      const ranker = String(item?.ranker ?? "").toLowerCase()
      if (!candidateId || !ranker) continue
      explanationMap.set(`${candidateId}__${ranker}`, item)
    }

    return attachedCandidates
      .map((candidate) => {
        const candidateId = String(candidate?.candidate_id ?? "")
        const candidateName = candidateNameMap.get(candidateId) || candidateId

        const baseline = baselineLookup.get(`${candidateId}__${selectedRanker}`) || {
          norm: null,
          rank: null,
        }

        const item = explanationMap.get(`${candidateId}__${selectedRanker}`)

        if (!item) {
          return {
            candidateId,
            candidateName,
            baselineNorm: baseline.norm,
            baselineRank: baseline.rank,
            topFactors: [],
            topFactorNorm: null,
            topFactorRank: null,
            combinedNorm: null,
            combinedRank: null,
            topExplains: null,
            combinedExplains: null,
            explanationItem: null,
            rawTopFactors: [],
            topReason: "—",
            impactSummary: [],
            scoreDelta: null,
          }
        }

        const factors = Array.isArray(item?.factors) ? item.factors : []

        const nonCombinedFactors = factors
          .filter((f) => String(f?.case_type ?? "").toLowerCase() !== "combined")
          .sort((a, b) => (Number(b?.delta_norm ?? 0) || 0) - (Number(a?.delta_norm ?? 0) || 0))

        const topFactors = nonCombinedFactors.slice(0, 6)
        const topFactor = topFactors[0] || null

        const combinedFactor =
          factors.find((f) => String(f?.case_type ?? "").toLowerCase() === "combined") || null

        const topFactorMetrics = topFactor
          ? experimentLookup.get(
              `${candidateId}__${selectedRanker}__${String(topFactor.case_id)}`
            )
          : null

        const combinedMetrics = combinedFactor
          ? experimentLookup.get(
              `${candidateId}__${selectedRanker}__${String(combinedFactor.case_id)}`
            )
          : null

        const impactCounts = {
          tech: 0,
          education: 0,
          experience: 0,
          other: 0,
        }

        for (const f of topFactors) {
          const type = String(f?.case_type ?? "").toLowerCase()

          if (type === "tech" || type === "tools" || type === "vendors") {
            impactCounts.tech += 1
          } else if (type === "education") {
            impactCounts.education += 1
          } else if (type === "position") {
            impactCounts.experience += 1
          } else if (type === "other") {
            impactCounts.other += 1
          }
        }

        const impactSummary = [
          impactCounts.tech > 0 ? `tech +${impactCounts.tech}` : null,
          impactCounts.education > 0 ? `education +${impactCounts.education}` : null,
          impactCounts.experience > 0 ? `experience +${impactCounts.experience}` : null,
          impactCounts.other > 0 ? `other +${impactCounts.other}` : null,
        ].filter(Boolean)

        return {
          candidateId,
          candidateName,
          baselineNorm: item?.baseline_norm ?? baseline.norm,
          baselineRank: item?.baseline_rank ?? baseline.rank,
          topFactors: topFactors.map((f) => String(f?.full_reason ?? f?.case_type ?? "—")),
          topFactorNorm: topFactorMetrics?.norm ?? null,
          topFactorRank: topFactorMetrics?.rank ?? null,
          combinedNorm: combinedMetrics?.norm ?? null,
          combinedRank: combinedMetrics?.rank ?? null,
          topExplains:
            item?.top_factor_explains != null
              ? Number(item.top_factor_explains) * 100
              : null,
          combinedExplains:
            item?.combined_factor_explains != null
              ? Number(item.combined_factor_explains) * 100
              : null,
          explanationItem: item,
          rawTopFactors: topFactors.map((f) => {
            const metrics = experimentLookup.get(
              `${candidateId}__${selectedRanker}__${String(f?.case_id ?? "")}`
            )

            return {
              caseId: String(f?.case_id ?? ""),
              reason: String(f?.full_reason ?? f?.case_type ?? "—"),
              deltaNorm: Number(f?.delta_norm ?? 0) || 0,
              newRank: metrics?.rank ?? null,
              newNorm: metrics?.norm ?? null,
              caseType: String(f?.case_type ?? ""),
            }
          }),
          topReason:
            topFactors.length > 0
              ? String(topFactors[0]?.full_reason ?? topFactors[0]?.case_type ?? "—")
              : "—",
          impactSummary,
          scoreDelta:
            item?.baseline_norm != null && combinedMetrics?.norm != null
              ? Number(combinedMetrics.norm) - Number(item.baseline_norm)
              : baseline.norm != null && combinedMetrics?.norm != null
              ? Number(combinedMetrics.norm) - Number(baseline.norm)
              : null,
        }
      })
      .sort((a, b) => {
        const aRank = a.baselineRank ?? 9999
        const bRank = b.baselineRank ?? 9999
        return aRank - bRank
      })
  }, [
    attachedCandidates,
    candidateNameMap,
    baselineLookup,
    jobState,
    selectedRanker,
    experimentLookup,
  ])

  const stats = useMemo(() => {
    if (!explanationRows.length) {
      return {
        topCandidate: "—",
        avgScore: "—",
        biggestGainName: "—",
        biggestGainValue: "—",
      }
    }

    const validCombined = explanationRows.filter((r) => Number.isFinite(r.combinedNorm))
    const sortedByRank = [...explanationRows].sort((a, b) => {
      const ar = a.combinedRank ?? Number.MAX_SAFE_INTEGER
      const br = b.combinedRank ?? Number.MAX_SAFE_INTEGER
      return ar - br
    })

    const topCandidate = sortedByRank[0]?.candidateName || "—"

    const avg =
      validCombined.length > 0
        ? validCombined.reduce((sum, r) => sum + Number(r.combinedNorm), 0) / validCombined.length
        : null

    const biggestGainRow = [...explanationRows].sort((a, b) => {
      const ad = a.scoreDelta ?? -Infinity
      const bd = b.scoreDelta ?? -Infinity
      return bd - ad
    })[0]

    return {
      topCandidate,
      avgScore: avg != null ? formatNum(avg) : "—",
      biggestGainName: biggestGainRow?.candidateName || "—",
      biggestGainValue:
        biggestGainRow?.scoreDelta != null
          ? `${biggestGainRow.scoreDelta >= 0 ? "+" : ""}${formatNum(biggestGainRow.scoreDelta)}`
          : "—",
    }
  }, [explanationRows])

  if (loading) {
    return <p className="py-10 text-center">Loading...</p>
  }

  if (error) {
    return <p className="py-10 text-center text-destructive">{error}</p>
  }

  if (!attachedCandidates.length) {
    return (
      <div>
        <PageHeader title="Experiment Results" description={`Job: ${id}`}>
          <Link href={`/results/${id}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </PageHeader>

        <div className="py-10 text-center text-muted-foreground">
          No experiment results found yet.
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Experiment Results"
        description={`Job: ${id} • Ranker: ${selectedRanker.toUpperCase()}`}
      >
        <Link href={`/results/${id}`}>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </PageHeader>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Top Candidate
              </p>
              <span className="mt-2 text-lg font-semibold">{stats.topCandidate}</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Average Score
              </p>
              <span className="mt-2 text-lg font-semibold">{stats.avgScore}</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Biggest Gain
              </p>
              <span className="mt-2 text-lg font-semibold">{stats.biggestGainName}</span>
              <span className="text-sm text-emerald-600"> {stats.biggestGainValue}</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Candidate Impact Analysis</CardTitle>

          <div className="w-[220px]">
            <Select value={selectedRanker} onValueChange={setSelectedRanker}>
              <SelectTrigger>
                <SelectValue placeholder="Select ranker" />
              </SelectTrigger>
              <SelectContent>
                {rankerOptions.map((ranker) => (
                  <SelectItem key={ranker} value={ranker}>
                    {ranker.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-center">Candidate</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Rank</TableHead>
                  <TableHead className="text-center">Impact</TableHead>
                  <TableHead className="min-w-[300px] text-center">Insights</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {explanationRows.map((row) => (
                  <TableRow key={row.candidateId} className="align-top hover:bg-muted/30">
                    <TableCell>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold">{row.candidateName}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <p>Baseline: {formatNum(row.baselineNorm)}</p>
                          <p>Base Rank: {row.baselineRank ?? "—"}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold">
                          {formatNum(row.combinedNorm)}
                        </p>
                        <p
                          className={`text-xs ${
                            row.scoreDelta != null && row.scoreDelta >= 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          }`}
                        >
                          {row.scoreDelta != null
                            ? `${row.scoreDelta >= 0 ? "+" : ""}${formatNum(row.scoreDelta)} vs baseline`
                            : "—"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {row.combinedRank ?? "—"}
                        </p>

                        <p
                          className={`text-xs ${
                            row.baselineRank != null && row.combinedRank != null
                              ? row.baselineRank - row.combinedRank > 0
                                ? "text-emerald-600"
                                : row.baselineRank - row.combinedRank < 0
                                ? "text-red-500"
                                : "text-muted-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {row.baselineRank != null && row.combinedRank != null
                            ? `${row.baselineRank - row.combinedRank > 0 ? "+" : ""}${
                                row.baselineRank - row.combinedRank
                              } vs baseline`
                            : "—"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold">
                          {row.topExplains != null ? `${Math.round(row.topExplains)}%` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">Top factor contribution</p>
                        <p className="text-xs text-muted-foreground">
                          Combined:{" "}
                          {row.combinedExplains != null
                            ? `${Math.round(row.combinedExplains)}%`
                            : "—"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-2">
                        {row.impactSummary && row.impactSummary.length ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {row.impactSummary.map((item, idx) => (
                                <span
                                  key={`${row.candidateId}-impact-${idx}`}
                                  className="rounded-full border bg-muted px-3 py-1 text-xs font-medium"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>

                            <p className="text-sm text-foreground leading-5">
                              {buildInsightSentence(row)}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No major contributing factors detected.
                          </p>
                        )}

                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span>Norm: {formatNum(row.topFactorNorm)}</span>
                          <span>Rank: {row.topFactorRank != null ? row.topFactorRank : "—"}</span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-black text-white hover:bg-black/90"
                        onClick={() => setSelectedCandidate(row)}
                      >
                        View Explanation
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedCandidate}
        onOpenChange={(open) => {
          if (!open) setSelectedCandidate(null)
        }}
      >
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidate Results</DialogTitle>
          </DialogHeader>

          {selectedCandidate && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Candidate</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">name:</span>{" "}
                      {selectedCandidate.candidateName}
                    </p>
                    <p>
                      <span className="font-medium">candidate_id:</span>{" "}
                      {selectedCandidate.candidateId}
                    </p>
                    <p>
                      <span className="font-medium">ranker:</span> {selectedRanker}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Job</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">job_id:</span> {jobState?.job?.job_id || id}
                    </p>
                    <p>
                      <span className="font-medium">title:</span>{" "}
                      {jobDetails?.title ?? jobState?.job?.title ?? jobState?.job?.job_id ?? "—"}
                    </p>
                    <p>
                      <span className="font-medium">location:</span>{" "}
                      {jobDetails?.location ?? jobState?.job?.location ?? "Not available"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p>
                    Baseline Score: {formatNum(selectedCandidate.baselineNorm)}{" "}
                    {selectedCandidate.baselineRank != null
                      ? `(rank ${selectedCandidate.baselineRank}/${attachedCandidates.length})`
                      : ""}
                  </p>

                  <div>
                    <p className="font-semibold">
                      Top reason - the following change had the biggest impact:
                    </p>
                    <p className="mt-1">{selectedCandidate.topReason || "—"}</p>
                  </div>

                  <div className="space-y-1">
                    <p>
                      Top factor explains{" "}
                      {selectedCandidate.topExplains != null
                        ? `${Math.round(selectedCandidate.topExplains)}%`
                        : "—"}{" "}
                      of gap
                    </p>
                    <p>
                      All factors explain{" "}
                      {selectedCandidate.combinedExplains != null
                        ? `${Math.round(selectedCandidate.combinedExplains)}%`
                        : "—"}{" "}
                      of gap
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 font-semibold">Top factors</p>
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Reason</TableHead>
                            <TableHead className="w-[140px]">Δ score</TableHead>
                            <TableHead className="w-[140px]">New rank</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCandidate.rawTopFactors &&
                          selectedCandidate.rawTopFactors.length ? (
                            selectedCandidate.rawTopFactors.map((factor, idx) => (
                              <TableRow key={`${selectedCandidate.candidateId}-raw-factor-${idx}`}>
                                <TableCell>{factor.reason}</TableCell>
                                <TableCell>{formatNum(factor.deltaNorm)}</TableCell>
                                <TableCell>
                                  {factor.newRank != null
                                    ? `${factor.newRank}/${attachedCandidates.length}`
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} className="text-muted-foreground">
                                No factor breakdown available.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}