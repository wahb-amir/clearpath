export const sampleDocuments = [
  {
    id: "attendance-warning",
    label: "School Attendance Warning",
    description: "Official letter from school district regarding attendance",
    icon: "🏫",
    preview:
      "Dear Parent/Guardian: We are writing to inform you that your child has accumulated 8 unexcused absences this semester. Per district policy 5.3.2, students with 10 or more unexcused absences may be referred to the Student Attendance Review Board (SARB). Failure to comply may result in a mandatory parent conference and possible referral to the County Office of Education...",
    result: {
      id: "attendance-warning",
      title: "School Attendance Warning Letter",
      documentType: "Official School Notice",
      urgency: "high",
      summary:
        "Your child has 8 unexcused absences this semester. District policy requires action before they reach 10 absences to avoid a formal review board referral. You must contact the school and provide documentation for any absences within the next 2 weeks.",
      deadlines: [
        {
          label: "Submit absence documentation",
          date: "2024-02-15",
          urgency: "high",
          daysUntil: 7,
        },
        {
          label: "Parent conference deadline",
          date: "2024-02-28",
          urgency: "medium",
          daysUntil: 14,
        },
        {
          label: "SARB referral threshold",
          date: "2024-03-15",
          urgency: "high",
          daysUntil: 28,
        },
      ],
      actions: [
        "Contact the school attendance office immediately to discuss the absences",
        "Gather documentation (doctor notes, family emergency records) for any excusable absences",
        "Request a meeting with the school counselor to create an attendance improvement plan",
        "Set up a system at home to prevent further unexcused absences",
        "Ask about the school's formal excusal process for future absences",
      ],
      questions: [
        "Which specific dates are counted as unexcused absences?",
        "Can any of these absences be retroactively excused with documentation?",
        "What exactly happens at the SARB review board meeting?",
        "Are there any community resources for families struggling with attendance?",
        "What is the school's process for approving medical or family emergency absences?",
      ],
      sources: [
        {
          title: "District Attendance Policy 5.3.2",
          url: "https://www.ed.gov/attendance",
          type: "official",
        },
        {
          title: "SARB Process Explained",
          url: "https://www.cde.ca.gov/ls/ai/cw/sarb.asp",
          type: "guide",
        },
        {
          title: "Parent Rights in Attendance Matters",
          url: "https://www.aclu.org/know-your-rights/students-rights",
          type: "support",
        },
      ],
      confidence: [
        {
          label: "Number of absences (8)",
          level: "high",
          note: "Clearly stated in the document",
        },
        {
          label: "SARB referral threshold (10 absences)",
          level: "high",
          note: "Directly referenced in policy section 5.3.2",
        },
        {
          label: "Submission deadline (Feb 15)",
          level: "medium",
          note: "Inferred from letter date — verify exact deadline with school",
        },
        {
          label: "Penalty for non-compliance",
          level: "low",
          note: "May vary by district — please confirm with attendance office",
        },
      ],
      warning:
        "This is an AI-generated summary. Please verify all deadlines and consequences directly with your school's attendance office before taking action.",
    },
  },
  {
    id: "scholarship-notice",
    label: "Scholarship Eligibility Notice",
    description: "Financial aid letter with eligibility requirements",
    icon: "🎓",
    preview:
      "NOTICE OF CONDITIONAL SCHOLARSHIP ELIGIBILITY — Dear Applicant: Your application for the State Merit Scholarship has been reviewed. You are conditionally eligible for an award of $2,500 per semester. To confirm eligibility, you must maintain a 3.0 GPA, enroll in minimum 12 units, and submit your FAFSA verification documents by March 1st...",
    result: {
      id: "scholarship-notice",
      title: "State Merit Scholarship — Conditional Eligibility",
      documentType: "Financial Aid Notice",
      urgency: "medium",
      summary:
        "You have been conditionally approved for a $2,500 per semester scholarship. To receive funding, you must maintain a 3.0 GPA, be enrolled full-time (12+ units), and submit FAFSA verification documents by March 1st. Missing any condition will result in award cancellation.",
      deadlines: [
        {
          label: "FAFSA verification documents due",
          date: "2024-03-01",
          urgency: "high",
          daysUntil: 18,
        },
        {
          label: "GPA review period ends",
          date: "2024-05-15",
          urgency: "medium",
          daysUntil: 93,
        },
        {
          label: "Next semester enrollment confirmation",
          date: "2024-04-15",
          urgency: "medium",
          daysUntil: 63,
        },
      ],
      actions: [
        "Log into your FAFSA account and download your Student Aid Report (SAR)",
        "Submit all required verification documents to the financial aid office by March 1st",
        "Confirm your enrollment for minimum 12 units before the deadline",
        "Monitor your GPA throughout the semester to stay above 3.0",
        "Set up direct deposit information with the bursar's office for disbursement",
      ],
      questions: [
        "What specific documents are needed for FAFSA verification?",
        "What happens if my GPA drops below 3.0 mid-semester — is there an appeals process?",
        "Can I receive the scholarship if I drop to 11 units due to a medical withdrawal?",
        "When exactly will the scholarship funds be disbursed each semester?",
        "Is this scholarship renewable next year, and what are the renewal requirements?",
      ],
      sources: [
        {
          title: "State Merit Scholarship Program",
          url: "https://www.csac.ca.gov/merit-scholarship",
          type: "official",
        },
        {
          title: "FAFSA Verification Guide",
          url: "https://studentaid.gov/resources/aid-offer",
          type: "guide",
        },
        {
          title: "Student Financial Aid Help Center",
          url: "https://studentaid.gov/help-center",
          type: "support",
        },
      ],
      confidence: [
        {
          label: "Award amount ($2,500/semester)",
          level: "high",
          note: "Explicitly stated in the award letter",
        },
        {
          label: "GPA requirement (3.0)",
          level: "high",
          note: "Clearly defined in eligibility conditions",
        },
        {
          label: "FAFSA deadline (March 1)",
          level: "high",
          note: "Specific date mentioned in document",
        },
        {
          label: "Consequences of GPA drop",
          level: "medium",
          note: "Appeal process not detailed — verify with financial aid office",
        },
      ],
      warning:
        "Scholarship terms can vary. Always confirm requirements with your institution's financial aid office and keep copies of all submitted documents.",
    },
  },
  {
    id: "housing-notice",
    label: "Housing Assistance Notice",
    description: "Community housing support program eligibility letter",
    icon: "🏠",
    preview:
      "NOTICE OF HOUSING ASSISTANCE PROGRAM ELIGIBILITY — The County Housing Authority has determined that your household may be eligible for emergency rental assistance. Based on our records, your household income qualifies under Program Code HAS-7. To complete your application, you must submit proof of residency, income verification, and a signed landlord agreement form within 30 days...",
    result: {
      id: "housing-notice",
      title: "Emergency Rental Assistance — Eligibility Notice",
      documentType: "Housing Support Program",
      urgency: "high",
      summary:
        "Your household qualifies for emergency rental assistance under Program Code HAS-7. You have 30 days from the letter date to submit three required documents: proof of residency, income verification, and a signed landlord agreement. Missing the deadline means your application is automatically closed.",
      deadlines: [
        {
          label: "Submit all required documents",
          date: "2024-02-20",
          urgency: "high",
          daysUntil: 5,
        },
        {
          label: "Landlord agreement form signing",
          date: "2024-02-18",
          urgency: "high",
          daysUntil: 3,
        },
        {
          label: "Application review period",
          date: "2024-03-15",
          urgency: "low",
          daysUntil: 29,
        },
      ],
      actions: [
        "Gather proof of residency: lease agreement, utility bill, or bank statement with address",
        "Collect income verification: pay stubs, tax return, or benefit award letters",
        "Contact your landlord IMMEDIATELY to request they sign the landlord agreement form",
        "Submit all documents in-person or by certified mail before the 30-day deadline",
        "Request a receipt or confirmation number when submitting documents",
      ],
      questions: [
        "What counts as acceptable 'proof of residency' if I don't have a formal lease?",
        "Is there an extension process if my landlord refuses to sign the agreement form?",
        "How much rental assistance is available and how many months does it cover?",
        "Can I submit documents digitally or must they be delivered in person?",
        "What happens after I submit — what is the approval timeline?",
      ],
      sources: [
        {
          title: "County Housing Authority Program HAS-7",
          url: "https://www.hud.gov/rental-assistance",
          type: "official",
        },
        {
          title: "Tenant Rights and Resources",
          url: "https://www.tenantrightsca.com",
          type: "support",
        },
        {
          title: "Emergency Rental Assistance Help",
          url: "https://www.consumerfinance.gov/renterhelp",
          type: "guide",
        },
      ],
      confidence: [
        {
          label: "Program eligibility (HAS-7)",
          level: "high",
          note: "Explicitly confirmed in the letter header",
        },
        {
          label: "30-day submission deadline",
          level: "high",
          note: "Clearly stated — calculate from letter date",
        },
        {
          label: "Required documents list",
          level: "medium",
          note: "Three types listed — additional docs may be needed",
        },
        {
          label: "Assistance amount",
          level: "low",
          note: "Amount not specified in this letter — contact the housing authority",
        },
      ],
      warning:
        "URGENT: You have very little time remaining. Contact the County Housing Authority directly to confirm document requirements and any available deadline extensions.",
    },
  },
];
