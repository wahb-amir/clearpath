export type UrgencyLevel = "low" | "medium" | "high";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface Deadline {
  label: string;
  date: string;
  urgency: UrgencyLevel;
  daysUntil?: number;
}

export interface Source {
  title: string;
  url: string;
  type?: "official" | "support" | "guide";
}

export interface ConfidenceItem {
  label: string;
  level: ConfidenceLevel;
  note: string;
}

export interface AnalysisResult {
  id: string;
  title: string;
  documentType: string;
  urgency: UrgencyLevel;
  summary: string;
  deadlines: Deadline[];
  actions: string[];
  questions: string[];
  sources: Source[];
  confidence: ConfidenceItem[];
  warning: string;
}

export interface SampleDocument {
  id: string;
  label: string;
  description: string;
  icon: string;
  preview: string;
  result: AnalysisResult;
}
