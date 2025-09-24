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
import { BulkApprovalModal } from "@/components/bulk-approval-modal";
import { NotificationToast } from "@/components/notification-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bed, Inbox, Calendar, UserCheck, Clock, DoorOpen, Search, Download, Filter, Users, CheckCircle2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HotelDashboard() {
  const { user } = useAuth();
  const [showAssignRoomModal, setShowAssignRoomModal] = useState(false);
  const [showBulkApprovalModal, setShowBulkApprovalModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [activeTab, setActiveTab] = useState<"requests" | "extensions">("requests");

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

  // Filter and sort accommodation requests
  const filteredRequests = requests
    .filter((request: any) => {
      const matchesSearch = !searchTerm || 
        request.worker?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.worker?.workerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name":
          return a.worker?.name.localeCompare(b.worker?.name);
        case "duration":
          return (b.worker?.expectedDuration || 0) - (a.worker?.expectedDuration || 0);
        default:
          return 0;
      }
    });
  
  // Filter and sort extension requests
  const filteredExtensions = extensions
    .filter((extension: any) => {
      const matchesSearch = !searchTerm || 
        extension.worker?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        extension.worker?.workerId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || extension.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
        case "oldest":
          return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
        case "name":
          return a.worker?.name.localeCompare(b.worker?.name);
        case "duration":
          return (b.additionalDays || 0) - (a.additionalDays || 0);
        default:
          return 0;
      }
    });
  
  const pendingRequestsCount = requests.filter((req: any) => req.status === "pending").length;
  const pendingExtensionsCount = extensions.filter((ext: any) => ext.status === "pending").length;

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hotel Dashboard</h1>
            <p className="text-muted-foreground">Manage accommodation requests and room assignments</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Real-time Status Indicator */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live Updates Active</span>
            </div>
            
            <Button
              onClick={() => setShowBulkApprovalModal(true)}
              disabled={pendingRequestsCount === 0}
              className="flex items-center space-x-2"
              data-testid="button-bulk-approval"
            >
              <Users className="w-4 h-4" />
              <span>Bulk Approve ({pendingRequestsCount})</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-pending-requests">
                  {pendingRequestsCount || 0}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Inbox className="text-orange-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Occupied Rooms</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-occupied-rooms">
                  {(stats as any)?.occupiedRooms || 0}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Bed className="text-blue-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Extension Requests</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="stat-pending-extensions">
                  {pendingExtensionsCount || 0}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Calendar className="text-purple-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-monthly-revenue">
                  ${((stats as any)?.monthlyRevenue || 0).toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <DoorOpen className="text-green-600 w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by worker name, ID, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-requests"
              />
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32" data-testid="select-sort-by">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "requests" | "extensions")}>
        <TabsList className="mb-6">
          <TabsTrigger value="requests" className="flex items-center space-x-2" data-testid="tab-requests">
            <Inbox className="w-4 h-4" />
            <span>Accommodation Requests</span>
            {pendingRequestsCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="extensions" className="flex items-center space-x-2" data-testid="tab-extensions">
            <Calendar className="w-4 h-4" />
            <span>Extension Requests</span>
            {pendingExtensionsCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingExtensionsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Accommodation Requests</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Showing {filteredRequests.length} of {requests.length} requests
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading requests...
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-requests">
                  {requests.length === 0 ? "No accommodation requests yet." : "No requests match your search criteria."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker Info</TableHead>
                      <TableHead>Request Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request: any) => (
                      <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-primary font-medium text-sm">
                                {request.worker?.name.split(' ').map((n: string) => n[0]).join('')}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-foreground" data-testid={`text-worker-name-${request.id}`}>
                                {request.worker?.name}
                              </div>
                              <div className="text-sm text-muted-foreground font-mono" data-testid={`text-worker-id-${request.id}`}>
                                {request.worker?.workerId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.worker?.phone}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">Duration: {request.worker?.expectedDuration} days</div>
                            {request.notes && (
                              <div className="text-muted-foreground mt-1 text-xs">{request.notes}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              Requested: {new Date(request.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <WorkerStatusBadge status={request.worker?.status} size="sm" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {request.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleAssignRoom(request)}
                                  className="flex items-center space-x-1"
                                  data-testid={`button-assign-room-${request.id}`}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Assign Room</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectRequest(request.id)}
                                  className="flex items-center space-x-1 text-red-600"
                                  data-testid={`button-reject-${request.id}`}
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </Button>
                              </>
                            )}
                            {request.status === "approved" && request.assignedRoom && (
                              <div className="text-sm text-green-600">
                                Room {request.assignedRoom}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extensions">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Extension Requests</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Showing {filteredExtensions.length} of {extensions.length} extensions
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {extensionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading extensions...
                </div>
              ) : filteredExtensions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-extensions">
                  {extensions.length === 0 ? "No extension requests yet." : "No extensions match your search criteria."}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker Info</TableHead>
                      <TableHead>Extension Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExtensions.map((extension: any) => (
                      <TableRow key={extension.id} data-testid={`row-extension-${extension.id}`}>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-primary font-medium text-sm">
                                {extension.worker?.name.split(' ').map((n: string) => n[0]).join('')}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-foreground">
                                {extension.worker?.name}
                              </div>
                              <div className="text-sm text-muted-foreground font-mono">
                                {extension.worker?.workerId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Room: {extension.worker?.assignedRoom}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">Additional: {extension.additionalDays} days</div>
                            <div className="text-muted-foreground">{extension.reason}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Requested: {new Date(extension.requestedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            extension.status === "approved" ? "default" :
                            extension.status === "rejected" ? "destructive" : "secondary"
                          }>
                            {extension.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {extension.status === "pending" && (
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveExtension(extension.id, "Extension approved by hotel management")}
                                className="flex items-center space-x-1"
                                data-testid={`button-approve-extension-${extension.id}`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approve</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectExtension(extension.id, "Extension rejected by hotel management")}
                                className="flex items-center space-x-1 text-red-600"
                                data-testid={`button-reject-extension-${extension.id}`}
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <AssignRoomModal
        open={showAssignRoomModal}
        onOpenChange={setShowAssignRoomModal}
        request={selectedRequest}
        onRequestUpdated={() => {
          refetchRequests();
          refetchStats();
          setShowAssignRoomModal(false);
          setSelectedRequest(null);
        }}
      />

      <BulkApprovalModal
        open={showBulkApprovalModal}
        onOpenChange={setShowBulkApprovalModal}
        requests={requests}
        onRequestsUpdated={() => {
          refetchRequests();
          refetchStats();
        }}
      />

      <NotificationToast />
    </div>
  );
}