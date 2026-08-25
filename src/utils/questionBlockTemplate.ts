import type { JSONContent } from "@tiptap/core";

export const QUESTION_BLOCK_TEMPLATE: JSONContent[] = [
  {
    type: "questionBlock",
    content: [
      {
        type: "questionText",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Question text here" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "A" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option A" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "B" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option B" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "C" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option C" }],
          },
        ],
      },
      {
        type: "questionOption",
        attrs: { label: "D" },
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Option D" }],
          },
        ],
      },
      {
        type: "questionFooter",
        content: [
          {
            type: "questionAnswer",
            content: [{ type: "paragraph" }],
          },
          {
            type: "questionMarks",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "1" }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: "paragraph",
  },
];

export const QUESTION_PLACEHOLDER = "Question text here";
