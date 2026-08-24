export interface PrintSettings {
  paperSize: "A4";
  orientation: "portrait" | "landscape";
  marginTop: number; // in mm
  marginRight: number; // in mm
  marginBottom: number; // in mm
  marginLeft: number; // in mm
  showPageNumbers: boolean;
}

export interface ExamHeaderData {
  instituteName?: string;
  examTitle?: string;
  subject?: string;
  standardClass?: string;
  date?: string;
  timeAllowed?: string;
  totalMarks?: string;
}

export interface PrintDocumentProps {
  content: any; // Tiptap JSON document
  title?: string;
  settings?: PrintSettings;
  headerData?: ExamHeaderData;
}
