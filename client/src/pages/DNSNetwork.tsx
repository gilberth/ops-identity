import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, Server, Globe, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";

const DNSNetwork = () => {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<any[]>([]);

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

            // Attempt to find DNS data in common keys
            // Some collectors put it under 'Dns', others 'DnsRecords'
            // The PowerShell script exports as 'DNS', so we should check that first
            const dnsList = data.DNS || data.dns || data.Dns || data.DnsRecords || [];
            if (Array.isArray(dnsList)) {
                setRecords(dnsList);
            } else if (typeof dnsList === 'object' && dnsList !== null) {
                // sometimes it's nested by zone
                const flatList = Object.values(dnsList).flat();
                setRecords(flatList);
            } else {
                setRecords([]);
            }

        } catch (error) {
            console.error("Error loading DNS data:", error);
            toast({
                title: "Error loading data",
                description: "Could not fetch DNS data.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const totalRecords = records.length;
    // Heuristic: Count unique zones if available
    const zones = new Set(records.map(r => r.ZoneName || r.zone || r.Zone)).size;
    // Mock health score for now
    const healthScore = totalRecords > 0 ? 98 : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">DNS & Network</h1>
                    <p className="text-muted-foreground mt-1">Monitor DNS health and network configurations.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-none shadow-soft bg-white p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Network className="h-24 w-24 text-primary" />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-4xl font-bold text-primary mb-1">{healthScore}%</h3>
                        <p className="text-sm font-medium text-muted-foreground">DNS Health Score</p>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-soft bg-white p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                            <Server className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Active Zones</p>
                            <h3 className="text-2xl font-bold text-foreground">{zones}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-soft bg-white p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                            <Globe className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                            <h3 className="text-2xl font-bold text-foreground">{totalRecords}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="rounded-[2rem] border-none shadow-soft overflow-hidden bg-white">
                <CardHeader className="bg-white px-8 pt-8 pb-4 border-b border-gray-100/50">
                    <CardTitle>DNS Records ({records.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No DNS records found in the latest assessment data.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="pl-8 h-12">Record Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Zone</TableHead>
                                    <TableHead>TTL</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.slice(0, 100).map((record, idx) => (
                                    <TableRow key={idx} className="hover:bg-gray-50/50 border-gray-100">
                                        <TableCell className="pl-8 font-medium">{record.Name || record.name || "N/A"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono bg-white">
                                                {record.Type || record.type || "A"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm max-w-xs truncate">{record.Data || record.data || record.IP || ""}</TableCell>
                                        <TableCell>{record.ZoneName || record.zone || record.Zone || "-"}</TableCell>
                                        <TableCell>{record.TTL || record.ttl || "-"}</TableCell>
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

export default DNSNetwork;
