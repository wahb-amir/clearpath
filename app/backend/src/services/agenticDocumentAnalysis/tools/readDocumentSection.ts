import { z } from "zod";
import type { AgentTool, AgentToolContext } from "../types";

export const ReadDocumentSectionParamsSchema = z.object({
  from: z.number().int().min(0).describe("Zero-based section index to start from."),
  to: z
    .number()
    .int()
    .min(0)
    .max(50)
    .optional()
    .describe("Inclusive upper index (max 50 sections returned at once)."),
});

export interface ReadDocumentSectionSection {
  index: number;
  section_id: string | null;
  title: string | null;
  content: string;
}

export interface ReadDocumentSectionResult {
  sections: ReadDocumentSectionSection[];
  truncated: boolean;
  total_sections: number;
}

export const readDocumentSectionTool: AgentTool<
  "read_document_section",
  z.infer<typeof ReadDocumentSectionParamsSchema>,
  ReadDocumentSectionResult
> = {
  name: "read_document_section",
  description:
    "Read one or more sections of the document by zero-based index. Sections come from the document's structure (titles + paragraphs). Use this when you need the raw text of a specific part of the document.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "integer", minimum: 0 },
      to: { type: "integer", minimum: 0, maximum: 50 },
    },
    required: ["from"],
  },
  paramsSchema: ReadDocumentSectionParamsSchema,
  sseEvent: {
    start: "ai_extraction_started",
    complete: "ai_extraction_completed",
  },
  handler: async (args, ctx) => {
    const sections = ctx.document.sections ?? [];
    const from = args.from;
    const to = Math.min(args.to ?? from, sections.length - 1);
    const slice = sections.slice(from, to + 1);

    return {
      sections: slice.map((s, i) => ({
        index: from + i,
        section_id: s.section_id ?? null,
        title: s.title ?? null,
        content: s.content,
      })),
      truncated: to + 1 < sections.length - 1,
      total_sections: sections.length,
    };
  },
};
