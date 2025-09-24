import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const assignRoomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  notes: z.string().optional(),
});

type AssignRoomForm = z.infer<typeof assignRoomSchema>;

interface AssignRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: any;
  onRoomAssigned: () => void;
}

export function AssignRoomModal({ open, onOpenChange, request, onRoomAssigned }: AssignRoomModalProps) {
  const { toast } = useToast();
  
  const form = useForm<AssignRoomForm>({
    defaultValues: {
      roomNumber: "",
      notes: "",
    },
  });

  const assignRoomMutation = useMutation({
    mutationFn: async (data: AssignRoomForm) => {
      const response = await apiRequest("PATCH", `/api/accommodation-requests/${request.id}`, {
        status: "approved",
        assignedRoom: data.roomNumber,
        notes: data.notes,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Room Assigned Successfully",
        description: `${request.worker.name} has been assigned to room ${form.getValues("roomNumber")}.`,
      });
      onRoomAssigned();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Assign Room",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AssignRoomForm) => {
    assignRoomMutation.mutate(data);
  };

  const handleClose = () => {
    if (!assignRoomMutation.isPending) {
      onOpenChange(false);
      form.reset();
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-md" data-testid="modal-assign-room">
        <DialogHeader>
          <DialogTitle>Assign Room</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div>
            <Label>Worker</Label>
            <div className="p-3 bg-muted rounded-md">
              <div className="text-sm font-medium" data-testid="selected-worker-name">
                {request.worker.name}
              </div>
              <div className="text-xs text-muted-foreground" data-testid="selected-worker-id">
                {request.worker.workerId}
              </div>
              <div className="text-xs text-muted-foreground" data-testid="selected-worker-company">
                {request.company.companyName}
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="roomNumber">Room Number *</Label>
            <Input
              id="roomNumber"
              placeholder="e.g., 301"
              data-testid="input-room-number"
              {...form.register("roomNumber", { required: "Room number is required" })}
            />
            {form.formState.errors.roomNumber && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.roomNumber.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Any special requirements or notes..."
              data-testid="textarea-room-notes"
              {...form.register("notes")}
            />
          </div>
          
          <DialogFooter className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={assignRoomMutation.isPending}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignRoomMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignRoomMutation.isPending ? "Assigning Room..." : "Assign Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
