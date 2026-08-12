"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  ClassicEditor, Essentials, Paragraph, Bold, Italic, Underline, List, Link, Undo,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

export default function RichTextEditorInner({
  value, onChange, placeholder,
}: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  return (
    <div className="rte-wrap">
      <CKEditor
        editor={ClassicEditor}
        data={value}
        config={{
          licenseKey: "GPL",
          plugins: [Essentials, Paragraph, Bold, Italic, Underline, List, Link, Undo],
          toolbar: ["undo", "redo", "|", "bold", "italic", "underline", "|", "bulletedList", "numberedList", "|", "link"],
          placeholder,
        }}
        onChange={(_, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
