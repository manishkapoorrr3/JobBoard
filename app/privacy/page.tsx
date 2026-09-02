export const metadata = { title: 'Privacy Policy | NCR Walk-in' };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
      <p className="text-sm text-slate-500">Last updated: August 2026</p>

      <div className="space-y-4 text-sm text-slate-700">
        <p>NCR Walk-in is a job board for BPO walk-in interviews in Delhi NCR. This policy explains what data we collect and how we use it, in line with the Digital Personal Data Protection (DPDP) Act, 2023.</p>

        <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
        <ul className="list-inside list-disc space-y-1">
          <li><strong>Job seekers:</strong> Name, phone number (required), email (optional), password, profile details you choose to fill.</li>
          <li><strong>Recruiters:</strong> Name, email, password, and listing details (company, role, address, WhatsApp number).</li>
          <li><strong>Reports:</strong> Your user ID and the reason you selected when reporting a listing.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-900">How we use it</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>To show walk-in and job listings on the site.</li>
          <li>To let recruiters contact candidates via WhatsApp (using the number they posted).</li>
          <li>To let you save jobs and manage your own listings.</li>
          <li>To investigate reports of fake or misleading listings.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-900">What we do not do</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>We do not sell your data to anyone.</li>
          <li>We do not send marketing SMS or emails without your consent.</li>
          <li>We do not share your phone number with third parties beyond what is shown on listings you posted.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-900">Your rights</h2>
        <p>You can delete your account and all associated data at any time. Contact us at the email below and we will process your request within 7 days.</p>

        <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
        <p>For privacy questions, email privacy@ncrwalkin.example</p>
      </div>
    </div>
  );
}
