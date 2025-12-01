import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CreditCard, TrendingUp, Wallet, PartyPopper } from "lucide-react";
import { PlanResponse, Account, Budget } from "@shared/schema";
import { cn } from "@/lib/utils";

type EventType = "payment" | "budgetChange" | "lumpSum" | "payoff";

interface CalendarEvent {
  date: Date;
  type: EventType;
  details: {
    accounts?: Array<{ name: string; amount: number }>;
    oldBudget?: number;
    newBudget?: number;
    lumpAmount?: number;
    lumpTarget?: string;
    payoffAccount?: string;
  };
}

const formatCurrency = (cents: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function PaymentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { data: plan, isLoading: planLoading } = useQuery<PlanResponse>({ 
    queryKey: ["/api/plans/latest"] 
  });
  const { data: accounts } = useQuery<Account[]>({ 
    queryKey: ["/api/accounts"] 
  });
  const { data: budget } = useQuery<Budget>({ 
    queryKey: ["/api/budget"] 
  });
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/users/me"] 
  });

  const currency = user?.currency || "USD";

  const calendarEvents = useMemo(() => {
    if (!plan?.planStartDate || !plan?.schedule) return [];
    
    const events: CalendarEvent[] = [];
    const planStart = new Date(plan.planStartDate);
    
    plan.schedule.forEach((entry, monthIndex) => {
      const paymentDate = new Date(planStart);
      paymentDate.setMonth(planStart.getMonth() + monthIndex);
      
      const accountPayments = Object.entries(entry.payments)
        .filter(([_, amount]) => amount > 0)
        .map(([name, amount]) => ({ name, amount }));
      
      if (accountPayments.length > 0) {
        events.push({
          date: paymentDate,
          type: "payment",
          details: { accounts: accountPayments },
        });
      }
    });
    
    if (budget?.futureChanges) {
      let previousBudget = budget.monthlyBudgetCents;
      
      budget.futureChanges
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .forEach(([dateStr, newAmount]) => {
          events.push({
            date: new Date(dateStr),
            type: "budgetChange",
            details: { oldBudget: previousBudget, newBudget: newAmount },
          });
          previousBudget = newAmount;
        });
    }
    
    if (budget?.lumpSumPayments) {
      budget.lumpSumPayments.forEach((payment) => {
        const dateStr = payment[0];
        const amount = payment[1];
        events.push({
          date: new Date(dateStr),
          type: "lumpSum",
          details: { 
            lumpAmount: amount,
          },
        });
      });
    }
    
    if (plan.accountSchedules && accounts) {
      plan.accountSchedules.forEach((schedule) => {
        if (schedule.payoffTimeMonths > 0) {
          const payoffDate = new Date(planStart);
          payoffDate.setMonth(planStart.getMonth() + schedule.payoffTimeMonths);
          
          events.push({
            date: payoffDate,
            type: "payoff",
            details: { payoffAccount: schedule.lenderName },
          });
        }
      });
    }
    
    return events;
  }, [plan, budget, accounts]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const navigateYear = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setFullYear(prev.getFullYear() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getEventsForDay = (day: number) => {
    return calendarEvents.filter(event => {
      return (
        event.date.getDate() === day &&
        event.date.getMonth() === currentDate.getMonth() &&
        event.date.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  const getEventTypeStyles = (type: EventType) => {
    switch (type) {
      case "payment":
        return "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300";
      case "budgetChange":
        return "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300";
      case "lumpSum":
        return "bg-green-500/20 border-green-500 text-green-700 dark:text-green-300";
      case "payoff":
        return "bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300";
      default:
        return "";
    }
  };

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case "payment":
        return <CreditCard className="h-3 w-3" />;
      case "budgetChange":
        return <TrendingUp className="h-3 w-3" />;
      case "lumpSum":
        return <Wallet className="h-3 w-3" />;
      case "payoff":
        return <PartyPopper className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const renderEventTooltip = (event: CalendarEvent) => {
    switch (event.type) {
      case "payment":
        return (
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <CreditCard className="h-4 w-4" /> Monthly Payment
            </p>
            {event.details.accounts?.map((acc, i) => (
              <p key={i} className="text-sm">
                {acc.name}: {formatCurrency(acc.amount, currency)}
              </p>
            ))}
            <p className="text-sm font-medium pt-1 border-t">
              Total: {formatCurrency(
                event.details.accounts?.reduce((sum, a) => sum + a.amount, 0) || 0,
                currency
              )}
            </p>
          </div>
        );
      case "budgetChange":
        return (
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Budget Change
            </p>
            <p className="text-sm">
              From: {formatCurrency(event.details.oldBudget || 0, currency)}
            </p>
            <p className="text-sm">
              To: {formatCurrency(event.details.newBudget || 0, currency)}
            </p>
          </div>
        );
      case "lumpSum":
        return (
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <Wallet className="h-4 w-4" /> Lump Sum Payment
            </p>
            <p className="text-sm">
              Amount: {formatCurrency(event.details.lumpAmount || 0, currency)}
            </p>
            {event.details.lumpTarget && (
              <p className="text-sm">
                Target: {event.details.lumpTarget}
              </p>
            )}
          </div>
        );
      case "payoff":
        return (
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-1">
              <PartyPopper className="h-4 w-4" /> Account Payoff
            </p>
            <p className="text-sm">
              {event.details.payoffAccount} is paid off!
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);
  const today = new Date();
  const isCurrentMonth = 
    today.getMonth() === currentDate.getMonth() && 
    today.getFullYear() === currentDate.getFullYear();

  if (planLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!plan?.schedule || plan.schedule.length === 0) {
    return (
      <div className="p-6">
        <Card className="text-center py-12">
          <CardContent>
            <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">No Plan Generated</h2>
            <p className="text-muted-foreground mb-4">
              Generate a debt payoff plan to see your payment calendar.
            </p>
            <Button onClick={() => window.location.href = "/preferences"} data-testid="button-go-to-preferences">
              Go to Preferences
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="payment-calendar-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            Payment Calendar
          </h1>
          <p className="text-muted-foreground">
            View all your scheduled payments, budget changes, and account payoffs
          </p>
        </div>
        <Button variant="outline" onClick={goToToday} data-testid="button-go-to-today">
          Today
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="outline" className="bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300 gap-1">
          <CreditCard className="h-3 w-3" /> Payment
        </Badge>
        <Badge variant="outline" className="bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 gap-1">
          <TrendingUp className="h-3 w-3" /> Budget Change
        </Badge>
        <Badge variant="outline" className="bg-green-500/10 border-green-500 text-green-700 dark:text-green-300 gap-1">
          <Wallet className="h-3 w-3" /> Lump Sum
        </Badge>
        <Badge variant="outline" className="bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300 gap-1">
          <PartyPopper className="h-3 w-3" /> Account Payoff
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigateYear("prev")}
                data-testid="button-prev-year"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigateMonth("prev")}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            
            <CardTitle className="text-xl" data-testid="calendar-title">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigateMonth("next")}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => navigateYear("next")}
                data-testid="button-next-year"
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div 
                key={day} 
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] p-2 bg-muted/30 rounded-md" />
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isToday = isCurrentMonth && today.getDate() === day;
              
              return (
                <div
                  key={day}
                  className={cn(
                    "min-h-[100px] p-2 rounded-md border transition-colors",
                    isToday 
                      ? "border-primary bg-primary/5" 
                      : "border-transparent hover:bg-muted/50",
                    dayEvents.length > 0 && "bg-muted/30"
                  )}
                  data-testid={`calendar-day-${day}`}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isToday && "text-primary font-bold"
                  )}>
                    {day}
                  </div>
                  
                  <div className="space-y-1">
                    {dayEvents.map((event, eventIndex) => (
                      <Tooltip key={eventIndex}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "flex items-center gap-1 text-xs p-1 rounded border cursor-pointer",
                              getEventTypeStyles(event.type)
                            )}
                            data-testid={`event-${event.type}-${day}`}
                          >
                            {getEventIcon(event.type)}
                            <span className="truncate">
                              {event.type === "payment" && "Payment"}
                              {event.type === "budgetChange" && "Budget"}
                              {event.type === "lumpSum" && "Lump Sum"}
                              {event.type === "payoff" && event.details.payoffAccount}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          {renderEventTooltip(event)}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Events</CardTitle>
          <CardDescription>
            Events in the next 3 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {calendarEvents
              .filter(event => {
                const now = new Date();
                const threeMonthsLater = new Date();
                threeMonthsLater.setMonth(now.getMonth() + 3);
                return event.date >= now && event.date <= threeMonthsLater;
              })
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .slice(0, 10)
              .map((event, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    getEventTypeStyles(event.type)
                  )}
                  data-testid={`upcoming-event-${index}`}
                >
                  <div className="flex-shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {event.type === "payment" && "Monthly Payment"}
                      {event.type === "budgetChange" && "Budget Change"}
                      {event.type === "lumpSum" && "Lump Sum Payment"}
                      {event.type === "payoff" && `${event.details.payoffAccount} Payoff`}
                    </p>
                    <p className="text-sm opacity-80">
                      {event.date.toLocaleDateString("en-US", { 
                        month: "short", 
                        day: "numeric", 
                        year: "numeric" 
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {event.type === "payment" && event.details.accounts && (
                      <span className="font-mono font-semibold">
                        {formatCurrency(
                          event.details.accounts.reduce((sum, a) => sum + a.amount, 0),
                          currency
                        )}
                      </span>
                    )}
                    {event.type === "budgetChange" && (
                      <span className="font-mono text-sm">
                        {formatCurrency(event.details.oldBudget || 0, currency)} → {formatCurrency(event.details.newBudget || 0, currency)}
                      </span>
                    )}
                    {event.type === "lumpSum" && (
                      <span className="font-mono font-semibold">
                        {formatCurrency(event.details.lumpAmount || 0, currency)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            }
            {calendarEvents.filter(event => {
              const now = new Date();
              const threeMonthsLater = new Date();
              threeMonthsLater.setMonth(now.getMonth() + 3);
              return event.date >= now && event.date <= threeMonthsLater;
            }).length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No upcoming events in the next 3 months
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
