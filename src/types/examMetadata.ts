export interface LogoSettings {
  src: string;
  width: number; // in pixels or percentage
  alignment: "left" | "center" | "right";
}

export type QuestionTypePreset = "mcq" | "short" | "long" | "mixed";
export type SectionNumberingMode = "continue" | "restart";

export interface ExamSection {
  id: string;
  title: string;
  description?: string;
  marks?: number | null;
  numberingMode: SectionNumberingMode;
  startNumber?: number;
  questionType?: QuestionTypePreset;
}

export interface NumberingSettings {
  continueAcrossSections: boolean;
}

export interface ExamMetadata {
  instituteName: string;
  examTitle: string;
  subject: string;
  standard: string;
  academicYear: string;
  date: string;
  timeAllowed: string;
  totalMarks: number | null;
  logo?: LogoSettings;
  instructions: string[];
  numbering: NumberingSettings;
  sections: ExamSection[];
}

export const DEFAULT_EXAM_METADATA: ExamMetadata = {
  instituteName: "ABC International School",
  examTitle: "Unit Test Examination",
  subject: "General",
  standard: "Std 10",
  academicYear: "2026-27",
  date: new Date().toLocaleDateString("en-GB"),
  timeAllowed: "2 Hours",
  totalMarks: 50,
  logo: undefined,
  instructions: [
    "1. All questions are compulsory.",
    "2. Figures to the right indicate full marks.",
  ],
  numbering: {
    continueAcrossSections: true,
  },
  sections: [
    {
      id: "sec-1",
      title: "SECTION A — MULTIPLE CHOICE QUESTIONS",
      description: "Choose the correct option for each question.",
      marks: 20,
      numberingMode: "continue",
      questionType: "mcq",
    },
    {
      id: "sec-2",
      title: "SECTION B — SHORT ANSWER QUESTIONS",
      description: "Answer the following questions briefly.",
      marks: 30,
      numberingMode: "continue",
      questionType: "short",
    },
  ],
};
