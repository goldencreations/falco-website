import { ManagerPageHeader } from "@/components/manager-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
 Activity,
 AlertCircle,
 ArrowUpRight,
 BriefcaseBusiness,
 CheckCircle2,
 Clock3,
 CreditCard,
 FileCheck2,
 Target,
 UsersRound,
 Wallet,
} from "lucide-react";
import { getServerSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBranchById, formatCurrency } from "@/lib/mock-data";
import {
 getBranchApplications,
 getBranchCollections,
 getBranchCustomers,
 getBranchLoans,
 getBranchPayments,
 getBranchTeam,
} from "@/lib/branch-scope";

export default async function ManagerDashboardPage() {
 const user = await getServerSessionUser();
 if (!user || user.role !== "branch_manager") redirect("/");

 const branch = getBranchById(user.branch_id);
 const branchLabel = branch ? `${branch.name} (${branch.code})` : user.branch_id;

 const branchCustomers = getBranchCustomers(user.branch_id);
 const branchLoans = getBranchLoans(user.branch_id);
 const branchPayments = getBranchPayments(user.branch_id);
 const branchApplications = getBranchApplications(user.branch_id);
 const branchTeam = getBranchTeam(user.branch_id);
 const branchCollections = getBranchCollections(user.branch_id);

 const outstanding = branchLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
 const principalDisbursed = branchLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);
 const collected = branchPayments
 .filter((payment) => payment.status === "completed")
 .reduce((sum, payment) => sum + payment.amount, 0);
 const pendingReview = branchApplications.filter(
 (item) => item.status === "submitted" || item.status === "under_review"
 ).length;
 const approvedApps = branchApplications.filter((item) => item.status === "approved").length;
 const rejectedApps = branchApplications.filter((item) => item.status === "rejected").length;
 const collectionToday = branchCollections.filter((item) => {
 const today = new Date().toDateString();
 return new Date(item.performed_at).toDateString() === today;
 }).length;
 const inArrearsCount = branchLoans.filter((loan) => loan.days_in_arrears > 0).length;
 const completedLoans = branchLoans.filter((loan) => loan.status === "paid_off").length;
 const completionRate = branchLoans.length > 0 ? (completedLoans / branchLoans.length) * 100 : 0;
 const collectionRate = principalDisbursed > 0 ? (collected / principalDisbursed) * 100 : 0;
 const portfolioAtRiskAmount = branchLoans
 .filter((loan) => loan.days_in_arrears > 30)
 .reduce((sum, loan) => sum + loan.total_outstanding, 0);

 const officerTeam = branchTeam.filter(
 (member) => member.role === "loan_officer" || member.role === "collections_officer"
 );
 const pendingTasks = [
 { label: "Applications pending review", value: pendingReview, tone: "warning" as const },
 { label: "Loans in arrears follow-up", value: inArrearsCount, tone: "danger" as const },
 { label: "Collections activities today", value: collectionToday, tone: "neutral" as const },
 ];

 return (
 <>
 <ManagerPageHeader
 title="Branch Manager Dashboard"
 description="Branch-only portfolio oversight and operational controls"
 branchLabel={branchLabel}
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-5">
 <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-5 text-white shadow-sm">
 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Branch Command Desk</p>
 <h2 className="mt-1 text-2xl font-semibold tracking-tight">{branch?.name ?? "Assigned Branch"} Operations</h2>
 <p className="mt-1 text-sm text-emerald-100/90">
 Executive view for manager decisions: portfolio quality, review queues, field activity, and team execution.
 </p>
 <div className="mt-4 flex flex-wrap gap-2">
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <UsersRound className="mr-1 h-3.5 w-3.5" />
 {branchCustomers.length} customers
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <BriefcaseBusiness className="mr-1 h-3.5 w-3.5" />
 {branchLoans.length} active loan records
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <Activity className="mr-1 h-3.5 w-3.5" />
 {officerTeam.length} field staff
 </Badge>
 </div>
 </div>

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <Card className="border-emerald-200/70 bg-emerald-50/50">
 <CardHeader className="pb-2">
 <CardDescription>Branch Portfolio</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(outstanding)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Current outstanding across branch loans</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Total Collected</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(collected)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Completed payment collections to date</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Review Queue</CardDescription>
 <CardTitle className="text-2xl">{pendingReview}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Submitted and under-review applications</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Portfolio At Risk ({">"}30d)</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(portfolioAtRiskAmount)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Exposure requiring urgent follow-up</CardContent>
 </Card>
 </div>

 <div className="grid gap-4 xl:grid-cols-12">
 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Application Pipeline</CardTitle>
 <CardDescription>Branch credit flow status</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="inline-flex items-center gap-2 text-muted-foreground"><Clock3 className="h-4 w-4" /> Pending review</span>
 <span className="font-semibold">{pendingReview}</span>
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="inline-flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Approved</span>
 <span className="font-semibold">{approvedApps}</span>
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="inline-flex items-center gap-2 text-muted-foreground"><AlertCircle className="h-4 w-4 text-rose-600" /> Rejected</span>
 <span className="font-semibold">{rejectedApps}</span>
 </div>
 </CardContent>
 </Card>

 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Collection Efficiency</CardTitle>
 <CardDescription>Recovery against disbursed principal</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="rounded-xl border bg-muted/20 p-4">
 <p className="text-3xl font-bold tracking-tight">{collectionRate.toFixed(1)}%</p>
 <p className="text-xs text-muted-foreground">Collection rate</p>
 </div>
 <Progress value={Math.min(collectionRate, 100)} className="h-2.5" />
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Disbursed: {formatCurrency(principalDisbursed)}</span>
 <span className="inline-flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Collected: {formatCurrency(collected)}</span>
 </div>
 </CardContent>
 </Card>

 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Loan Completion</CardTitle>
 <CardDescription>Repayment maturity progress</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="rounded-xl border bg-muted/20 p-4">
 <p className="text-3xl font-bold tracking-tight">{completionRate.toFixed(1)}%</p>
 <p className="text-xs text-muted-foreground">Loans closed vs total loans</p>
 </div>
 <Progress value={completionRate} className="h-2.5" />
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>{completedLoans} paid off</span>
 <span>{branchLoans.length - completedLoans} in progress</span>
 </div>
 </CardContent>
 </Card>
 </div>

 <div className="grid gap-4 lg:grid-cols-3">
 <Card className="lg:col-span-2">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Team Workload Snapshot</CardTitle>
 <CardDescription>Branch team members and execution roles</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 {branchTeam.slice(0, 7).map((member) => (
 <div key={member.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
 <div>
 <p className="font-medium">{member.full_name}</p>
 <p className="text-xs text-muted-foreground">{member.employee_id}</p>
 </div>
 <Badge variant="outline" className="capitalize">
 {member.role.replace("_", " ")}
 </Badge>
 </div>
 ))}
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Manager Priority Queue</CardTitle>
 <CardDescription>What needs action now</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {pendingTasks.map((task) => (
 <div key={task.label} className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">{task.label}</p>
 <div className="mt-1 flex items-center justify-between">
 <p className="text-xl font-semibold">{task.value}</p>
 <ArrowUpRight
 className={`h-4 w-4 ${
 task.tone === "danger"
 ? "text-rose-600"
 : task.tone === "warning"
 ? "text-amber-600"
 : "text-emerald-600"
 }`}
 />
 </div>
 </div>
 ))}
 <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
 <p className="inline-flex items-center gap-1 font-medium text-foreground">
 <Target className="h-3.5 w-3.5 text-emerald-600" />
 Branch weekly focus
 </p>
 <p className="mt-1">Reduce PAR exposure by prioritizing accounts above 30 arrears days.</p>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 </main>
 </>
 );
}
