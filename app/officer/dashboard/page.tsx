import { redirect } from "next/navigation";
import { Activity, CheckCircle2, Clock3, HandCoins, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { OfficerPageHeader } from "@/components/officer-page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSessionUser } from "@/lib/auth";
import { collectionActivities, formatCurrency, getBranchById, loanApplications, loans, payments } from "@/lib/mock-data";
import { getBranchCustomers } from "@/lib/branch-scope";

export default async function OfficerDashboardPage() {
 const user = await getServerSessionUser();
 if (!user || user.role !== "loan_officer") redirect("/");

 const branch = getBranchById(user.branch_id);
 const branchLabel = branch ? `${branch.name} (${branch.code})` : user.branch_id;

 const branchCustomers = getBranchCustomers(user.branch_id).filter(
 (customer) => customer.assigned_loan_officer_id === user.id || customer.created_by === user.id
 );
 const officerApplications = loanApplications.filter(
 (application) => application.branch_id === user.branch_id && application.created_by === user.id
 );
 const officerLoans = loans.filter((loan) => loan.branch_id === user.branch_id && loan.loan_officer_id === user.id);
 const officerPayments = payments.filter((payment) => officerLoans.some((loan) => loan.id === payment.loan_id));
 const officerCollections = collectionActivities.filter((item) => officerLoans.some((loan) => loan.id === item.loan_id));

 const pendingReview = officerApplications.filter(
 (application) => application.status === "submitted" || application.status === "under_review"
 ).length;
 const approvedApps = officerApplications.filter((application) => application.status === "approved").length;
 const activeLoans = officerLoans.filter((loan) => loan.status === "active" || loan.status === "in_arrears").length;
 const inArrears = officerLoans.filter((loan) => loan.days_in_arrears > 0).length;
 const completedRepayments = officerPayments.filter((payment) => payment.status === "completed");
 const totalCollected = completedRepayments.reduce((sum, payment) => sum + payment.amount, 0);
 const portfolioOutstanding = officerLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
 const completedLoans = officerLoans.filter((loan) => loan.status === "paid_off").length;
 const completionRate = officerLoans.length > 0 ? (completedLoans / officerLoans.length) * 100 : 0;
 const inProgressLoans = Math.max(officerLoans.length - completedLoans - inArrears, 0);
 const progressTotal = Math.max(completedLoans + inProgressLoans + inArrears, 1);
 const arcLength = Math.PI * 90;
 const completedArc = (completedLoans / progressTotal) * arcLength;
 const inProgressArc = (inProgressLoans / progressTotal) * arcLength;
 const riskArc = (inArrears / progressTotal) * arcLength;
 const collectionRate = officerLoans.length
 ? (officerLoans.reduce((sum, loan) => sum + loan.total_paid, 0) /
 officerLoans.reduce((sum, loan) => sum + loan.principal_amount, 0)) *
 100
 : 0;

 return (
 <>
 <OfficerPageHeader
 title="Loan Officer Dashboard"
 description="Your assigned workload, recovery activity, and portfolio quality"
 branchLabel={branchLabel}
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-5">
 <section className="rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-5 text-white shadow-sm">
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Officer Command Desk</p>
 <h2 className="mt-1 text-2xl font-semibold tracking-tight">{user.full_name}</h2>
 <p className="mt-1 text-sm text-emerald-100/90">
 Overview of your customer portfolio, repayment performance, and branch execution priorities.
 </p>
 <div className="mt-4 flex flex-wrap gap-2">
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <UsersRound className="mr-1 h-3.5 w-3.5" />
 {branchCustomers.length} assigned customers
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <Clock3 className="mr-1 h-3.5 w-3.5" />
 {pendingReview} applications pending
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <Activity className="mr-1 h-3.5 w-3.5" />
 {officerCollections.length} collection actions
 </Badge>
 </div>
 </section>

 <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Portfolio Outstanding</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(portfolioOutstanding)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Open amount across your assigned loans</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Total Collected</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(totalCollected)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Recovered via completed repayment entries</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>Active Loans</CardDescription>
 <CardTitle className="text-2xl">{activeLoans}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Loans currently in servicing</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>At-Risk Accounts</CardDescription>
 <CardTitle className="text-2xl">{inArrears}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">Loans requiring immediate follow-up</CardContent>
 </Card>
 </section>

 <section className="grid gap-4 xl:grid-cols-12">
 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Application Flow</CardTitle>
 <CardDescription>Applications originated by you</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="text-muted-foreground">Pending review</span>
 <span className="font-semibold">{pendingReview}</span>
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="text-muted-foreground">Approved</span>
 <span className="font-semibold">{approvedApps}</span>
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="text-muted-foreground">Total originated</span>
 <span className="font-semibold">{officerApplications.length}</span>
 </div>
 </CardContent>
 </Card>

 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Portfolio Progress</CardTitle>
 <CardDescription>Completion gauge for your loan portfolio</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="relative mx-auto h-36 w-56 sm:h-40 sm:w-64">
 <svg viewBox="0 0 220 130" className="h-full w-full">
 <defs>
 <pattern id="officer-pending-stripe" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(35)">
 <line x1="0" y1="0" x2="0" y2="8" stroke="#9ca3af" strokeWidth="4" />
 </pattern>
 </defs>
 <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="#e5e7eb" strokeWidth="22" strokeLinecap="round" />
 <path
 d="M20 110 A90 90 0 0 1 200 110"
 fill="none"
 stroke="#16a34a"
 strokeWidth="22"
 strokeDasharray={`${completedArc} ${arcLength - completedArc}`}
 transform="rotate(180 110 110)"
 />
 <path
 d="M20 110 A90 90 0 0 1 200 110"
 fill="none"
 stroke="#166534"
 strokeWidth="22"
 strokeDasharray={`${inProgressArc} ${arcLength - inProgressArc}`}
 strokeDashoffset={-completedArc}
 transform="rotate(180 110 110)"
 />
 <path
 d="M20 110 A90 90 0 0 1 200 110"
 fill="none"
 stroke="url(#officer-pending-stripe)"
 strokeWidth="22"
 strokeDasharray={`${riskArc} ${arcLength - riskArc}`}
 strokeDashoffset={-(completedArc + inProgressArc)}
 transform="rotate(180 110 110)"
 />
 </svg>
 <div className="absolute inset-x-0 bottom-1 text-center">
 <p className="text-4xl font-bold leading-none">{completionRate.toFixed(0)}%</p>
 <p className="text-xs text-muted-foreground">Completed</p>
 </div>
 </div>
 <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
 <p className="inline-flex items-center gap-1.5 text-muted-foreground">
 <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
 Completed ({completedLoans})
 </p>
 <p className="inline-flex items-center gap-1.5 text-muted-foreground">
 <span className="h-2.5 w-2.5 rounded-full bg-emerald-900" />
 In Progress ({inProgressLoans})
 </p>
 <p className="inline-flex items-center gap-1.5 text-muted-foreground">
 <span className="h-2.5 w-2.5 rounded bg-[repeating-linear-gradient(135deg,#9ca3af_0px,#9ca3af_2px,transparent_2px,transparent_4px)]" />
 Pending ({inArrears})
 </p>
 </div>
 </CardContent>
 </Card>

 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Priority Queue</CardTitle>
 <CardDescription>What needs your action now</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <div className="rounded-lg border p-3">
 <p className="font-medium">Collection follow-ups</p>
 <p className="text-xs text-muted-foreground">{inArrears} accounts need repayment tracking</p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="font-medium">Review queue</p>
 <p className="text-xs text-muted-foreground">{pendingReview} applications waiting credit review</p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="inline-flex items-center gap-1 font-medium">
 <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
 Recovery momentum
 </p>
 <p className="text-xs text-muted-foreground">Collection rate: {collectionRate.toFixed(1)}%</p>
 </div>
 </CardContent>
 </Card>
 </section>

 <section>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Field Focus</CardTitle>
 <CardDescription>Live activity indicators for your day</CardDescription>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">Pending documents</p>
 <p className="mt-1 text-xl font-semibold">{pendingReview}</p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">Collection activities</p>
 <p className="mt-1 text-xl font-semibold">{officerCollections.length}</p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">Repayment records</p>
 <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold">
 <HandCoins className="h-4 w-4 text-emerald-600" />
 {completedRepayments.length}
 </p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">Paid off loans</p>
 <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold">
 <CheckCircle2 className="h-4 w-4 text-emerald-600" />
 {completedLoans}
 </p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">In progress loans</p>
 <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold">
 <Wallet className="h-4 w-4 text-blue-600" />
 {inProgressLoans}
 </p>
 </div>
 </CardContent>
 </Card>
 </section>
 </div>
 </main>
 </>
 );
}
