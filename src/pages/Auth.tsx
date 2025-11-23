import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">AD Security Assessment</CardTitle>
          <CardDescription>
            Self-Hosted Version - No authentication required
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2 py-4">
            <p className="text-sm text-muted-foreground">
              This is a self-hosted deployment running with direct PostgreSQL access.
            </p>
            <p className="text-sm text-muted-foreground">
              Authentication is disabled for internal use.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => navigate("/")}
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
