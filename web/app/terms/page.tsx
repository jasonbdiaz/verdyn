import type { Metadata } from "next";
import { LegalLayout, Section, P, UL } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Verdyn",
  description:
    "The terms for using Verdyn, an independent smart-scheduling service for Orbit® B-hyve® controllers: what the service does, the unofficial-API disclaimer, subscription and cancellation terms, and liability.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Terms of Service" updated="June 14, 2026">
      <P>
        These terms govern your use of Verdyn. By connecting your controller and
        using the service, you agree to them. Please read the disclaimers about
        the unofficial B-hyve® interface and watering responsibility — they matter.
      </P>

      <Section id="what" title="What Verdyn is">
        <P>
          Verdyn is an independent software service that builds smart watering
          schedules and writes them to the Orbit® B-hyve® controller you already
          own. Verdyn does not sell or provide hardware and does not replace your
          controller — it adds an intelligence layer on top of it.
        </P>
      </Section>

      <Section id="independent" title="Independent product — not affiliated with Orbit">
        <P>
          Verdyn is an independent product and is <strong>not affiliated with,
          endorsed by, or sponsored by Orbit Irrigation Products, LLC</strong>.
          B-hyve® is a registered trademark of Orbit. We reference these names only
          to describe compatibility (nominative fair use).
        </P>
      </Section>

      <Section id="unofficial" title="Unofficial interface — service may change or break">
        <P>
          Verdyn communicates with B-hyve through an <strong>unofficial interface
          that Orbit does not publish or support</strong>. Orbit can change or
          disable it at any time, which may interrupt or break Verdyn&apos;s ability
          to read zones or send schedules — sometimes without notice. We design
          Verdyn defensively (every controller call is wrapped and failures are
          surfaced, not hidden), but we cannot guarantee uninterrupted operation.
          You use the service on this understanding.
        </P>
      </Section>

      <Section id="responsibility" title="Watering is your responsibility">
        <P>
          Verdyn aims to follow sound agronomy and your area&apos;s watering rules,
          but you remain responsible for your lawn, your water use, and compliance
          with all local restrictions and ordinances. Verdyn is provided as
          guidance and automation — verify that scheduled watering is appropriate
          and lawful for your property. We are not liable for over- or
          under-watering, plant loss, water bills, or fines.
        </P>
      </Section>

      <Section id="account" title="Your account & credentials">
        <P>
          You must own or be authorized to control the B-hyve account and devices
          you connect. Your B-hyve password is used once to mint a session token
          and is never stored — see the <a href="/privacy" className="text-green underline underline-offset-2">Privacy Policy</a>.
          Keep your credentials confidential.
        </P>
      </Section>

      <Section id="subscription" title="Subscription & billing">
        <UL>
          <li>Verdyn is open source. Hosted accounts are currently free; any managed-service arrangement is agreed directly and individually — there is no in-app billing.</li>
          <li>Subscriptions renew automatically until canceled.</li>
          <li>Except where required by law, payments already made are non-refundable; canceling stops future charges.</li>
        </UL>
      </Section>

      <Section id="cancellation" title="Cancellation — what happens to access">
        <P>When you cancel, Verdyn does the following, by design:</P>
        <UL>
          <li><strong>Stops all zones</strong> on your connected controllers (best-effort, immediately).</li>
          <li><strong>Turns off access</strong> and <strong>revokes your session token</strong>, so Verdyn can no longer program your controller.</li>
          <li>Stops further billing.</li>
        </UL>
        <P>
          After cancellation, your controller keeps whatever schedule was last on
          the device unless you change it in the B-hyve app — Verdyn simply stops
          managing it. You can reactivate later, which requires reconnecting your
          account because the token was revoked. If a stop command can&apos;t reach a
          controller (e.g., it&apos;s offline), we&apos;ll tell you so you can verify in
          the B-hyve app.
        </P>
      </Section>

      <Section id="acceptable" title="Acceptable use">
        <UL>
          <li>Don&apos;t use Verdyn to access accounts or devices you aren&apos;t authorized to control.</li>
          <li>Don&apos;t attempt to disrupt, reverse-engineer, or overload the service.</li>
          <li>Don&apos;t use Verdyn in violation of any applicable water restriction or law.</li>
        </UL>
      </Section>

      <Section id="warranty" title="Disclaimer of warranties">
        <P>
          Verdyn is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without
          warranties of any kind, express or implied, including merchantability,
          fitness for a particular purpose, and non-infringement. We do not warrant
          that the service will be uninterrupted, error-free, or always able to
          reach your controller.
        </P>
      </Section>

      <Section id="liability" title="Limitation of liability">
        <P>
          To the maximum extent permitted by law, Verdyn and its operators will not
          be liable for any indirect, incidental, special, or consequential damages,
          or for water bills, fines, or plant/property loss arising from use of the
          service. Our total liability for any claim is limited to the amount you
          paid for Verdyn in the 12 months before the claim.
        </P>
      </Section>

      <Section id="changes" title="Changes & contact">
        <P>
          We may update these terms as the product evolves; continued use after an
          update means you accept the revised terms. Questions: support@verdyn.com.
        </P>
      </Section>
    </LegalLayout>
  );
}
