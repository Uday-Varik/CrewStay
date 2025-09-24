import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Download, Edit2, Trash2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WorkerRowData {
  id: string;
  name: string;
  phone: string;
  expectedDuration: string;
  isValid: boolean;
  errors: string[];
}

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkersImported: () => void;
}

export function BulkImportModal({ open, onOpenChange, onWorkersImported }: BulkImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [csvData, setCsvData] = useState<WorkerRowData[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);

  // CSV Template download
  const downloadTemplate = () => {
    const template = `name,phone,expectedDuration
John Doe,555-0101,30
Jane Smith,555-0102,45
Mike Johnson,555-0103,60`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worker_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Validate worker data
  const validateWorkerData = (data: any[]): WorkerRowData[] => {
    return data.map((row, index) => {
      const errors: string[] = [];
      
      if (!row.name || row.name.trim().length < 2) {
        errors.push("Name must be at least 2 characters");
      }
      
      const phoneDigits = row.phone?.replace(/[^\d]/g, '') || '';
      if (!row.phone || (phoneDigits.length < 7 || phoneDigits.length > 15)) {
        errors.push("Phone number must contain 7-15 digits");
      }
      
      const duration = parseInt(row.expectedDuration);
      if (!duration || duration < 1 || duration > 365) {
        errors.push("Duration must be between 1-365 days");
      }

      return {
        id: `temp-${index}`,
        name: row.name?.trim() || '',
        phone: row.phone?.trim() || '',
        expectedDuration: row.expectedDuration?.toString() || '',
        isValid: errors.length === 0,
        errors
      };
    });
  };

  // Parse CSV content
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      toast({
        title: "Invalid CSV",
        description: "CSV must contain a header row and at least one data row.",
        variant: "destructive",
      });
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['name', 'phone', 'expectedduration'];
    
    const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      toast({
        title: "Invalid CSV Headers",
        description: `Missing required columns: ${missingHeaders.join(', ')}. Expected: name, phone, expectedDuration`,
        variant: "destructive",
      });
      return;
    }

    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header === 'expectedduration' ? 'expectedDuration' : header] = values[index] || '';
      });
      return row;
    }).filter(row => row.name || row.phone || row.expectedDuration);

    if (data.length === 0) {
      toast({
        title: "No Data Found",
        description: "No valid worker data found in the CSV file.",
        variant: "destructive",
      });
      return;
    }

    const validatedData = validateWorkerData(data);
    setCsvData(validatedData);
    setStep('preview');
  };

  // Handle file upload
  const handleFileUpload = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File Too Large",
        description: "File size must be less than 5MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Edit cell functionality
  const updateCellValue = (rowId: string, field: string, value: string) => {
    setCsvData(prevData => 
      prevData.map(row => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [field]: value };
          const validatedData = validateWorkerData([updatedRow])[0];
          return { ...updatedRow, isValid: validatedData.isValid, errors: validatedData.errors };
        }
        return row;
      })
    );
  };

  const removeRow = (rowId: string) => {
    setCsvData(prevData => prevData.filter(row => row.id !== rowId));
  };

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: async (workers: WorkerRowData[]) => {
      const response = await apiRequest('POST', '/api/workers/bulk', {
        workers: workers.map(w => ({
          name: w.name,
          phone: w.phone,
          expectedDuration: parseInt(w.expectedDuration)
        }))
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "Workers Imported",
        description: `Successfully imported ${validWorkers.length} workers.`,
      });
      onWorkersImported();
      onOpenChange(false);
      resetModal();
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "Failed to import workers. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetModal = () => {
    setCsvData([]);
    setStep('upload');
    setEditingCell(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = () => {
    const validWorkers = csvData.filter(w => w.isValid);
    if (validWorkers.length === 0) {
      toast({
        title: "No Valid Workers",
        description: "Please fix all validation errors before importing.",
        variant: "destructive",
      });
      return;
    }
    bulkImportMutation.mutate(validWorkers);
  };

  const validCount = csvData.filter(w => w.isValid).length;
  const invalidCount = csvData.length - validCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Workers</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple workers at once
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {step === 'upload' ? (
            <div className="space-y-6">
              {/* Template Download */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">1. Download Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Download our CSV template to ensure your data is formatted correctly.
                  </p>
                  <Button variant="outline" onClick={downloadTemplate} className="flex items-center space-x-2">
                    <Download className="w-4 h-4" />
                    <span>Download CSV Template</span>
                  </Button>
                </CardContent>
              </Card>

              {/* File Upload */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">2. Upload Your CSV File</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
                    <p className="text-muted-foreground mb-4">or click to browse</p>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Choose File</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                      className="hidden"
                      data-testid="input-csv-file"
                    />
                  </div>
                  
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p><strong>Required columns:</strong> name, phone, expectedDuration</p>
                    <p><strong>File requirements:</strong> CSV format, max 5MB, up to 1000 workers</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {validCount} Valid
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive">
                      {invalidCount} Invalid
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Back to Upload
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={validCount === 0 || bulkImportMutation.isPending}
                    data-testid="button-import-workers"
                  >
                    {bulkImportMutation.isPending ? 'Importing...' : `Import ${validCount} Workers`}
                  </Button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Duration (days)</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.map((worker) => (
                      <TableRow 
                        key={worker.id} 
                        className={worker.isValid ? '' : 'bg-red-50'}
                        data-testid={`row-preview-worker-${worker.id}`}
                      >
                        <TableCell>
                          {worker.isValid ? (
                            <Check className="w-4 h-4 text-green-600" data-testid={`status-valid-${worker.id}`} />
                          ) : (
                            <div className="flex items-center space-x-1">
                              <X className="w-4 h-4 text-red-600" data-testid={`status-invalid-${worker.id}`} />
                              <div className="text-xs text-red-600">
                                {worker.errors.join(', ')}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.rowId === worker.id && editingCell.field === 'name' ? (
                            <Input
                              defaultValue={worker.name}
                              onBlur={(e) => {
                                updateCellValue(worker.id, 'name', e.target.value);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateCellValue(worker.id, 'name', e.currentTarget.value);
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              className="h-8"
                            />
                          ) : (
                            <div 
                              className="flex items-center space-x-2 cursor-pointer"
                              onClick={() => setEditingCell({ rowId: worker.id, field: 'name' })}
                            >
                              <span data-testid={`text-preview-name-${worker.id}`}>{worker.name}</span>
                              <Edit2 className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.rowId === worker.id && editingCell.field === 'phone' ? (
                            <Input
                              defaultValue={worker.phone}
                              onBlur={(e) => {
                                updateCellValue(worker.id, 'phone', e.target.value);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateCellValue(worker.id, 'phone', e.currentTarget.value);
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              className="h-8"
                            />
                          ) : (
                            <div 
                              className="flex items-center space-x-2 cursor-pointer"
                              onClick={() => setEditingCell({ rowId: worker.id, field: 'phone' })}
                            >
                              <span data-testid={`text-preview-phone-${worker.id}`}>{worker.phone}</span>
                              <Edit2 className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingCell?.rowId === worker.id && editingCell.field === 'expectedDuration' ? (
                            <Input
                              type="number"
                              defaultValue={worker.expectedDuration}
                              onBlur={(e) => {
                                updateCellValue(worker.id, 'expectedDuration', e.target.value);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateCellValue(worker.id, 'expectedDuration', e.currentTarget.value);
                                  setEditingCell(null);
                                }
                              }}
                              autoFocus
                              className="h-8"
                            />
                          ) : (
                            <div 
                              className="flex items-center space-x-2 cursor-pointer"
                              onClick={() => setEditingCell({ rowId: worker.id, field: 'expectedDuration' })}
                            >
                              <span data-testid={`text-preview-duration-${worker.id}`}>{worker.expectedDuration}</span>
                              <Edit2 className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRow(worker.id)}
                            className="text-destructive hover:text-destructive/80"
                            data-testid={`button-remove-preview-${worker.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}