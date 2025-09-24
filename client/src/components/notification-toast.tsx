import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, X } from "lucide-react";

interface Notification {
  id: string;
  type: "success" | "warning" | "info";
  title: string;
  description: string;
}

export function NotificationToast() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = (notification: Omit<Notification, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = { ...notification, id };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 2)]); // Keep max 3 notifications
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case "room_assigned":
          showNotification({
            type: "success",
            title: "Room Assigned!",
            description: `${message.data.workerName} has been assigned to Room ${message.data.roomNumber} at ${message.data.hotelName}`,
          });
          break;
          
        case "new_worker_request":
          showNotification({
            type: "info",
            title: "New Worker Request",
            description: `${message.data.worker.name} needs accommodation`,
          });
          break;
          
        case "worker_discontinued":
          showNotification({
            type: "warning",
            title: "Worker Discontinued",
            description: "A worker has been marked as discontinued",
          });
          break;
          
        case "extension_request":
          showNotification({
            type: "info",
            title: "Extension Request",
            description: `${message.data.worker.name} has requested a stay extension`,
          });
          break;
          
        case "extension_response":
          showNotification({
            type: message.data.status === "approved" ? "success" : "warning",
            title: `Extension ${message.data.status.charAt(0).toUpperCase() + message.data.status.slice(1)}`,
            description: `${message.data.workerName}'s extension request has been ${message.data.status}`,
          });
          break;
      }
    },
  });

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" data-testid="notification-container">
      {notifications.map((notification) => (
        <Card 
          key={notification.id}
          className="w-80 p-4 shadow-lg slide-in"
          data-testid={`notification-${notification.id}`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                notification.type === "success" 
                  ? "bg-green-100" 
                  : notification.type === "warning"
                  ? "bg-orange-100"
                  : "bg-blue-100"
              }`}>
                {notification.type === "success" ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : notification.type === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground" data-testid={`notification-title-${notification.id}`}>
                {notification.title}
              </p>
              <p className="text-xs text-muted-foreground" data-testid={`notification-description-${notification.id}`}>
                {notification.description}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 h-8 w-8 p-0"
              data-testid={`button-close-notification-${notification.id}`}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
