export const userProfile = {
  name: "Sarah Jenkins",
  email: "sarah.jenkins@example.com",
  role: "Parent / Guardian",
  joinedDate: "October 2023",
  preferredLanguage: "English",
  avatarUrl: null, // Using initials fallback in UI
};

export const mockHistoryItems = [
  {
    id: "doc-1",
    title: "Notice of Truancy",
    type: "School Attendance Warning",
    date: "2024-05-12T10:30:00Z",
    urgency: "high",
    confidence: "high",
    status: "action_required",
    summary:
      "Your child has 5 unexcused absences. A parent-teacher meeting is required before May 20th.",
    actionCount: 2,
    saved: true,
  },
  {
    id: "doc-2",
    title: "Housing Support Program Qualification",
    type: "Government Letter",
    date: "2024-05-08T14:15:00Z",
    urgency: "medium",
    confidence: "medium",
    status: "review_suggested",
    summary:
      "You pre-qualify for rental assistance, but additional income verification documents are needed.",
    actionCount: 3,
    saved: true,
  },
  {
    id: "doc-3",
    title: "Spring Scholarship Details",
    type: "Financial Aid Form",
    date: "2024-05-01T09:00:00Z",
    urgency: "low",
    confidence: "high",
    status: "completed",
    summary:
      "Details for the 2024 Spring Arts Scholarship. Deadline is extended to June 15.",
    actionCount: 1,
    saved: false,
  },
  {
    id: "doc-4",
    title: "Community Center Liability Waiver",
    type: "Legal Release Form",
    date: "2024-04-20T16:45:00Z",
    urgency: "low",
    confidence: "high",
    status: "completed",
    summary:
      "Standard liability waiver for the summer camp. Requires signature before participation.",
    actionCount: 1,
    saved: false,
  },
];

export const mockSettings = {
  language: "English",
  emailNotifications: true,
  smsAlerts: false,
  theme: "system",
  accessibility: {
    highContrast: false,
    largeText: false,
  },
};
