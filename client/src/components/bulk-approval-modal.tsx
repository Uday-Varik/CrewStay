import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { WorkerStatusBadge } from "@/components/worker-status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, CheckCircle, X, Loader2 } from "lucide-react";

interface BulkApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: any[];
  onRequestsUpdated: () => void;
}

export function BulkApprovalModal({ open, onOpenChange, requests, onRequestsUpdated }: BulkApprovalModalProps) {
  const { toast } = useToast();
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [defaultRoomPrefix, setDefaultRoomPrefix] = useState("");
  const [processing, setProcessing] = useState(false);
  
  const pendingRequests = requests.filter(req => req.status === "pending");
  
  const bulkApproveMutation = useMutation({
    mutationFn: async (data: { requestIds: string[]; roomAssignments: Record<string, string> }) => {
      const responses = [];
      for (const requestId of data.requestIds) {
        const roomNumber = data.roomAssignments[requestId];
        const response = await apiRequest("POST", `/api/accommodation-requests/${requestId}/approve`, {
          roomNumber,
        });
        responses.push(await response.json());
      }
      return responses;
    },
    onSuccess: (responses) => {
      toast({
        title: "Bulk Approval Successful",
        description: `Successfully approved ${responses.length} accommodation requests`,
      });
      onRequestsUpdated();
      onOpenChange(false);
      setSelectedRequests(new Set());
      setDefaultRoomPrefix("");
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRequests(new Set(pendingRequests.map(req => req.id)));
    } else {
      setSelectedRequests(new Set());
    }
  };
  
  const handleSelectRequest = (requestId: string, checked: boolean) => {
    const newSelected = new Set(selectedRequests);
    if (checked) {
      newSelected.add(requestId);
    } else {
      newSelected.delete(requestId);
    }
    setSelectedRequests(newSelected);
  };
  
  const handleBulkApprove = async () => {
    if (selectedRequests.size === 0) {
      toast({
        title: "No Requests Selected",
        description: "Please select at least one request to approve",
        variant: "destructive",
      });
      return;
    }
    
    setProcessing(true);
    
    // Generate room assignments
    const roomAssignments: Record<string, string> = {};
    const selectedRequestsList = Array.from(selectedRequests);
    
    selectedRequestsList.forEach((requestId, index) => {
      const baseRoom = defaultRoomPrefix || "100";
      const roomNumber = `${baseRoom}${String(index + 1).padStart(2, '0')}`;
      roomAssignments[requestId] = roomNumber;
    });
    
    try {
      await bulkApproveMutation.mutateAsync({
        requestIds: selectedRequestsList,
        roomAssignments,
      });
    } finally {
      setProcessing(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col" data-testid="modal-bulk-approval">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Bulk Approve Accommodation Requests</span>
          </DialogTitle>
          <DialogDescription>
            Select multiple requests to approve at once with automatic room assignments.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Configuration */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Label htmlFor="roomPrefix">Room Number Prefix</Label>
                <Input
                  id="roomPrefix"
                  placeholder="e.g., 200 (will generate 20001, 20002, etc.)"
                  value={defaultRoomPrefix}
                  onChange={(e) => setDefaultRoomPrefix(e.target.value)}
                  data-testid="input-room-prefix"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Selected: {selectedRequests.size} of {pendingRequests.length} requests</p>
              </div>
            </div>
          </div>
          
          {/* Request Selection */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <div className="sticky top-0 bg-background border-b p-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={selectedRequests.size === pendingRequests.length && pendingRequests.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="font-medium">Select All Pending Requests</span>
                <Badge variant="secondary">{pendingRequests.length} pending</Badge>
              </div>
            </div>
            
            <div className="p-3 space-y-2">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending accommodation requests available for bulk approval.
                </div>
              ) : (
                pendingRequests.map((request, index) => {
                  const isSelected = selectedRequests.has(request.id);
                  const assignedRoom = defaultRoomPrefix ? 
                    `${defaultRoomPrefix}${String(Array.from(selectedRequests).indexOf(request.id) + 1).padStart(2, '0')}` : 
                    `Room ${index + 1}`;
                  
                  return (
                    <div
                      key={request.id}
                      className={`border rounded-lg p-3 transition-colors ${
                        isSelected ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" : "bg-background"
                      }`}
                      data-testid={`request-item-${request.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectRequest(request.id, checked as boolean)}
                          data-testid={`checkbox-request-${request.id}`}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm" data-testid={`worker-name-${request.id}`}>
                                {request.worker?.name}
                              </p>
                              <p className="text-xs text-muted-foreground" data-testid={`worker-id-${request.id}`}>
                                ID: {request.worker?.workerId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Duration: {request.worker?.expectedDuration} days
                              </p>
                            </div>
                            
                            <div className="text-right">
                              <WorkerStatusBadge status={request.worker?.status} size="sm" />
                              {isSelected && (
                                <div className="mt-1">
                                  <Badge className="text-xs" data-testid={`assigned-room-${request.id}`}>
                                    → {assignedRoom}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {request.notes && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {request.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {selectedRequests.size > 0 && (
              <span>Will assign rooms: {Array.from(selectedRequests).map((_, index) => 
                defaultRoomPrefix ? `${defaultRoomPrefix}${String(index + 1).padStart(2, '0')}` : `${index + 1}`
              ).join(", ")}</span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
              data-testid="button-cancel-bulk-approval"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkApprove}
              disabled={selectedRequests.size === 0 || processing}
              className="flex items-center space-x-2"
              data-testid="button-confirm-bulk-approval"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve {selectedRequests.size} Requests</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}