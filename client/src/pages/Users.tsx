import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download, Loader2, UserX, UserCheck } from "lucide-react";

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

            // Get latest assessment
            const sorted = assessments.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const latestId = sorted[0].id;

            // Fetch raw data
            const data = await api.getAssessmentData(latestId);

            // Expected structure: data.users or data.Identity info. 
            // Depending on the collector script, it might be in different keys.
            // We will look for common keys.
            // The PowerShell script exports as 'Users'
            const userList = data.Users || data.users || [];

            // If raw data is flat or different, we might need to adjust.
            // Assuming standard AD Collector format.
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Users & Identities</h1>
                    <p className="text-muted-foreground mt-1">Manage and audit Active Directory user accounts.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="rounded-full">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                </div>
            </div>

            <Card className="rounded-[2rem] border-none shadow-soft overflow-hidden bg-white">
                <CardHeader className="bg-white px-8 pt-8 pb-4 border-b border-gray-100/50">
                    <div className="flex items-center justify-between">
                        <CardTitle>Directory Users ({filteredUsers.length})</CardTitle>
                        <div className="flex items-center gap-3">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search users..."
                                    className="pl-9 h-10 rounded-xl bg-gray-50 border-transparent focus:bg-white transition-all shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
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
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead className="pl-8 h-12">Name</TableHead>
                                    <TableHead>Username (SAM)</TableHead>
                                    <TableHead>Enabled</TableHead>
                                    <TableHead>Last Logon</TableHead>
                                    <TableHead>Password Age</TableHead>
                                    <TableHead>Description</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.slice(0, 100).map((user, idx) => (
                                    <TableRow key={idx} className="hover:bg-gray-50/50 border-gray-100">
                                        <TableCell className="pl-8 font-medium">{user.Name || user.name || "N/A"}</TableCell>
                                        <TableCell className="text-muted-foreground">{user.SamAccountName || user.username || "N/A"}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={(user.Enabled === true || user.Enabled === "True" || user.status === "Active") ? "default" : "secondary"}
                                                className={(user.Enabled === true || user.Enabled === "True" || user.status === "Active") ? "bg-primary/10 text-primary hover:bg-primary/20 shadow-none border-none font-bold" : "bg-gray-100 text-gray-500 hover:bg-gray-200 shadow-none border-none"}
                                            >
                                                {(user.Enabled === true || user.Enabled === "True" || user.status === "Active") ? "Active" : "Disabled"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{user.LastLogonDate || user.lastLogon || "Never"}</TableCell>
                                        <TableCell>{user.PasswordAge || user.pwdAge || "N/A"}</TableCell>
                                        <TableCell className="max-w-xs truncate text-muted-foreground">{user.Description || user.description || "-"}</TableCell>
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

export default Users;
