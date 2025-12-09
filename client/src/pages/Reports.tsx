import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/utils/api";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useClient } from "@/context/ClientContext";

const Reports = () => {
    const [loading, setLoading] = useState(true);
    const [assessments, setAssessments] = useState<any[]>([]);
    const { currentClient } = useClient();

    useEffect(() => {
        loadData();
    }, [currentClient]); // Reload if client changes

    const loadData = async () => {
        try {
            const data = await api.getAssessments(currentClient?.id);
            // Sort by date desc
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Reports Center</h1>
                    <p className="text-muted-foreground mt-1">Generate and download security assessment reports.</p>
                </div>
                <Link to="/new-assessment">
                    <Button className="rounded-full bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20">
                        Generate New Report
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Featured Report Card */}
                {latestReport && (
                    <Card className="rounded-[2rem] border-none shadow-soft bg-gradient-to-br from-primary to-emerald-800 text-white p-8 relative overflow-hidden col-span-1 md:col-span-2">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <Badge className="bg-white/20 text-white hover:bg-white/30 border-none mb-4">Latest Generated</Badge>
                                <h2 className="text-3xl font-bold mb-2">Assessment: {latestReport.domain}</h2>
                                <p className="text-white/80 max-w-xl">
                                    Generated on {new Date(latestReport.created_at).toLocaleDateString()} at {new Date(latestReport.created_at).toLocaleTimeString()}.
                                    Contains comprehensive analysis of Active Directory security posture.
                                </p>
                                <div className="flex gap-3 mt-6">
                                    <Link to={`/assessment/${latestReport.id}`}>
                                        <Button className="bg-white text-primary hover:bg-gray-100 rounded-xl font-bold">
                                            View Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            <div className="hidden lg:block bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                                <FileText className="h-24 w-24 text-white/90" />
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            <Card className="rounded-[2rem] border-none shadow-soft overflow-hidden bg-white">
                <CardHeader className="bg-white px-8 pt-8 pb-4 border-b border-gray-100/50">
                    <CardTitle>Available Reports</CardTitle>
                    <CardDescription>Archive of all generated security reports</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
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
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="pl-8 h-12">Domain / Report Name</TableHead>
                                    <TableHead>Date Generated</TableHead>
                                    <TableHead>Findings Count</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right pr-8">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assessments.map((report) => (
                                    <TableRow key={report.id} className="hover:bg-gray-50/50 border-gray-100">
                                        <TableCell className="pl-8 font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-gray-100 text-gray-500">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                {report.domain || "Unnamed Assessment"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(report.created_at).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {/* We don't have findings count in list view usually, so maybe plain text or fetch it. Just show placeholder or simple status */}
                                            <Badge variant="secondary" className="bg-gray-100">
                                                Analysis Complete
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className={`h-2 w-2 rounded-full bg-green-500`} />
                                                Ready
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <Link to={`/assessment/${report.id}`}>
                                                <Button variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary rounded-lg">
                                                    View Details
                                                </Button>
                                            </Link>
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

export default Reports;
