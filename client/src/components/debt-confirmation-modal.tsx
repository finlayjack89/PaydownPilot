import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CreditCard, RefreshCw, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

interface DetectedDebt {
  transaction_id: string;
  description: string;
  merchant_name: string;
  logo_url?: string | null;
  amount_cents: number;
  is_recurring: boolean;
  recurrence_frequency?: string | null;
}

interface DebtConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detectedDebts: DetectedDebt[];
  onConfirm: (confirmedDebts: DetectedDebt[], excludedDebts: DetectedDebt[]) => void;
  onSkip: () => void;
}

export function DebtConfirmationModal({
  open,
  onOpenChange,
  detectedDebts,
  onConfirm,
  onSkip,
}: DebtConfirmationModalProps) {
  const { user } = useAuth();
  const currency = user?.currency || "GBP";
  
  const [selectedDebts, setSelectedDebts] = useState<Set<string>>(
    new Set(detectedDebts.map(d => d.transaction_id))
  );

  const toggleDebt = (transactionId: string) => {
    const newSelected = new Set(selectedDebts);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedDebts(newSelected);
  };

  const handleConfirm = () => {
    const confirmed = detectedDebts.filter(d => selectedDebts.has(d.transaction_id));
    const excluded = detectedDebts.filter(d => !selectedDebts.has(d.transaction_id));
    onConfirm(confirmed, excluded);
  };

  const handleSelectAll = () => {
    setSelectedDebts(new Set(detectedDebts.map(d => d.transaction_id)));
  };

  const handleDeselectAll = () => {
    setSelectedDebts(new Set());
  };

  if (detectedDebts.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" data-testid="modal-debt-confirmation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="modal-debt-title">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Confirm Debt Payments
          </DialogTitle>
          <DialogDescription data-testid="modal-debt-description">
            We found what looks like debt or loan payments in your transactions. 
            Please confirm which ones are actually debts you're paying off.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm text-muted-foreground">
            {selectedDebts.size} of {detectedDebts.length} selected
          </span>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSelectAll}
              data-testid="button-select-all"
            >
              <Check className="h-4 w-4 mr-1" />
              All
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDeselectAll}
              data-testid="button-deselect-all"
            >
              <X className="h-4 w-4 mr-1" />
              None
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4 max-h-[400px]">
          <div className="space-y-3 py-2">
            {detectedDebts.map((debt) => (
              <Card 
                key={debt.transaction_id}
                className={`cursor-pointer transition-colors ${
                  selectedDebts.has(debt.transaction_id) 
                    ? "border-primary bg-primary/5" 
                    : "hover-elevate"
                }`}
                onClick={() => toggleDebt(debt.transaction_id)}
                data-testid={`debt-card-${debt.transaction_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedDebts.has(debt.transaction_id)}
                      onCheckedChange={() => toggleDebt(debt.transaction_id)}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-debt-${debt.transaction_id}`}
                    />
                    
                    <div className="flex-shrink-0">
                      {debt.logo_url ? (
                        <img 
                          src={debt.logo_url} 
                          alt={debt.merchant_name}
                          className="w-10 h-10 rounded-lg object-contain bg-white border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate" data-testid={`text-merchant-${debt.transaction_id}`}>
                          {debt.merchant_name || debt.description}
                        </span>
                        {debt.is_recurring && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            {debt.recurrence_frequency || "Recurring"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-description-${debt.transaction_id}`}>
                        {debt.description}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0 text-right">
                      <span className="font-mono font-medium" data-testid={`text-amount-${debt.transaction_id}`}>
                        {formatCurrency(debt.amount_cents, currency)}
                      </span>
                      <p className="text-xs text-muted-foreground">per month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t bg-muted/30 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">
              Total confirmed debt payments:
            </span>
            <span className="font-mono font-semibold text-lg" data-testid="text-total-debt">
              {formatCurrency(
                detectedDebts
                  .filter(d => selectedDebts.has(d.transaction_id))
                  .reduce((sum, d) => sum + d.amount_cents, 0),
                currency
              )}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </span>
          </div>
          
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button 
              variant="ghost" 
              onClick={onSkip}
              data-testid="button-skip-debt-confirmation"
            >
              Skip for now
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={selectedDebts.size === 0}
              data-testid="button-confirm-debts"
            >
              Confirm {selectedDebts.size} Debt{selectedDebts.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
