import React from "react";
import { type Bucket, type Parent, type DateField, type Scope } from "../components/reports/ReportFilters";

interface UseReportFiltersProps {
  isOfficeHead: boolean;
  isOfficeStaff: boolean;
}

export const useReportFilters = ({ isOfficeHead, isOfficeStaff }: UseReportFiltersProps) => {
  const isDeptUser = isOfficeHead || isOfficeStaff;

  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [bucket, setBucket] = React.useState<Bucket>("monthly");
  const [parent, setParent] = React.useState<Parent>("ALL");
  const [dateField, setDateField] = React.useState<DateField>("completed");
  const [scope, setScope] = React.useState<Scope>("offices");
  const [officeId, setOfficeId] = React.useState<number | null>(null);

  const activeFilterCount = [
    !isDeptUser && scope !== "offices",
    !isDeptUser && scope === "clusters" && parent !== "ALL",
    !isDeptUser && scope === "offices" && officeId !== null,
    bucket !== "monthly",
    dateField !== "completed",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setDateFrom("");
    setDateTo("");
    setBucket("monthly");
    setParent("ALL");
    setOfficeId(null);
    setDateField("completed");
    if (!isDeptUser) setScope("offices");
  };

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    bucket,
    setBucket,
    parent,
    setParent,
    dateField,
    setDateField,
    scope,
    setScope,
    officeId,
    setOfficeId,
    activeFilterCount,
    clearAllFilters,
  };
};
