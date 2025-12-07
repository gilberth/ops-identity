import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Terminal } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface RemediationModalProps {
    isOpen: boolean;
    onClose: () => void;
    finding: any;
}

export const RemediationModal = ({ isOpen, onClose, finding }: RemediationModalProps) => {
    const [copied, setCopied] = useState(false);

    if (!finding) return null;

    // Extract remediation content
    // Prefer remediation_commands, fallback to recommendation, fallback to generic message
    const remediationScript = finding.remediation_commands || finding.recommendation || "No specific script available. Please refer to the description for manual remediation steps.";

    // Detect language for syntax highlighting hint (simple check)
    const isPowerShell = remediationScript.toLowerCase().includes("get-") || remediationScript.toLowerCase().includes("set-") || remediationScript.includes("$");

    const handleCopy = () => {
        navigator.clipboard.writeText(remediationScript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">
                            {finding.severity || "Critical"}
                        </Badge>
                        <span className="text-xs text-muted-foreground uppercase">{finding.type_id || "SECURITY_FINDING"}</span>
                    </div>
                    <DialogTitle className="text-xl leading-tight">{finding.title}</DialogTitle>
                    <DialogDescription>
                        Implement the following changes to remediate this vulnerability.
                        <span className="block mt-1 text-xs text-red-600 font-semibold">⚠️ Always test in a non-production environment first.</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="my-4">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                            <Terminal className="h-3 w-3" />
                            {isPowerShell ? "PowerShell Remediation" : "Remediation Steps"}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 hover:bg-slate-100"
                            onClick={handleCopy}
                        >
                            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                            {copied ? "Copied" : "Copy Code"}
                        </Button>
                    </div>
                    <div className="bg-slate-950 rounded-lg p-4 overflow-x-auto relative group border border-slate-800 shadow-inner">
                        <pre className="text-sm font-mono text-slate-50 whitespace-pre-wrap break-all">
                            <code>{remediationScript}</code>
                        </pre>
                    </div>
                </div>

                {finding.microsoft_docs && (
                    <div className="mb-4 text-sm text-muted-foreground bg-slate-50 p-3 rounded-md border border-slate-100">
                        <strong>Reference: </strong>
                        <a href={finding.microsoft_docs} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800 break-all">
                            {finding.microsoft_docs}
                        </a>
                    </div>
                )}

                <DialogFooter className="sm:justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    <Button type="button" onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700">
                        {copied ? "Copied to Clipboard" : "Copy Script"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
