import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Terminal, Check } from "lucide-react";
import SeverityBadge from "./SeverityBadge";

interface FindingCardProps {
    finding: any;
}

export const FindingCard = ({ finding }: FindingCardProps) => {
    const [copied, setCopied] = useState(false);

    const copyScript = () => {
        navigator.clipboard.writeText(finding.remediation_commands || '# No script available');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                            <SeverityBadge severity={finding.severity} />
                            <CardTitle className="text-xl">{finding.title}</CardTitle>
                        </div>
                        <CardDescription>{finding.description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="recommendation">
                    <TabsList>
                        <TabsTrigger value="recommendation">Recomendación</TabsTrigger>
                        <TabsTrigger value="script" className="flex items-center gap-2">
                            <Terminal className="w-4 h-4" />
                            Script de Remediación
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="recommendation" className="mt-4">
                        <div className="bg-muted p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{finding.recommendation}</p>
                        </div>
                    </TabsContent>
                    <TabsContent value="script" className="mt-4">
                        <div className="relative bg-slate-950 text-slate-50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-2 right-2 text-slate-400 hover:text-white hover:bg-slate-800"
                                onClick={copyScript}
                            >
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            <pre>{finding.remediation_commands || '# No script available'}</pre>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};
