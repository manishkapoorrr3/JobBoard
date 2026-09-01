export const metadata = { title: 'Terms of Use | NCR Walk-in' };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Terms of Use</h1>
      <p className="text-sm text-slate-500">Last updated: August 2026</p>

      <div className="space-y-4 text-sm text-slate-700">
        <p>By using NCR Walk-in, you agree to these terms. NCR Walk-in is a platform for posting and finding BPO walk-in interviews in Delhi NCR.</p>

        <h2 className="text-lg font-semibold text-slate-900">For recruiters</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>You must provide accurate company and walk-in details. Fake or misleading listings will be removed.</li>
          <li>Paid walk-in listings are visible for 7 days from the date of payment. Renewals extend this by another 7 days.</li>
          <li>Payments are non-refundable once the listing is live.</li>
          <li>You are responsible for the WhatsApp number and contact details you post. Candidates will contact you directly.</li>
          <li>We reserve the right to remove any listing that receives multiple reports or violates these terms.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-900">For job seekers</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>NCR Walk-in is a listing platform. We do not guarantee employment or verify every listing.</li>
          <li>You apply directly via WhatsApp or phone — NCR Walk-in is not involved in the hiring process.</li>
          <li>Do not pay any money to anyone claiming to be from NCR Walk-in. We never charge candidates.</li>
          <li>Report any suspicious or fake listing using the Report button.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-900">Limitation of liability</h2>
        <p>NCR Walk-in is not responsible for the accuracy of listings posted by recruiters. We provide the platform and rely on community reporting to maintain quality. We are not liable for any loss arising from interactions between recruiters and candidates.</p>

        <h2 className="text-lg font-semibold text-slate-900">Changes</h2>
        <p>We may update these terms from time to time. Continued use after changes means you accept the updated terms.</p>
      </div>
    </div>
  );
}
