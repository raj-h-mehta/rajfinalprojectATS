"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ArrowLeft, Trophy, Users, BarChart3 } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010"

function formatScore(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  return n.toFixed(2)
}
/** 
function rankerLabel(key) {
  if (key === "bm25") return "BM25"
  if (key === "tfidf") return "TFIDF"
  if (key === "transformer") return "Transformer"
  return String(key || "").toUpperCase()
}  */ //GS not needed!  don't hard code.

export default function ResultDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [jobState, setJobState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attachedCandidates, setAttachedCandidates] = useState([])
  const [expOpen, setExpOpen] = useState(false)
  const [expRunning, setExpRunning] = useState(false)
  const [expErr, setExpErr] = useState("")

  const runExperiment = async () => {
    if (!id) return

    setExpRunning(true)
    setExpErr("")

    try {
      /**const paramsRes = await fetch(
        `${API_BASE}/jobs/${encodeURIComponent(id)}/params`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            params: {
              rankers: ["bm25", "tfidf", "transformer"],
              num_iterations: 20,
            },
          }),
        }
      ) 
      if (!paramsRes.ok) {
        const txt = await paramsRes.text().catch(() => "")
        throw new Error(txt || "Failed to set params")
      }  **/ //GS the back end controls the rankers -should not be here. 

      const runRes = await fetch(
        `${API_BASE}/jobs/${encodeURIComponent(id)}/experiments/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({candidate_id: null}) 
        }
      )

      if (!runRes.ok) {
        const txt = await runRes.text().catch(() => "")
        throw new Error(txt || "Failed to run experiment")
      }

      setExpOpen(false)
      router.push(`/results/${encodeURIComponent(id)}/experiment`) //GS deleted the "s"
    } catch (e) {
      setExpErr(e?.message || "Experiment failed")
    } finally {
      setExpRunning(false)
    }
  }

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        setLoading(true)
        setError("")

        const res = await fetch(
          `${API_BASE}/jobs/${encodeURIComponent(id)}/baseline`,
          { cache: "no-store" }
        )

        if (!res.ok) {
          const txt = await res.text().catch(() => "")
          throw new Error(`GET /jobs/${id}/baseline failed (${res.status}) ${txt}`)
        }

        const data = await res.json()
        if (!alive) return
        setJobState(data)

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
        setError(e?.message || "Failed to load results")
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

  const rawRows = jobState?.rows || []

  const activeRankers = useMemo(() => {
    const rankers = Array.isArray(jobState?.rankers) ? jobState.rankers : []
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

  const results = useMemo(() => {
    const arr = Array.isArray(rawRows) ? rawRows : []
    const byCandidate = new Map()

    for (const r of arr) {
      const cid = String(r?.candidate_id ?? "")
      const ranker = String(r?.ranker ?? "").toLowerCase()
      if (!cid || !ranker) continue

      if (!byCandidate.has(cid)) byCandidate.set(cid, {})
      byCandidate.get(cid)[ranker] = {
        rank: Number(r?.rank ?? 0) || 0,
        score: Number(r?.norm_score ?? r?.score ?? 0) || 0,
      }
    }

    const rows = Array.from(byCandidate.entries()).map(([candidateId, rankers]) => {
/**      const tfidf = rankers.tfidf || { rank: 0, score: 0 }
      const bm25 = rankers.bm25 || { rank: 0, score: 0 }
      const transformer = rankers.transformer || { rank: 0, score: 0 }

      const overallRank =
        (bm25.rank || 0) || (tfidf.rank || 0) || (transformer.rank || 0) || 9999

      return {
        candidateId,
        candidateName: candidateNameMap.get(candidateId) || candidateId,
        overallRank,
        bm25Rank: bm25.rank || 0,
        bm25Score: bm25.score,
        tfidfRank: tfidf.rank || 0,
        tfidfScore: tfidf.score,
        transformerRank: transformer.rank || 0,
        transformerScore: transformer.score,
      }   */  //GS no need to hard code. Use an array., 
      
      const metrics = {}
      for (const k of Object.keys(rankers)) {
        metrics[k] = {rank: rankers[k]?.rank || 0, score: rankers[k]?.score || 0}
      }
      const overallRank =
        Object.values(metrics).map(m => m.rank).find(r => r > 0) || 9999
      return {candidateId, candidateName: candidateNameMap.get(candidateId) || candidateId,
        overallRank, metrics}
    })

    return rows.sort((a, b) => a.overallRank - b.overallRank)
  }, [rawRows, candidateNameMap])

  const jobTitle = jobState?.job_id || id

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
        <Link href="/results">
          <Button variant="outline" className="mt-4 bg-transparent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Results
          </Button>
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">{error}</p>
        <Link href="/results">
          <Button variant="outline" className="mt-4 bg-transparent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Results
          </Button>
        </Link>
      </div>
    )
  }

  if (!jobState || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Results not found</p>
        <Link href="/results">
          <Button variant="outline" className="mt-4 bg-transparent">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Results
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Ranking Results" description={`Results for ${jobTitle}`}>
        <Link href="/results">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Results
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
              <p className="mt-2 text-lg font-semibold">
                {results[0]?.candidateName || "—"}
              </p>
            </div>

            <div className="rounded-2xl bg-amber-50 p-3">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Candidates
              </p>
              <p className="mt-2 text-lg font-semibold">{results.length}</p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-3">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Rankers Used
              </p>
              <p className="mt-2 text-lg font-semibold">{activeRankers.length}</p>
            </div>

            <div className="rounded-2xl bg-blue-50 p-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">Baseline Ranking</CardTitle>

          <Button
            onClick={() => {
              setExpErr("")
              setExpOpen(true)
            }}
            className="bg-black text-white hover:bg-black/90"
          >
            Run Full Experiment
          </Button>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Candidate</TableHead>
                   {activeRankers.flatMap((rk) => [
                      <TableHead key={`${rk}-rank`} className="text-center font-semibold">
                        {rk.toUpperCase()} Rank
                      </TableHead>,
                      <TableHead key={`${rk}-score`} className="text-center font-semibold">
                        {rk.toUpperCase()} Score
                      </TableHead>,
                    ])}
                </TableRow>
              </TableHeader>

              <TableBody>
                {results.map((r, index) => {
                  const isTop1 = index === 0
                  const isTop3 = index < 3

                  return (
                    <TableRow
                      key={`${r.candidateId}-${index}`}
                      className={`hover:bg-muted/30 ${
                        isTop1 ? "bg-green-50" : isTop3 ? "bg-muted/40" : ""
                      }`}
                    >
                      <TableCell title={r.candidateName}>
                        <div className="flex items-center gap-3">
                          <span className="truncate font-medium text-foreground">
                            {r.candidateName}
                          </span>
                        </div>
                      </TableCell>
                        {activeRankers.flatMap((rk) => [
                          <TableCell key={`${r.candidate_id}-${rk}-rank`} className="text-center">
                            {r.metrics[rk]?.rank || "—"}
                          </TableCell>,
                          <TableCell key={`${r.candidate_id}-${rk}-score`} className="text-center">
                            {r.metrics[rk]?.score ?? "—"}
                          </TableCell>,
                        ])}      
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent aria-describedby="run-full-experiment-description">
          <DialogHeader>
            <DialogTitle>Run Full Experiment</DialogTitle>
          </DialogHeader>

          <p
            id="run-full-experiment-description"
            className="text-sm text-muted-foreground"
          >
            This will run experiments for all attached candidates. 
          </p>

          {expErr && <p className="text-sm text-destructive">{expErr}</p>}

          <DialogFooter>
            <Button onClick={runExperiment} disabled={expRunning}>
              {expRunning ? "Running Experiment..." : "Run Full Experiment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}