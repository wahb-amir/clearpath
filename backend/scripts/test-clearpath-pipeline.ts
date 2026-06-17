import { runClearPathPipeline } from "../src/services/documentAnalysisPipeline";
import type { NormalizedDocument } from "../src/types/documentAnalysis";

const sampleDocument: NormalizedDocument = {
  document_id: "doc_demo_001",
  user_id: "user_demo_001",
  file_type: "text/plain",
  language: "en",
  source_text: [
    "Notice of action.",
    "Please submit the completed form by June 30, 2026.",
    "For questions, contact the school office at office@example.edu.",
    "This notice does not confirm eligibility or guarantee approval.",
    "Needs review if anything is unclear."
  ].join("\n"),
  sections: [
    {
      section_id: "sec_1",
      title: "Deadline",
      content: "Please submit the completed form by June 30, 2026.",
      order: 1
    },
    {
      section_id: "sec_2",
      title: "Contact",
      content: "For questions, contact the school office at office@example.edu.",
      order: 2
    }
  ],
  entities: {
    dates: ["2026-06-30"],
    contacts: ["office@example.edu"],
    urls: [],
    names: ["school office"]
  }
};

async function main(): Promise<void> {
  const result = await runClearPathPipeline(sampleDocument, {
    maxSearchResultsPerQuery: 3
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
