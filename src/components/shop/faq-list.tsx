import { ChevronDown } from "lucide-react";
import { JsonLd } from "./json-ld";

export function FaqList({ faqs, withSchema = false }: { faqs: { id: string; question: string; answer: string }[]; withSchema?: boolean }) {
  if (!faqs.length) return null;
  return (
    <>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
        {faqs.map((f) => (
          <details key={f.id} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-semibold text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
              <span>{f.question}</span>
              <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-ink-soft sm:px-5">{f.answer}</p>
          </details>
        ))}
      </div>
      {withSchema ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
          }}
        />
      ) : null}
    </>
  );
}
