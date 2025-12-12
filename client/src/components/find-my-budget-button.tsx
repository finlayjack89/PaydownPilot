import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { BudgetConsentModal } from "./budget-consent-modal";

interface FindMyBudgetButtonProps {
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}

export function FindMyBudgetButton({ 
  size = "default", 
  variant = "default",
  className = ""
}: FindMyBudgetButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-open modal when returning from TrueLayer with connected=true
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get("connected");
    const error = urlParams.get("error");
    
    if (connected === "true" || error) {
      setModalOpen(true);
    }
  }, []);

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        onClick={() => setModalOpen(true)}
        data-testid="button-find-my-budget"
      >
        <TrendingUp className="h-4 w-4 mr-2" />
        Find My Budget
      </Button>
      
      <BudgetConsentModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
      />
    </>
  );
}