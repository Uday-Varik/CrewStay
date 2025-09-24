import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WorkerStatusBadge } from "@/components/worker-status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AssignRoomModal } from "@/components/assign-room-modal";
import { NotificationToast } from "@/components/notification-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bed, Inbox, Calendar, UserCheck, Clock, DoorOpen, Search, Download, LogOut } from "lucide-react";

export default function HotelDashboard() {
  const { user, logoutMutation } = useAuth();
  const [showAssignRoomModal, setShowAssignRoomModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<"rooms" | "requests">("rooms");

  // Fetch accommodation requests
  const { data: requests = [], isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ["/api/accommodation-requests"],
  });

  // Fetch extension requests
  const { data: extensions = [], isLoading: extensionsLoading, refetch: refetchExtensions } = useQuery({
    queryKey: ["/api/extensions"],
  });

  // Fetch statistics
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/stats"],
  });

  // WebSocket for real-time updates
  useWebSocket({
    onMessage: (message: any) => {
      if (message.type === "new_worker_request") {
        refetchRequests();
        refetchStats();
      } else if (message.type === "worker_discontinued") {
        refetchRequests();
        refetchStats();
      } else if (message.type === "extension_request") {
        refetchExtensions();
        refetchStats();
      } else if (message.type === "extension_response") {
        refetchExtensions();
        refetchStats();
      } else if (message.type === "worker_status_updated") {
        // Real-time worker status updates
        refetchRequests();
        refetchExtensions();
        refetchStats();
      }
    },
  });

  // Mutation for handling accommodation requests
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, assignedRoom, notes }: { 
      id: string; 
      status: "approved" | "rejected"; 
      assignedRoom?: string; 
      notes?: string; 
    }) => {
      const response = await apiRequest("PATCH", `/api/accommodation-requests/${id}`, {
        status,
        assignedRoom,
        notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accommodation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  // Mutation for handling extension requests
  const updateExtensionMutation = useMutation({
    mutationFn: async ({ id, status, hotelResponse }: { 
      id: string; 
      status: "approved" | "rejected"; 
      hotelResponse?: string; 
    }) => {
      const response = await apiRequest("PATCH", `/api/extensions/${id}`, {
        status,
        hotelResponse,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extensions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const handleAssignRoom = (request: any) => {
    setSelectedRequest(request);
    setShowAssignRoomModal(true);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (confirm("Are you sure you want to reject this request?")) {
      await updateRequestMutation.mutateAsync({
        id: requestId,
        status: "rejected",
      });
    }
  };

  const handleApproveExtension = async (extensionId: string, hotelResponse?: string) => {
    await updateExtensionMutation.mutateAsync({
      id: extensionId,
      status: "approved",
      hotelResponse,
    });
  };

  const handleRejectExtension = async (extensionId: string, hotelResponse?: string) => {
    if (confirm("Are you sure you want to reject this extension request?")) {
      await updateExtensionMutation.mutateAsync({
        id: extensionId,
        status: "rejected",
        hotelResponse,
      });
    }
  };

  const pendingRequests = (requests as any[]).filter((req: any) => req.status === "pending");
  const approvedRequests = (requests as any[]).filter((req: any) => req.status === "approved");
  const pendingExtensions = (extensions as any[]).filter((ext: any) => ext.status === "pending");

  const filteredApprovedRequests = approvedRequests.filter((request: any) =>
    request.worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.worker.workerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.assignedRoom?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border h-screen sticky top-0">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold text-primary">CrewStay</h2>
            <p className="text-sm text-muted-foreground" data-testid="text-hotel-name">
              {user?.companyName}
            </p>
          </div>
          
          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${activeView === "rooms" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                  onClick={() => setActiveView("rooms")}
                  data-testid="button-room-management"
                >
                  <Bed className="w-5 h-5 mr-3" />
                  Room Management
                </Button>
              </li>
              <li>
                <Button
                  variant="ghost"
                  className={`w-full justify-start ${activeView === "requests" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
                  onClick={() => setActiveView("requests")}
                  data-testid="button-requests"
                >
                  <Inbox className="w-5 h-5 mr-3" />
                  Requests
                  {pendingRequests.length > 0 && (
                    <Badge className="ml-auto bg-orange-500 text-white text-xs notification-badge" data-testid="badge-pending-requests">
                      {pendingRequests.length}
                    </Badge>
                  )}
                </Button>
              </li>
            </ul>
          </nav>
          
          <div className="absolute bottom-4 left-4 right-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {/* Header */}
          <header className="bg-card border-b border-border p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {activeView === "rooms" ? "Room Management" : "Accommodation Requests"}
                </h1>
                <p className="text-muted-foreground">
                  {activeView === "rooms" 
                    ? "Manage accommodation requests and room assignments" 
                    : "Review and process accommodation requests"
                  }
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live Updates Active</span>
                </div>
              </div>
            </div>
          </header>
          
          {/* Content based on active view */}
          {activeView === "rooms" && (
            <>
              {/* Stats Cards */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Rooms</p>
                        <p className="text-2xl font-bold text-foreground" data-testid="stat-total-rooms">
                          {(stats as any)?.totalRooms || 0}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Bed className="text-primary w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Occupied</p>
                        <p className="text-2xl font-bold text-green-600" data-testid="stat-occupied-rooms">
                          {(stats as any)?.occupiedRooms || 0}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <UserCheck className="text-green-600 w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending Requests</p>
                        <p className="text-2xl font-bold text-orange-600" data-testid="stat-pending-requests">
                          {(stats as any)?.pendingRequests || 0}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Clock className="text-orange-600 w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Available</p>
                        <p className="text-2xl font-bold text-primary" data-testid="stat-available-rooms">
                          {(stats as any)?.availableRooms || 0}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <DoorOpen className="text-primary w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Current Occupants Section for Room Management View */}
              <div className="px-6 pb-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <UserCheck className="mr-2 text-green-500 w-5 h-5" />
                    Current Occupants
                    <span className="ml-2 text-sm text-muted-foreground">({approvedRequests.length} workers)</span>
                  </CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Search rooms or workers..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        data-testid="input-search-occupants"
                      />
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {requestsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading occupants...
                  </div>
                ) : filteredApprovedRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-occupants">
                    {approvedRequests.length === 0 ? "No current occupants." : "No occupants match your search."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead>
                        <TableHead>Worker Info</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Check-in Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApprovedRequests.map((request: any) => (
                        <TableRow key={request.id} data-testid={`occupant-${request.id}`}>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Bed className="text-primary w-4 h-4" />
                              </div>
                              <span className="ml-3 text-sm font-medium text-foreground" data-testid={`occupant-room-${request.id}`}>
                                {request.assignedRoom}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium text-foreground" data-testid={`occupant-name-${request.id}`}>
                                {request.worker.name}
                              </div>
                              <div className="text-sm text-muted-foreground font-mono" data-testid={`occupant-id-${request.id}`}>
                                {request.worker.workerId}
                              </div>
                              <div className="text-xs text-muted-foreground" data-testid={`occupant-phone-${request.id}`}>
                                {request.worker.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground" data-testid={`occupant-company-${request.id}`}>
                            {request.company.companyName}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div data-testid={`occupant-checkin-${request.id}`}>
                              {new Date(request.respondedAt || request.requestDate).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <WorkerStatusBadge 
                              status={request.worker?.status || "checked_in"} 
                              size="sm" 
                              data-testid={`status-occupant-${request.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                data-testid={`button-view-details-${request.id}`}
                              >
                                👁️
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
            </>
          )}

          {/* Requests View */}
          {activeView === "requests" && (
            <div className="p-6 space-y-6">
              {/* Pending Accommodation Requests */}
              {pendingRequests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Inbox className="mr-2 text-orange-500 w-5 h-5" />
                      Pending Accommodation Requests
                      <Badge className="ml-2 bg-orange-100 text-orange-800 text-xs" data-testid="badge-new-requests">
                        {pendingRequests.length} New
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {pendingRequests.map((request: any) => (
                        <div key={request.id} className="p-4 hover:bg-muted/50 transition-colors" data-testid={`request-${request.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0 h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                <span className="text-primary font-bold text-sm">
                                  {request.worker.name.split(' ').map((n: string) => n[0]).join('')}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-sm font-medium text-foreground" data-testid={`request-worker-name-${request.id}`}>
                                    {request.worker.name}
                                  </h4>
                                  <span className="text-xs text-muted-foreground font-mono" data-testid={`request-worker-id-${request.id}`}>
                                    {request.worker.workerId}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground" data-testid={`request-company-${request.id}`}>
                                  {request.company.companyName}
                                </p>
                                <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                                  <span>Phone: <span data-testid={`request-worker-phone-${request.id}`}>{request.worker.phone}</span></span>
                                  <span>Requested: <span data-testid={`request-date-${request.id}`}>
                                    {new Date(request.requestDate).toLocaleDateString()}
                                  </span></span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleAssignRoom(request)}
                                className="text-sm font-medium"
                                data-testid={`button-assign-room-${request.id}`}
                              >
                                Assign Room
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleRejectRequest(request.id)}
                                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground text-sm font-medium"
                                data-testid={`button-reject-${request.id}`}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pending Extension Requests */}
              {pendingExtensions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="mr-2 text-blue-500 w-5 h-5" />
                      Pending Extension Requests
                      <Badge className="ml-2 bg-blue-100 text-blue-800 text-xs" data-testid="badge-extension-requests">
                        {pendingExtensions.length} New
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {pendingExtensions.map((extension: any) => (
                        <div key={extension.id} className="p-4 hover:bg-muted/50 transition-colors" data-testid={`extension-${extension.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0 h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Clock className="text-blue-600 w-6 h-6" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-sm font-medium text-foreground" data-testid={`extension-worker-name-${extension.id}`}>
                                    {extension.worker.name}
                                  </h4>
                                  <span className="text-xs text-muted-foreground font-mono" data-testid={`extension-worker-id-${extension.id}`}>
                                    {extension.worker.workerId}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground" data-testid={`extension-company-${extension.id}`}>
                                  {extension.worker.company?.companyName}
                                </p>
                                <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                                  <span>Current End: <span data-testid={`extension-current-date-${extension.id}`}>
                                    {new Date(extension.currentEndDate).toLocaleDateString()}
                                  </span></span>
                                  <span>Requested: <span data-testid={`extension-requested-date-${extension.id}`}>
                                    {new Date(extension.requestedEndDate).toLocaleDateString()}
                                  </span></span>
                                </div>
                                {extension.reason && (
                                  <p className="text-sm text-muted-foreground mt-1" data-testid={`extension-reason-${extension.id}`}>
                                    Reason: {extension.reason}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                onClick={() => handleApproveExtension(extension.id, "Extension approved by hotel")}
                                className="text-sm font-medium bg-green-600 hover:bg-green-700"
                                data-testid={`button-approve-extension-${extension.id}`}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleRejectExtension(extension.id, "Extension rejected by hotel")}
                                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground text-sm font-medium"
                                data-testid={`button-reject-extension-${extension.id}`}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No Requests Message */}
              {pendingRequests.length === 0 && pendingExtensions.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Inbox className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Pending Requests</h3>
                    <p className="text-muted-foreground">All accommodation and extension requests have been processed.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AssignRoomModal
        open={showAssignRoomModal}
        onOpenChange={setShowAssignRoomModal}
        request={selectedRequest}
        onRoomAssigned={() => {
          refetchRequests();
          setShowAssignRoomModal(false);
          setSelectedRequest(null);
        }}
      />

      <NotificationToast />
    </div>
  );
}
