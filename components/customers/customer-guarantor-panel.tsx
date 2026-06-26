"use client";

import { Download, ExternalLink, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerGuarantorRow } from "@/lib/customer-profile-extras";

export function CustomerGuarantorPanel({ rows }: { rows: CustomerGuarantorRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guarantor details & attachment</CardTitle>
          <CardDescription>
            Guarantors registered at customer onboarding and from loan applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Guarantor information from loan applications will appear here when available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <Card key={`${row.applicationNumber}-${row.name}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              {row.name}
            </CardTitle>
            <CardDescription>Application {row.applicationNumber}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">National ID</TableCell>
                  <TableCell className="font-mono text-sm">{row.nationalId}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Phone</TableCell>
                  <TableCell>{row.phone}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Relationship</TableCell>
                  <TableCell className="capitalize">{row.relationship}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Address</TableCell>
                  <TableCell>{row.address}</TableCell>
                </TableRow>
                {row.collateralType ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Collateral type</TableCell>
                    <TableCell>{row.collateralType}</TableCell>
                  </TableRow>
                ) : null}
                {row.collateralDescription ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Collateral description</TableCell>
                    <TableCell>{row.collateralDescription}</TableCell>
                  </TableRow>
                ) : null}
                {row.collateralEstimatedValue != null && row.collateralEstimatedValue > 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Collateral value</TableCell>
                    <TableCell>
                      TSh {row.collateralEstimatedValue.toLocaleString("en-TZ")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            {row.documents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Attachments</p>
                <ul className="divide-y rounded-md border">
                  {row.documents.map((doc) => (
                    <li
                      key={doc.url}
                      className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="truncate">{doc.name}</span>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            View
                          </a>
                        </Button>
                        <Button type="button" variant="secondary" size="sm" asChild>
                          <a href={doc.url} download>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No guarantor attachment URLs on file yet.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
