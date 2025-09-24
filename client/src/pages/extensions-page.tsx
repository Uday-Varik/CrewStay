import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, Clock, FileText, Plus, Users, CheckCircle, XCircle, ArrowLeft, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NotificationToast } from "@/components/notification-toast";

const extensionRequestSchema = z.object({
  requestedEndDate: z.string().min(1, "New end date is required"),
  reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
});

type ExtensionRequest = z.infer<typeof extensionRequestSchema>;

export default function ExtensionsPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch workers for construction companies
  const { data: workers = [] } = useQuery({
    queryKey: ['/api/workers'],
    enabled: user?.userType === "construction",
  });

  // Fetch extensions
  const { data: extensions = [] } = useQuery({
    queryKey: ['/api/extensions'],
  });

  // Fetch stats 
  const { data: stats } = useQuery({
    queryKey: ['/api/stats'],
  });

  // Create extension mutation
  const createExtensionMutation = useMutation({
    mutationFn: async (data: ExtensionRequest & { workerId: string }) => {
      const response = await apiRequest('POST', '/api/extensions', {
        workerId: data.workerId,
        currentEndDate: selectedWorker?.expectedEndDate || new Date().toISOString(),
        requestedEndDate: new Date(data.requestedEndDate).toISOString(),
        reason: data.reason,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/extensions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      setShowCreateModal(false);
      setSelectedWorker(null);
      toast({
        title: "Extension Requested",
        description: "Your extension request has been submitted to the hotel.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit extension request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Extension approval/rejection mutation
  const updateExtensionMutation = useMutation({
    mutationFn: async ({ extensionId, status, hotelResponse }: {
      extensionId: string;
      status: "approved" | "rejected";
      hotelResponse?: string;
    }) => {
      const response = await apiRequest('PATCH', `/api/extensions/${extensionId}`, {
        status,
        hotelResponse,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/extensions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: variables.status === "approved" ? "Extension Approved" : "Extension Rejected",
        description: `Extension request has been ${variables.status}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update extension request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ExtensionRequest>({
    resolver: zodResolver(extensionRequestSchema),
    defaultValues: {
      requestedEndDate: "",
      reason: "",
    },
  });

  const onSubmit = (data: ExtensionRequest) => {
    if (!selectedWorker) return;
    createExtensionMutation.mutate({
      ...data,
      workerId: selectedWorker.id,
    });
  };

  // Filter active workers that can request extensions
  const activeWorkers = workers.filter((worker: any) => 
    worker.status === "active" && worker.assignedHotelId
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
      default:
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Pending</Badge>;
    }
  };

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
                <Link href="/">
                  <div className="flex items-center space-x-3 px-3 py-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                    <Users className="w-5 h-5" />
                    <span>Worker Management</span>
                  </div>
                </Link>
              </li>
              <li>
                <div className="flex items-center space-x-3 px-3 py-2 rounded-md bg-accent text-accent-foreground">
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
                <h1 className="text-2xl font-bold text-foreground">Extension Management</h1>
                <p className="text-muted-foreground">Manage worker accommodation extensions</p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Real-time Status Indicator */}
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live Updates Active</span>
                </div>
              </div>
            </div>
          </header>
          
          {/* Stats Cards */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Extensions</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="stat-total-extensions">
                      {extensions.length}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <FileText className="text-primary w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Approval</p>
                    <p className="text-2xl font-bold text-orange-600" data-testid="stat-pending-extensions">
                      {extensions.filter((ext: any) => ext.status === "pending").length}
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
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="stat-approved-extensions">
                      {extensions.filter((ext: any) => ext.status === "approved").length}
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
                    <p className="text-sm text-muted-foreground">Eligible Workers</p>
                    <p className="text-2xl font-bold text-primary" data-testid="stat-eligible-workers">
                      {activeWorkers.length}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="text-primary w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Extension Workers Section - For Construction Companies */}
          {user?.userType === "construction" && (
            <div className="p-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Extension Eligible Workers</CardTitle>
                    <div className="text-sm text-muted-foreground">
                      Workers assigned to hotels who can request extensions
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {activeWorkers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground" data-testid="empty-eligible-workers">
                      No active workers eligible for extensions. Workers must be assigned to a hotel first.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Worker Info</TableHead>
                          <TableHead>Accommodation</TableHead>
                          <TableHead>Current End Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeWorkers.map((worker: any) => (
                          <TableRow key={worker.id} data-testid={`row-eligible-worker-${worker.id}`}>
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
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-foreground" data-testid={`text-worker-hotel-${worker.id}`}>
                                {worker.assignedHotel?.companyName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Room <span data-testid={`text-worker-room-${worker.id}`}>{worker.roomNumber}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-foreground" data-testid={`text-worker-end-date-${worker.id}`}>
                                {worker.expectedEndDate ? format(new Date(worker.expectedEndDate), "MMM dd, yyyy") : "Not set"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedWorker(worker);
                                  setShowCreateModal(true);
                                }}
                                className="flex items-center space-x-2"
                                data-testid={`button-request-extension-${worker.id}`}
                              >
                                <Plus className="w-4 h-4" />
                                <span>Request Extension</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Extensions Table */}
          <div className="p-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Extension Requests</CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {user?.userType === "construction" 
                      ? "Your submitted extension requests and their status"
                      : "Extension requests from construction companies"
                    }
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {extensions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="empty-extensions">
                    No extension requests found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        {user?.userType === "hotel" && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extensions.map((extension: any) => (
                        <TableRow key={extension.id} data-testid={`row-extension-${extension.id}`}>
                          <TableCell>
                            <div>
                              <div className="text-sm font-medium text-foreground" data-testid={`text-extension-worker-${extension.id}`}>
                                {extension.worker?.name || "Unknown Worker"}
                              </div>
                              <div className="text-sm text-muted-foreground font-mono">
                                {extension.worker?.workerId}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="text-muted-foreground">
                                Current: <span className="text-foreground">{format(new Date(extension.currentEndDate), "MMM dd, yyyy")}</span>
                              </div>
                              <div className="text-muted-foreground">
                                Requested: <span className="text-foreground">{format(new Date(extension.requestedEndDate), "MMM dd, yyyy")}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground max-w-xs truncate" data-testid={`text-extension-reason-${extension.id}`}>
                              {extension.reason || "No reason provided"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(extension.status)}
                          </TableCell>
                          {user?.userType === "hotel" && (
                            <TableCell>
                              {extension.status === "pending" ? (
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive/80"
                                    onClick={() => {
                                      updateExtensionMutation.mutate({
                                        extensionId: extension.id,
                                        status: "rejected",
                                        hotelResponse: "Extension request has been rejected.",
                                      });
                                    }}
                                    disabled={updateExtensionMutation.isPending}
                                    data-testid={`button-reject-extension-${extension.id}`}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      updateExtensionMutation.mutate({
                                        extensionId: extension.id,
                                        status: "approved",
                                        hotelResponse: "Extension request has been approved.",
                                      });
                                    }}
                                    disabled={updateExtensionMutation.isPending}
                                    data-testid={`button-approve-extension-${extension.id}`}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  {extension.status === "approved" ? "Approved" : "Rejected"}
                                </div>
                              )}
                            </TableCell>
                          )}
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

      {/* Create Extension Request Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Extension</DialogTitle>
            <DialogDescription>
              Request an extension for {selectedWorker?.name}'s accommodation
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Worker</label>
                <div className="p-3 bg-muted rounded-md">
                  <div className="font-medium">{selectedWorker?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Current end date: {selectedWorker?.expectedEndDate ? 
                      format(new Date(selectedWorker.expectedEndDate), "MMM dd, yyyy") : "Not set"}
                  </div>
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="requestedEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-requested-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Extension</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please provide a detailed reason for the extension request..."
                        {...field}
                        data-testid="textarea-extension-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  data-testid="button-cancel-extension"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createExtensionMutation.isPending}
                  data-testid="button-submit-extension-request"
                >
                  {createExtensionMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <NotificationToast />
    </div>
  );
}