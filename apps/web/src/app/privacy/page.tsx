import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/marketing/LegalShell";

export const metadata: Metadata = {
  title: "privacy policy",
  description:
    "How DITCH collects, uses and protects your data as the browser multistream studio.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated="june 12, 2026">
      <LegalSection number="01" title="who we are">
        <p>
          DITCH is a live streaming service operated from Rome, Italy. For
          the purposes of the GDPR, DITCH is the data controller for the
          personal data described in this policy. Contact:
          sendmailtodex@gmail.com
        </p>
      </LegalSection>

      <LegalSection number="02" title="data we collect">
        <p>
          Account data: email address, username and channel name, collected
          when you sign up.
        </p>
        <p>
          Platform connections: authorization tokens and stream keys for the
          platforms you connect. These are stored server-side and are never
          exposed to the browser.
        </p>
        <p>
          Streaming data: session metadata such as start and end times,
          configured destinations, participant requests, and chat messages
          sent through DITCH.
        </p>
        <p>
          Audio and video: when you broadcast, or join a stream as a
          participant, your camera, microphone and screen content are
          processed in real time to deliver the broadcast. DITCH does not
          keep recordings of your stream unless a recording feature is
          explicitly offered and enabled by you.
        </p>
        <p>
          Technical data: logs, IP addresses and basic device information
          needed to run and secure the service.
        </p>
      </LegalSection>

      <LegalSection number="03" title="how we use data">
        <p>
          We use this data to operate the service: authenticate you, deliver
          your broadcast to the destinations you choose, show unified chat,
          run the participant queue, prevent abuse, and improve reliability.
          We do not sell personal data and we do not use it for third-party
          advertising.
        </p>
      </LegalSection>

      <LegalSection number="04" title="legal bases">
        <p>
          We process data to perform our contract with you (running the
          service), for legitimate interests (security, abuse prevention,
          service improvement), and on the basis of consent where required,
          for example when you connect a platform account. You can withdraw
          consent at any time by disconnecting the platform or deleting your
          account.
        </p>
      </LegalSection>

      <LegalSection number="05" title="processors and recipients">
        <p>
          We use a small set of infrastructure providers to run DITCH:
          Supabase (database and authentication), Vercel (web hosting),
          Railway (api and streaming relay), and Agora (real-time audio and
          video). Each processes data on our behalf under their own data
          processing terms.
        </p>
        <p>
          The platforms you broadcast to (for example Twitch, YouTube,
          TikTok, Kick) receive your stream and handle it under their own
          privacy policies, as separate controllers.
        </p>
      </LegalSection>

      <LegalSection number="06" title="international transfers">
        <p>
          Some providers process data outside the European Economic Area.
          Where they do, transfers rely on safeguards such as the European
          Commission&apos;s standard contractual clauses or an adequacy
          decision.
        </p>
      </LegalSection>

      <LegalSection number="07" title="retention">
        <p>
          We keep account data while your account exists. Session metadata
          and chat messages are kept while needed to provide the service and
          then deleted or anonymized. Logs are kept for a short rolling
          window for security and debugging. When you delete your account we
          delete the personal data associated with it, except what we must
          keep to meet legal obligations.
        </p>
      </LegalSection>

      <LegalSection number="08" title="your rights">
        <p>
          Under the GDPR you can request access, correction, deletion,
          portability and restriction of your personal data, and you can
          object to certain processing. Write to sendmailtodex@gmail.com and we
          will respond within the statutory deadline. You also have the right
          to complain to your supervisory authority; in Italy that is the
          Garante per la protezione dei dati personali.
        </p>
      </LegalSection>

      <LegalSection number="09" title="cookies">
        <p>
          DITCH uses only the cookies required to keep you signed in. There
          are no advertising trackers on this site.
        </p>
      </LegalSection>

      <LegalSection number="10" title="children">
        <p>
          DITCH is not directed at children. You must be at least 16 years
          old, or the minimum age of digital consent in your country, to use
          the service.
        </p>
      </LegalSection>

      <LegalSection number="11" title="changes">
        <p>
          We may update this policy as the service evolves. If a change is
          material we will give notice before it takes effect. The date at
          the top of this page always reflects the latest version.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
