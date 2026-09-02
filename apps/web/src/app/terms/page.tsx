import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "terms of service",
  description:
    "The terms that govern your use of DITCH, the browser multistream studio.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of service" updated="September 3, 2026">
      <LegalSection number="01" title="acceptance">
        <p>
          These terms govern your use of DITCH, a live streaming service
          operated from Rome, Italy. By creating an account or using the
          service you agree to these terms. If you do not agree, do not use
          the service.
        </p>
      </LegalSection>

      <LegalSection number="02" title="the service">
        <p>
          DITCH lets creators broadcast live video from the browser to
          third-party platforms such as Twitch, YouTube, TikTok and Kick at
          the same time, and lets viewers join a creator&apos;s stream as
          on-screen participants.
        </p>
        <p>
          DITCH is currently in public beta. Features may change, break or be
          removed, and the service may be interrupted without notice. The
          service is free during the beta; we will announce pricing before
          introducing paid plans.
        </p>
      </LegalSection>

      <LegalSection number="03" title="accounts">
        <p>
          You must provide accurate information when creating an account and
          keep your credentials secure. You are responsible for activity that
          happens under your account. You must be at least 16 years old, or
          the minimum age of digital consent in your country, to use DITCH.
        </p>
      </LegalSection>

      <LegalSection number="04" title="your content">
        <p>
          You keep ownership of everything you broadcast through DITCH. To
          operate the service, you grant us a worldwide, non-exclusive
          license to receive, process, relay and transmit your content to the
          destinations you configure, for as long as you use the service.
        </p>
        <p>
          You are responsible for the content you broadcast, including music,
          third-party material and the conduct of guests you bring on stream.
        </p>
      </LegalSection>

      <LegalSection number="05" title="participants on stream">
        <p>
          When a viewer asks to join a stream and is cued in by the creator,
          their camera, microphone and screen content become part of the
          broadcast and are transmitted to every configured destination. By
          requesting to join, participants consent to this. Creators are
          responsible for the participants they bring on screen.
        </p>
      </LegalSection>

      <LegalSection number="06" title="third-party platforms">
        <p>
          Twitch, YouTube, TikTok, Kick and other destinations are
          independent services with their own terms and policies. You are
          responsible for complying with them, including any exclusivity
          terms in agreements you have signed. DITCH is not affiliated with
          or endorsed by any of these platforms.
        </p>
      </LegalSection>

      <LegalSection number="07" title="acceptable use">
        <p>
          Do not use DITCH to broadcast content that is illegal, infringes
          the rights of others, or violates the policies of the platforms you
          stream to. Do not attempt to disrupt the service, access other
          users&apos; accounts or credentials, or use the service to send
          spam or malware. We may suspend or terminate accounts that violate
          these rules.
        </p>
      </LegalSection>

      <LegalSection number="08" title="stream credentials">
        <p>
          Stream keys and platform tokens you connect are stored server-side
          and used only to deliver your broadcast. Keep your own copies of
          credentials safe and revoke them on the relevant platform if you
          believe they are compromised.
        </p>
      </LegalSection>

      <LegalSection number="09" title="disclaimers">
        <p>
          The service is provided as is and as available, without warranties
          of any kind, to the extent permitted by law. We do not guarantee
          uninterrupted operation, delivery to any particular platform, or
          that the service will meet your requirements.
        </p>
      </LegalSection>

      <LegalSection number="10" title="limitation of liability">
        <p>
          To the maximum extent permitted by law, DITCH is not liable for
          indirect, incidental or consequential damages, lost profits, or
          lost data arising from your use of the service. Nothing in these
          terms limits liability that cannot be limited under applicable law.
        </p>
      </LegalSection>

      <LegalSection number="11" title="termination">
        <p>
          You can stop using DITCH and delete your account at any time. We
          may suspend or terminate accounts that violate these terms or
          create risk for the service or other users. Sections that by their
          nature should survive termination do survive it.
        </p>
      </LegalSection>

      <LegalSection number="12" title="changes">
        <p>
          We may update these terms as the service evolves. If a change is
          material we will give notice, for example by email or in the app,
          before it takes effect. Continuing to use the service after a
          change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection number="13" title="governing law">
        <p>
          These terms are governed by Italian law. Disputes are subject to
          the jurisdiction of the courts of Rome, Italy, without prejudice to
          mandatory consumer protections in your country of residence.
        </p>
      </LegalSection>

      <LegalSection number="14" title="contact">
        <p>
          Questions about these terms: hello@ditchlive.app
        </p>
      </LegalSection>
    </LegalShell>
  );
}
