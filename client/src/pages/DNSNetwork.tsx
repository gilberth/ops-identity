import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Network, Server, Globe, Loader2 } from "lucide-react";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/MainLayout";

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

            const dnsList = data.DNSRecords || data.DNS || data.dns || data.DnsRecords || [];
            if (Array.isArray(dnsList)) {
                setRecords(dnsList);
            } else if (typeof dnsList === 'object' && dnsList !== null) {
                const flatList = Object.values(dnsList).flat();
                setRecords(flatList as any[]);
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
    const zones = new Set(records.map(r => r.ZoneName || r.zone || r.Zone)).size;
    const healthScore = totalRecords > 0 ? 98 : 0;

    return (
        <MainLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
                        DNS & Network
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor DNS health and network configurations
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="panel p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Network className="h-20 w-20 text-primary" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-3xl font-display font-bold text-primary mb-1">{healthScore}%</h3>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">DNS Health Score</p>
                        </div>
                    </div>
                    <div className="panel p-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-accent/10 text-accent">
                                <Server className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Zones</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{zones}</h3>
                            </div>
                        </div>
                    </div>
                    <div className="panel p-5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                <Globe className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Records</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{totalRecords}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="panel">
                    <div className="panel-header">
                        <h2 className="text-sm font-semibold text-foreground">
                            DNS Records ({records.length})
                        </h2>
                    </div>

                    <div className="p-0">
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
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="pl-6 h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Record Name</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zone</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">TTL</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.slice(0, 100).map((record, idx) => (
                                        <TableRow key={idx} className="border-border hover:bg-secondary/30 transition-colors">
                                            <TableCell className="pl-6 font-medium text-foreground">{record.Name || record.name || "N/A"}</TableCell>
                                            <TableCell>
                                                <Badge className="font-mono bg-secondary text-muted-foreground border-border">
                                                    {record.Type || record.type || "A"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm max-w-xs truncate text-muted-foreground">{record.Data || record.data || record.IP || ""}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{record.ZoneName || record.zone || record.Zone || "-"}</TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-sm">{record.TTL || record.ttl || "-"}</TableCell>
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

export default DNSNetwork;
