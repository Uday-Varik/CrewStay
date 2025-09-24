import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  UserCheck, 
  Home, 
  CheckCircle, 
  Calendar, 
  Shield, 
  LogOut, 
  UserX,
  AlertCircle
} from "lucide-react";

export type WorkerStatus = 
  | "pending" 
  | "pending_assignment" 
  | "room_assigned" 
  | "checked_in" 
  | "extension_requested" 
  | "extension_approved" 
  | "checkout_pending" 
  | "checked_out" 
  | "inactive"
  | "active"; // Legacy status - will be mapped to checked_in

interface WorkerStatusBadgeProps {
  status: WorkerStatus;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<WorkerStatus, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  pending: {
    label: "Pending",
    variant: "outline",
    icon: Clock,
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
  },
  pending_assignment: {
    label: "Awaiting Assignment",
    variant: "secondary",
    icon: UserCheck,
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
  },
  room_assigned: {
    label: "Room Assigned",
    variant: "default",
    icon: Home,
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
  },
  checked_in: {
    label: "Checked In",
    variant: "default",
    icon: CheckCircle,
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
  },
  extension_requested: {
    label: "Extension Requested",
    variant: "outline",
    icon: Calendar,
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
  },
  extension_approved: {
    label: "Extension Approved",
    variant: "default",
    icon: Shield,
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
  },
  checkout_pending: {
    label: "Checkout Pending",
    variant: "outline",
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
  },
  checked_out: {
    label: "Checked Out",
    variant: "secondary",
    icon: LogOut,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800"
  },
  inactive: {
    label: "Inactive",
    variant: "destructive",
    icon: UserX,
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
  }
};

export function WorkerStatusBadge({ 
  status, 
  showIcon = true, 
  size = "md" 
}: WorkerStatusBadgeProps) {
  // Handle legacy status values and provide fallback
  const normalizedStatus = status === "active" ? "checked_in" : status;
  const config = statusConfig[normalizedStatus as WorkerStatus] || statusConfig.pending;
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-5 w-5"
  };

  return (
    <Badge
      className={`
        inline-flex items-center gap-1.5 font-medium transition-colors
        ${config.color} ${config.bgColor} ${sizeClasses[size]}
      `}
      data-testid={`status-badge-${status}`}
    >
      {showIcon && (
        <Icon className={`${iconSizes[size]} flex-shrink-0`} />
      )}
      <span className="leading-none">{config.label}</span>
    </Badge>
  );
}

// Helper function to get status priority for sorting
export function getStatusPriority(status: WorkerStatus): number {
  const priorities: Record<WorkerStatus, number> = {
    pending: 1,
    pending_assignment: 2,
    room_assigned: 3,
    checked_in: 4,
    extension_requested: 5,
    extension_approved: 6,
    checkout_pending: 7,
    checked_out: 8,
    inactive: 9
  };
  
  return priorities[status] || 0;
}

// Helper function to determine if status requires action
export function statusRequiresAction(status: WorkerStatus, userType: "construction" | "hotel"): boolean {
  if (userType === "hotel") {
    return ["pending_assignment", "extension_requested"].includes(status);
  }
  
  if (userType === "construction") {
    return ["checkout_pending"].includes(status);
  }
  
  return false;
}