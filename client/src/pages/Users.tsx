import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/utils/api";
import { toast } from "@/hooks/use-toast";

const Users = () => {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<any[]>([]);
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
            const userList = data.Users || data.users || [];
            setUsers(Array.isArray(userList) ? userList : []);

        } catch (error) {
            console.error("Error loading user data:", error);
            toast({
                title: "Error loading data",
                description: "Could not fetch user data from the latest assessment.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        (user.Name || user.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.SamAccountName || user.username || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
                            Users & Identities
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage and audit Active Directory user accounts
                        </p>
                    </div>
                    <Button className="btn-primary">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>

                {/* Main Panel */}
                <div className="panel">
                    <div className="panel-header flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground">
                            Directory Users ({filteredUsers.length})
                        </h2>
                        <div className="flex items-center gap-3">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search users..."
                                    className="pl-9 h-9 rounded-lg bg-secondary/50 border-border focus:bg-secondary transition-all text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-border">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>

                    <div className="p-0">
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                No users found in the latest assessment data.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border hover:bg-transparent">
                                        <TableHead className="pl-6 h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username (SAM)</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enabled</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Logon</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password Age</TableHead>
                                        <TableHead className="h-11 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.slice(0, 100).map((user, idx) => (
                                        <TableRow key={idx} className="border-border hover:bg-secondary/30 transition-colors">
                                            <TableCell className="pl-6 font-medium text-foreground">{user.Name || user.name || "N/A"}</TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-sm">{user.SamAccountName || user.username || "N/A"}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={(user.Enabled === true || user.Enabled === "True" || user.status === "Active")
                                                        ? "badge-low"
                                                        : "bg-secondary text-muted-foreground border-border"}
                                                >
                                                    {(user.Enabled === true || user.Enabled === "True" || user.status === "Active") ? "Active" : "Disabled"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{user.LastLogonDate || user.lastLogon || "Never"}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{user.PasswordAge || user.pwdAge || "N/A"}</TableCell>
                                            <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{user.Description || user.description || "-"}</TableCell>
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

export default Users;
