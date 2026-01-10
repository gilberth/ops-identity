import { useState, useEffect } from "react";
import { Bell, AlertTriangle, ShieldAlert, Info, CheckCircle, X, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "critical" | "high" | "medium" | "info";
  title: string;
  message: string;
  timestamp: Date;
  assessmentId?: string;
  read: boolean;
}

const NotificationsPanel = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch recent findings/alerts from API
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/assessments");
        if (response.ok) {
          const assessments = await response.json();

          // Get findings from recent completed assessments
          const recentNotifications: Notification[] = [];

          for (const assessment of assessments.slice(0, 5)) {
            if (assessment.status === "completed") {
              try {
                const findingsRes = await fetch(`/api/assessments/${assessment.id}/findings`);
                if (findingsRes.ok) {
                  const findings = await findingsRes.json();

                  // Add critical and high findings as notifications
                  findings
                    .filter((f: any) => f.severity === "critical" || f.severity === "high")
                    .slice(0, 3)
                    .forEach((f: any) => {
                      recentNotifications.push({
                        id: `${assessment.id}-${f.id}`,
                        type: f.severity as "critical" | "high",
                        title: f.title || f.type_id,
                        message: `${assessment.domain}: ${f.description?.substring(0, 100) || "Security finding detected"}...`,
                        timestamp: new Date(assessment.completed_at || assessment.created_at),
                        assessmentId: assessment.id,
                        read: false,
                      });
                    });
                }
              } catch {
                // Skip if findings fetch fails
              }
            }
          }

          // Sort by timestamp and limit
          recentNotifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          setNotifications(recentNotifications.slice(0, 10));
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 300000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "critical":
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <Info className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (type: string) => {
    switch (type) {
      case "critical":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      case "high":
        return "bg-orange-500/10 border-orange-500/30 text-orange-400";
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
      default:
        return "bg-blue-500/10 border-blue-500/30 text-blue-400";
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No notifications</p>
              <p className="text-xs">All clear! No critical findings.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer",
                    !notification.read && "bg-primary/5"
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          !notification.read && "text-foreground",
                          notification.read && "text-muted-foreground"
                        )}>
                          {notification.title}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[9px] h-4 px-1",
                            getSeverityColor(notification.type)
                          )}
                        >
                          {notification.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatTime(notification.timestamp)}
                        </span>
                        {notification.assessmentId && (
                          <Link
                            to={`/assessment/${notification.assessmentId}`}
                            className="text-[10px] text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpen(false);
                            }}
                          >
                            View details
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="px-4 py-2 border-t border-border bg-secondary/30">
          <Link
            to="/reports"
            className="text-xs text-primary hover:underline flex items-center justify-center gap-1"
            onClick={() => setIsOpen(false)}
          >
            View all findings
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPanel;
