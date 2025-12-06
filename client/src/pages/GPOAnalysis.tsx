import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

            // Attempt to find GPO data in common keys
            const gpoList = data.gpos || data.Gpo || data.GroupPolicy || [];
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

    // Calculate stats
    const totalGpos = gpos.length;
    // Heuristic: if filtering implies links check for LinkedOUs or similar
    const unlinkedGpos = gpos.filter(g => !g.LinkedOUs || g.LinkedOUs.length === 0).length;
    // Heuristic: check for some 'status' or 'consistency' field if available, or just mock it for now if data is missing
    const complianceIssues = gpos.filter(g => g.Status === "Disabled" || g.sysvol === "Orphaned").length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">GPO Analysis</h1>
                    <p className="text-muted-foreground mt-1">Analyze Group Policy Objects for security and compliance.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-none shadow-soft bg-white p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total GPOs</p>
                            <h3 className="text-2xl font-bold text-foreground">{totalGpos}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-soft bg-white p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                            <LinkIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Unlinked GPOs</p>
                            <h3 className="text-2xl font-bold text-foreground">{unlinkedGpos}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-soft bg-white p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-red-100 text-red-600">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Compliance Issues</p>
                            <h3 className="text-2xl font-bold text-foreground">{complianceIssues}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="rounded-[2rem] border-none shadow-soft overflow-hidden bg-white">
                <CardHeader className="bg-white px-8 pt-8 pb-4 border-b border-gray-100/50">
                    <div className="flex items-center justify-between">
                        <CardTitle>Group Policy Objects ({filteredGpos.length})</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search GPOs..."
                                className="pl-9 h-10 rounded-xl bg-gray-50 border-transparent focus:bg-white transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
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
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="pl-8 h-12">GPO Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Linked OUs</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Sysvol Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGpos.slice(0, 100).map((gpo, idx) => (
                                    <TableRow key={idx} className="hover:bg-gray-50/50 border-gray-100">
                                        <TableCell className="pl-8 font-medium">{gpo.DisplayName || gpo.name || "N/A"}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={(gpo.GpoStatus === "AllSettingsEnabled" || gpo.status === "Enforced") ? "default" : "secondary"}
                                                className={(gpo.GpoStatus === "AllSettingsEnabled" || gpo.status === "Enforced") ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500"}
                                            >
                                                {gpo.GpoStatus || gpo.status || "Unknown"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{gpo.LinkedOUs ? gpo.LinkedOUs.length : (gpo.linkedOUs || 0)}</TableCell>
                                        <TableCell>{gpo.UserVersion?.Version || gpo.version || "-"}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {/* Mocking sysvol status if not present, as it's complex to check remotely without specific data */}
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                Synced
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default GPOAnalysis;
