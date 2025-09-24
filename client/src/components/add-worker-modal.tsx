import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertWorkerSchema } from "@shared/schema";
import { z } from "zod";
import { Info } from "lucide-react";

const addWorkerSchema = insertWorkerSchema.extend({
  preferredHotel: z.string().optional(),
});

type AddWorkerForm = z.infer<typeof addWorkerSchema>;

interface AddWorkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkerAdded: () => void;
}

export function AddWorkerModal({ open, onOpenChange, onWorkerAdded }: AddWorkerModalProps) {
  const { toast } = useToast();
  
  const form = useForm<AddWorkerForm>({
    resolver: zodResolver(addWorkerSchema),
    defaultValues: {
      name: "",
      phone: "",
      idNumber: "",
      expectedDuration: 30,
      specialRequirements: "",
      preferredHotel: "",
    },
  });

  const addWorkerMutation = useMutation({
    mutationFn: async (data: AddWorkerForm) => {
      const { preferredHotel, ...workerData } = data;
      const response = await apiRequest("POST", "/api/workers", workerData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Worker Added Successfully",
        description: "The worker has been added and a room request has been sent to hotels.",
      });
      onWorkerAdded();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Worker",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AddWorkerForm) => {
    addWorkerMutation.mutate(data);
  };

  const handleClose = () => {
    if (!addWorkerMutation.isPending) {
      onOpenChange(false);
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-lg" data-testid="modal-add-worker">
        <DialogHeader>
          <DialogTitle>Add New Worker</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="workerName">Full Name *</Label>
              <Input
                id="workerName"
                placeholder="John Doe"
                data-testid="input-worker-name"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="workerPhone">Phone Number *</Label>
              <Input
                id="workerPhone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                data-testid="input-worker-phone"
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="workerIdNumber">ID Number *</Label>
            <Input
              id="workerIdNumber"
              placeholder="Driver's License or State ID"
              data-testid="input-worker-id-number"
              {...form.register("idNumber")}
            />
            {form.formState.errors.idNumber && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.idNumber.message}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expectedDuration">Expected Duration (days) *</Label>
              <Input
                id="expectedDuration"
                type="number"
                min="1"
                placeholder="30"
                data-testid="input-expected-duration"
                {...form.register("expectedDuration", { valueAsNumber: true })}
              />
              {form.formState.errors.expectedDuration && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.expectedDuration.message}
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="preferredHotel">Preferred Hotel</Label>
              <Select
                value={form.watch("preferredHotel")}
                onValueChange={(value) => form.setValue("preferredHotel", value)}
              >
                <SelectTrigger data-testid="select-preferred-hotel">
                  <SelectValue placeholder="Any Available Hotel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Available Hotel</SelectItem>
                  <SelectItem value="paradise">Paradise Hotel</SelectItem>
                  <SelectItem value="comfort">Comfort Inn</SelectItem>
                  <SelectItem value="business">Business Lodge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="specialRequirements">Special Requirements</Label>
            <Textarea
              id="specialRequirements"
              rows={3}
              placeholder="Any accessibility needs, dietary restrictions, etc."
              data-testid="textarea-special-requirements"
              {...form.register("specialRequirements")}
            />
            {form.formState.errors.specialRequirements && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.specialRequirements.message}
              </p>
            )}
          </div>
          
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm text-muted-foreground flex items-start space-x-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Worker ID will be automatically generated in format: <span className="font-mono text-foreground">CWS-[COMPANY]-[NUMBER]</span>
              </span>
            </p>
          </div>
          
          <DialogFooter className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={addWorkerMutation.isPending}
              data-testid="button-cancel-add-worker"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addWorkerMutation.isPending}
              data-testid="button-submit-add-worker"
            >
              {addWorkerMutation.isPending ? "Adding Worker..." : "Add Worker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
