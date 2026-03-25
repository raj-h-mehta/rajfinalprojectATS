"use client"

import { useEffect, useMemo, useState, useRef } from "react"
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

import { API_BASE } from "@/lib/api";

function getResumeFileName(path) {
  if (!path) return "—"
  return path.split("\\").pop()?.split("/").pop() || path
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const singleFileInputRef = useRef(null)
  const folderInputRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState("")

  const loadCandidates = async () => {
    try {
      setLoading(true)
      setError("")

      const res = await fetch(`${API_BASE}/candidates`, { cache: "no-store" })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`GET /candidates failed (${res.status}) ${txt}`)
      }

      const data = await res.json()
      setCandidates(data?.candidates ?? [])
    } catch (e) {
      setError(e?.message || "Failed to load candidates")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCandidates()
  }, [])

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return candidates.filter((c) => {
      const fileName = getResumeFileName(c.resume_pdf_path).toLowerCase()

      return (
        (c.candidate_id || "").toLowerCase().includes(q) ||
        (c.candidate_name || "").toLowerCase().includes(q) ||
        fileName.includes(q)
      )
    })
  }, [candidates, searchQuery])

  const handleSinglePdfSelect = (e) => {
    const files = Array.from(e.target.files || []).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    )
    setSelectedFiles(files)
  }

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files || []).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    )
    setSelectedFiles(files)
  }

  const openSingleFilePicker = () => {
    singleFileInputRef.current?.click()
  }

  const openFolderPicker = () => {
    folderInputRef.current?.click()
  }

  const resetForm = () => {
    setSelectedFiles([])

    if (singleFileInputRef.current) {
      singleFileInputRef.current.value = ""
    }

    if (folderInputRef.current) {
      folderInputRef.current.value = ""
    }
  }

  const handleAddCandidate = async () => {
    if (selectedFiles.length === 0) return

    try {
      setError("")

      const formData = new FormData()

      selectedFiles.forEach((file) => {
        formData.append("files", file)
      })

      const res = await fetch(`${API_BASE}/candidates/upload`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`POST /candidates/upload failed (${res.status}) ${txt}`)
      }

      resetForm()
      setIsDialogOpen(false)
      await loadCandidates()
    } catch (e) {
      setError(e?.message || "Failed to upload candidates")
    }
  }

  const handleDeleteCandidate = async (candidateIdToDelete) => {
    if (!candidateIdToDelete) return

    const ok = window.confirm(
      `Delete candidate "${candidateIdToDelete}"? This cannot be undone.`
    )
    if (!ok) return

    try {
      setError("")

      const res = await fetch(
        `${API_BASE}/candidates/${encodeURIComponent(candidateIdToDelete)}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`DELETE /candidates/${candidateIdToDelete} failed (${res.status}) ${txt}`)
      }

      await loadCandidates()
    } catch (e) {
      setError(e?.message || "Failed to delete candidate")
    }
  }

  return (
    <div>
      <PageHeader title="Candidates" description="Manage your candidate pipeline">
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
              Add Candidate
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Resumes</DialogTitle>
              <DialogDescription>
                Upload single, multiple, or folder-based PDF resumes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Single or Multiple PDFs</Label>

                  <Button
                    type="button"
                    onClick={openSingleFilePicker}
                    className="w-full bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 rounded-full"
                  >
                    Select PDF Files
                  </Button>

                  <input
                    ref={singleFileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleSinglePdfSelect}
                    style={{ display: "none" }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Upload Folder of PDFs</Label>

                  <Button
                    type="button"
                    onClick={openFolderPicker}
                    className="w-full bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 rounded-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Select Folder
                  </Button>

                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    webkitdirectory=""
                    directory=""
                    onChange={handleFolderSelect}
                    style={{ display: "none" }}
                  />
                </div>

                {selectedFiles.length > 0 && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    {selectedFiles.length} PDF file(s) selected
                  </div>
                )}
              </div>

              <Button onClick={handleAddCandidate} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Candidate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded border border-destructive p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Candidate</TableHead>
                  <TableHead className="font-semibold">Resume File</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Loading candidates...
                    </TableCell>
                  </TableRow>
                ) : filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No candidates found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <TableRow key={candidate.candidate_id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        {candidate.candidate_name || candidate.candidate_id}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {getResumeFileName(candidate.resume_pdf_path)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteCandidate(candidate.candidate_id)}
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