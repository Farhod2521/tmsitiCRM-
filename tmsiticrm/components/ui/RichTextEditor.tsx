"use client";

import dynamic from "next/dynamic";

const CKEditorInner = dynamic(() => import("./RichTextEditorInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full flex items-center justify-center py-10" style={{ background: "#F4F9FD", borderRadius: 12 }}>
      <span className="text-xs font-bold" style={{ color: "#91929E" }}>Muharrir yuklanmoqda...</span>
    </div>
  ),
});

export default function RichTextEditor(props: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  return <CKEditorInner {...props} />;
}
