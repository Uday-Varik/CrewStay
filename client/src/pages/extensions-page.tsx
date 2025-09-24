import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, Clock, FileText, Plus, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const extensionRequestSchema = z.object({
  requestedEndDate: z.string().min(1, "New end date is required"),
  reason: z.string().min(10, "Please provide a detailed reason (at least 10 characters)"),
});

type ExtensionRequest = z.infer<typeof extensionRequestSchema>;

export default function ExtensionsPage() {
  const { user } = useAuth();
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

  // Create extension mutation
  const createExtensionMutation = useMutation({
    mutationFn: async (data: ExtensionRequest & { workerId: string }) => {
      const response = await apiRequest('/api/extensions', {
        method: 'POST',
        body: JSON.stringify({
          workerId: data.workerId,
          currentEndDate: selectedWorker?.expectedEndDate || new Date().toISOString(),
          requestedEndDate: new Date(data.requestedEndDate).toISOString(),
          reason: data.reason,
        }),
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
      const response = await apiRequest(`/api/extensions/${extensionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          hotelResponse,
        }),
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500";
      case "rejected": return "bg-red-500";
      default: return "bg-yellow-500";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-to-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Extension Requests</h1>
            <p className="text-muted-foreground">Manage worker accommodation extensions</p>
          </div>
        </div>
      </div>

      {user?.userType === "construction" && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Active Workers - Extension Eligible</span>
              </CardTitle>
              <CardDescription>
                Workers currently assigned to hotels who can request extensions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeWorkers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No active workers eligible for extensions. Workers must be assigned to a hotel first.
                </p>
              ) : (
                <div className="grid gap-4">
                  {activeWorkers.map((worker: any) => (
                    <div
                      key={worker.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="font-medium">{worker.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {worker.workerId} • {worker.assignedHotel?.companyName} Room {worker.roomNumber}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Current End Date</div>
                          <div className="font-medium">
                            {worker.expectedEndDate ? format(new Date(worker.expectedEndDate), "MMM dd, yyyy") : "Not set"}
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            setSelectedWorker(worker);
                            setShowCreateModal(true);
                          }}
                          data-testid={`button-request-extension-${worker.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Request Extension
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {user?.userType === "hotel" && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Pending Extension Requests</span>
              </CardTitle>
              <CardDescription>
                Extension requests from construction companies for workers at your hotel
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extensions.filter((ext: any) => ext.status === "pending").length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No pending extension requests.
                </p>
              ) : (
                <div className="space-y-4">
                  {extensions.filter((ext: any) => ext.status === "pending").map((extension: any) => (
                    <div
                      key={extension.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`pending-extension-${extension.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-medium">
                            {extension.worker?.name || "Unknown Worker"}
                          </span>
                          <Badge className="bg-yellow-500">
                            Pending Approval
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Current End:</span>{" "}
                            {format(new Date(extension.currentEndDate), "MMM dd, yyyy")}
                          </div>
                          <div>
                            <span className="font-medium">Requested End:</span>{" "}
                            {format(new Date(extension.requestedEndDate), "MMM dd, yyyy")}
                          </div>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Reason:</span> {extension.reason || "No reason provided"}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
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
                          {updateExtensionMutation.isPending ? "Rejecting..." : "Reject"}
                        </Button>
                        <Button
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
                          {updateExtensionMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Extension Requests</span>
          </CardTitle>
          <CardDescription>
            {user?.userType === "construction" 
              ? "Your submitted extension requests and their status"
              : "Extension requests from construction companies"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {extensions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No extension requests found.
            </p>
          ) : (
            <div className="space-y-4">
              {extensions.map((extension: any) => (
                <div
                  key={extension.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`extension-request-${extension.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium">
                        {extension.worker?.name || "Unknown Worker"}
                      </span>
                      <Badge className={getStatusColor(extension.status)}>
                        {extension.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Current End:</span>{" "}
                        {format(new Date(extension.currentEndDate), "MMM dd, yyyy")}
                      </div>
                      <div>
                        <span className="font-medium">Requested End:</span>{" "}
                        {format(new Date(extension.requestedEndDate), "MMM dd, yyyy")}
                      </div>
                    </div>
                    {extension.hotelResponse && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Hotel Response:</span> {extension.hotelResponse}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    Requested {format(new Date(extension.createdAt), "MMM dd, yyyy")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}