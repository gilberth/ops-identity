import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/utils/api";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useClient } from "@/context/ClientContext";
import MainLayout from "@/components/layout/MainLayout";

const Reports = () => {
    const [loading, setLoading] = useState(true);
    const [assessments, setAssessments] = useState<any[]>([]);
    const { currentClient } = useClient();

    useEffect(() => {
        loadData();
    }, [currentClient]);

    const loadData = async () => {
        try {
            const data = await api.getAssessments(currentClient?.id);
            const sorted = (data || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setAssessments(sorted);
        } catch (error) {
            console.error("Error loading reports:", error);
            toast({
                title: "Error loading reports",
                description: "Could not fetch assessment history.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const latestReport = assessments.length > 0 ? assessments[0] : null;

    return (
        <MainLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
                            Reports Center
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Generate and download security assessment reports
                        </p>
                    </div>
                    <Link to="/new-assessment">
                        <Button className="btn-primary">
                            Generate New Report
                        </Button>
                    </Link>
                </div>

                {/* Featured Report Card */}
                {latestReport && (
                    <div className="panel-accent p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <Badge className="badge-low mb-4">Latest Generated</Badge>
                                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                                    Assessment: {latestReport.domain}
                                </h2>
                                <p className="text-muted-foreground max-w-xl text-sm">
                                    Generated on {new Date(latestReport.created_at).toLocaleDateString()} at {new Date(latestReport.created_at).toLocaleTimeString()}.
                                    Contains comprehensive analysis of Active Directory security posture.
                                </p>
                                <div className="flex gap-3 mt-6">
                                    <Link to={`/assessment/${latestReport.id}`}>
                                        <Button className="btn-primary">
                                            View Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            <div className="hidden lg:block p-4 rounded-xl bg-secondary/50 border border-border">
                                <FileText className="h-20 w-20 text-primary/50" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Reports Table */}
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Available Reports</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Archive of all generated security reports</p>
                        </div>
                    </div>

                    <div className="p-0">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : assessments.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No reports found.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="pl-6 h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain / Report Name</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Generated</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Findings Count</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                                        <TableHead className="text-right pr-6 h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assessments.map((report) => (
                                        <TableRow key={report.id} className="border-border hover:bg-secondary/30 transition-colors">
                                            <TableCell className="pl-6 font-medium">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-lg bg-secondary border border-border">
                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <span className="text-foreground">{report.domain || "Unnamed Assessment"}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(report.created_at).toLocaleDateString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-secondary text-muted-foreground border-border">
                                                    Analysis Complete
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className="h-2 w-2 rounded-full bg-accent" />
                                                    <span className="text-muted-foreground">Ready</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <Link to={`/assessment/${report.id}`}>
                                                    <Button variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary rounded-lg text-sm">
                                                        View Details
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default Reports;
