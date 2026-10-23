import { reopenCookieSettings } from "./consent"
import { SITE } from "./siteConfig"
import { usePageMeta } from "./usePageMeta"

// NOTE: these are a good-faith starting template written from how MergeSpace works.
// They are not legal advice. Have them reviewed before you rely on them.

function LegalLayout({ page, title, children }) {
  usePageMeta(page)
  return <main className="site-page">
    <header className="site-header">
      <a className="site-brand" href="/"><span className="brand-mark">M</span>MergeSpace</a>
      <a className="site-link" href="/">← Back to home</a>
    </header>
    <article className="legal">
      <p className="site-kicker">LEGAL</p>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated {SITE.legalUpdated}</p>
      {children}
    </article>
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} MergeSpace</span>
      <nav aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><button type="button" onClick={reopenCookieSettings}>Cookie settings</button><a href={`mailto:${SITE.contactEmail}`}>Contact</a></nav>
    </footer>
  </main>
}

const Contact = () => <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>

export function PrivacyPage() {
  return <LegalLayout page="privacy" title="Privacy Policy">
    <p>This policy explains what MergeSpace collects when you use the site and app at {SITE.url}, why we collect it, and the choices you have. “We” means the MergeSpace team.</p>

    <h2>1. What we collect</h2>
    <ul>
      <li><strong>Account details:</strong> your name and email address. If you sign in with Google or GitHub, we receive the name and email your provider shares. Passwords are handled by our authentication provider and are not readable by us.</li>
      <li><strong>Workspace content:</strong> workspace names, files you and your teammates create, member roles and invitations.</li>
      <li><strong>Live collaboration data:</strong> your name, cursor position and typing activity, which other members of the same workspace see in real time. Messages you send in a workspace chat, where that feature is available, are stored with the workspace.</li>
      <li><strong>Technical data:</strong> your IP address, browser type and request details, which our hosting provider records in server logs for security and reliability.</li>
      <li><strong>Browser storage:</strong> a sign-in session and your cookie choice (see section 5).</li>
    </ul>

    <h2>2. How we use it</h2>
    <p>To provide the service (sign you in, store your workspaces, sync edits between collaborators), to send sign-in codes and invitations, to keep MergeSpace secure and prevent abuse, and, only if you accept, to understand how the site is used so we can improve it. We do not sell your personal information and we do not show ads.</p>

    <h2>3. Who we share it with</h2>
    <ul>
      <li><strong>Other workspace members:</strong> people you invite can see your name, your edits and the files in that workspace.</li>
      <li><strong>Service providers:</strong> InsForge provides our database, authentication and hosting. Google and GitHub are involved only if you choose to sign in with them. Google Fonts delivers the typefaces used on the site, which means your IP address is sent to Google when a page loads.</li>
      <li><strong>Analytics:</strong> if analytics is enabled and you accept it, anonymous usage statistics go to our analytics provider.</li>
      <li><strong>Legal reasons:</strong> if the law requires it or to protect our users and service.</li>
    </ul>

    <h2>4. How long we keep it</h2>
    <p>We keep your account and workspace data while your account is active. Deleting a workspace removes its files. To close your account or have data removed, email us and we will act on the request within a reasonable time. Some data may remain in backups for a short period.</p>

    <h2>5. Cookies and local storage</h2>
    <p><strong>Essential:</strong> a sign-in session so you stay logged in, and a record of your cookie choice. These are needed for the site to work. <strong>Analytics:</strong> only loaded if you click “Accept analytics”. You can change your mind at any time with “Cookie settings” in the footer.</p>

    <h2>6. Security</h2>
    <p>Traffic is encrypted with HTTPS and workspace access is limited to the members of each workspace. No online service is perfectly secure, so please use a strong, unique password.</p>

    <h2>7. Your rights</h2>
    <p>Depending on where you live, you may have the right to access, correct, export or delete your personal data, and to withdraw consent. Email <Contact /> and we will help.</p>

    <h2>8. Children</h2>
    <p>MergeSpace is not directed at children under 13, and we do not knowingly collect their information.</p>

    <h2>9. Changes</h2>
    <p>If we change this policy we will update the date above and, for significant changes, tell you in the app or by email.</p>

    <h2>10. Contact</h2>
    <p>Questions about privacy: <Contact />.</p>
  </LegalLayout>
}

export function TermsPage() {
  return <LegalLayout page="terms" title="Terms and Conditions">
    <p>These terms apply when you use MergeSpace at {SITE.url}. By creating an account or using the service you agree to them. If you do not agree, please do not use MergeSpace.</p>

    <h2>1. The service</h2>
    <p>MergeSpace is a collaborative code editor where teams edit HTML, CSS and JavaScript files together and preview the result. The service is actively developed, features may change, and some may be marked “coming soon”.</p>

    <h2>2. Your account</h2>
    <p>Give us accurate information and keep your login secure. You are responsible for activity under your account. Tell us promptly if you think it has been compromised.</p>

    <h2>3. Workspaces and roles</h2>
    <p>The person who creates a workspace is its owner. Owners invite and remove members, change roles and manage files. Editors can edit file contents within the workspace. Owners decide who may join and what they may do.</p>

    <h2>4. Your content</h2>
    <p>You keep ownership of the code and other content you add. You give us permission to store, process and display it as needed to run the service, including showing it to the members of your workspace. You are responsible for your content and for having the right to use it.</p>

    <h2>5. Acceptable use</h2>
    <p>Do not use MergeSpace to break the law, store or distribute malware, harass others, infringe someone’s rights, try to access workspaces you were not invited to, probe or disrupt the service, run automated sign-ups, or overload our systems.</p>

    <h2>6. Third-party services</h2>
    <p>MergeSpace relies on third-party services such as InsForge, and optional sign-in with Google or GitHub. Their own terms and privacy policies apply to your use of them.</p>

    <h2>7. Availability</h2>
    <p>We work to keep MergeSpace running but do not promise uninterrupted or error-free service. Please keep your own copy of anything important.</p>

    <h2>8. Ending your use</h2>
    <p>You can stop using MergeSpace at any time. We may suspend or end access if these terms are broken or to protect the service and its users.</p>

    <h2>9. Disclaimers and liability</h2>
    <p>MergeSpace is provided “as is” and “as available”, without warranties of any kind to the extent the law allows. To the extent the law allows, we are not liable for indirect or consequential losses, or for loss of data, profits or business arising from use of the service.</p>

    {SITE.governingLaw && <><h2>10. Governing law</h2><p>These terms are governed by {SITE.governingLaw}.</p></>}

    <h2>{SITE.governingLaw ? "11" : "10"}. Changes</h2>
    <p>We may update these terms. If we make a significant change we will tell you, and continuing to use MergeSpace afterwards means you accept the updated terms.</p>

    <h2>{SITE.governingLaw ? "12" : "11"}. Contact</h2>
    <p>Questions about these terms: <Contact />.</p>
  </LegalLayout>
}
