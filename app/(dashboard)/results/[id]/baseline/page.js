"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Trophy, BarChart3 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010"

function toTitleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function getBestNorm(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  let best = null
  for (const row of rows) {
    const v = Number(row?.norm_score)
    if (Number.isFinite(v)) {
      best = best === null ? v : Math.max(best, v)
    }
  }
  return best
}

export default function BaselineResultPage() {
  const params = useParams()
  const jobId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [baseline, setBaseline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let alive = true

    async function loadBaseline() {
      try {
        setLoading(true)
        setError("")

        const res = await fetch(
          `${API_BASE}/jobs/${encodeURIComponent(jobId)}/baseline`,
          { cache: "no-store" }
        )

        if (!res.ok) {
          const txt = await res.text().catch(() => "")
          throw new Error(`Failed to load baseline (${res.status}) ${txt}`)
        }

        const data = await res.json()
        if (!alive) return
        setBaseline(data || null)
      } catch (e) {
        if (!alive) return
        setError(e?.message || "Failed to load baseline result")
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    if (jobId) loadBaseline()

    return () => {
      alive = false
    }
  }, [jobId])

  const rows = useMemo(() => {
    const raw = Array.isArray(baseline?.rows) ? baseline.rows : []
    return [...raw].sort((a, b) => {
      const rankDiff = Number(a?.rank || 9999) - Number(b?.rank || 9999)
      if (rankDiff !== 0) return rankDiff
      return String(a?.candidate_id || "").localeCompare(String(b?.candidate_id || ""))
    })
  }, [baseline])

  const rankers = Array.isArray(baseline?.rankers) ? baseline.rankers : []
  const bestNorm = getBestNorm(rows)
  const totalCandidates = rows.length
  const activeRanker = rankers.length ? rankers[0] : "transformer"

  return (
    <div>
      <PageHeader
        title="Baseline Results"
        description={`Baseline ranking for ${toTitleCase(jobId)}`}
      />

      <div className="mb-6 flex items-center">
        <Link href="/results">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Results
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive p-3 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-xl bg-blue-50 text-blue-600 p-2.5">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Ranker</div>
              <div className="text-sm font-semibold">{toTitleCase(activeRanker)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-xl bg-emerald-50 text-emerald-600 p-2.5">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Candidates Ranked</div>
              <div className="text-sm font-semibold">{totalCandidates}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-xl bg-amber-50 text-amber-600 p-2.5">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Top Score</div>
              <div className="text-sm font-semibold">
                {bestNorm !== null ? bestNorm.toFixed(2) : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Baseline Ranking</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="rounded-b-lg border-t">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[45%] text-left font-semibold">
                    Candidate
                  </TableHead>
                  <TableHead className="w-[20%] text-left font-semibold">
                    Rank
                  </TableHead>
                  <TableHead className="w-[35%] text-left font-semibold">
                    Score
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Loading baseline results...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No saved baseline result found for this job.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={`${row.ranker}-${row.candidate_id}`} className="hover:bg-muted/30">
                      <TableCell className="truncate font-medium text-foreground">
                        {row.candidate_id}
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex min-w-[34px] items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
                          #{row.rank}
                        </span>
                      </TableCell>

                      <TableCell className="font-medium">
                        {row.norm_score != null
                          ? Number(row.norm_score).toFixed(2)
                          : Number(row.score).toFixed(2)}
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