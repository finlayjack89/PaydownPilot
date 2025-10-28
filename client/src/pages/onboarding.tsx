import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressStepper } from "@/components/progress-stepper";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const steps = [
  { id: 1, name: "Profile", description: "Basic information" },
  { id: 2, name: "Location", description: "Country & currency" },
  { id: 3, name: "Complete", description: "All set!" },
];

const countries = [
  { code: "US", name: "United States", currency: "USD", regions: ["Select state..."] },
  { code: "GB", name: "United Kingdom", currency: "GBP", regions: ["England", "Scotland", "Wales", "Northern Ireland"] },
  { code: "CA", name: "Canada", currency: "CAD", regions: ["Select province..."] },
  { code: "AU", name: "Australia", currency: "AUD", regions: ["Select state..."] },
  { code: "EU", name: "European Union", currency: "EUR", regions: ["Select country..."] },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form state
  const [country, setCountry] = useState(user?.country || "");
  const [region, setRegion] = useState(user?.region || "");
  const [currency, setCurrency] = useState(user?.currency || "USD");

  const selectedCountry = countries.find(c => c.code === country);

  const handleNext = async () => {
    if (currentStep === 2) {
      // Validate location selection
      if (!country || !region || !currency) {
        toast({
          title: "Missing information",
          description: "Please select your country, region, and currency",
          variant: "destructive",
        });
        return;
      }

      // Save location data
      try {
        const response = await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ country, region, currency }),
          credentials: "include",
        });

        if (!response.ok) throw new Error("Failed to update profile");

        updateUser({ country, region, currency });
        setCurrentStep(3);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to save your information. Please try again.",
          variant: "destructive",
        });
      }
    } else if (currentStep === 3) {
      // Complete onboarding
      setLocation("/accounts");
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <ProgressStepper steps={steps} currentStep={currentStep} />

        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Welcome to Paydown Pilot!</CardTitle>
              <CardDescription>
                Let's get you set up with a personalized debt repayment plan. This will only take a few minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg bg-muted p-6">
                <h3 className="font-medium mb-2">What we'll do together:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Set up your location and currency preferences</li>
                  <li>• Add your credit cards, loans, and BNPL accounts</li>
                  <li>• Configure your monthly budget</li>
                  <li>• Choose your optimization strategy</li>
                  <li>• Generate your personalized payment plan</li>
                </ul>
              </div>
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
                <p className="text-sm font-medium">
                  <span className="text-primary">Your information is secure.</span> We use bank-level encryption to protect your financial data.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Location & Currency</CardTitle>
              <CardDescription>
                This helps us apply the correct minimum payment rules and display amounts in your currency.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-sm font-medium">
                    Country
                  </Label>
                  <Select value={country} onValueChange={(value) => {
                    setCountry(value);
                    const newCountry = countries.find(c => c.code === value);
                    if (newCountry) {
                      setCurrency(newCountry.currency);
                      setRegion("");
                    }
                  }}>
                    <SelectTrigger id="country" className="h-12" data-testid="select-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region" className="text-sm font-medium">
                    Region/State
                  </Label>
                  <Select 
                    value={region} 
                    onValueChange={setRegion}
                    disabled={!selectedCountry}
                  >
                    <SelectTrigger id="region" className="h-12" data-testid="select-region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCountry?.regions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm font-medium">
                  Currency
                </Label>
                <Input
                  id="currency"
                  value={currency}
                  disabled
                  className="h-12"
                  data-testid="input-currency"
                />
                <p className="text-xs text-muted-foreground">
                  Currency is automatically set based on your country selection
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-semibold">You're all set!</CardTitle>
              <CardDescription>
                Your profile is complete. Let's add your accounts and start optimizing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-8">
                  <div className="rounded-full bg-primary/20 p-6">
                    <div className="rounded-full bg-primary p-4">
                      <ArrowRight className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Next, you'll add your credit cards, loans, and other accounts. We'll use AI to help find the specific minimum payment rules for your lenders.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex justify-between gap-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="h-12"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            className="h-12 px-8"
            data-testid="button-next"
          >
            {currentStep === 3 ? "Get Started" : "Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
