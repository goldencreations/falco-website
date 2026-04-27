"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Phone,
  MessageSquare,
  MapPin,
  FileText,
  AlertTriangle,
  Clock,
  Plus,
  Calendar,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  loans,
  collectionActivities,
  getCustomerById,
  getProductById,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/mock-data";
import type { CollectionAction, RiskClassification } from "@/lib/types";

const riskConfig: Record<RiskClassification, { label: string; color: string; priority: number }> = {
  current: { label: "Current", color: "bg-accent", priority: 0 },
  especially_mentioned: { label: "Watch (1-30d)", color: "bg-warning", priority: 1 },
  substandard: { label: "Substandard (31-90d)", color: "bg-destructive", priority: 2 },
  doubtful: { label: "Doubtful (91-180d)", color: "bg-destructive", priority: 3 },
  loss: { label: "Loss (>180d)", color: "bg-foreground", priority: 4 },
};

const actionConfig: Record<CollectionAction, { label: string; icon: typeof Phone }> = {
  sms_reminder: { label: "SMS Reminder", icon: MessageSquare },
  phone_call: { label: "Phone Call", icon: Phone },
  field_visit: { label: "Field Visit", icon: MapPin },
  demand_letter: { label: "Demand Letter", icon: FileText },
  legal_notice: { label: "Legal Notice", icon: AlertTriangle },
  restructuring_offer: { label: "Restructuring Offer", icon: FileText },
  write_off_recommendation: { label: "Write-off Recommendation", icon: AlertTriangle },
};

export default function CollectionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState("");
  const [selectedAction, setSelectedAction] = useState<CollectionAction>("phone_call");
  const [activityNotes, setActivityNotes] = useState("");

  // Get loans that need collection attention (in arrears or worse)
  const delinquentLoans = loans.filter(
    (loan) => loan.risk_classification !== "current"
  ).sort((a, b) => b.days_in_arrears - a.days_in_arrears);

  const filteredLoans = delinquentLoans.filter((loan) => {
    const customer = getCustomerById(loan.customer_id);
    const matchesSearch =
      searchQuery === "" ||
      loan.loan_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.last_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClassification =
      classificationFilter === "all" ||
      loan.risk_classification === classificationFilter;

    return matchesSearch && matchesClassification;
  });

  const totalOverdue = delinquentLoans.reduce(
    (sum, l) => sum + l.total_outstanding,
    0
  );

  const watchLoans = delinquentLoans.filter(
    (l) => l.risk_classification === "especially_mentioned"
  );
  const substandardLoans = delinquentLoans.filter(
    (l) => l.risk_classification === "substandard" || l.risk_classification === "doubtful"
  );

  const handleLogActivity = () => {
    console.log("Logging activity:", {
      loanId: selectedLoan,
      action: selectedAction,
      notes: activityNotes,
    });
    setIsDialogOpen(false);
    setSelectedLoan("");
    setActivityNotes("");
  };

  return (
    <>
      <DashboardHeader
        title="Collections"
        description="Manage overdue loans and collection activities"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(totalOverdue)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {delinquentLoans.length} loans
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-warning" />
                  Watch List (1-30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{watchLoans.length}</div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(watchLoans.reduce((s, l) => s + l.total_outstanding, 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  Substandard (31-90d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{substandardLoans.length}</div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(substandardLoans.reduce((s, l) => s + l.total_outstanding, 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Activities Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {collectionActivities.filter((a) => {
                    const actDate = new Date(a.performed_at).toDateString();
                    const today = new Date().toDateString();
                    return actDate === today;
                  }).length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="queue" className="space-y-4">
            <TabsList>
              <TabsTrigger value="queue">Collection Queue</TabsTrigger>
              <TabsTrigger value="activities">Recent Activities</TabsTrigger>
            </TabsList>

            {/* Collection Queue Tab */}
            <TabsContent value="queue" className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search loans..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={classificationFilter}
                    onValueChange={setClassificationFilter}
                  >
                    <SelectTrigger className="w-48">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classifications</SelectItem>
                      <SelectItem value="especially_mentioned">Watch (1-30d)</SelectItem>
                      <SelectItem value="substandard">Substandard (31-90d)</SelectItem>
                      <SelectItem value="doubtful">Doubtful (91-180d)</SelectItem>
                      <SelectItem value="loss">Loss ({">"}180d)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Log Activity
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Collection Activity</DialogTitle>
                      <DialogDescription>
                        Record a collection action taken for an overdue loan
                      </DialogDescription>
                    </DialogHeader>
                    <FieldGroup className="py-4">
                      <Field>
                        <FieldLabel>Select Loan</FieldLabel>
                        <Select value={selectedLoan} onValueChange={setSelectedLoan}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a loan" />
                          </SelectTrigger>
                          <SelectContent>
                            {delinquentLoans.map((loan) => {
                              const customer = getCustomerById(loan.customer_id);
                              return (
                                <SelectItem key={loan.id} value={loan.id}>
                                  {loan.loan_number} - {customer?.first_name} {customer?.last_name} ({loan.days_in_arrears}d)
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Action Type</FieldLabel>
                        <Select
                          value={selectedAction}
                          onValueChange={(v) => setSelectedAction(v as CollectionAction)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sms_reminder">SMS Reminder</SelectItem>
                            <SelectItem value="phone_call">Phone Call</SelectItem>
                            <SelectItem value="field_visit">Field Visit</SelectItem>
                            <SelectItem value="demand_letter">Demand Letter</SelectItem>
                            <SelectItem value="legal_notice">Legal Notice</SelectItem>
                            <SelectItem value="restructuring_offer">Restructuring Offer</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Notes / Outcome</FieldLabel>
                        <Textarea
                          placeholder="Describe the outcome of this action..."
                          value={activityNotes}
                          onChange={(e) => setActivityNotes(e.target.value)}
                          rows={4}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Follow-up Date</FieldLabel>
                        <Input type="date" />
                      </Field>
                    </FieldGroup>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleLogActivity}>Log Activity</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Collection Queue Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead className="text-center">Days Overdue</TableHead>
                        <TableHead>Classification</TableHead>
                        <TableHead>Last Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLoans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No overdue loans found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLoans.map((loan) => {
                          const customer = getCustomerById(loan.customer_id);
                          const product = getProductById(loan.product_id);
                          const risk = riskConfig[loan.risk_classification];
                          const loanActivities = collectionActivities.filter(
                            (a) => a.loan_id === loan.id
                          );
                          const lastActivity = loanActivities[loanActivities.length - 1];

                          return (
                            <TableRow key={loan.id}>
                              <TableCell className="font-mono text-sm">
                                {loan.loan_number}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">
                                    {customer?.first_name} {customer?.last_name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {customer?.phone_primary}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>{product?.name}</TableCell>
                              <TableCell className="text-right font-bold text-destructive">
                                {formatCurrency(loan.total_outstanding)}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xl font-bold text-destructive">
                                  {loan.days_in_arrears}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  style={{ backgroundColor: `hsl(var(--${risk.color.replace("bg-", "")}))` }}
                                  className="text-white"
                                >
                                  {risk.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {lastActivity ? (
                                  <div className="text-sm">
                                    <p>{actionConfig[lastActivity.action].label}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(lastActivity.performed_at)}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">No contact</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="sm" title="Call">
                                    <Phone className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" title="SMS">
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link href={`/loans/${loan.id}`}>
                                      View
                                    </Link>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activities Tab */}
            <TabsContent value="activities">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Collection Activities</CardTitle>
                  <CardDescription>
                    History of collection actions taken
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {collectionActivities.map((activity) => {
                      const customer = getCustomerById(activity.customer_id);
                      const loan = loans.find((l) => l.id === activity.loan_id);
                      const action = actionConfig[activity.action];
                      const ActionIcon = action.icon;

                      return (
                        <div
                          key={activity.id}
                          className="flex gap-4 border-b border-border pb-4 last:border-0"
                        >
                          <div className="rounded-full bg-muted p-2 h-fit">
                            <ActionIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{action.label}</p>
                              <Badge variant="outline" className="text-xs">
                                {activity.outcome || "Pending"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {customer?.first_name} {customer?.last_name} | {loan?.loan_number}
                            </p>
                            <p className="text-sm">{activity.notes}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{formatDateTime(activity.performed_at)}</span>
                              {activity.follow_up_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Follow-up: {formatDate(activity.follow_up_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
