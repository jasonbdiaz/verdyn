import type { Metadata } from "next";
import { LegalLayout, Section, P, UL } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Verdyn",
  description:
    "How Verdyn handles your data: your B-hyve® password is used once to mint a session token and is never stored, logged, or shared. What we keep, where it lives, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Privacy Policy" updated="June 14, 2026">
      <P>
        This policy explains, in plain English, what data Verdyn collects, how we
        use it, and the choices you have. The short version: we ask for the
        minimum we need to water your lawn intelligently, we never store your
        B-hyve® password, and you can delete everything at any time.
      </P>

      <Section id="credentials" title="Your B-hyve® password is never stored">
        <P>
          To control your sprinklers, Verdyn signs in to your Orbit® account the
          same way the official B-hyve app does. We take this seriously:
        </P>
        <UL>
          <li>Your password is sent over an encrypted connection and used <strong>exactly once</strong> — to exchange it for a session token from Orbit.</li>
          <li>It is <strong>never written to disk, never logged, and never shared</strong>. The moment the token is issued, the password is discarded from memory.</li>
          <li>On the web, the resulting session token is sealed with <strong>AES-256-GCM authenticated encryption</strong> and stored only in a secure, httpOnly cookie your browser sends back to us — it is not readable by JavaScript and not exposed to third parties.</li>
          <li>On iOS, the token stays in the app&apos;s memory for the session and is never persisted to the device.</li>
          <li>You can revoke the token at any time by disconnecting or canceling — see &ldquo;Your choices&rdquo; below.</li>
        </UL>
      </Section>

      <Section id="collect" title="What we collect">
        <UL>
          <li><strong>Lawn profile:</strong> your ZIP code, soil type, grass type, sun/slope and sprinkler details per zone, and whether your lawn is newly sodded. This is what powers the schedule.</li>
          <li><strong>Controller data:</strong> the zones and device names Verdyn reads from your B-hyve account so it can write schedules back to it.</li>
          <li><strong>Session token:</strong> the encrypted Orbit access token described above. Not your password.</li>
          <li><strong>Operational data:</strong> basic, short-lived technical logs (e.g., error counts and rate-limit counters) used to keep the service reliable and secure. We do not sell this or use it for advertising.</li>
        </UL>
        <P>
          We do <strong>not</strong> collect your B-hyve password, payment-card numbers
          (handled by our payment processor, not stored by us), or precise location
          beyond the ZIP code you provide.
        </P>
      </Section>

      <Section id="use" title="How we use it">
        <UL>
          <li>To build your daily watering plan from agronomy, local weather, and your area&apos;s watering rules.</li>
          <li>To read your zones and write the resulting schedule to your B-hyve controller.</li>
          <li>To keep the service secure (rate limiting, abuse prevention) and to fix problems.</li>
        </UL>
        <P>We do not sell your personal data, and we do not use it for third-party advertising.</P>
      </Section>

      <Section id="weather" title="Third parties we rely on">
        <UL>
          <li><strong>Orbit / B-hyve:</strong> to read your zones and send watering commands. Verdyn is an independent product and uses an unofficial interface, which Orbit may change at any time.</li>
          <li><strong>Open-Meteo:</strong> weather and evapotranspiration data, looked up by ZIP. No personal account data is sent.</li>
          <li><strong>Hosting &amp; payments:</strong> our infrastructure and payment processors handle delivery and billing under their own terms.</li>
        </UL>
      </Section>

      <Section id="retention" title="Retention &amp; storage">
        <P>
          Your lawn profile is kept while your subscription is active so Verdyn can
          keep watering. On iOS, your profile is stored on your device. Encrypted
          session tokens expire and are re-minted; operational logs are short-lived.
          When you delete your data, we remove your profile and revoke any active token.
        </P>
      </Section>

      <Section id="choices" title="Your choices">
        <UL>
          <li><strong>Disconnect</strong> at any time from the dashboard — this immediately revokes the stored session token.</li>
          <li><strong>Cancel</strong> your subscription — Verdyn stops all zones, turns off access, and revokes the token. See the Terms for details.</li>
          <li><strong>Delete my data</strong> — removes your stored profile. On iOS, deleting the app removes the profile from your device.</li>
        </UL>
      </Section>

      <Section id="security" title="Security">
        <P>
          Connections are encrypted in transit (HTTPS/HSTS). Session tokens are
          sealed with authenticated encryption at rest. We apply a strict
          Content-Security-Policy, per-IP rate limiting, and server-side input
          validation. No system is perfectly secure, but we design Verdyn so that
          the most sensitive secret — your password — is never something we hold.
        </P>
      </Section>

      <Section id="children" title="Children">
        <P>Verdyn is intended for adults managing their own irrigation and is not directed to children under 13.</P>
      </Section>

      <Section id="changes" title="Changes & contact">
        <P>
          We may update this policy as the product evolves; we&apos;ll revise the
          &ldquo;last updated&rdquo; date above. Questions or data requests:
          contact us at privacy@verdyn.com.
        </P>
      </Section>
    </LegalLayout>
  );
}
