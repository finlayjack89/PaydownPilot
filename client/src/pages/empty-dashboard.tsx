import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

export default function EmptyDashboard() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold" data-testid="text-welcome-title">
            Welcome to Paydown Pilot
          </h1>
          <p className="text-lg text-muted-foreground">
            Let's get you started on your journey to becoming debt-free
          </p>
        </div>

        <Card className="backdrop-blur-sm bg-card/50">
          <CardContent className="pt-12 pb-12 text-center space-y-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-6">
                <TrendingUp className="h-16 w-16 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold" data-testid="text-empty-message">
              No payment plan generated yet
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Add accounts to begin your payment plan generation
            </p>
            <div className="pt-4">
              <Button asChild size="lg" className="h-12 px-8" data-testid="button-add-accounts">
                <Link href="/accounts">Add Accounts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
