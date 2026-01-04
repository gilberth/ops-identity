import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Search, FileText, AlertTriangle, LinkIcon, CheckCircle, Loader2 } from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";

const GPOAnalysis = () => {
    const [loading, setLoading] = useState(true);
    const [gpos, setGpos] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const assessments = await api.getAssessments();
            if (!assessments || assessments.length === 0) {
                setLoading(false);
                return;
            }
            const sorted = assessments.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const latestId = sorted[0].id;
            const data = await api.getAssessmentData(latestId);
            const gpoList = data.GPOs || data.gpos || data.Gpo || data.GroupPolicy || [];
            setGpos(Array.isArray(gpoList) ? gpoList : []);

        } catch (error) {
            console.error("Error loading GPO data:", error);
            toast({
                title: "Error loading data",
                description: "Could not fetch GPO data.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredGpos = gpos.filter(gpo =>
        (gpo.DisplayName || gpo.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalGpos = gpos.length;
    const unlinkedGpos = gpos.filter(g => {
        const links = g.Links || g.LinkedOUs || [];
        return links.length === 0;
    }).length;

    const complianceIssues = gpos.filter(g => {
        const status = g.GpoStatus || g.Status || "";
        const isMismatch = (g.UserVersionDS && g.UserVersionSysvol && g.UserVersionDS !== g.UserVersionSysvol);
        return status === "Disabled" || status === "AllSettingsDisabled" || isMismatch;
    }).length;

    return (
        <>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
                        GPO Analysis
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Analyze Group Policy Objects for security and compliance
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="panel p-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total GPOs</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{totalGpos}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="panel p-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-[hsl(var(--severity-medium))]/10 text-[hsl(var(--severity-medium))]">
                                <LinkIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unlinked GPOs</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{unlinkedGpos}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="panel p-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-[hsl(var(--severity-critical))]/10 text-[hsl(var(--severity-critical))]">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Compliance Issues</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{complianceIssues}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="panel">
                    <div className="panel-header flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground">
                            Group Policy Objects ({filteredGpos.length})
                        </h2>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search GPOs..."
                                className="pl-9 h-9 rounded-lg bg-secondary/50 border-border focus:bg-secondary transition-all text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-0">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : filteredGpos.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No GPOs found in the latest assessment data.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="pl-6 h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">GPO Name</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linked OUs</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Version (DS)</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Replication Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredGpos.slice(0, 100).map((gpo, idx) => (
                                        <TableRow key={idx} className="border-border hover:bg-secondary/30 transition-colors">
                                            <TableCell className="pl-6 font-medium text-foreground">{gpo.DisplayName || gpo.name || "N/A"}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={(gpo.GpoStatus === "AllSettingsEnabled" || gpo.status === "Enforced")
                                                        ? "badge-low"
                                                        : "bg-secondary text-muted-foreground border-border"}
                                                >
                                                    {gpo.GpoStatus || gpo.status || "Unknown"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-sm">{(gpo.Links || gpo.LinkedOUs || []).length}</TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-sm">{gpo.UserVersionDS || gpo.version || "-"}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {(gpo.UserVersionDS && gpo.UserVersionSysvol && gpo.UserVersionDS !== gpo.UserVersionSysvol) ? (
                                                        <span className="text-[hsl(var(--severity-critical))] flex items-center gap-1 text-sm font-medium">
                                                            <AlertTriangle className="h-3 w-3" /> Mismatch
                                                        </span>
                                                    ) : (
                                                        <span className="text-accent flex items-center gap-1 text-sm font-medium">
                                                            <CheckCircle className="h-3 w-3" /> Synced
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default GPOAnalysis;
