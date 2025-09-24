import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddWorkerModal } from "@/components/add-worker-modal";
import { NotificationToast } from "@/components/notification-toast";
import { Users, CheckCircle, Clock, CalendarPlus, Plus, Download, Search, Settings, LogOut, Bell } from "lucide-react";

export default function ConstructionDashboard() {
  const { user, logoutMutation } = useAuth();
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch workers
  const { data: workers = [], isLoading: workersLoading, refetch: refetchWorkers } = useQuery({
    queryKey: ["/api/workers"],
  });

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  // WebSocket for real-time updates
  useWebSocket({
    onMessage: (message) => {
      if (message.type === "room_assigned") {
        refetchWorkers();
      } else if (message.type === "extension_response") {
        refetchWorkers();
      }
    },
  });

  const handleExportCSV = async () => {
    try {
      const response = await fetch("/api/workers/export", {
        credentials: "include",
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "workers.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const filteredWorkers = workers.filter((worker: any) =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.workerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border h-screen sticky top-0">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-bold text-primary">CrewStay</h2>
            <p className="text-sm text-muted-foreground" data-testid="text-company-name">
              {user?.companyName}
            </p>
          </div>
          
          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <div className="flex items-center space-x-3 px-3 py-2 rounded-md bg-accent text-accent-foreground">
                  <Users className="w-5 h-5" />
                  <span>Worker Management</span>
                </div>
              </li>
              <li>
                <div className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground">
                  <Clock className="w-5 h-5" />
                  <span>Extensions</span>
                  {stats?.extensionsDue > 0 && (
                    <Badge className="ml-auto bg-primary text-primary-foreground text-xs notification-badge" data-testid="badge-extensions-due">
                      {stats.extensionsDue}
                    </Badge>
                  )}
                </div>
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
                <h1 className="text-2xl font-bold text-foreground">Worker Management</h1>
                <p className="text-muted-foreground">Manage your construction crew accommodations</p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Real-time Status Indicator */}
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live Updates Active</span>
                </div>
                
                <Button
                  onClick={() => setShowAddWorkerModal(true)}
                  className="flex items-center space-x-2"
                  data-testid="button-add-worker"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Worker</span>
                </Button>
              </div>
            </div>
          </header>
          
          {/* Stats Cards */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Workers</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="stat-total-workers">
                      {stats?.totalWorkers || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="text-primary w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Workers</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="stat-active-workers">
                      {stats?.activeWorkers || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-green-600 w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Assignments</p>
                    <p className="text-2xl font-bold text-orange-600" data-testid="stat-pending-assignments">
                      {stats?.pendingAssignments || 0}
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
                    <p className="text-sm text-muted-foreground">Extensions Due</p>
                    <p className="text-2xl font-bold text-primary" data-testid="stat-extensions-due">
                      {stats?.extensionsDue || 0}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <CalendarPlus className="text-primary w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Workers Table */}
          <div className="p-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Worker List</CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Search workers..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        data-testid="input-search-workers"
                      />
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleExportCSV}
                      className="flex items-center space-x-2"
                      data-testid="button-export-csv"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {workersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading workers...
                  </div>
                ) : filteredWorkers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-workers">
                    {workers.length === 0 ? "No workers added yet." : "No workers match your search."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker Info</TableHead>
                        <TableHead>Accommodation</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWorkers.map((worker: any) => (
                        <TableRow key={worker.id} data-testid={`row-worker-${worker.id}`}>
                          <TableCell>
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-primary font-medium text-sm">
                                  {worker.name.split(' ').map((n: string) => n[0]).join('')}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-foreground" data-testid={`text-worker-name-${worker.id}`}>
                                  {worker.name}
                                </div>
                                <div className="text-sm text-muted-foreground font-mono" data-testid={`text-worker-id-${worker.id}`}>
                                  {worker.workerId}
                                </div>
                                <div className="text-xs text-muted-foreground" data-testid={`text-worker-phone-${worker.id}`}>
                                  {worker.phone}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {worker.assignedHotel?.companyName ? (
                              <>
                                <div className="text-sm text-foreground" data-testid={`text-worker-hotel-${worker.id}`}>
                                  {worker.assignedHotel.companyName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Room <span data-testid={`text-worker-room-${worker.id}`}>{worker.roomNumber}</span>
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-orange-600" data-testid={`text-pending-assignment-${worker.id}`}>
                                Pending Assignment
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              <div data-testid={`text-worker-duration-${worker.id}`}>{worker.expectedDuration} days</div>
                              {worker.expectedEndDate && (
                                <div className="text-xs">
                                  Ends: <span data-testid={`text-worker-end-date-${worker.id}`}>
                                    {new Date(worker.expectedEndDate).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                worker.status === "active"
                                  ? "default"
                                  : worker.status === "pending"
                                  ? "secondary"
                                  : "outline"
                              }
                              className={
                                worker.status === "active"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : worker.status === "pending"
                                  ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                                  : ""
                              }
                              data-testid={`badge-worker-status-${worker.id}`}
                            >
                              {worker.status.charAt(0).toUpperCase() + worker.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {worker.status === "active" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary/80"
                                  data-testid={`button-extend-worker-${worker.id}`}
                                >
                                  <CalendarPlus className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive/80"
                                data-testid={`button-remove-worker-${worker.id}`}
                              >
                                ×
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
        </div>
      </div>

      {/* Modals */}
      <AddWorkerModal
        open={showAddWorkerModal}
        onOpenChange={setShowAddWorkerModal}
        onWorkerAdded={() => {
          refetchWorkers();
          setShowAddWorkerModal(false);
        }}
      />

      <NotificationToast />
    </div>
  );
}
